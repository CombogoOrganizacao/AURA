import JSZip from "jszip";

import { lerCabecalhoImagem, TAMANHO_MAXIMO_IMAGEM, type DadosImagem } from "../../document/imagem";
import type { Documento, NoConteudo } from "../../document/types";
import { gerarBib } from "../../export/latex/bib";
import type { ImagemArmazenada } from "../../persistence/types";
import { importarBibtex, TAMANHO_MAXIMO_BIB } from "../../references/import/bibtexToCsl";
import type { Referencia } from "../../references/types";
import type { Aviso } from "./fonte";
import { decodificarUtf8, lerTex, TAMANHO_MAXIMO_TEX, type CodigoErro } from "./lerTex";
import { montarReimportacao, type Relatorio } from "./reimport";

// Reimportação do `.zip` do projeto LaTeX (passo 6.2.4, terceiro commit): o
// pacote que `gerarZipTex()` escreve, de volta, depois de passar pelo
// Overleaf. Regras em docs/latex-abntex.md §1.5, "Referências", "Figuras" e
// "Limites de segurança do `.zip`".
//
// **O arquivo vem de fora e é lido na memória da aba.** Tudo o que pode
// custar caro é conferido antes: o diretório central do `.zip` é lido aqui,
// sem biblioteca, para saber quantos arquivos há, quanto ocupam
// descompactados e com que nome, antes de descompactar qualquer um. Depois,
// cada arquivo é lido em fluxo, e a leitura para se passar do tamanho que o
// próprio `.zip` declarou (um `.zip` pode mentir no cabeçalho).

export const LIMITES_ZIP = {
  // Decisão da usuária em 30/09/2026 (to-do, 6.2.4).
  bytesDescompactados: 100 * 1024 * 1024,
  arquivos: 300,
} as const;

export type CodigoErroZip =
  | "zip-invalido"
  | "zip-grande-demais"
  | "zip-muitos-arquivos"
  | "zip-caminho-inseguro"
  | "zip-sem-main";

export interface ErroReimportacao {
  codigo: CodigoErro | CodigoErroZip;
  mensagem: string;
}

export interface FiguraDoZip {
  caminho: string;
  bytes: Uint8Array;
  dados: DadosImagem;
}

export interface ProjetoZip {
  main: string;
  // `sections/<nome>.tex` → conteúdo.
  secoes: Map<string, string>;
  bib: string | null;
  // `id` da imagem (o nome do arquivo em `figuras/`, sem a extensão) → arquivo.
  figuras: Map<string, FiguraDoZip>;
  // Caminhos que o AURA não lê, para o relatório listar.
  ignorados: string[];
  avisos: Aviso[];
}

type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: ErroReimportacao };

function falha<T>(codigo: ErroReimportacao["codigo"], mensagem: string): Resultado<T> {
  return { ok: false, erro: { codigo, mensagem } };
}

// --- Diretório central -------------------------------------------------------

interface EntradaDeclarada {
  nome: string;
  tamanho: number;
}

const FIM_DO_DIRETORIO = 0x06054b50;
const ENTRADA_DO_DIRETORIO = 0x02014b50;
// O que o ZIP64 põe no campo de 16 ou 32 bits quando o valor não cabe. Um
// projeto de TCC nunca chega lá; quem chega não é o que o AURA exporta.
const NAO_CABE_16 = 0xffff;
const NAO_CABE_32 = 0xffffffff;

