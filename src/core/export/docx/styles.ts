import { AlignmentType, type IStylesOptions } from "docx";

import { ABNT } from "./constants";

// Estilos nomeados do `.docx` — porte 1:1 de `poc/docx/gerar.js` (ver
// docs/porte-poc.md para o que ficou de fora deste porte). Fatorado de
// `index.ts` no passo 3.2.5: este arquivo é o destino de todo estilo
// nomeado do exportador, daqui em diante — `CitacaoLonga` chega em 3.4.2,
// o restante (Título 1-3 completo, Corpo, Referência, Legenda) em 6.1.1.
// Nunca de volta pra `index.ts`, que fica só com a montagem do `Document`.
//
// NBR 6024 exige gradação visível entre níveis de título e consistência
// entre sumário e texto — não impõe esta combinação específica (caixa
// alta+negrito / negrito / itálico): é escolha de estilo do AURA
// (docs/auditoria-abnt.md, achado do passo 3.1.1, mesmos valores que
// `NORMAS.abnt.titulos` em `src/core/standards/standards.ts`). O Vitest
// de 3.2.5 (`styles.test.ts`) confere que os três níveis se distinguem no
// `<w:style>` gerado — não que esta seja "a" combinação exigida pela norma.
function estiloTitulo(extra: Record<string, boolean>) {
  return {
    run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, color: "000000", ...extra },
    paragraph: { spacing: { before: 360, after: 240, line: ABNT.espacamento15 } },
  };
}

export const ESTILOS_DOCUMENTO: IStylesOptions = {
  default: {
    document: {
      run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo },
      paragraph: { spacing: { line: ABNT.espacamento15 } },
    },
    // heading4/heading5 não são produzidos por `fromDocumento()` — `NivelSecao`
    // (src/core/document/types.ts) para em 3. Ficam declarados só pra manter
    // paridade de `<w:style>` com `poc/docx/gerar.js` (conferido em
    // `index.test.ts`), que monta até cinco níveis de subseção.
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
    // NBR 10520 — citação direta com mais de três linhas (passo 3.4.2, nó
    // `citacao_longa` desde 3.4.1). Nomeado, ao contrário do que
    // `poc/docx/gerar.js` fazia (formatação solta no `Paragraph`, sem
    // `paragraphStyles` próprio) — é o que faz o Word listar "Citacao Longa"
    // no painel de Estilos (critério do 6.1.1, que estende esta lista com
    // Corpo/Referencia/Legenda mais adiante). `recuoCitacao` (4 cm) só à
    // esquerda, mesma decisão da PoC e do CSS do editor (globals.css,
    // `--doc-indent-citacao`, passo 3.4.1) — nunca as duas margens.
    {
      id: "CitacaoLonga",
      name: "Citacao Longa",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: ABNT.fonte, size: ABNT.tamanhoMenor, color: "000000" },
      paragraph: {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 240, after: 240, line: ABNT.espacamento1 },
        indent: { left: ABNT.recuoCitacao },
      },
    },
  ],
};
