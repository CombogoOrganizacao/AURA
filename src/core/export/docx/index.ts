import {
  AlignmentType,
  Document,
  Header,
  NumberFormat,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";

import { ABNT } from "./constants";

// Porte de poc/docx/gerar.js (passo 1.4.1) — o que ficou de fora deste porte
// está registrado em docs/porte-poc.md, pra ninguém supor que ele cobre mais
// do que cobre.
//
// Prova a montagem das três seções OOXML (capa fora da contagem;
// pré-textuais com contagem reiniciada e número oculto; corpo com contagem
// contínua e número exibido) e os estilos nomeados — os mesmos que
// `poc/docx/gerar.js` já tem verificados como OOXML válido.
//
// Corpo real desde o passo 1.4.2 (`fromDocumento.ts` converte `Documento`
// canônico pra `ConteudoExportacao`). Capa e pré-textuais continuam
// placeholder: dependem dos metadados ganharem layout de verdade no passo
// 3.5.1. Os geradores de cada tipo de bloco (citação, lista, figura, tabela,
// fórmula), referências, notas e sumário chegam um de cada vez, nos passos
// da Fase 3/4 que os implementam de verdade no editor primeiro.

const propriedadesPagina = {
  size: ABNT.paginaA4,
  margin: { ...ABNT.margem, header: ABNT.distanciaCabecalho },
};

// Mesma tipografia da seção primária, mas sem nível de estrutura — o que
// mantém os pré-textuais fora do sumário (NBR 6027). Ver
// poc/docx/gerar.js, `tituloPreTextual`.
function paragrafoTituloPreTextual(texto: string) {
  return new Paragraph({ text: texto, style: "TituloPreTextual", keepNext: true });
}

// Cabeçalho com o número da página no canto superior direito (NBR 14724).
const cabecalhoComNumero = new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ children: [PageNumber.CURRENT] })],
    }),
  ],
});

function estiloTitulo(extra: Record<string, boolean>) {
  return {
    run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, color: "000000", ...extra },
    paragraph: { spacing: { before: 360, after: 240, line: ABNT.espacamento15 } },
  };
}

export interface ConteudoExportacao {
  // Corpo já convertido para nós do `docx` — quem faz essa conversão a
  // partir do `Documento` canônico é `fromDocumento.ts` (passo 1.4.2).
  // Capa e pré-textuais continuam placeholder aqui: dependem dos metadados
  // ganharem layout de verdade no passo 3.5.1.
  corpo: Paragraph[];
}

export async function gerarDocx({ corpo }: ConteudoExportacao): Promise<Buffer> {
  const documento = new Document({
    styles: {
      default: {
        document: {
          run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo },
          paragraph: { spacing: { line: ABNT.espacamento15 } },
        },
        // NBR 6024: cada nível com recurso gráfico distinto, usado de forma
        // consistente ao longo do trabalho.
        heading1: {
          run: {
            font: ABNT.fonte,
            size: ABNT.tamanhoCorpo,
            bold: true,
            allCaps: true,
            color: "000000",
          },
          paragraph: { spacing: { before: 480, after: 240, line: ABNT.espacamento15 } },
        },
        heading2: estiloTitulo({ bold: true }),
        heading3: estiloTitulo({ italics: true }),
        heading4: estiloTitulo({}),
        heading5: estiloTitulo({ italics: true, smallCaps: true }),
        footnoteText: {
          run: { font: ABNT.fonte, size: ABNT.tamanhoMenor },
          paragraph: { spacing: { line: ABNT.espacamento1 } },
        },
      },
      paragraphStyles: [
        {
          id: "TituloPreTextual",
          name: "Titulo Pre-Textual",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, bold: true, color: "000000" },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { after: 360, line: ABNT.espacamento15 },
          },
        },
      ],
    },
    sections: [
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
        children: corpo,
      },
    ],
  });

  return Packer.toBuffer(documento);
}