// As entradas como o próprio `.zip` as declara, ou `null` se o arquivo não
// é um `.zip` legível. Formato: APPNOTE.TXT do PKWARE, §4.3.12 e §4.3.16.
function lerDiretorioCentral(bytes: Uint8Array): EntradaDeclarada[] | "zip64" | null {
  if (bytes.length < 22) return null;
  const dados = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fim = -1;
  // O registro final tem 22 bytes mais um comentário de até 64 KB.
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (dados.getUint32(i, true) === FIM_DO_DIRETORIO) {
      fim = i;
      break;
    }
  }
  if (fim < 0) return null;

  const total = dados.getUint16(fim + 10, true);
  const inicio = dados.getUint32(fim + 16, true);
  if (total === NAO_CABE_16 || inicio === NAO_CABE_32) return "zip64";

  const decodificador = new TextDecoder("utf-8");
  const entradas: EntradaDeclarada[] = [];
  let pos = inicio;
  for (let k = 0; k < total; k++) {
    if (pos + 46 > bytes.length || dados.getUint32(pos, true) !== ENTRADA_DO_DIRETORIO) return null;
    const tamanho = dados.getUint32(pos + 24, true);
    const tamanhoDoNome = dados.getUint16(pos + 28, true);
    const tamanhoExtra = dados.getUint16(pos + 30, true);
    const tamanhoComentario = dados.getUint16(pos + 32, true);
    if (tamanho === NAO_CABE_32) return "zip64";
    if (pos + 46 + tamanhoDoNome > bytes.length) return null;
    const nome = decodificador.decode(bytes.subarray(pos + 46, pos + 46 + tamanhoDoNome));
    entradas.push({ nome, tamanho });
    pos += 46 + tamanhoDoNome + tamanhoExtra + tamanhoComentario;
  }
  return entradas;
}

// *Zip slip*: nome que sai da pasta do projeto. O AURA não grava arquivo em
// disco, mas um `.zip` com um nome assim não saiu do AURA nem do Overleaf.
function caminhoInseguro(nome: string): boolean {
  return (
    nome.includes("\\") ||
    nome.startsWith("/") ||
    /^[a-zA-Z]:/.test(nome) ||
    nome.split("/").some((parte) => parte === "..")
  );
}

// --- Leitura em fluxo --------------------------------------------------------

// O fluxo interno do JSZip (`internalStream`), documentado na API
// (stuk.github.io/jszip, "ZipObject#internalStream") e ausente da tipagem.
interface FluxoInterno {
  on(evento: "data", ao: (parte: Uint8Array) => void): FluxoInterno;
  on(evento: "end", ao: () => void): FluxoInterno;
  on(evento: "error", ao: (erro: Error) => void): FluxoInterno;
  resume(): FluxoInterno;
  pause(): FluxoInterno;
}

// Os bytes do arquivo, ou `null` se passarem de `limite`: a leitura para ali,
// sem descompactar o resto.
function lerComLimite(objeto: JSZip.JSZipObject, limite: number): Promise<Uint8Array | null> {
  const fluxo = (
    objeto as unknown as { internalStream(tipo: "uint8array"): FluxoInterno }
  ).internalStream("uint8array");
  return new Promise((resolve, reject) => {
    const partes: Uint8Array[] = [];
    let total = 0;
    let parado = false;
    fluxo
      .on("data", (parte) => {
        if (parado) return;
        total += parte.length;
        if (total > limite) {
          parado = true;
          fluxo.pause();
          resolve(null);
          return;
        }
        partes.push(parte);
      })
      .on("error", (erro) => {
        if (parado) return;
        parado = true;
        reject(erro);
      })
      .on("end", () => {
        if (parado) return;
        const saida = new Uint8Array(total);
        let pos = 0;
        for (const parte of partes) {
          saida.set(parte, pos);
          pos += parte.length;
        }
        resolve(saida);
      })
      .resume();
  });
}

// --- Pacote ------------------------------------------------------------------

const FIGURA = /^figuras\/([^/]+)\.(png|jpe?g)$/i;
const CAPITULO = /^sections\/[^/]+\.tex$/;

