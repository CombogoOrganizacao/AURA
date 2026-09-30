import { TITULO_REFERENCIAS } from "../../document/elements/posTextual";
import type {
  CelulaTabela,
  LinhaTabela,
  Metadados,
  NivelSecao,
  NoCitacaoLonga,
  NoFigura,
  NoFormula,
  NoParagrafo,
  NoTabela,
} from "../../document/types";
import { MACRO, SEPARADOR_TERMOS, VERSAO_FORMATO_TEX } from "../../export/latex/markers";
import {
  dividirForaDeChaves,
  fimDoAmbiente,
  fimDosArgumentos,
  Fonte,
  lerGrupo,
  lerNomeDeComando,
  lerOpcional,
  liberarPares,
  linhasDe,
  MARCADOR_AURA,
  pularEspacos,
  type Aviso,
  type LinhaFonte,
} from "./fonte";
import {
  lerAtributos,
  lerInline,
  lerInlineDeCelula,
  textoPlano,
  type ChamadaLida,
  type ContextoInline,
} from "./inline";

// Leitor do `.tex` que o AURA escreve (passo 6.2.4, primeiro commit). Devolve
// o que o arquivo diz, na forma do schema, sem tocar no documento: comparar
// com o que está salvo, montar o relatório e aplicar é o passo seguinte
// (`reimport.ts`). As regras estão em docs/latex-abntex.md §1.5.
//
// **Lê o subconjunto que o próprio AURA escreve** (`export/latex/document.ts`
// e `markers.ts`), mais o `\cite` do aluno. Não expande macro, não segue
// `\input` que o AURA não escreveu, não executa nada. O que não reconhece
// volta como texto literal, no lugar onde estava, com aviso e a linha.
//
// O que o arquivo tem e o AURA deriva (capa, folhas, sumário, listas,
// referências, numeração, chamadas) não é lido: o AURA recalcula.

export type CodigoErro =
  "sem-identificacao" | "versao-nova" | "sem-documento" | "nao-utf8" | "grande-demais";

export interface ErroLeitura {
  codigo: CodigoErro;
  mensagem: string;
}

// Figura e tabela sem `id`: o `.tex` não guarda o `id` do nó, só o da
// imagem. Quem aplica (`reimport.ts`) casa com a figura que já existia ou
// cria um `id` novo.
export type FiguraLida = Omit<NoFigura, "id">;
export type TabelaLida = Omit<NoTabela, "id">;

// Figura ou tabela dentro de apêndice/anexo: o `.tex` ainda não as exporta
// (`conteudoPosTextual()`), e escreve um aviso no lugar. Na volta, o aviso
// marca a posição, e quem aplica põe de volta o nó que já existia.
export interface NaoExportado {
  type: "nao_exportado";
  tipo: "figura" | "tabela";
}

export type BlocoLido =
  NoParagrafo | NoCitacaoLonga | NoFormula | FiguraLida | TabelaLida | NaoExportado;

export interface SecaoLida {
  // `null`: seção sem marcador (nova, ou com o marcador apagado ou repetido).
  id: string | null;
  nivel: NivelSecao;
  titulo: string;
  content: BlocoLido[];
  linha: number;
  arquivo: string;
}

export interface PosTextualLido {
  id: string | null;
  titulo: string;
  content: BlocoLido[];
  linha: number;
  arquivo: string;
}

// Os campos do bloco `AURA-METADADOS`. Só os que estavam no bloco: campo
// ausente fica como está no documento. Os opcionais vêm como texto, com os
// parágrafos separados por quebra de linha; vazio quer dizer desligado.
export type MetadadosLidos = Partial<
  Pick<
    Metadados,
    | "titulo"
    | "subtitulo"
    | "autores"
    | "instituicao"
    | "orientador"
    | "local"
    | "ano"
    | "naturezaTrabalho"
    | "resumo"
    | "palavrasChave"
    | "abstract"
    | "keywords"
  > & { dedicatoria: string; agradecimentos: string; epigrafe: string }
>;

export interface TexLido {
  documentoId: string;
  versaoFormato: number;
  metadados: MetadadosLidos | null;
  secoes: SecaoLida[];
  apendices: PosTextualLido[];
  anexos: PosTextualLido[];
  chamadas: ChamadaLida[];
  avisos: Aviso[];
}

export type ResultadoLeitura = { ok: true; tex: TexLido } | { ok: false; erro: ErroLeitura };

export interface OpcoesLeitura {
  // Nome do arquivo nos avisos.
  arquivo?: string;
  // Conteúdo de `sections/<nome>.tex`, para o `\input` do `main.tex` do
  // `.zip` (passo 6.2.3). Sem esta função (`.tex` avulso), nenhum `\input` é
  // seguido.
  lerArquivo?: (caminho: string) => string | null;
  // Chaves que o `\cite{chave}` do aluno pode usar: as referências do
  // documento e as do `.bib` do pacote.
  chavesDeReferencia?: ReadonlySet<string>;
}

const PRIMEIRA_LINHA = /^% AURA-DOCUMENTO: (\S+) v(\d+)\s*$/;

