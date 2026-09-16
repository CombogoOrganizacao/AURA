import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento } from "../../document/types";
import { fromDocumento } from "./fromDocumento";

// O que dá para provar aqui é a ESTRUTURA do campo: que existe um `TOC` no
// lugar certo, pedindo os níveis certos, e que o documento manda o Word
// atualizar os campos ao abrir. O número de página em si é calculado pelo
// Word — **nenhum teste deste arquivo prova que ele sai correto**, e é por
// isso que o passo 3.6.2 é 🔍 (CLAUDE.md, "Verificação"): inspecionar o XML
// não substitui abrir o `.docx` e usar "Atualizar sumário".

async function xmlDe(documento: Documento, parte = "word/document.xml"): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return zip.file(parte)!.async("string");
}

function documentoComTresNiveis(): Documento {
  const documento = novoDocumento();
  documento.sections = [
    { id: "s1", ordem: 0, nivel: 1, titulo: "Introdução", content: [] },
    { id: "s2", ordem: 1, nivel: 1, titulo: "Referencial teórico", content: [] },
    { id: "s3", ordem: 2, nivel: 2, titulo: "Metodologia", content: [] },
    { id: "s4", ordem: 3, nivel: 3, titulo: "Instrumentos", content: [] },
  ];
  return documento;
}

describe("sumário no .docx como campo TOC (passo 3.6.2)", () => {
  it("é um campo TOC, não uma lista de entradas escritas pelo exportador", async () => {
    const xml = await xmlDe(documentoComTresNiveis());

    expect(xml).toContain('<w:fldChar w:fldCharType="begin" w:dirty="true"/>');
    expect(xml).toMatch(/<w:instrText[^>]*>TOC [^<]*<\/w:instrText>/);
    expect(xml).toContain('<w:fldChar w:fldCharType="end"/>');
  });

  it("pede os níveis 1-3, ligando o campo aos estilos Heading1-Heading3", async () => {
    const instrucao = (await xmlDe(documentoComTresNiveis())).match(
      /<w:instrText[^>]*>(TOC [^<]*)<\/w:instrText>/,
    )![1];

    // `\o "1-3"` é a ligação com os estilos nomeados de `styles.ts`; `\h`
    // faz cada entrada virar link para o título no corpo.
    expect(instrucao).toContain("\o &quot;1-3&quot;");
    expect(instrucao).toContain("\h");
  });

  it("word/settings.xml traz <w:updateFields/>, para o Word preencher as páginas ao abrir", async () => {
    expect(await xmlDe(documentoComTresNiveis(), "word/settings.xml")).toContain(
      "<w:updateFields/>",
    );
  });

  it("o título SUMÁRIO usa TituloPreTextual, e não um estilo de título — o sumário não se lista", async () => {
    const xml = await xmlDe(documentoComTresNiveis());

    const posTitulo = xml.indexOf("SUMÁRIO");
    const paragrafo = xml.slice(xml.lastIndexOf("<w:p>", posTitulo), posTitulo);

    expect(paragrafo).toContain('<w:pStyle w:val="TituloPreTextual"/>');
    expect(paragrafo).not.toMatch(/<w:pStyle w:val="Heading\d"\/>/);
  });

  it("o campo fica no fim dos pré-textuais, depois do resumo e antes do corpo (NBR 6027)", async () => {
    const documento = documentoComTresNiveis();
    documento.metadados.resumo = "Este trabalho investiga X.";

    const xml = await xmlDe(documento);

    expect(xml.indexOf("RESUMO")).toBeLessThan(xml.indexOf("SUMÁRIO"));
    expect(xml.indexOf("SUMÁRIO")).toBeLessThan(xml.indexOf("Introdução"));
  });

  // O campo copia o texto do parágrafo de título do corpo — então a grafia
  // da entrada do sumário É a grafia do corpo. Sem indicativo aqui, o
  // sumário sai sem indicativo (NBR 6024/6027).
  it("os títulos do corpo saem com o indicativo numérico derivado", async () => {
    const xml = await xmlDe(documentoComTresNiveis());

    expect(xml).toContain("1 Introdução");
    expect(xml).toContain("2 Referencial teórico");
    expect(xml).toContain("2.1 Metodologia");
    expect(xml).toContain("2.1.1 Instrumentos");
  });

  it("o indicativo não é gravado em `Secao.titulo` — só existe na saída", async () => {
    const documento = documentoComTresNiveis();
    await xmlDe(documento);

    expect(documento.sections.map((secao) => secao.titulo)).toEqual([
      "Introdução",
      "Referencial teórico",
      "Metodologia",
      "Instrumentos",
    ]);
  });
});