export async function lerProjetoZip(bytes: Uint8Array): Promise<Resultado<ProjetoZip>> {
  const declaradas = lerDiretorioCentral(bytes);
  if (declaradas === null) return falha("zip-invalido", "O arquivo não é um .zip legível.");
  if (declaradas === "zip64") {
    return falha("zip-grande-demais", "O .zip é grande demais para ser o projeto de um TCC.");
  }
  if (declaradas.length > LIMITES_ZIP.arquivos) {
    return falha(
      "zip-muitos-arquivos",
      `O .zip tem ${declaradas.length} arquivos. O projeto exportado pelo AURA tem poucos; o limite é ${LIMITES_ZIP.arquivos}.`,
    );
  }
  const total = declaradas.reduce((soma, entrada) => soma + entrada.tamanho, 0);
  if (total > LIMITES_ZIP.bytesDescompactados) {
    return falha(
      "zip-grande-demais",
      "Descompactado, o .zip passa de 100 MB. Confira se é o projeto exportado pelo AURA.",
    );
  }
  const inseguro = declaradas.find((entrada) => caminhoInseguro(entrada.nome));
  if (inseguro) {
    return falha(
      "zip-caminho-inseguro",
      `O .zip tem um caminho que sai da pasta do projeto (${inseguro.nome}) e foi recusado.`,
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return falha("zip-invalido", "O arquivo não é um .zip legível.");
  }

  // Projeto compactado de novo à mão, dentro de uma pasta: a pasta vira a raiz.
  const nomes = declaradas.map((entrada) => entrada.nome);
  let raiz = "";
  if (!nomes.includes("main.tex")) {
    const candidatos = nomes.filter((nome) => /^[^/]+\/main\.tex$/.test(nome));
    if (candidatos.length !== 1) {
      return falha(
        "zip-sem-main",
        "O .zip não tem o main.tex do projeto. Reimporte o .zip exportado pelo AURA (ou baixado do Overleaf).",
      );
    }
    raiz = candidatos[0].slice(0, -"main.tex".length);
  }
  const declarado = new Map(declaradas.map((entrada) => [entrada.nome, entrada.tamanho]));

  const projeto: ProjetoZip = {
    main: "",
    secoes: new Map(),
    bib: null,
    figuras: new Map(),
    ignorados: [],
    avisos: [],
  };
  let bytesDeTexto = 0;

  for (const objeto of Object.values(zip.files)) {
    if (objeto.dir) continue;
    const nome = objeto.unsafeOriginalName ?? objeto.name;
    if (!nome.startsWith(raiz)) {
      projeto.ignorados.push(nome);
      continue;
    }
    const caminho = nome.slice(raiz.length);
    const tamanho = declarado.get(nome) ?? 0;
    const eTexto = caminho === "main.tex" || CAPITULO.test(caminho);
    const figura = FIGURA.exec(caminho);

    if (!eTexto && caminho !== "referencias.bib" && !figura) {
      projeto.ignorados.push(caminho);
      continue;
    }
    if (caminho === "referencias.bib" && tamanho > TAMANHO_MAXIMO_BIB) {
      projeto.avisos.push({
        arquivo: caminho,
        linha: 0,
        mensagem:
          "O referencias.bib passa de 2 MB e não foi lido: as referências ficam como estão.",
      });
      continue;
    }
    if (figura && tamanho > TAMANHO_MAXIMO_IMAGEM) {
      projeto.avisos.push({
        arquivo: caminho,
        linha: 0,
        mensagem: "A imagem passa de 5 MB e não foi lida: a figura fica com a imagem que já tinha.",
      });
      continue;
    }
    if (eTexto) {
      bytesDeTexto += tamanho;
      // UTF-8 tem no máximo 4 bytes por caractere.
      if (bytesDeTexto > TAMANHO_MAXIMO_TEX * 4) {
        return falha("grande-demais", "O texto do projeto é grande demais para um TCC.");
      }
    }

    let conteudo: Uint8Array | null;
    try {
      conteudo = await lerComLimite(objeto, tamanho);
    } catch {
      return falha(
        "zip-invalido",
        `Não foi possível descompactar ${caminho}: o .zip está corrompido.`,
      );
    }
    if (conteudo === null) {
      return falha(
        "zip-invalido",
        `${caminho} ocupa mais do que o .zip declara. O arquivo foi recusado.`,
      );
    }

    if (figura) {
      const dados = lerCabecalhoImagem(conteudo);
      if (!dados) {
        projeto.avisos.push({
          arquivo: caminho,
          linha: 0,
          mensagem: "A imagem não é um PNG ou JPEG legível e não foi lida.",
        });
        continue;
      }
      projeto.figuras.set(figura[1], { caminho, bytes: conteudo, dados });
      continue;
    }

    const texto = decodificarUtf8(conteudo);
    if (!texto.ok) return falha("nao-utf8", `${caminho}: ${texto.erro.mensagem}`);
    if (caminho === "main.tex") projeto.main = texto.texto;
    else if (caminho === "referencias.bib") projeto.bib = texto.texto;
    else projeto.secoes.set(caminho, texto.texto);
  }

  return { ok: true, valor: projeto };
}

// --- Referências -------------------------------------------------------------

export interface ConflitoDeReferencia {
  id: string;
  noAura: Referencia;
  noArquivo: Referencia;
}

// Igualdade de conteúdo, sem depender da ordem das chaves nem do `id`.
function estavel(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(estavel);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([chave, item]) => chave !== "id" && item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([chave, item]) => [chave, estavel(item)]),
    );
  }
  return valor;
}

