import { TextRun } from "docx";

import type { Trecho } from "../../document/elements/trechos";

// Trechos do inline (`document/elements/trechos.ts`, passo 4B.2) como runs do
// OOXML. Negrito e itálico só onde o aluno marcou: trecho sem destaque não
// grava `bold: false`, omite o atributo, como a lista de referências (4.11).
export function runsDeTrechos(trechos: readonly Trecho[]): TextRun[] {
  return trechos.map(
    (trecho) =>
      new TextRun({
        text: trecho.texto,
        ...(trecho.negrito ? { bold: true } : {}),
        ...(trecho.italico ? { italics: true } : {}),
      }),
  );
}
