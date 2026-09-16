import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento, NoConteudo } from "../../document/types";
import { fromDocumento } from "./fromDocumento";

async function documentXmlDe(content: NoConteudo[]): Promise<string> {
  const documento: Documento = novoDocumento();
  documento.sections = [{ id: "s1", ordem: 0, nivel: 1, titulo: "Resultados", content }];

  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return zip.file("word/document.xml")!.async("string");
}

function figura(id: string, legenda = "", fonte = ""): NoConteudo {
  return { type: "figura", id, legenda, fonte, imagem: null };
}

describe("legenda de figura/tabela no .docx (passo 3.6.3)", () => {
  // O número é campo `SEQ`, não texto — mesmo raciocínio do campo `TOC` no
  // sumário (3.6.2): quem conta é o Word, então inserir uma figura no meio do
  // arquivo JÁ EXPORTADO renumera as seguintes sem reexportar nada.
  it("o número é um campo SEQ, não um número escrito pelo exportador", async () => {
    const xml = await documentXmlDe([figura("f1", "Fluxo do processo")]);

    expect(xml).toMatch(/<w:instrText[^>]*>\s*SEQ Figura[^<]*<\/w:instrText>/);
    expect(xml).toContain("Fluxo do processo");
    // O "1" não aparece escrito em lugar nenhum da legenda — se aparecesse,
    // seria um número gravado, exatamente o que docs/schema-tiptap.md §2
    // proíbe.
    expect(xml).not.toContain("Figura 1");
  });

  it("figura e tabela usam sequências SEQ distintas", async () => {
    const xml = await documentXmlDe([
      figura("f1"),
      { type: "tabela", id: "t1", legenda: "", fonte: "", linhas: [] },
    ]);

    expect(xml).toMatch(/SEQ Figura/);
    expect(xml).toMatch(/SEQ Tabela/);
  });

  // Ancorado no início de um `<w:t>`: o travessão do placeholder da capa
  // ("Capa — metadados chegam...") também é um " — " solto no XML, e casar
  // por substring nua encontraria aquele em vez deste.
  it("o travessão e o título só saem quando há legenda digitada", async () => {
    expect(await documentXmlDe([figura("f1", "Fluxo")])).toMatch(/<w:t[^>]*> — Fluxo</);
    expect(await documentXmlDe([figura("f1")])).not.toMatch(/<w:t[^>]*> — /);
  });

  it("omite a linha Fonte quando o campo está vazio, e a escreve quando não está", async () => {
    expect(await documentXmlDe([figura("f1", "Fluxo", "IBGE (2024)")])).toContain(
      "Fonte: IBGE (2024)",
    );
    expect(await documentXmlDe([figura("f1", "Fluxo")])).not.toContain("Fonte:");
  });

  // Legenda ACIMA, fonte ABAIXO. Convenção corrente, não regra conferida na
  // fonte primária — ver o cabeçalho de `document/elements/legenda.ts`.
  it("a legenda vem antes do objeto e a fonte depois", async () => {
    const xml = await documentXmlDe([figura("f1", "Fluxo do processo", "IBGE (2024)")]);

    expect(xml.indexOf("Fluxo do processo")).toBeLessThan(xml.indexOf("espaço reservado"));
    expect(xml.indexOf("espaço reservado")).toBeLessThan(xml.indexOf("Fonte: IBGE (2024)"));
  });

  // O que este passo NÃO entrega, dito por teste para ninguém supor o
  // contrário: a imagem em `word/media/` é 6.1.2 e a grade OOXML é 6.1.3.
  it("figura e tabela saem com placeholder no lugar do objeto, não em silêncio", async () => {
    const xml = await documentXmlDe([
      figura("f1", "Fluxo"),
      { type: "tabela", id: "t1", legenda: "Faixas", fonte: "", linhas: [] },
    ]);

    expect(xml).toContain("espaço reservado para a imagem");
    expect(xml).toContain("grade da tabela ainda não exportada");
  });
});
