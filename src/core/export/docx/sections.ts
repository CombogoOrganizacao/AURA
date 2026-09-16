import {
  AlignmentType,
  Header,
  NumberFormat,
  PageBreak,
  PageNumber,
  Paragraph,
  TextRun,
  type ISectionOptions,
} from "docx";

import { ABNT } from "./constants";
import { blocoSumario } from "./toc";

// Montagem das três seções OOXML (passo 1.4.3) — fatorado de `index.ts`
// (1.4.1/1.4.2) pra existir e ser testado por si só, independente de
// estilos ou do conteúdo real do corpo.
//
//   1. Capa — sem cabeçalho, fora da contagem de página.
//   2. Pré-textuais — contagem de página REINICIA em 1, número NÃO exibido.
//   3. Corpo — contagem CONTINUA, número EXIBIDO (cabeçalho com o campo
//      PAGE no canto superior direito, NBR 14724).
//
// Capa continua placeholder: depende de layout próprio (página sem
// numeração, sem cabeçalho — só a ordem/alinhamento já existe, em
// `src/core/document/elements/capa.ts`/`folhaDeRosto.ts`, passo 3.5.1) que
// ninguém ligou aqui ainda. Pré-textuais recebe resumo/abstract de verdade
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
  corpo: readonly Paragraph[],
  preTextuais: readonly Paragraph[] = [],
): ISectionOptions[] {
  return [
    // 1 — Capa: sem cabeçalho, fora da contagem de página.
    {
      properties: { page: propriedadesPagina },
      children: [
        new Paragraph({
          text: "Capa — metadados chegam no passo 3.5.1",
          alignment: AlignmentType.CENTER,
        }),
      ],
    },
    // 2 — Pré-textuais: contagem REINICIA em 1, número NÃO exibido.
    // `preTextuais` (resumo/abstract, passo 3.5.2) vem antes do sumário —
    // mesma ordem canônica que `docs/to-do.md` (3.7.2) já define: resumo,
    // abstract, listas, sumário. O sumário é o ÚLTIMO pré-textual (NBR
    // 6027), e é por isso que ele fecha esta seção.
    {
      properties: {
        page: {
          ...propriedadesPagina,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      children: [
        ...preTextuais,
        // Cada elemento pré-textual em página própria — a quebra só existe
        // se houver algo antes do sumário (senão sobra uma página em
        // branco na abertura da seção). Mesma regra de `montarPreTextuais()`.
        ...(preTextuais.length > 0 ? [new Paragraph({ children: [new PageBreak()] })] : []),
        ...blocoSumario(),
      ],
    },
    // 3 — Corpo: contagem CONTINUA, número EXIBIDO.
    {
      properties: { page: propriedadesPagina },
      headers: { default: cabecalhoComNumero },
      children: [...corpo],
    },
  ];
}
