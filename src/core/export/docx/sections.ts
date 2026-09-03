import {
  AlignmentType,
  Header,
  NumberFormat,
  PageNumber,
  Paragraph,
  TextRun,
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
// Capa e pré-textuais aqui dentro continuam placeholder: dependem do layout
// de metadados de verdade, que é o passo 3.5.1 — fora do escopo deste passo.

const propriedadesPagina = {
  size: ABNT.paginaA4,
  margin: { ...ABNT.margem, header: ABNT.distanciaCabecalho },
};

// Mesma tipografia da seção primária, mas sem nível de estrutura — o que
// mantém os pré-textuais fora do sumário (NBR 6027). Ver
// poc/docx/gerar.js, `tituloPreTextual`; o estilo `TituloPreTextual` em si
// é declarado em `index.ts`, junto dos demais estilos nomeados.
function paragrafoTituloPreTextual(texto: string): Paragraph {
  return new Paragraph({ text: texto, style: "TituloPreTextual", keepNext: true });
}

const cabecalhoComNumero = new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ children: [PageNumber.CURRENT] })],
    }),
  ],
});

export function montarSecoes(corpo: readonly Paragraph[]): ISectionOptions[] {
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
    {
      properties: {
        page: {
          ...propriedadesPagina,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      children: [paragrafoTituloPreTextual("SUMÁRIO")],
    },
    // 3 — Corpo: contagem CONTINUA, número EXIBIDO.
    {
      properties: { page: propriedadesPagina },
      headers: { default: cabecalhoComNumero },
      children: [...corpo],
    },
  ];
}
