import JSZip from "jszip";

import { lerCabecalhoImagem, TAMANHO_MAXIMO_IMAGEM, type DadosImagem } from "../../document/imagem";
import type { Documento, NoConteudo } from "../../document/types";
import { gerarBib } from "../../export/latex/bib";
import type { ImagemArmazenada } from "../../persistence/types";
import { importarBibtex, TAMANHO_MAXIMO_BIB } from "../../references/import/bibtexToCsl";
import type { Referencia } from "../../references/types";
import type { Aviso } from "./fonte";
import { decodificarUtf8, lerTex, TAMANHO_MAXIMO_TEX, type CodigoErro } from "./lerTex";
import { montarReimportacao, type Relatorio, type ResolverImagem } from "./reimport";

// Importação do `.zip` de um projeto LaTeX: o pacote que `gerarZipTex()`
// escreve, de volta depois de passar pelo Overleaf (passo 6.2.4), e o projeto
// de um TCC que o aluno começou fora do AURA, com quaisquer nomes (6.2.5).
// Regras em docs/latex-abntex.md §1.5 ("Referências", "Figuras", "Limites de
// segurança do `.zip`") e §1.6.
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

// Os caminhos são a partir da pasta do arquivo principal, como na compilação.
export interface ProjetoZip {
  // O `.tex` principal (o que tem `\documentclass`) e o caminho dele.
  main: string;
  caminhoDoMain: string;
  // Os outros `.tex`, para o `\input` e o `\include`.
  arquivos: Map<string, string>;
  // Os `.bib` do pacote, juntos.
  bib: string | null;
  // As imagens PNG e JPEG.
  imagens: Map<string, FiguraDoZip>;
  // As do padrão do AURA, pelo `id` (o nome do arquivo em `figuras/`).
  figuras: Map<string, FiguraDoZip>;
  // Imagens que o AURA não aceita (PDF, EPS, SVG), para o aviso dizer o motivo.
  outrasImagens: Set<string>;
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

// Figura no padrão do AURA: o nome do arquivo é o `id` da imagem.
const FIGURA_DO_AURA = /^figuras\/([^/]+)\.(png|jpe?g)$/i;
const EXTENSOES_DE_IMAGEM = new Set(["png", "jpg", "jpeg"]);
// Imagens que um projeto LaTeX costuma ter e o AURA não aceita.
const OUTRAS_IMAGENS = new Set(["pdf", "eps", "svg"]);

function extensao(nome: string): string {
  return /\.([^./]+)$/.exec(nome)?.[1].toLowerCase() ?? "";
}

function pastaDe(nome: string): string {
  const barra = nome.lastIndexOf("/");
  return barra < 0 ? "" : nome.slice(0, barra + 1);
}

// `\documentclass` fora de comentário: é o arquivo principal.
const DOCUMENTCLASS = /^[^%\n]*\\documentclass/m;

// O arquivo principal: o `.tex` com `\documentclass`. Vários: o `main.tex`
// mais perto da raiz (o nome do AURA e o padrão do Overleaf).
function escolherPrincipal(textos: ReadonlyMap<string, string>): Resultado<string> {
  const candidatos = [...textos.entries()]
    .filter(([, texto]) => DOCUMENTCLASS.test(texto))
    .map(([nome]) => nome);
  if (candidatos.length === 0) {
    return falha(
      "zip-sem-main",
      "O .zip não tem o arquivo principal do projeto (o .tex com \\documentclass).",
    );
  }
  if (candidatos.length === 1) return { ok: true, valor: candidatos[0] };
  const mains = candidatos
    .filter((nome) => /(^|\/)main\.tex$/.test(nome))
    .sort((a, b) => a.split("/").length - b.split("/").length);
  if (
    mains.length > 0 &&
    (mains.length === 1 || mains[0].split("/").length < mains[1].split("/").length)
  ) {
    return { ok: true, valor: mains[0] };
  }
  return falha(
    "zip-sem-main",
    `O .zip tem mais de um arquivo principal (${candidatos.join(", ")}). Deixe só um, ou chame o principal de main.tex.`,
  );
}

export async function lerProjetoZip(bytes: Uint8Array): Promise<Resultado<ProjetoZip>> {
  const declaradas = lerDiretorioCentral(bytes);
  if (declaradas === null) return falha("zip-invalido", "O arquivo não é um .zip legível.");
  if (declaradas === "zip64") {
    return falha("zip-grande-demais", "O .zip é grande demais para ser o projeto de um TCC.");
  }
  if (declaradas.length > LIMITES_ZIP.arquivos) {
    return falha(
      "zip-muitos-arquivos",
      `O .zip tem ${declaradas.length} arquivos, e o limite é ${LIMITES_ZIP.arquivos}. Deixe no pacote só o projeto do trabalho.`,
    );
  }
  const total = declaradas.reduce((soma, entrada) => soma + entrada.tamanho, 0);
  if (total > LIMITES_ZIP.bytesDescompactados) {
    return falha(
      "zip-grande-demais",
      "Descompactado, o .zip passa de 100 MB. Deixe no pacote só o projeto do trabalho.",
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
  const declarado = new Map(declaradas.map((entrada) => [entrada.nome, entrada.tamanho]));

  // Tudo o que pode ser do trabalho é lido: os `.tex` (qual é o principal e
  // o que ele inclui só se sabe lendo), os `.bib` e as imagens.
  const textos = new Map<string, string>();
  const bibs: string[] = [];
  const imagens = new Map<string, FiguraDoZip>();
  const outrasImagens = new Set<string>();
  const ignorados: string[] = [];
  const avisos: Aviso[] = [];
  let bytesDeTexto = 0;
  let bytesDeBib = 0;

  for (const objeto of Object.values(zip.files)) {
    if (objeto.dir) continue;
    const nome = objeto.unsafeOriginalName ?? objeto.name;
    const tamanho = declarado.get(nome) ?? 0;
    const tipo = extensao(nome);
    const aviso = (mensagem: string) => avisos.push({ arquivo: nome, linha: 0, mensagem });

    if (OUTRAS_IMAGENS.has(tipo)) {
      outrasImagens.add(nome);
      continue;
    }
    if (tipo !== "tex" && tipo !== "bib" && !EXTENSOES_DE_IMAGEM.has(tipo)) {
      ignorados.push(nome);
      continue;
    }
    if (tipo === "bib" && bytesDeBib + tamanho > TAMANHO_MAXIMO_BIB) {
      aviso("Os .bib passam de 2 MB juntos, e este não foi lido: as referências dele não vêm.");
      continue;
    }
    if (EXTENSOES_DE_IMAGEM.has(tipo) && tamanho > TAMANHO_MAXIMO_IMAGEM) {
      aviso("A imagem passa de 5 MB e não foi lida. Reduza a imagem e inclua na figura.");
      continue;
    }
    if (tipo === "tex") {
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
        `Não foi possível descompactar ${nome}: o .zip está corrompido.`,
      );
    }
    if (conteudo === null) {
      return falha(
        "zip-invalido",
        `${nome} ocupa mais do que o .zip declara. O arquivo foi recusado.`,
      );
    }

    if (EXTENSOES_DE_IMAGEM.has(tipo)) {
      const dados = lerCabecalhoImagem(conteudo);
      if (dados) imagens.set(nome, { caminho: nome, bytes: conteudo, dados });
      else aviso("A imagem não é um PNG ou JPEG legível e não foi lida.");
      continue;
    }
    const texto = decodificarUtf8(conteudo);
    if (tipo === "bib") {
      // `.bib` do JabRef costuma vir em Latin-1: ele não impede o resto.
      if (texto.ok) {
        bibs.push(texto.texto);
        bytesDeBib += tamanho;
      } else aviso("O .bib não está em UTF-8 e não foi lido: as referências dele não vêm.");
      continue;
    }
    if (!texto.ok) return falha("nao-utf8", `${nome}: ${texto.erro.mensagem}`);
    textos.set(nome, texto.texto);
  }

  const principal = escolherPrincipal(textos);
  if (!principal.ok) return principal;
  // Os caminhos do `\input` e do `\includegraphics` partem da pasta do
  // principal, como na compilação.
  const raiz = pastaDe(principal.valor);
  const relativo = (nome: string) => (nome.startsWith(raiz) ? nome.slice(raiz.length) : null);

  const projeto: ProjetoZip = {
    main: textos.get(principal.valor)!,
    caminhoDoMain: principal.valor.slice(raiz.length),
    arquivos: new Map(),
    bib: bibs.length > 0 ? bibs.join("\n\n") : null,
    imagens: new Map(),
    figuras: new Map(),
    outrasImagens: new Set(),
    ignorados,
    avisos,
  };
  for (const [nome, texto] of textos) {
    const caminho = relativo(nome);
    if (caminho === null) ignorados.push(nome);
    else if (nome !== principal.valor) projeto.arquivos.set(caminho, texto);
  }
  for (const [nome, imagem] of imagens) {
    const caminho = relativo(nome);
    if (caminho === null) {
      ignorados.push(nome);
      continue;
    }
    const lida = { ...imagem, caminho };
    projeto.imagens.set(caminho, lida);
    const doAura = FIGURA_DO_AURA.exec(caminho);
    if (doAura) projeto.figuras.set(doAura[1], lida);
  }
  for (const nome of outrasImagens) {
    const caminho = relativo(nome);
    if (caminho !== null) projeto.outrasImagens.add(caminho);
  }
  return { ok: true, valor: projeto };
}

// --- Imagens pelo caminho ----------------------------------------------------

// Pastas de `\graphicspath{{imagens/}{fig/}}`, em que o `\includegraphics`
// procura.
function pastasDeImagem(main: string): string[] {
  const achado = /\\graphicspath\s*\{((?:\s*\{[^{}]*\})+)\s*\}/.exec(main);
  if (!achado) return [];
  return [...achado[1].matchAll(/\{([^{}]*)\}/g)].map((pasta) => pasta[1].trim());
}

// Caminho dentro do projeto, sem `..` que saia dele. `null` se sai.
function normalizar(caminho: string): string | null {
  const partes: string[] = [];
  for (const parte of caminho.replace(/\\/g, "/").split("/")) {
    if (parte === "" || parte === ".") continue;
    if (parte === "..") {
      if (partes.length === 0) return null;
      partes.pop();
    } else partes.push(parte);
  }
  return partes.length > 0 ? partes.join("/") : null;
}

const PREFIXO_DE_CAMINHO = "caminho:";

// A imagem de um `\includegraphics{…}` de fora (§1.6): o caminho como está e
// dentro de cada pasta do `\graphicspath`, com a extensão escrita ou
// deduzida, como o LaTeX faz.
function resolverImagem(projeto: ProjetoZip, pastas: readonly string[]): ResolverImagem {
  return (pedido) => {
    const bases = [pedido, ...pastas.map((pasta) => `${pasta.replace(/\/?$/, "/")}${pedido}`)];
    for (const base of bases) {
      const caminho = normalizar(base);
      if (!caminho) continue;
      const tentativas = extensao(caminho)
        ? [caminho]
        : ["png", "jpg", "jpeg", "PNG", "JPG", "JPEG", "pdf", "eps", "svg"].map(
            (tipo) => `${caminho}.${tipo}`,
          );
      for (const tentativa of tentativas) {
        if (projeto.imagens.has(tentativa)) return { imagem: `${PREFIXO_DE_CAMINHO}${tentativa}` };
        if (projeto.outrasImagens.has(tentativa)) {
          return {
            motivo: `${tentativa} está em ${extensao(tentativa).toUpperCase()}, e o AURA só aceita PNG e JPEG. Converta a imagem e inclua na figura.`,
          };
        }
      }
    }
    return { motivo: `${pedido} não está no pacote.` };
  };
}

// A imagem de uma figura: pelo `id` do AURA, ou pelo caminho resolvido.
function arquivoDaImagem(projeto: ProjetoZip, imagem: string): FiguraDoZip | undefined {
  return imagem.startsWith(PREFIXO_DE_CAMINHO)
    ? projeto.imagens.get(imagem.slice(PREFIXO_DE_CAMINHO.length))
    : projeto.figuras.get(imagem);
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

  const incluidos = new Set<string>();
  const lido = lerTex(projeto.main, {
    arquivo: projeto.caminhoDoMain,
    lerArquivo: (caminho) => {
      incluidos.add(caminho);
      return projeto.arquivos.get(caminho) ?? null;
    },
    chavesDeReferencia: new Set(referencias.map((referencia) => referencia.id)),
  });
  if (!lido.ok) return { ok: false, erro: lido.erro };
  const { documento: base, relatorio } = montarReimportacao(atual, lido.tex, {
    gerarId,
    referencias,
    resolverImagem: resolverImagem(projeto, pastasDeImagem(projeto.main)),
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
      const arquivo = arquivoDaImagem(projeto, no.imagem);
      if (!arquivo) return no;
      usadas.add(arquivo.caminho);
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
    for (const no of elemento.content) {
      const arquivo =
        no.type === "figura" && no.imagem ? arquivoDaImagem(projeto, no.imagem) : undefined;
      if (arquivo) usadas.add(arquivo.caminho);
    }
  }
  // Também o que não entrou: imagens que nenhuma figura usa e `.tex` que
  // nenhum `\input` inclui (um rascunho, um capítulo tirado do trabalho).
  const ignorados = [
    ...projeto.ignorados,
    ...[...projeto.imagens.keys(), ...projeto.outrasImagens].filter(
      (caminho) => !usadas.has(caminho),
    ),
    ...[...projeto.arquivos.keys()].filter((caminho) => !incluidos.has(caminho)),
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
