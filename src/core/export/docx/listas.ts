import {
  AlignmentType,
  Paragraph,
  TabStopType,
  TableOfContents,
  TextRun,
  type FileChild,
} from "docx";

import { TITULO_LISTA_ABREVIATURAS } from "../../document/elements/abreviaturas";
import { ROTULO_FIGURA, ROTULO_TABELA } from "../../document/elements/legenda";
import {
  TITULO_LISTA_FIGURAS,
  TITULO_LISTA_TABELAS,
} from "../../document/elements/listas";
import { ABNT } from "./constants";
import { paragrafoTituloPreTextual } from "./preTextuais";

// Listas de ilustrações, tabelas e abreviaturas no `.docx` — passo 3.6.4.
//
// **Figuras e tabelas são campos `TOC` de legenda**, porte de
// `poc/docx/gerar.js` (os dois `new TableOfContents(..., {
// captionLabelIncludingNumbers })`), congelada e conferida no Word. O campo
// recolhe os parágrafos que contêm um campo `SEQ Figura`/`SEQ Tabela` — os
// mesmos que `docx/legenda.ts` escreve desde 3.6.3 — e preenche o número de
// página real. Mesmo raciocínio do sumário (3.6.2): número de página não
// existe em `src/core/`, então quem preenche é o Word.
//
// **Abreviaturas são parágrafos de verdade**, não campo: não há nada no
// documento para o Word recolher. A lista (quem entra, em que ordem) vem de
// `gerarListaDeAbreviaturas()`, e aqui só vira OOXML.
//
// **`gerarListaDeFiguras()` decide SE o elemento existe; o Word decide o QUE
// vai dentro.** Não é redundância: uma "LISTA DE FIGURAS" num trabalho sem
// figura nenhuma seria um elemento fabricado, com título e campo vazio — e o
// campo, sozinho, não sabe se dá ou não resultado antes de o Word abrir o
// arquivo. Mesma lógica de `paragrafosResumo()` em `preTextuais.ts`.

// Tabulação entre a sigla e o significado, para a lista sair em duas colunas
// alinhadas em vez de depender do comprimento de cada sigla.
const PARADA_SIGNIFICADO = Math.round(ABNT.larguraUtil / 6);

function blocoListaDeLegendas(titulo: string, rotulo: string, temItens: boolean): FileChild[] {
  if (!temItens) return [];

  return [
    paragrafoTituloPreTextual(titulo),
    new TableOfContents(titulo, {
      hyperlink: true,
      captionLabelIncludingNumbers: rotulo,
    }),
  ];
}

// Um bloco por lista, exportados um a um: quem conhece a ORDEM entre eles é
// `src/core/document/order.ts` (3.7.2), e quem decide a quebra de página é
// quem compõe a parte (`fromDocumento.ts`). Aqui cada lista só sabe virar
// OOXML — e devolver `[]` quando não há o que listar.
export function blocoListaDeFiguras(temFiguras: boolean): FileChild[] {
  return blocoListaDeLegendas(TITULO_LISTA_FIGURAS, ROTULO_FIGURA, temFiguras);
}

export function blocoListaDeTabelas(temTabelas: boolean): FileChild[] {
  return blocoListaDeLegendas(TITULO_LISTA_TABELAS, ROTULO_TABELA, temTabelas);
}

export function blocoListaDeAbreviaturas(
  itens: readonly { sigla: string; significado: string }[],
): FileChild[] {
  if (itens.length === 0) return [];

  return [
    paragrafoTituloPreTextual(TITULO_LISTA_ABREVIATURAS),
    ...itens.map(
      (item) =>
        new Paragraph({
          children: [
            new TextRun(item.sigla),
            new TextRun({ children: ["	"] }),
            new TextRun(item.significado),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { line: ABNT.espacamento15 },
          tabStops: [{ type: TabStopType.LEFT, position: PARADA_SIGNIFICADO }],
        }),
    ),
  ];
}
