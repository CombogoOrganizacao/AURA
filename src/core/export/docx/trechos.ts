import { Math as MathDocx, TextRun, type FootnoteReferenceRun } from "docx";

import type { Trecho } from "../../document/elements/trechos";

import { ommlDoLatex } from "./formula";
import type { NotasDeRodape } from "./notas";

// Trechos do inline (`document/elements/trechos.ts`, passo 4B.2) como runs do
// OOXML. Negrito e itálico só onde o aluno marcou: trecho sem destaque não
// grava `bold: false`, omite o atributo, como a lista de referências (4.11).
//
// A nota de rodapé (6.1.3c) vira a referência de nota do Word e o conteúdo
// dela vai para `notas`. Sem `notas`, uma nota **lança** em vez de sair como
// texto no meio do parágrafo: quem chama sem registro é a célula de tabela,
// que pelo tipo (`CelulaTabela`) não tem nota, e uma nota ali seria defeito a
// aparecer, não a esconder.
export function runsDeTrechos(
  trechos: readonly Trecho[],
  notas?: NotasDeRodape,
): (TextRun | FootnoteReferenceRun | MathDocx)[] {
  return trechos.map((trecho) => {
    // Fórmula no meio da frase (6.2.11): a mesma conversão da fórmula em
    // bloco (`ommlDoLatex`), sem o parágrafo próprio. LaTeX que não converte
    // sai como o texto que o aluno escreveu, como no bloco.
    if (trecho.papel === "formula") {
      const { componentes } = ommlDoLatex(trecho.texto);
      return componentes ? new MathDocx({ children: componentes }) : new TextRun(trecho.texto);
    }
    if (trecho.papel === "nota") {
      if (!notas) throw new Error("Nota de rodapé fora de parágrafo: não há onde registrá-la");
      return notas.referencia(trecho.texto);
    }
    return new TextRun({
      text: trecho.texto,
      ...(trecho.negrito ? { bold: true } : {}),
      ...(trecho.italico ? { italics: true } : {}),
    });
  });
}
