import { MESCLA_MAXIMA, normalizarMesclas } from "../../document/elements/tabela";
import type { CelulaTabela, LinhaTabela, NoTexto } from "../../document/types";
import type { NoHtmlColado } from "../../editor/paste";
import type { FiguraLida, TabelaLida } from "../latex/blocos";
import { CLASSE } from "./estilos";
import { normal, semNotas, textoDe, trechosPorParagrafo } from "./texto";

// Figura e tabela do `.docx` (passo 8.7.2). A legenda vem do parágrafo logo
// acima do objeto (NBR 14724:2024 §5.8: "precedido por sua palavra
// designativa") ou, no trabalho feito à mão, logo abaixo; a fonte, do
// parágrafo "Fonte: …" logo depois. O número da legenda não é lido: o AURA
// numera pela ordem (CLAUDE.md, "Formato e dados").

type Elemento = Extract<NoHtmlColado, { tipo: "elemento" }>;

// --- Legenda e fonte ---------------------------------------------------------

// As palavras designativas da §5.8. O AURA chama toda ilustração de
// "Figura" (`document/elements/legenda.ts`), e o quadro vira tabela.
const LEGENDA =
  /^(figura|tabela|quadro|gr[áa]fico|ilustra[çc][ãa]o|imagem|fotografia|foto|desenho|esquema|fluxograma|mapa|organograma|planta|retrato)\s*(\d+)?\s*(?:([-–—:.])\s*(.*))?$/i;

const TAMANHO_MAXIMO_DE_LEGENDA = 300;

export interface Legenda {
  rotulo: "figura" | "tabela";
  // A palavra como o aluno escreveu ("Gráfico"), para o aviso.
  palavra: string;
  titulo: string;
  // O parágrafo como estava, para voltar a ser parágrafo se não houver
  // objeto perto.
  texto: string;
  // Tem o estilo de legenda: sem objeto perto, merece aviso.
  doEstilo: boolean;
}

// O parágrafo é legenda: tem o estilo de legenda do Word ou do AURA, ou
// começa pela palavra designativa, com número e travessão. "Figura 2 mostra
// que…" não é legenda.
// `undefined`: não há bloco ali (o objeto era o último do arquivo).
export function legendaDe(no: NoHtmlColado | undefined): Legenda | null {
  if (!no || no.tipo !== "elemento" || no.tag !== "p") return null;
  const texto = normal(textoDe(no));
  if (!texto || texto.length > TAMANHO_MAXIMO_DE_LEGENDA) return null;
  const achado = LEGENDA.exec(texto);
  if (!achado) return null;
  const doEstilo = no.classe === CLASSE.legenda;
  if (!doEstilo && !(achado[2] && achado[3])) return null;
  const palavra = achado[1];
  return {
    rotulo: /^(tabela|quadro)$/i.test(palavra) ? "tabela" : "figura",
    palavra,
    titulo: (achado[4] ?? "").trim(),
    texto,
    doEstilo,
  };
}

const FONTE = /^fontes?\s*:\s*(.*)$/i;

export function fonteDe(no: NoHtmlColado | undefined): string | null {
  if (!no || no.tipo !== "elemento" || no.tag !== "p") return null;
  const achado = FONTE.exec(normal(textoDe(no)));
  return achado ? achado[1].trim() : null;
}

// --- Imagens -----------------------------------------------------------------

// O que o exportador do AURA põe no lugar da figura sem imagem
// (`molduraFigura()`, export/docx/fromDocumento.ts): na volta, é a figura
// sem imagem de novo.
const ESPACO_RESERVADO = "[ espaço reservado para a imagem ]";

function imagensDe(no: NoHtmlColado): string[] {
  if (no.tipo === "texto") return [];
  if (no.tag === "img") return [no.atributos?.src ?? ""];
  return no.filhos.flatMap(imagensDe);
}

// As imagens de um parágrafo que só tem imagem (a chave de cada uma, que
// `src/lib/lerDocx.ts` pôs no `src`), `[null]` para o espaço reservado do
// AURA, ou `null` se o parágrafo tem texto.
export function imagensSozinhas(no: NoHtmlColado): (string | null)[] | null {
  if (no.tipo !== "elemento" || no.tag !== "p") return null;
  const texto = normal(textoDe(no));
  if (texto === ESPACO_RESERVADO) return [null];
  const imagens = imagensDe(no);
  return imagens.length > 0 && texto === "" ? imagens : null;
}

// As imagens no meio de um parágrafo com texto.
export function imagensNoTexto(no: NoHtmlColado): string[] {
  return imagensDe(no);
}

export function figura(chave: string | null, legenda: string, fonte: string): FiguraLida {
  return {
    type: "figura",
    legenda,
    fonte,
    imagem: null,
    ...(chave !== null ? { caminho: chave } : {}),
  };
}

// --- Tabela ------------------------------------------------------------------

interface CelulaLida {
  trechos: NoTexto[];
  // `<th>`: a linha está marcada para repetir no Word.
  th: boolean;
  // Mescla do Word (`gridSpan` e `vMerge`, que o mammoth escreve como
  // `colspan` e `rowspan`): o vão fica na âncora, e as partes cobertas, na
  // grade, como o AURA guarda (passo 8.5.4).
  colspan?: number;
  rowspan?: number;
  coberta?: boolean;
}