// A referência do AURA como ela voltaria do `.bib` sem edição nenhuma: o
// `.bib` não carrega todos os campos (6.2.3), e o que ele não carrega não
// é diferença do arquivo.
function comoVoltaDoBib(referencia: Referencia): Referencia {
  const volta = importarBibtex(gerarBib([referencia]), () => referencia.id).importadas[0];
  return volta ? volta.referencia : referencia;
}

function referenciasDoBib(salvas: readonly Referencia[], bib: string, gerarId: () => string) {
  const resultado = importarBibtex(bib, gerarId);
  const novas: Referencia[] = [];
  const conflitos: ConflitoDeReferencia[] = [];
  const avisos: Aviso[] = [];
  const vistas = new Set<string>();

  for (const { chave, linha, referencia } of resultado.importadas) {
    if (vistas.has(chave)) {
      avisos.push({
        arquivo: "referencias.bib",
        linha,
        mensagem: `Chave ${chave} repetida: só a primeira entrada conta.`,
      });
      continue;
    }
    vistas.add(chave);
    // A chave é o `refId` do `\auracite` e do `\cite`: vira o `id`.
    const doArquivo: Referencia = { ...referencia, id: chave };
    const salva = salvas.find((item) => item.id === chave);
    if (!salva) novas.push(doArquivo);
    else if (
      JSON.stringify(estavel(comoVoltaDoBib(salva))) !== JSON.stringify(estavel(doArquivo))
    ) {
      conflitos.push({ id: chave, noAura: salva, noArquivo: doArquivo });
    }
  }
  for (const descartada of resultado.descartadas) {
    avisos.push({
      arquivo: "referencias.bib",
      linha: descartada.linha,
      mensagem: `A entrada ${descartada.chave} não entrou: ${descartada.motivo}`,
    });
  }
  for (const erro of resultado.erros) {
    avisos.push({ arquivo: "referencias.bib", linha: erro.linha, mensagem: erro.mensagem });
  }
  return { novas, conflitos, avisos };
}

// --- Montagem ----------------------------------------------------------------

export interface ImagemAtualizada {
  legenda: string;
  // O `id` novo: a imagem trocada nunca sobrescreve a antiga, para a versão
  // do histórico que aponta para ela continuar certa (`ImagemArmazenada`).
  imagem: string;
}

export interface RelatorioDoProjeto extends Relatorio {
  referencias: { novas: Referencia[]; conflitos: ConflitoDeReferencia[] };
  imagens: { atualizadas: ImagemAtualizada[]; novas: number };
  ignorados: string[];
}

export interface ReimportacaoDoProjeto {
  documento: Documento;
  relatorio: RelatorioDoProjeto;
  // Imagens a gravar antes do documento, já com o `documentoId` dele.
  imagens: ImagemArmazenada[];
}

