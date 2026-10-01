import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import { fromDocumento as paraEditor, toDocumento } from "../../document/serialize";
import type { Documento, NoConteudo, NoInline } from "../../document/types";
import { gerarTex } from "../latex/document";
import { fromDocumento } from "./fromDocumento";

// Passo 6.2.11. O XML prova que a fórmula no meio da frase sai como equação
// nativa (OMML) dentro do mesmo parágrafo, entre os trechos de texto. Como o
// Word a desenha na linha só se confere abrindo nele.

const texto = (text: string): NoInline => ({ type: "text", text });
const formula = (latex: string): NoInline => ({ type: "formula_inline", texto: latex });

function documentoCom(...content: NoConteudo[]): Documento {
  const documento = novoDocumento();
  documento.sections = [{ id: "s1", ordem: 0, nivel: 1, titulo: "Métricas", content }];
  return documento;
}

async function xmlDoCorpo(documento: Documento): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return zip.file("word/document.xml")!.async("string");
}

describe("fórmula no meio da frase", () => {
  const paragrafo: NoConteudo = {
    type: "paragraph",
    content: [texto("expressa por "), formula("PDR = \\frac{a}{b}"), texto(". O aumento")],
  };

  it("sai no .docx como equação dentro do parágrafo, entre os textos", async () => {
    const xml = await xmlDoCorpo(documentoCom(paragrafo));
    const doParagrafo = xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*expressa por[\s\S]*?<\/w:p>/)?.[0];
    expect(doParagrafo).toBeDefined();
    const ordem = doParagrafo!.match(/expressa por|<m:oMath>|<m:f>|\. O aumento/g);
    expect(ordem).toEqual(["expressa por", "<m:oMath>", "<m:f>", ". O aumento"]);
    // Nem o LaTeX cru no texto do parágrafo.
    expect(doParagrafo).not.toContain("\\frac");
  });

  it("LaTeX que não converte sai como o texto escrito", async () => {
    const xml = await xmlDoCorpo(
      documentoCom({ type: "paragraph", content: [texto("x "), formula("\\frac{a")] }),
    );
    expect(xml).toContain("\\frac{a");
  });

  it("vai e volta pelo editor sem perder nada", () => {
    const secoes = documentoCom(paragrafo).sections;
    expect(toDocumento(paraEditor(secoes))).toEqual(secoes);
  });

  it("no .tex, entre $; inválida, em \\texttt", () => {
    const valido = gerarTex(documentoCom(paragrafo));
    expect(valido).toContain("expressa por $PDR = \\frac{a}{b}$. O aumento");
    const invalido = gerarTex(
      documentoCom({ type: "paragraph", content: [texto("x "), formula("\\frac{a")] }),
    );
    expect(invalido).toContain("x \\texttt{");
  });
});
