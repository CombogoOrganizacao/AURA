import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento } from "../../document/types";
import { fromDocumento, larguraIndicativo } from "./fromDocumento";

// Fonte escolhida pelo aluno (Times New Roman ou Arial) no `.docx`. O que dá
// para provar aqui é que o estilo pede a família certa; se o Word a desenha
// como devia, só abrindo o arquivo.

async function estilosDe(documento: Documento): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return zip.file("word/styles.xml")!.async("string");
}

function comFonte(fonte?: "times" | "arial"): Documento {
  const documento = novoDocumento();
  documento.metadados.fonte = fonte;
  documento.sections = [{ id: "s1", ordem: 0, nivel: 1, titulo: "Introdução", content: [] }];
  return documento;
}

describe("fonte do trabalho no .docx", () => {
  it("sem escolha, sai Times New Roman, como antes da caixa existir", async () => {
    const estilos = await estilosDe(comFonte());
    expect(estilos).toContain('w:ascii="Times New Roman"');
    expect(estilos).not.toContain('w:ascii="Arial"');
  });

  it("Arial escolhida: todos os estilos pedem Arial, nenhum Times", async () => {
    const estilos = await estilosDe(comFonte("arial"));
    expect(estilos).toContain('w:ascii="Arial"');
    expect(estilos).not.toContain("Times New Roman");
  });
});

describe("larguraIndicativo — recuo do título pela largura do número", () => {
  it("Times: algarismo de meio eme, ponto e espaço de um quarto (12 pt)", () => {
    // "2.1 " = 120 + 60 + 120 + 60
    expect(larguraIndicativo("2.1")).toBe(360);
    expect(larguraIndicativo("2.1", "times")).toBe(360);
  });

  it("Arial: algarismo de 556 milésimos de eme, ponto e espaço de 278", () => {
    // 240 twips por eme: 133,44 + 66,72 + 133,44 + 66,72 = 400,32
    expect(larguraIndicativo("2.1", "arial")).toBe(400);
  });
});