// Só UTF-8 (§1.5). `fatal` faz o decodificador recusar em vez de trocar o
// byte inválido por "�" em silêncio.
export function decodificarUtf8(
  bytes: Uint8Array,
): { ok: true; texto: string } | { ok: false; erro: ErroLeitura } {
  try {
    return { ok: true, texto: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return {
      ok: false,
      erro: {
        codigo: "nao-utf8",
        mensagem:
          "O arquivo não está em UTF-8. Salve-o em UTF-8 (é o padrão do Overleaf) e tente de novo.",
      },
    };
  }
}

function falha(codigo: CodigoErro, mensagem: string): ResultadoLeitura {
  return { ok: false, erro: { codigo, mensagem } };
}

// Texto do `.tex`, com os cap\u00EDtulos do `.zip` somados. Um TCC inteiro fica
// abaixo de 1 MB; o limite existe para um arquivo que n\u00E3o \u00E9 TCC n\u00E3o travar a
// aba (o limite do `.zip` \u00E9 maior por causa das imagens).
export const TAMANHO_MAXIMO_TEX = 10 * 1024 * 1024;

const GRANDE_DEMAIS =
  "O texto do arquivo passa de 10 MB, muito mais do que um TCC tem. Confira se \u00E9 o arquivo exportado pelo AURA.";

export function lerTex(conteudo: string, opcoes: OpcoesLeitura = {}): ResultadoLeitura {
  if (conteudo.length > TAMANHO_MAXIMO_TEX) return falha("grande-demais", GRANDE_DEMAIS);
  try {
    return ler(conteudo, opcoes);
  } finally {
    liberarPares();
  }
}

function ler(conteudo: string, opcoes: OpcoesLeitura): ResultadoLeitura {
  const arquivo = opcoes.arquivo ?? "main.tex";
  const texto = conteudo.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const linhas = linhasDe(texto, arquivo);

  const primeira = linhas.find((linha) => linha.texto.trim() !== "");
  const identidade = primeira ? PRIMEIRA_LINHA.exec(primeira.texto.trim()) : null;
  if (!identidade) {
    return falha(
      "sem-identificacao",
      "Este arquivo não foi gerado pelo AURA, ou a primeira linha foi apagada. A reimportação " +
        "só lê .tex e .zip exportados pelo AURA, que começam com a linha “% AURA-DOCUMENTO: …”.",
    );
  }
  const versaoFormato = Number(identidade[2]);
  if (versaoFormato > VERSAO_FORMATO_TEX) {
    return falha(
      "versao-nova",
      "Este arquivo foi gerado por uma versão mais nova do AURA. Atualize a página e tente de novo.",
    );
  }

  const inicio = linhas.findIndex((linha) => /^\s*\\begin\{document\}/.test(linha.texto));
  if (inicio < 0) {
    return falha(
      "sem-documento",
      "O arquivo não tem \\begin{document}. Sem ele não há como saber onde o texto começa.",
    );
  }

  const avisos: Aviso[] = [];
  const chamadas: ChamadaLida[] = [];
  const chaves = opcoes.chavesDeReferencia ?? new Set<string>();
  const contexto = (fonte: Fonte): ContextoInline => ({
    fonte,
    avisos,
    chamadas,
    chaves,
    profundidade: 0,
  });

  let fim = linhas.findLastIndex((linha) => /^\s*\\end\{document\}/.test(linha.texto));
  if (fim < inicio) {
    avisos.push({
      ...posicaoDe(linhas.at(-1)!),
      mensagem: "Falta o \\end{document}: o texto foi lido até o fim do arquivo.",
    });
    fim = linhas.length;
  }

  const metadados = lerMetadados(linhas.slice(0, inicio), contexto, avisos);
  const corpo = linhas.slice(inicio + 1, fim);
  const { textual, posTextual } = dividirCorpo(corpo, avisos);

  const fonteTextual = Fonte.deLinhas(expandirInputs(textual, opcoes, avisos));
  if (fonteTextual.texto.length > TAMANHO_MAXIMO_TEX) return falha("grande-demais", GRANDE_DEMAIS);
  const secoes = montarSecoes(lerItens(contexto(fonteTextual), "textual"), avisos);

  const fontePos = Fonte.deLinhas(posTextual);
  const { apendices, anexos } = montarPosTextuais(
    lerItens(contexto(fontePos), "posTextual"),
    avisos,
  );

  return {
    ok: true,
    tex: {
      documentoId: identidade[1],
      versaoFormato,
      metadados,
      secoes,
      apendices,
      anexos,
      chamadas,
      avisos,
    },
  };
}

function posicaoDe(linha: LinhaFonte) {
  return { arquivo: linha.arquivo, linha: linha.linha };
}

// --- Metadados ---------------------------------------------------------------

const CAMPO_DA_MACRO = new Map(
  (Object.keys(MACRO) as (keyof typeof MACRO)[]).map((campo) => [MACRO[campo], campo]),
);

function lerMetadados(
  preambulo: readonly LinhaFonte[],
  contexto: (fonte: Fonte) => ContextoInline,
  avisos: Aviso[],
): MetadadosLidos | null {
  const abre = preambulo.findIndex((linha) => linha.texto.trim() === "% AURA-METADADOS: início");
  const fecha = preambulo.findIndex((linha) => linha.texto.trim() === "% AURA-METADADOS: fim");
  if (abre < 0 || fecha < abre) {
    avisos.push({
      arquivo: preambulo[0]?.arquivo ?? "",
      linha: 1,
      mensagem:
        "O bloco AURA-METADADOS não foi encontrado no preâmbulo: capa, resumo e demais dados ficam como estão no AURA.",
    });
    return null;
  }

  const fonte = Fonte.deLinhas(preambulo.slice(abre + 1, fecha));
  const ctx = contexto(fonte);
  const t = fonte.texto;
  const lidos: MetadadosLidos = {};
  let i = 0;
  for (;;) {
    i = pularEspacos(t, i);
    if (i >= t.length) break;
    const nomeGrupo = t.startsWith("\\newcommand", i)
      ? lerGrupo(t, i + "\\newcommand".length)
      : null;
    const valor = nomeGrupo && lerGrupo(t, nomeGrupo.depois);
    if (!nomeGrupo || !valor) {
      const fimDaLinha = t.indexOf("\n", i) < 0 ? t.length : t.indexOf("\n", i);
      avisos.push({
        ...fonte.posicao(i),
        mensagem: "Linha do bloco de metadados que não é um \\newcommand do AURA: ignorada.",
      });
      i = fimDaLinha;
      continue;
    }
    const macro = t.slice(nomeGrupo.inicio, nomeGrupo.fim).trim();
    const campo = CAMPO_DA_MACRO.get(macro as (typeof MACRO)[keyof typeof MACRO]);
    if (!campo) {
      avisos.push({
        ...fonte.posicao(i),
        mensagem: `Comando ${macro} no bloco de metadados não é do AURA: ignorado.`,
      });
    } else {
      atribuirCampo(lidos, campo, ctx, valor.inicio, valor.fim);
    }
    i = valor.depois;
  }
  return lidos;
}

function atribuirCampo(
  lidos: MetadadosLidos,
  campo: keyof typeof MACRO,
  ctx: ContextoInline,
  inicio: number,
  fim: number,
) {
  const t = ctx.fonte.texto;
  const plano = () => textoPlano(ctx, inicio, fim, "o campo");
  switch (campo) {
    case "autores":
      lidos.autores = dividirForaDeChaves(t, inicio, fim, "\\\\")
        .map((parte) => textoPlano(ctx, parte.inicio, parte.fim, "o nome do autor"))
        .filter(Boolean);
      return;
    case "palavrasChave":
    case "keywords":
      lidos[campo] = plano()
        .split(SEPARADOR_TERMOS.trim())
        .map((termo) => termo.trim())
        .filter(Boolean);
      return;
    case "ano": {
      const ano = Number.parseInt(plano(), 10);
      if (Number.isFinite(ano)) lidos.ano = ano;
      else
        ctx.avisos.push({
          ...ctx.fonte.posicao(inicio),
          mensagem: "O ano não é um número: ficou o do AURA.",
        });
      return;
    }
    case "dedicatoria":
    case "agradecimentos":
    case "epigrafe":
      // Parágrafos separados por `\par` (`paragrafosDe()` em markers.ts).
      lidos[campo] = dividirEmPar(t, inicio, fim)
        .map((parte) => textoPlano(ctx, parte.inicio, parte.fim, "o campo"))
        .filter(Boolean)
        .join("\n");
      return;
    default:
      lidos[campo] = plano();
  }
}

// Divide no `\par` fora de chaves.
function dividirEmPar(texto: string, inicio: number, fim: number) {
  const partes: { inicio: number; fim: number }[] = [];
  let parte = inicio;
  let profundidade = 0;
  for (let i = inicio; i < fim; i++) {
    const c = texto[i];
    if (c === "{") profundidade++;
    else if (c === "}") profundidade--;
    else if (c === "\\") {
      if (profundidade === 0 && /^\\par(?![a-zA-Z])/.test(texto.slice(i, i + 5))) {
        partes.push({ inicio: parte, fim: i });
        parte = i + 4;
        i += 3;
      } else i++;
    }
  }
  partes.push({ inicio: parte, fim });
  return partes;
}

// --- Corpo -------------------------------------------------------------------

const TEXTUAL = /^\s*\\textual\s*$/;
const POS_TEXTUAL = /^\s*\\postextual\s*$/;
const TITULO_DE_SECAO = /^\s*\\(chapter|section|subsection|subsubsection)\b/;

// O corpo em duas regiões: as seções (entre `\textual` e `\postextual`) e
// os apêndices e anexos. O que vem antes de `\textual` é pré-textual,
// derivado dos metadados; não é lido.
function dividirCorpo(corpo: readonly LinhaFonte[], avisos: Aviso[]) {
  let textual = corpo.findIndex((linha) => TEXTUAL.test(linha.texto));
  let pos = corpo.findIndex((linha) => POS_TEXTUAL.test(linha.texto));

  if (textual < 0) {
    const primeira = corpo.findIndex(
      (linha) => /^\s*% AURA-SECTION:/.test(linha.texto) || TITULO_DE_SECAO.test(linha.texto),
    );
    textual = primeira < 0 ? (pos < 0 ? corpo.length : pos) : primeira - 1;
    avisos.push({
      ...posicaoDe(corpo[Math.max(textual, 0)] ?? { arquivo: "", linha: 0, texto: "" }),
      mensagem: "Falta o \\textual: as seções foram lidas a partir do primeiro título.",
    });
  }
  if (pos < 0 || pos < textual) {
    const primeiro = corpo.findIndex(
      (linha, indice) => indice > textual && /^\s*% AURA-(APENDICE|ANEXO):/.test(linha.texto),
    );
    pos = primeiro < 0 ? corpo.length : primeiro - 1;
    avisos.push({
      ...posicaoDe(corpo[Math.min(pos, corpo.length - 1)] ?? { arquivo: "", linha: 0, texto: "" }),
      mensagem:
        "Falta o \\postextual: o fim das seções foi deduzido pelo primeiro apêndice ou anexo.",
    });
  }

  // Depois do `\postextual` vêm as referências, derivadas. Os apêndices e
  // anexos começam no primeiro marcador ou no primeiro título que não é o
  // das referências.
  const depois = corpo.slice(pos + 1);
  const primeiroElemento = depois.findIndex(
    (linha) =>
      /^\s*% AURA-(APENDICE|ANEXO):/.test(linha.texto) ||
      (/^\s*\\pretextualchapter\{/.test(linha.texto) &&
        !linha.texto.includes(`{${TITULO_REFERENCIAS}}`)),
  );

  return {
    textual: corpo.slice(textual + 1, pos),
    posTextual: primeiroElemento < 0 ? [] : depois.slice(primeiroElemento),
  };
}

const INPUT = /^\s*\\(input|include)\{([^{}]+)\}\s*$/;

// `\input{sections/…}` do `main.tex` do `.zip`: o conteúdo do arquivo entra
// no lugar da linha, com a linha e o nome dele para os avisos. Só os
// arquivos de `sections/`, que é onde o AURA os põe (§1.5).
function expandirInputs(
  linhas: readonly LinhaFonte[],
  opcoes: OpcoesLeitura,
  avisos: Aviso[],
): LinhaFonte[] {
  const saida: LinhaFonte[] = [];
  for (const linha of linhas) {
    const achado = INPUT.exec(linha.texto);
    if (!achado) {
      saida.push(linha);
      continue;
    }
    const caminho = achado[2].trim().endsWith(".tex")
      ? achado[2].trim()
      : `${achado[2].trim()}.tex`;
    const doAura = /^sections\/[^/\\]+\.tex$/.test(caminho) && !caminho.includes("..");
    const conteudo = doAura && opcoes.lerArquivo ? opcoes.lerArquivo(caminho) : null;
    if (conteudo === null) {
      avisos.push({
        ...posicaoDe(linha),
        mensagem: !opcoes.lerArquivo
          ? `\\${achado[1]}{${achado[2]}} não é seguido num .tex avulso. Para trazer os capítulos, reimporte o .zip do projeto.`
          : doAura
            ? `\\${achado[1]}{${achado[2]}}: o arquivo não está no pacote.`
            : `\\${achado[1]}{${achado[2]}} não é seguido: só os arquivos de sections/ que o AURA escreve são lidos.`,
      });
      continue;
    }
    saida.push(...linhasDe(conteudo.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"), caminho));
  }
  return saida;
}

// --- Itens -------------------------------------------------------------------
// A região lida como uma sequência plana de marcadores, títulos e blocos. Quem
// monta seções e apêndices com eles é `montarSecoes()`/`montarPosTextuais()`.

type Item =
  | { tipo: "marcador"; qual: "SECTION" | "APENDICE" | "ANEXO"; id: string; pos: number }
  | { tipo: "titulo"; comando: string; titulo: string; pos: number }
  | { tipo: "tituloPos"; titulo: string; pos: number }
  | { tipo: "bloco"; bloco: BlocoLido; pos: number };

interface ItensLidos {
  fonte: Fonte;
  itens: Item[];
}

const COMANDOS_DE_TITULO = new Set(["chapter", "section", "subsection", "subsubsection"]);

// Começo de linha que encerra o parágrafo em curso.
const INICIO_DE_BLOCO =
  /^[ \t]*(% AURA-|\\(chapter|section|subsection|subsubsection|pretextualchapter|phantomsection)(?![a-zA-Z])|\\begin\{|\\\[)/;

function lerItens(ctx: ContextoInline, modo: "textual" | "posTextual"): ItensLidos {
  const { fonte } = ctx;
  const t = fonte.texto;
  const itens: Item[] = [];
  let i = 0;
  const avisar = (pos: number, mensagem: string) =>
    ctx.avisos.push({ ...fonte.posicao(pos), mensagem });

  while ((i = pularEspacos(t, i)) < t.length) {
    const fimDaLinha = t.indexOf("\n", i) < 0 ? t.length : t.indexOf("\n", i);
    const marcador = MARCADOR_AURA.exec(t.slice(i, fimDaLinha));
    if (marcador) {
      itens.push({ tipo: "marcador", qual: marcador[1] as "SECTION", id: marcador[2], pos: i });
      i = fimDaLinha;
      continue;
    }

    if (t[i] === "\\") {
      const { nome, depois } = lerNomeDeComando(t, i);

      if (COMANDOS_DE_TITULO.has(nome)) {
        const estrela = t[depois] === "*" ? 1 : 0;
        const opcional = lerOpcional(t, depois + estrela);
        const grupo = lerGrupo(t, opcional?.depois ?? depois + estrela);
        if (grupo) {
          const titulo = textoPlano(ctx, grupo.inicio, grupo.fim, "o título", { titulo: true });
          itens.push({ tipo: "titulo", comando: nome, titulo, pos: i });
          i = grupo.depois;
          continue;
        }
      }

      if (nome === "pretextualchapter" && modo === "posTextual") {
        const grupo = lerGrupo(t, depois);
        if (grupo) {
          itens.push({
            tipo: "tituloPos",
            titulo: tituloPosTextual(ctx, grupo.inicio, grupo.fim),
            pos: i,
          });
          i = grupo.depois;
          continue;
        }
      }

      // `\phantomsection\addcontentsline{toc}{chapter}{…}` depois do título
      // de apêndice e anexo: entrada do sumário, derivada.
      if (nome === "phantomsection") {
        let fim = depois;
        if (t.startsWith("\\addcontentsline", fim)) {
          fim = fimDosArgumentos(t, fim + "\\addcontentsline".length);
        }
        i = fim;
        continue;
      }

      if (nome === "begin") {
        const lido = lerAmbiente(ctx, i, depois);
        if (lido) {
          for (const bloco of lido.blocos) itens.push({ tipo: "bloco", bloco, pos: i });
          i = lido.depois;
          continue;
        }
      }

      if (nome === "[") {
        const fecha = t.indexOf("\\]", depois);
        if (fecha >= 0) {
          itens.push({
            tipo: "bloco",
            bloco: { type: "formula", texto: t.slice(depois, fecha).trim() },
            pos: i,
          });
          i = fecha + 2;
          continue;
        }
        avisar(i, "Fórmula \\[ sem o \\] que a fecha: entrou como texto.");
      }
    }

    // Parágrafo: até a linha em branco ou o começo de outro bloco, fora de
    // chaves.
    const fim = fimDoParagrafo(t, i);
    const content = lerInline(ctx, i, fim);
    if (content.length > 0)
      itens.push({ tipo: "bloco", bloco: { type: "paragraph", content }, pos: i });
    i = fim;
  }
  return { fonte, itens };
}

function fimDoParagrafo(t: string, inicio: number): number {
  let profundidade = 0;
  for (let i = inicio; i < t.length; i++) {
    const c = t[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "{") profundidade++;
    else if (c === "}") profundidade--;
    else if (c === "\n" && profundidade <= 0) {
      const proxima = t.indexOf("\n", i + 1);
      const linha = t.slice(i + 1, proxima < 0 ? t.length : proxima);
      if (linha.trim() === "" || INICIO_DE_BLOCO.test(linha)) return i;
    }
  }
  return t.length;
}

// Título de apêndice e anexo: `\texorpdfstring{\protect\MakeUppercase{T}}{T}`
// (`tituloDeApendiceOuAnexo()`). O segundo argumento é o título como o aluno
// o escreveu.
function tituloPosTextual(ctx: ContextoInline, inicio: number, fim: number): string {
  const t = ctx.fonte.texto;
  const comeco = pularEspacos(t, inicio, fim);
  if (t.startsWith("\\texorpdfstring", comeco)) {
    const primeiro = lerGrupo(t, comeco + "\\texorpdfstring".length, fim);
    const segundo = primeiro && lerGrupo(t, primeiro.depois, fim);
    if (segundo) return textoPlano(ctx, segundo.inicio, segundo.fim, "o título", { titulo: true });
  }
  return textoPlano(ctx, inicio, fim, "o título", { titulo: true });
}

// --- Ambientes ---------------------------------------------------------------

interface AmbienteLido {
  blocos: BlocoLido[];
  depois: number;
}

function paragrafoLiteral(texto: string): NoParagrafo {
  return {
    type: "paragraph",
    content: [{ type: "text", text: texto.replace(/\s+/g, " ").trim() }],
  };
}

function lerAmbiente(ctx: ContextoInline, pos: number, depoisDoBegin: number): AmbienteLido | null {
  const t = ctx.fonte.texto;
  const nomeGrupo = lerGrupo(t, depoisDoBegin);
  if (!nomeGrupo) return null;
  const nome = t.slice(nomeGrupo.inicio, nomeGrupo.fim);
  const fecha = fimDoAmbiente(t, pos);
  const avisar = (mensagem: string) => ctx.avisos.push({ ...ctx.fonte.posicao(pos), mensagem });
  if (fecha < 0) {
    avisar(`Ambiente ${nome} sem \\end{${nome}}: entrou como texto.`);
    return null;
  }
  const depois = fecha + `\\end{${nome}}`.length;
  const dentro = { inicio: nomeGrupo.depois, fim: fecha };

  switch (nome) {
    case "auracitacaolonga":
      return { blocos: [citacaoLonga(ctx, pos, dentro)], depois };
    case "figure":
      return { blocos: figura(ctx, pos, dentro), depois };
    case "table":
      return { blocos: tabelaVazia(ctx, pos, dentro), depois };
    case "longtable":
      return tabela(ctx, pos, dentro, depois);
    case "center":
      return { blocos: [centro(ctx, pos, dentro, t.slice(pos, depois))], depois };
    default:
      avisar(`Ambiente ${nome} não reconhecido: entrou como texto.`);
      return { blocos: [paragrafoLiteral(t.slice(pos, depois))], depois };
  }
}

interface Faixa {
  inicio: number;
  fim: number;
}

// `\begin{auracitacaolonga}[pagina={…}]{refId}` + texto + `\aurachamada{…}`.
function citacaoLonga(ctx: ContextoInline, pos: number, dentro: Faixa): NoCitacaoLonga {
  const t = ctx.fonte.texto;
  const opcional = lerOpcional(t, dentro.inicio, dentro.fim);
  const ref = lerGrupo(t, opcional?.depois ?? dentro.inicio, dentro.fim);
  const refId = ref ? textoPlano(ctx, ref.inicio, ref.fim, "a chave da citação") : "";
  const paginaLida = opcional ? lerAtributos(t, opcional).get("pagina") : undefined;
  const pagina = paginaLida ? textoPlano(ctx, paginaLida.inicio, paginaLida.fim, "a página") : "";

  let inicio = ref?.depois ?? dentro.inicio;
  let fim = dentro.fim;
  // A chamada no fim é derivada: sai do texto e vai para a lista de chamadas.
  const chamada = t.lastIndexOf("\\aurachamada", fim);
  if (chamada >= inicio) {
    const grupo = lerGrupo(t, chamada + "\\aurachamada".length, fim);
    if (grupo && t.slice(grupo.depois, fim).trim() === "") {
      ctx.chamadas.push({
        ...ctx.fonte.posicao(chamada),
        citacao: { refId, pagina: pagina || null },
        texto: textoPlano(ctx, grupo.inicio, grupo.fim, "a chamada"),
      });
      fim = chamada;
    }
  }
  inicio = pularEspacos(t, inicio, fim);
  if (!ref) {
    ctx.avisos.push({
      ...ctx.fonte.posicao(pos),
      mensagem: "Citação longa sem a chave da referência: voltou sem ligação.",
    });
  }
  const content = lerInline(ctx, inicio, fim);
  return {
    type: "citacao_longa",
    refId: refId || null,
    pagina,
    ...(content.length > 0 ? { content } : {}),
  };
}

// Comandos dentro de figura e tabela que são só da forma, não do conteúdo.
const SO_FORMA = new Set([
  "auraespacosimples",
  "centering",
  "par",
  "vspace",
  "toprule",
  "midrule",
  "bottomrule",
  "hline",
]);

// Percorre os comandos de dentro de um ambiente. `tratar` devolve onde o
// comando terminou, ou `null` para o que não conhece; o que sobra (texto e
// comandos desconhecidos) volta como parágrafo literal depois do bloco.
function comandosDoAmbiente(
  ctx: ContextoInline,
  pos: number,
  dentro: Faixa,
  onde: string,
  tratar: (nome: string, inicio: number, depois: number) => number | null,
): NoParagrafo[] {
  const t = ctx.fonte.texto;
  const sobras: string[] = [];
  let i = dentro.inicio;
  while ((i = pularEspacos(t, i, dentro.fim)) < dentro.fim) {
    if (t[i] === "\\") {
      const { nome, depois } = lerNomeDeComando(t, i);
      if (SO_FORMA.has(nome)) {
        i = fimDosArgumentos(t, depois, dentro.fim);
        continue;
      }
      const fim = tratar(nome, i, depois);
      if (fim !== null) {
        i = fim;
        continue;
      }
      const ate = fimDosArgumentos(t, depois, dentro.fim);
      sobras.push(t.slice(i, ate));
      i = ate;
      continue;
    }
    let ate = i;
    while (ate < dentro.fim && t[ate] !== "\\") ate++;
    sobras.push(t.slice(i, ate));
    i = ate;
  }
  const texto = sobras.join(" ").trim();
  if (!texto) return [];
  ctx.avisos.push({
    ...ctx.fonte.posicao(pos),
    mensagem: `Conteúdo não reconhecido dentro d${onde}: entrou como texto logo depois dela.`,
  });
  return [paragrafoLiteral(texto)];
}

// "Fonte: …" de `textoFonte()`. Sem o rótulo, o texto inteiro é a fonte.
function fonteDoTexto(texto: string): string {
  return texto.replace(/^Fonte:\s*/, "");
}

const IMAGEM_DO_AURA = /^figuras\/([^/\\]+)\.(png|jpe?g)$/i;

function figura(ctx: ContextoInline, pos: number, dentro: Faixa): BlocoLido[] {
  const t = ctx.fonte.texto;
  const lida: FiguraLida = { type: "figura", legenda: "", fonte: "", imagem: null };
  if (t[dentro.inicio] === "[") {
    const opcional = lerOpcional(t, dentro.inicio, dentro.fim);
    if (opcional) dentro = { inicio: opcional.depois, fim: dentro.fim };
  }
  const sobras = comandosDoAmbiente(ctx, pos, dentro, "a figura", (nome, inicio, depois) => {
    if (nome === "caption") {
      const grupo = lerGrupo(t, depois, dentro.fim);
      if (!grupo) return null;
      lida.legenda = textoPlano(ctx, grupo.inicio, grupo.fim, "a legenda");
      return grupo.depois;
    }
    if (nome === "aurafonte") {
      const grupo = lerGrupo(t, depois, dentro.fim);
      if (!grupo) return null;
      lida.fonte = fonteDoTexto(textoPlano(ctx, grupo.inicio, grupo.fim, "a fonte"));
      return grupo.depois;
    }
    if (nome === "includegraphics") {
      const opcional = lerOpcional(t, depois, dentro.fim);
      const grupo = lerGrupo(t, opcional?.depois ?? depois, dentro.fim);
      if (!grupo) return null;
      const caminho = t.slice(grupo.inicio, grupo.fim).trim();
      const achado = IMAGEM_DO_AURA.exec(caminho);
      if (achado) lida.imagem = achado[1];
      else {
        ctx.avisos.push({
          ...ctx.fonte.posicao(inicio),
          mensagem: `Imagem ${caminho} não é uma das figuras do AURA (figuras/, PNG ou JPEG): a figura voltou sem imagem.`,
        });
      }
      return grupo.depois;
    }
    // Espaço reservado da figura sem imagem.
    if (nome === "fbox") return fimDosArgumentos(t, depois, dentro.fim);
    return null;
  });
  return [lida, ...sobras];
}

// Tabela sem linhas: só legenda e fonte (`tabela()` do exportador).
function tabelaVazia(ctx: ContextoInline, pos: number, dentro: Faixa): BlocoLido[] {
  const t = ctx.fonte.texto;
  const lida: TabelaLida = { type: "tabela", legenda: "", fonte: "", linhas: [] };
  if (t[dentro.inicio] === "[") {
    const opcional = lerOpcional(t, dentro.inicio, dentro.fim);
    if (opcional) dentro = { inicio: opcional.depois, fim: dentro.fim };
  }
  const sobras = comandosDoAmbiente(ctx, pos, dentro, "a tabela", (nome, _inicio, depois) => {
    const grupo = lerGrupo(t, depois, dentro.fim);
    if (!grupo) return null;
    if (nome === "caption") lida.legenda = textoPlano(ctx, grupo.inicio, grupo.fim, "a legenda");
    else if (nome === "aurafonte")
      lida.fonte = fonteDoTexto(textoPlano(ctx, grupo.inicio, grupo.fim, "a fonte"));
    else return null;
    return grupo.depois;
  });
  return [lida, ...sobras];
}

// `longtable` no padrão do exportador: legenda e cabeçalho antes de
// `\endfirsthead`, cabeçalho repetido até `\endhead` (ignorado), corpo depois
// de `\endlastfoot`. A fonte vem logo depois do ambiente, fora dele.
function tabela(
  ctx: ContextoInline,
  pos: number,
  dentro: Faixa,
  depoisDoAmbiente: number,
): AmbienteLido {
  const t = ctx.fonte.texto;
  const colunas = lerGrupo(t, dentro.inicio, dentro.fim);
  const inicio = colunas?.depois ?? dentro.inicio;
  const achar = (comando: string) => {
    const achado = t.indexOf(comando, inicio);
    return achado >= 0 && achado < dentro.fim ? achado : -1;
  };
  const primeiraCabeca = achar("\\endfirsthead");
  const cabeca = achar("\\endhead");
  const pe = achar("\\endlastfoot");

  const fimDoCabecalho = primeiraCabeca >= 0 ? primeiraCabeca : cabeca;
  const inicioDoCorpo =
    pe >= 0
      ? pe + "\\endlastfoot".length
      : cabeca >= 0
        ? cabeca + "\\endhead".length
        : primeiraCabeca >= 0
          ? primeiraCabeca + "\\endfirsthead".length
          : inicio;
  if (pe < 0 && (cabeca >= 0 || primeiraCabeca >= 0)) {
    ctx.avisos.push({
      ...ctx.fonte.posicao(pos),
      mensagem: "Tabela sem \\endlastfoot: as linhas foram lidas a partir do fim do cabeçalho.",
    });
  }

  let legenda = "";
  const linhas: LinhaTabela[] = [];
  const lerLinhas = (faixa: Faixa, cabecalho: boolean) => {
    for (const parte of dividirForaDeChaves(t, faixa.inicio, faixa.fim, "\\\\")) {
      let comeco = parte.inicio;
      // Traços do padrão IBGE e a legenda abrem a linha, antes das células.
      for (;;) {
        comeco = pularEspacos(t, comeco, parte.fim);
        const regra = /^\\(toprule|midrule|bottomrule|hline)(?![a-zA-Z])/.exec(
          t.slice(comeco, parte.fim),
        );
        if (regra) {
          comeco += regra[0].length;
          continue;
        }
        if (t.startsWith("\\caption", comeco)) {
          const grupo = lerGrupo(t, comeco + "\\caption".length, parte.fim);
          if (grupo) {
            legenda = textoPlano(ctx, grupo.inicio, grupo.fim, "a legenda");
            comeco = grupo.depois;
            continue;
          }
        }
        break;
      }
      if (t.slice(comeco, parte.fim).trim() === "") continue;
      linhas.push({
        celulas: dividirForaDeChaves(t, comeco, parte.fim, "&").map((celula) =>
          lerCelula(ctx, celula, cabecalho),
        ),
      });
    }
  };
  if (fimDoCabecalho >= 0) lerLinhas({ inicio, fim: fimDoCabecalho }, true);
  lerLinhas({ inicio: inicioDoCorpo, fim: dentro.fim }, false);

  let depois = depoisDoAmbiente;
  let fonte = "";
  const seguinte = pularEspacos(t, depois);
  if (t.startsWith("\\aurafonte", seguinte)) {
    const grupo = lerGrupo(t, seguinte + "\\aurafonte".length);
    if (grupo) {
      fonte = fonteDoTexto(textoPlano(ctx, grupo.inicio, grupo.fim, "a fonte"));
      depois = grupo.depois;
    }
  }
  return { blocos: [{ type: "tabela", legenda, fonte, linhas }], depois };
}

// Célula de cabeçalho sai com o texto inteiro em `\textbf{}` (`linhaLatex`
// do exportador). No corpo, célula toda em negrito também volta como
// cabeçalho: é a mesma marcação, e a mesma aparência.
function lerCelula(ctx: ContextoInline, faixa: Faixa, linhaDeCabecalho: boolean): CelulaTabela {
  const t = ctx.fonte.texto;
  let inicio = pularEspacos(t, faixa.inicio, faixa.fim);
  let fim = faixa.fim;
  while (fim > inicio && /\s/.test(t[fim - 1])) fim--;
  let cabecalho = linhaDeCabecalho;
  if (t.startsWith("\\textbf{", inicio)) {
    const grupo = lerGrupo(t, inicio + "\\textbf".length, fim);
    if (grupo && grupo.depois === fim) {
      cabecalho = true;
      inicio = grupo.inicio;
      fim = grupo.fim;
    }
  }
  const content = lerInlineDeCelula(ctx, inicio, fim);
  return content.length > 0 ? { cabecalho, content } : { cabecalho };
}

const NAO_EXPORTADO = /\[ (figura|tabela) dentro de apêndice\/anexo ainda não exportada/;

// `center` é a fórmula que o KaTeX recusou (`\texttt{…}`) ou o aviso de
// figura/tabela em apêndice.
function centro(ctx: ContextoInline, pos: number, dentro: Faixa, bruto: string): BlocoLido {
  const t = ctx.fonte.texto;
  const inicio = pularEspacos(t, dentro.inicio, dentro.fim);
  const naoExportado = NAO_EXPORTADO.exec(bruto);
  if (naoExportado) return { type: "nao_exportado", tipo: naoExportado[1] as "figura" | "tabela" };
  if (t.startsWith("\\texttt", inicio)) {
    const grupo = lerGrupo(t, inicio + "\\texttt".length, dentro.fim);
    if (grupo && t.slice(grupo.depois, dentro.fim).trim() === "") {
      return { type: "formula", texto: textoPlano(ctx, grupo.inicio, grupo.fim, "a fórmula") };
    }
  }
  ctx.avisos.push({
    ...ctx.fonte.posicao(pos),
    mensagem: "Ambiente center não reconhecido: entrou como texto.",
  });
  return paragrafoLiteral(bruto);
}

// --- Montagem ----------------------------------------------------------------

const NIVEL: Record<string, NivelSecao> = {
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 3,
};

function montarSecoes({ fonte, itens }: ItensLidos, avisos: Aviso[]): SecaoLida[] {
  const secoes: SecaoLida[] = [];
  const vistos = new Set<string>();
  let marcador: Extract<Item, { tipo: "marcador" }> | null = null;
  const avisar = (pos: number, mensagem: string) =>
    avisos.push({ ...fonte.posicao(pos), mensagem });

  for (const item of itens) {
    if (item.tipo !== "titulo" && marcador) {
      avisar(marcador.pos, `Marcador da seção ${marcador.id} sem título logo depois: ignorado.`);
      marcador = null;
    }
    switch (item.tipo) {
      case "marcador":
        if (item.qual === "SECTION") marcador = item;
        else
          avisar(
            item.pos,
            `Marcador de ${item.qual === "APENDICE" ? "apêndice" : "anexo"} no meio das seções: ignorado.`,
          );
        break;
      case "titulo": {
        if (item.comando === "subsubsection") {
          avisar(
            item.pos,
            `O AURA tem três níveis de seção: “${item.titulo}” (\\subsubsection) voltou como nível 3.`,
          );
        }
        let id = marcador?.id ?? null;
        if (id && vistos.has(id)) {
          avisar(item.pos, `Marcador repetido (${id}): “${item.titulo}” voltou como seção nova.`);
          id = null;
        }
        if (id) vistos.add(id);
        secoes.push({
          id,
          nivel: NIVEL[item.comando],
          titulo: item.titulo,
          content: [],
          ...fonte.posicao(item.pos),
        });
        marcador = null;
        break;
      }
      case "tituloPos":
        break;
      case "bloco":
        if (secoes.length === 0) {
          avisar(item.pos, "Texto antes do primeiro título: entrou numa seção sem título.");
          secoes.push({ id: null, nivel: 1, titulo: "", content: [], ...fonte.posicao(item.pos) });
        }
        secoes.at(-1)!.content.push(item.bloco);
        break;
    }
  }
  if (marcador)
    avisar(marcador.pos, `Marcador da seção ${marcador.id} sem título logo depois: ignorado.`);
  return secoes;
}

// "APÊNDICE A — " / "ANEXO B — ": derivados da posição (§1.5, princípio 3).
// Sem travessão, só quando o título acaba ali: "Apêndice sobre X" é título.
const ROTULO_POS_TEXTUAL = /^(ap[êe]ndice|anexo)(?:\s+[a-z]{1,3})?\s*(?:(?:—|–|-{1,3})\s*|$)/iu;

function montarPosTextuais({ fonte, itens }: ItensLidos, avisos: Aviso[]) {
  const apendices: PosTextualLido[] = [];
  const anexos: PosTextualLido[] = [];
  const vistos = { APENDICE: new Set<string>(), ANEXO: new Set<string>() };
  let marcador: Extract<Item, { tipo: "marcador" }> | null = null;
  let atual: PosTextualLido | null = null;
  let ultimoTipo: "APENDICE" | "ANEXO" = "APENDICE";
  const avisar = (pos: number, mensagem: string) =>
    avisos.push({ ...fonte.posicao(pos), mensagem });

  for (const item of itens) {
    if (item.tipo !== "tituloPos" && marcador) {
      avisar(marcador.pos, `Marcador ${marcador.id} sem título logo depois: ignorado.`);
      marcador = null;
    }
    switch (item.tipo) {
      case "marcador":
        if (item.qual === "SECTION")
          avisar(item.pos, "Marcador de seção depois do fim das seções: ignorado.");
        else marcador = item;
        break;
      case "tituloPos": {
        const rotulo = ROTULO_POS_TEXTUAL.exec(item.titulo);
        const peloRotulo = rotulo
          ? rotulo[1].toLowerCase() === "anexo"
            ? "ANEXO"
            : "APENDICE"
          : null;
        const tipo: "APENDICE" | "ANEXO" =
          (marcador?.qual as "APENDICE" | "ANEXO" | undefined) ?? peloRotulo ?? ultimoTipo;
        let id = marcador?.id ?? null;
        if (!marcador) {
          avisar(
            item.pos,
            `“${item.titulo}” sem marcador: entra como ${tipo === "ANEXO" ? "anexo" : "apêndice"} novo.`,
          );
        } else if (id && vistos[tipo].has(id)) {
          avisar(item.pos, `Marcador repetido (${id}): “${item.titulo}” entra como novo.`);
          id = null;
        }
        if (id) vistos[tipo].add(id);
        atual = {
          id,
          titulo: rotulo ? item.titulo.slice(rotulo[0].length) : item.titulo,
          content: [],
          ...fonte.posicao(item.pos),
        };
        (tipo === "ANEXO" ? anexos : apendices).push(atual);
        ultimoTipo = tipo;
        marcador = null;
        break;
      }
      case "titulo":
        avisar(
          item.pos,
          `Título de seção “${item.titulo}” depois das referências: entrou como texto.`,
        );
        atual?.content.push(paragrafoLiteral(item.titulo));
        break;
      case "bloco":
        if (!atual) {
          avisar(item.pos, "Texto depois das referências, fora de apêndice ou anexo: não volta.");
          break;
        }
        atual.content.push(item.bloco);
        break;
    }
  }
  if (marcador) avisar(marcador.pos, `Marcador ${marcador.id} sem título logo depois: ignorado.`);
  return { apendices, anexos };
}
