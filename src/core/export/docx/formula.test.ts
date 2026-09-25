import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento } from "../../document/types";
import { recursosForaDoWord } from "./formula";
import { fromDocumento } from "./fromDocumento";
import { lerXml, mathmlDoLatex } from "./mathml";

// Passo 6.1.4. O XML prova que a fórmula sai como equação nativa (OMML) e com
// a estrutura certa; como o Word a desenha só se confere abrindo nele.

async function paragrafoDaFormula(latex: string): Promise<string> {
  const documento: Documento = novoDocumento();
  documento.sections = [
    { id: "s1", ordem: 0, nivel: 1, titulo: "Métodos", content: [{ type: "formula", texto: latex }] },
  ];
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  const xml = await zip.file("word/document.xml")!.async("string");
  // O parágrafo da fórmula é o único com equação — ou, com LaTeX inválido,
  // o que traz o código-fonte como texto.
  return xml
    .split("<w:p>")
    .find((trecho) => trecho.includes("<m:oMath>") || trecho.includes(latex))!;
}

// Os textos dos `m:t` da equação, na ordem.
function textos(xml: string): string[] {
  return [...xml.matchAll(/<m:t[^>]*>([^<]*)<\/m:t>/g)].map((achado) => achado[1]);
}

describe("leitor de MathML", () => {
  it("lê elementos, atributos, texto e entidades", () => {
    const raiz = lerXml('<mrow><mo fence="true">(</mo><mi>x</mi><mo>&lt;</mo></mrow>');
    const [mrow] = raiz.filhos;
    expect(mrow.filhos.map((no) => [no.tag, no.texto])).toEqual([
      ["mo", "("],
      ["mi", "x"],
      ["mo", "<"],
    ]);
    expect(mrow.filhos[0].atributos).toEqual({ fence: "true" });
  });

  it("devolve null para LaTeX inválido", () => {
    expect(mathmlDoLatex("\\frac{a")).toBeNull();
  });
});

describe("fórmula no .docx como equação do Word (OMML)", () => {
  it("E = mc²: equação nativa, com o expoente como índice superior", async () => {
    const xml = await paragrafoDaFormula("E = mc^2");
    expect(xml).toContain("<m:oMath>");
    expect(xml).toContain("<m:sSup>");
    expect(textos(xml)).toEqual(["E", "=", "m", "c", "2"]);
    // Destacada: parágrafo próprio e centralizado (14724 §5.7).
    expect(xml).toContain('<w:jc w:val="center"/>');
    // O código-fonte não sai como texto.
    expect(xml).not.toContain("mc^2");
  });

  it("fração, raiz com índice e subscrito com sobrescrito", async () => {
    const xml = await paragrafoDaFormula("\\frac{a+b}{\\sqrt[3]{x_i^2}}");
    expect(xml).toContain("<m:f>");
    expect(xml).toMatch(/<m:num>[\s\S]*a[\s\S]*<\/m:num>/);
    expect(xml).toContain("<m:rad>");
    expect(xml).toMatch(/<m:deg>[\s\S]*>3<[\s\S]*<\/m:deg>/);
    expect(xml).toContain("<m:sSubSup>");
  });

  it("somatório com limites leva o termo como base do n-ário", async () => {
    const xml = await paragrafoDaFormula("\\sum_{i=1}^{n} x_i");
    expect(xml).toContain("<m:nary>");
    expect(xml).toContain('<m:chr m:val="∑"/>');
    expect(xml).toMatch(/<m:sub>[\s\S]*i[\s\S]*=[\s\S]*1[\s\S]*<\/m:sub>/);
    expect(xml).toMatch(/<m:e>[\s\S]*<m:sSub>[\s\S]*x[\s\S]*<\/m:e>/);
  });

  it("produtório e integral: n-ário com o símbolo certo", async () => {
    expect(await paragrafoDaFormula("\\prod_{k=1}^n k")).toContain('<m:chr m:val="∏"/>');
    const integral = await paragrafoDaFormula("\\int_0^1 f(x)\\,dx");
    expect(integral).toContain("<m:nary>");
    expect(integral).toContain('<m:limLoc m:val="subSup"/>');
  });

  it("\\left( \\right) vira delimitador que cresce com o conteúdo", async () => {
    const xml = await paragrafoDaFormula("\\left( \\frac{1}{2} \\right)");
    expect(xml).toMatch(/<m:d>[\s\S]*<m:f>/);
    expect(textos(xml)).not.toContain("(");
  });

  it("|x| com \\left| \\right| vira delimitador com o caractere da barra", async () => {
    const xml = await paragrafoDaFormula("\\left| x \\right|");
    expect(xml).toMatch(/<m:begChr m:val="∣"\/>/);
    expect(xml).toMatch(/<m:endChr m:val="∣"\/>/);
  });

  it("função (sin, lim) sai como função do Word, com o nome separado do argumento", async () => {
    const xml = await paragrafoDaFormula("\\lim_{x \\to 0} \\frac{\\sin x}{x}");
    expect(xml.match(/<m:func>/g)).toHaveLength(2);
    expect(xml).toMatch(/<m:fName>[\s\S]*<m:limLow>[\s\S]*lim/);
    expect(xml).toMatch(/<m:fName>[\s\S]*sin[\s\S]*<\/m:fName>/);
  });

  it("acento matemático (x̄) vira acento da equação; acento de texto vira a letra", async () => {
    const barra = await paragrafoDaFormula("\\bar{x}");
    expect(barra).toContain("<m:acc>");
    expect(barra).toContain('<m:chr m:val="̄"/>');

    const texto = await paragrafoDaFormula("\\text{média} = 5");
    expect(textos(texto).join("")).toContain("média");
    expect(texto).not.toContain("<m:acc>");
  });

  it("LaTeX inválido sai como o próprio código-fonte, em texto", async () => {
    const xml = await paragrafoDaFormula("\\frac{a");
    expect(xml).not.toContain("<m:oMath>");
    expect(xml).toContain("\\frac{a");
  });
});

describe("o que não chega ao Word fica registrado", () => {
  it("fórmula comum: nada fora", () => {
    expect(recursosForaDoWord("\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i")).toEqual([]);
  });

  it("matriz e estilo de letra são listados, uma vez cada", () => {
    expect(
      recursosForaDoWord(
        "\\mathbf{A} = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} + \\mathbf{B}",
      ),
    ).toEqual(["estilo de letra (\\mathbf, \\mathcal, \\mathbb…)", "matriz ou equações alinhadas (\\begin{…})"]);
  });

  it("LaTeX inválido não lista nada: o aviso que vale é o de erro", () => {
    expect(recursosForaDoWord("\\frac{a")).toEqual([]);
  });
});