function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function montarReimportacaoDoProjeto({
  atual,
  projeto,
  imagensSalvas,
  gerarId = () => crypto.randomUUID(),
}: {
  atual: Documento | null;
  projeto: ProjetoZip;
  // As imagens do documento de destino, pelo `id`, para comparar os bytes.
  imagensSalvas: ReadonlyMap<string, ImagemArmazenada>;
  gerarId?: () => string;
}): Resultado<ReimportacaoDoProjeto> {
  const salvas = atual?.references ?? [];
  const bib = projeto.bib
    ? referenciasDoBib(salvas, projeto.bib, gerarId)
    : { novas: [], conflitos: [], avisos: [] };
  const referencias = [...salvas, ...bib.novas];

  const lido = lerTex(projeto.main, {
    arquivo: "main.tex",
    lerArquivo: (caminho) => projeto.secoes.get(caminho) ?? null,
    chavesDeReferencia: new Set(referencias.map((referencia) => referencia.id)),
  });
  if (!lido.ok) return { ok: false, erro: lido.erro };
  const { documento: base, relatorio } = montarReimportacao(atual, lido.tex, {
    gerarId,
    referencias,
  });

  // Figuras: arquivo igual ao salvo, nada muda; diferente, ou imagem que o
  // AURA não tem, vira imagem nova, com `id` novo (a loja de imagens é por
  // `id`, e o do arquivo poderia ser o de outro trabalho).
  const imagens: ImagemArmazenada[] = [];
  const atualizadas: ImagemAtualizada[] = [];
  let novasImagens = 0;
  const trocas = new Map<string, string>();
  const usadas = new Set<string>();

  const trocarImagens = (content: NoConteudo[]): NoConteudo[] => {
    let mudou = false;
    const novo = content.map((no) => {
      if (no.type !== "figura" || !no.imagem) return no;
      const arquivo = projeto.figuras.get(no.imagem);
      if (!arquivo) return no;
      usadas.add(no.imagem);
      const salva = imagensSalvas.get(no.imagem);
      if (salva && iguais(salva.bytes, arquivo.bytes)) return no;
      let id = trocas.get(no.imagem);
      if (!id) {
        id = gerarId();
        trocas.set(no.imagem, id);
        imagens.push({ id, documentoId: base.id, ...arquivo.dados, bytes: arquivo.bytes });
        if (salva) atualizadas.push({ legenda: no.legenda, imagem: id });
        else novasImagens++;
      }
      mudou = true;
      return { ...no, imagem: id };
    });
    return mudou ? novo : content;
  };
  const documento: Documento = {
    ...base,
    sections: base.sections.map((secao) => {
      const content = trocarImagens(secao.content);
      return content === secao.content ? secao : { ...secao, content };
    }),
  };

  // Figura de apêndice e anexo não sai no `.tex` (`conteudoPosTextual()`),
  // mas a imagem dela vai no `.zip`: não é arquivo ignorado.
  for (const elemento of [...documento.apendices, ...documento.anexos]) {
    for (const no of elemento.content) if (no.type === "figura" && no.imagem) usadas.add(no.imagem);
  }
  const ignorados = [
    ...projeto.ignorados,
    ...[...projeto.figuras.entries()]
      .filter(([id]) => !usadas.has(id))
      .map(([, arquivo]) => arquivo.caminho),
  ];

  const relatorioDoProjeto: RelatorioDoProjeto = {
    ...relatorio,
    avisos: [...projeto.avisos, ...relatorio.avisos, ...bib.avisos],
    referencias: { novas: bib.novas, conflitos: bib.conflitos },
    imagens: { atualizadas, novas: novasImagens },
    ignorados,
    semMudancas:
      relatorio.semMudancas &&
      bib.novas.length === 0 &&
      bib.conflitos.length === 0 &&
      imagens.length === 0,
  };
  return { ok: true, valor: { documento, relatorio: relatorioDoProjeto, imagens } };
}

// As referências em conflito que o aluno escolheu trazer do arquivo, entrada
// por entrada; as outras ficam com a versão do AURA (§1.5).
export function comReferenciasEscolhidas(
  documento: Documento,
  conflitos: readonly ConflitoDeReferencia[],
  usarDoArquivo: ReadonlySet<string>,
): Documento {
  if (usarDoArquivo.size === 0) return documento;
  const doArquivo = new Map(
    conflitos
      .filter((conflito) => usarDoArquivo.has(conflito.id))
      .map((conflito) => [conflito.id, conflito.noArquivo]),
  );
  return {
    ...documento,
    references: documento.references.map(
      (referencia) => doArquivo.get(referencia.id) ?? referencia,
    ),
  };
}