function linhasDoHtml(tabela: Elemento): Elemento[] {
  const linhas: Elemento[] = [];
  for (const filho of tabela.filhos) {
    if (filho.tipo !== "elemento") continue;
    if (filho.tag === "tr") linhas.push(filho);
    else if (["thead", "tbody", "tfoot"].includes(filho.tag)) linhas.push(...linhasDoHtml(filho));
  }
  return linhas;
}

function inteiro(valor: string | undefined): number {
  const numero = Number.parseInt(valor ?? "", 10);
  return Number.isFinite(numero) && numero > 1 ? Math.min(numero, MESCLA_MAXIMA) : 1;
}

// O texto da célula: os parágrafos dela num só, separados por espaço.
function trechosDaCelula(celula: Elemento): NoTexto[] {
  const paragrafos = trechosPorParagrafo(celula);
  return semNotas(
    paragrafos.flatMap((trechos, i) =>
      i === 0 ? trechos : [{ type: "text" as const, text: " " }, ...trechos],
    ),
  );
}

const vazia = (celula: CelulaLida) => celula.trechos.length === 0;

const todaEmNegrito = (celula: CelulaLida) =>
  celula.trechos.every((no) => (no.marks ?? []).some((marca) => marca.type === "negrito"));

export interface TabelaDoDocx {
  tabela: Omit<TabelaLida, "legenda" | "fonte">;
  semCabecalho: boolean;
}

// A grade da tabela, ou `null` se ela não tem texto nenhum.
export function tabelaDe(no: Elemento): TabelaDoDocx | null {
  const grade: (CelulaLida | undefined)[][] = [];
  const linhas = linhasDoHtml(no);

  linhas.forEach((linha, l) => {
    grade[l] ??= [];
    let c = 0;
    for (const celula of linha.filhos) {
      if (celula.tipo !== "elemento" || (celula.tag !== "td" && celula.tag !== "th")) continue;
      // Pula as colunas que a mescla de uma linha de cima já ocupa.
      while (grade[l][c] !== undefined) c++;
      const colunas = inteiro(celula.atributos?.colspan);
      const linhasMescladas = Math.min(inteiro(celula.atributos?.rowspan), linhas.length - l);
      const th = celula.tag === "th";
      for (let dl = 0; dl < linhasMescladas; dl++) {
        grade[l + dl] ??= [];
        for (let dc = 0; dc < colunas; dc++) {
          grade[l + dl][c + dc] =
            dl === 0 && dc === 0
              ? { trechos: trechosDaCelula(celula), th, colspan: colunas, rowspan: linhasMescladas }
              : { trechos: [], th, coberta: true };
        }
      }
      c += colunas;
    }
  });

  // A linha toda vazia sai: é o respiro que o exportador do AURA põe abaixo
  // do cabeçalho (`linhaDeRespiro()`, export/docx/table.ts), ou linha em
  // branco do aluno. A que tem parte de uma mescla fica: tirá-la deixaria a
  // mescla de cima maior que a tabela.
  const largura = Math.max(0, ...grade.map((linha) => linha.length));
  const cheias = grade
    .map((linha) =>
      Array.from({ length: largura }, (_, c) => linha[c] ?? { trechos: [], th: false }),
    )
    .filter((linha) => linha.some((celula) => !vazia(celula) || celula.coberta));
  if (cheias.length === 0) return null;

  // O cabeçalho: as primeiras linhas marcadas para repetir no Word. Se todas
  // estão marcadas (a tabela do AURA sai assim no mammoth) ou nenhuma, as
  // primeiras linhas todas em negrito, deixando ao menos uma de dados.
  const marcadas = cheias.map((linha) => linha.every((celula) => vazia(celula) || celula.th));
  let cabecalho = 0;
  if (!marcadas.every(Boolean)) while (marcadas[cabecalho]) cabecalho++;
  if (cabecalho === 0) {
    while (
      cabecalho < cheias.length - 1 &&
      cheias[cabecalho].every((celula) => vazia(celula) || todaEmNegrito(celula)) &&
      cheias[cabecalho].some((celula) => !vazia(celula))
    ) {
      cabecalho++;
    }
  }

  const linhasDaTabela: LinhaTabela[] = cheias.map((linha, l) => ({
    celulas: linha.map((celula): CelulaTabela => {
      const eCabecalho = l < cabecalho;
      // O negrito do cabeçalho é do AURA, que o desenha pela célula: no
      // dado, a célula de cabeçalho não leva a marca.
      const trechos = eCabecalho
        ? celula.trechos.map(({ marks, ...no }) => {
            const resto = (marks ?? []).filter((marca) => marca.type !== "negrito");
            return resto.length > 0 ? { ...no, marks: resto } : no;
          })
        : celula.trechos;
      return {
        cabecalho: eCabecalho,
        ...(trechos.length > 0 ? { content: trechos } : {}),
        ...(celula.colspan && celula.colspan > 1 ? { colspan: celula.colspan } : {}),
        ...(celula.rowspan && celula.rowspan > 1 ? { rowspan: celula.rowspan } : {}),
      };
    }),
  }));

  // `normalizarMesclas()` marca as cobertas a partir das âncoras, e encolhe a
  // mescla que passaria da borda.
  return {
    tabela: { type: "tabela", linhas: normalizarMesclas(linhasDaTabela) },
    semCabecalho: cabecalho === 0,
  };
}
