import {
  AlignmentType,
  Header,
  NumberFormat,
  PageNumber,
  Paragraph,
  TextRun,
  type FileChild,
  type ISectionOptions,
} from "docx";

import { ABNT } from "./constants";

// Montagem das três seções OOXML (passo 1.4.3) — fatorado de `index.ts`
// (1.4.1/1.4.2) pra existir e ser testado por si só, independente de
// estilos ou do conteúdo real do corpo.
//
//   1. Capa — sem cabeçalho, fora da contagem de página.
//   2. Pré-textuais — contagem de página REINICIA em 1, número NÃO exibido.
//   3. Corpo — contagem CONTINUA, número EXIBIDO (cabeçalho com o campo
//      PAGE no canto superior direito, NBR 14724).
//
// Capa deixou de ser placeholder no passo 3.7.2: o conteúdo vem de
// `gerarCapa()` (3.5.1) e a tipografia de `montarCapa()` (`preTextuais.ts`).
// A folha de rosto NÃO fica aqui — é o primeiro elemento da seção 2, porque é
// nela que a contagem de página começa (a capa fica fora da contagem, NBR
// 14724 §5.3). Pré-textuais recebe resumo/abstract de verdade
// desde o passo 3.5.2 (`preTextuais` abaixo, montado por `fromDocumento.ts`
// a partir de `preTextuais.ts`) e o sumário é campo `TOC` de verdade desde
// o passo 3.6.2 (`toc.ts`).

const propriedadesPagina = {
  size: ABNT.paginaA4,
  margin: { ...ABNT.margem, header: ABNT.distanciaCabecalho },
};

const cabecalhoComNumero = new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ children: [PageNumber.CURRENT] })],
    }),
  ],
});

export function montarSecoes(
  corpo: readonly FileChild[],
  preTextuais: readonly FileChild[] = [],
  capa: readonly FileChild[] = [],
): ISectionOptions[] {
  return [
    // 1 — Capa: sem cabeçalho, fora da contagem de página. Conteúdo real
    // desde o 3.7.2 (`montarCapa()`, em `preTextuais.ts`). Uma seção OOXML
    // precisa de ao menos um filho, então um documento sem capa nenhuma sai
    // com a folha em branco em vez de arquivo inválido.
    {
      properties: { page: propriedadesPagina },
      children: capa.length > 0 ? [...capa] : [new Paragraph({ text: "" })],
    },
    // 2 — Pré-textuais: contagem REINICIA em 1, número NÃO exibido. A
    // contagem começa aqui, e não na capa, porque é a folha de rosto que
    // conta como página 1 (NBR 14724 §5.3) — por isso ela abre esta seção.
    // A ordem inteira (folha de rosto, opcionais, resumo, abstract, listas e,
    // fechando, o sumário) vem de `src/core/document/order.ts`.
    {
      properties: {
        page: {
          ...propriedadesPagina,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      // O sumário deixou de ser emendado aqui no passo 3.7.2: ele é mais um
      // elemento da ordem canônica (`src/core/document/order.ts`), e chega
      // dentro de `preTextuais` com a quebra de página já no lugar certo.
      // Emendá-lo aqui de novo o duplicaria.
      children: preTextuais.length > 0 ? [...preTextuais] : [new Paragraph({ text: "" })],
    },
    // 3 — Corpo: contagem CONTINUA, número EXIBIDO.
    {
      properties: { page: propriedadesPagina },
      headers: { default: cabecalhoComNumero },
      children: [...corpo],
    },
  ];
}
