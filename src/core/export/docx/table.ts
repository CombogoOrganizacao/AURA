import {
  BorderStyle,
  type IBorderOptions,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
} from "docx";

import { trechosDoInline } from "../../document/elements/trechos";
import type { CelulaTabela, LinhaTabela, NoTabela } from "../../document/types";
import type { Referencia } from "../../references/types";
import { ABNT } from "./constants";
import { runsDeTrechos } from "./trechos";

// Grade da tabela no `.docx` — passo 6.1.3, porte do `case "tabela"` de
// `poc/docx/gerar.js`. A NBR 14724:2024 §5.9 manda padronizar as tabelas
// "conforme as normas de apresentação tabular do IBGE"; o documento foi lido
// na fonte primária (IBGE, *Normas de apresentação tabular*, 3. ed., 1993).
// Os traços saem dele:
//
// - §4.3.1: "no mínimo, três traços horizontais paralelos. O primeiro para
//   separar o topo. O segundo para separar o espaço do cabeçalho. O terceiro
//   para separar o rodapé."
// - §4.3.3: "A moldura de uma tabela não deve ter traços verticais que a
//   delimitem à esquerda e à direita."
// - §4.3.2: traço vertical interno só "quando houver necessidade de se
//   destacar parte do cabeçalho ou parte dos dados" — opcional, e o editor
//   não tem como pedi-lo. Nenhum sai.
// - §8.3 a): tabela que passa de uma página repete o cabeçalho em cada uma.
//   É o `tableHeader` das linhas de cabeçalho, que o Word repete sozinho.
//
// **Espaço do cabeçalho = as primeiras linhas em que TODA célula é
// cabeçalho.** `cabecalho` é atributo da célula (docs/schema-tiptap.md §4.7),
// mas o Word só repete linha inteira, e só a partir da primeira. Célula de
// cabeçalho no meio do corpo sai em negrito, sem traço e sem repetir. Tabela
// sem nenhuma linha de cabeçalho sai só com os traços de cima e de baixo: o
// §4.4 exige cabeçalho, e apontar a falta é da conferência, não do
// exportador.
//
// **O traço do topo é da primeira linha, não só da tabela.** Na página em que
// a tabela continua, o Word repete as linhas de cabeçalho, e a borda de
// célula vai junto com elas; a borda da tabela, não. É o que dá "o conteúdo
// do topo e o cabeçalho" em cada página (§8.3 a). O traço de baixo é da
// tabela, que o Word desenha só depois da última linha — o §8.3 d) pede isso:
// o traço do rodapé "somente em cada página que contenha a última linha".
// As duas coisas dependem de como o Word pagina, e só valem conferidas nele.
//
// **Limitação registrada:** "continua", "continuação" e "conclusão" no alto
// de cada página (§8.3 b) dependem de onde o Word quebra a página, e isso não
// se sabe na hora de exportar. Não saem.
//
// **Célula em 12 pt e entrelinha 1,5, como o corpo.** A PoC usava fonte menor
// e espaço simples, e a norma não sustenta: a 14724 §5.1 dá tamanho menor a
// "fontes e legendas das ilustrações e das tabelas", e a §5.2 dá espaço
// simples a "títulos das ilustrações e das tabelas, fontes e legendas". As
// duas listas de exceção são fechadas ("todo o texto [...] excetuando-se"), e
// o conteúdo da tabela não está em nenhuma. Quem formata é o estilo nomeado
// `CelulaTabela` (styles.ts).
//
// Cabeçalho em negrito é **convenção**, a mesma da tela: o IBGE não fala de
// destaque tipográfico no cabeçalho. Colunas de largura igual na largura útil
// da folha, como a PoC e o CSS do editor.

const TRACO: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const SEM_TRACO: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "auto" };

// Quantas linhas, do começo da tabela, formam o espaço do cabeçalho.
export function linhasDeCabecalho(linhas: readonly LinhaTabela[]): number {
  const primeiraDoCorpo = linhas.findIndex(
    (linha) => linha.celulas.length === 0 || !linha.celulas.every((celula) => celula.cabecalho),
  );
  return primeiraDoCorpo === -1 ? linhas.length : primeiraDoCorpo;
}

function celulaDocx(
  celula: CelulaTabela,
  largura: number,
  bordas: { top: boolean; bottom: boolean },
  references: readonly Referencia[],
): TableCell {
  const runs = runsDeTrechos(
    trechosDoInline(celula.content, references).map((trecho) =>
      celula.cabecalho ? { ...trecho, negrito: true } : trecho,
    ),
  );
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    borders: {
      top: bordas.top ? TRACO : SEM_TRACO,
      bottom: bordas.bottom ? TRACO : SEM_TRACO,
      left: SEM_TRACO,
      right: SEM_TRACO,
    },
    // Célula vazia também leva um parágrafo: o OOXML não aceita `<w:tc>` sem
    // nenhum, e o Word acusa o arquivo como corrompido.
    children: [new Paragraph({ children: runs, style: "CelulaTabela" })],
  });
}

// `null` para tabela sem linha nenhuma: `<w:tbl>` sem `<w:tr>` é OOXML
// inválido. O schema do editor não a produz (`linha_tabela+`), mas o
// `Documento` pode chegar de outro caminho, e o arquivo não pode quebrar por
// isso. Sai legenda e fonte, sem grade.
export function tabelaDocx(no: NoTabela, references: readonly Referencia[]): Table | null {
  if (no.linhas.length === 0) return null;

  const colunas = Math.max(1, ...no.linhas.map((linha) => linha.celulas.length));
  const largura = Math.floor(ABNT.larguraUtil / colunas);
  const cabecalho = linhasDeCabecalho(no.linhas);

  const rows = no.linhas.map(
    (linha, indice) =>
      new TableRow({
        tableHeader: indice < cabecalho,
        children: linha.celulas.map((celula) =>
          celulaDocx(
            celula,
            largura,
            { top: indice === 0, bottom: indice === cabecalho - 1 },
            references,
          ),
        ),
      }),
  );

  return new Table({
    width: { size: largura * colunas, type: WidthType.DXA },
    columnWidths: Array<number>(colunas).fill(largura),
    borders: {
      top: TRACO,
      bottom: TRACO,
      left: SEM_TRACO,
      right: SEM_TRACO,
      insideHorizontal: SEM_TRACO,
      insideVertical: SEM_TRACO,
    },
    rows,
  });
}
