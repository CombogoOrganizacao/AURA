import {
  AlignmentType,
  Paragraph,
  TabStopType,
  TableOfContents,
  TextRun,
  type FileChild,
} from "docx";

import {
  TITULO_LISTA_ABREVIATURAS,
  gerarListaDeAbreviaturas,
} from "../../document/elements/abreviaturas";
import { ROTULO_FIGURA, ROTULO_TABELA } from "../../document/elements/legenda";
import {
  TITULO_LISTA_FIGURAS,
  TITULO_LISTA_TABELAS,
  gerarListaDeFiguras,
  gerarListaDeTabelas,
} from "../../document/elements/listas";
import type { Documento } from "../../document/types";
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

function blocoListaDeAbreviaturas(documento: Documento): FileChild[] {
  const itens = gerarListaDeAbreviaturas(documento.metadados, documento.sections);
  if (itens.length === 0) return [];

  return [
    paragrafoTituloPreTextual(TITULO_LISTA_ABREVIATURAS),
    ...itens.map(
      (item) =>
        new Paragraph({
          children: [
            new TextRun(item.sigla),
            new TextRun({ children: ["\t"] }),
            new TextRun(item.significado),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { line: ABNT.espacamento15 },
          tabStops: [{ type: TabStopType.LEFT, position: PARADA_SIGNIFICADO }],
        }),
    ),
  ];
}

// Um bloco por elemento, na ordem canônica (docs/to-do.md 3.7.2: as listas
// ficam entre o abstract e o sumário). Blocos, e não um array achatado, porque
// quem compõe é que põe a quebra de página entre eles — mesma divisão que
// `montarPreTextuais()` já usa.
export function blocosDeListas(documento: Documento): FileChild[][] {
  return [
    blocoListaDeLegendas(
      TITULO_LISTA_FIGURAS,
      ROTULO_FIGURA,
      gerarListaDeFiguras(documento.sections).length > 0,
    ),
    blocoListaDeLegendas(
      TITULO_LISTA_TABELAS,
      ROTULO_TABELA,
      gerarListaDeTabelas(documento.sections).length > 0,
    ),
    blocoListaDeAbreviaturas(documento),
  ].filter((bloco) => bloco.length > 0);
}
