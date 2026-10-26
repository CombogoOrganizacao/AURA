import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { eDocAntigo, eDocx, recusaDoDocx } from "./arquivo";

async function zipCom(arquivos: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [nome, conteudo] of Object.entries(arquivos)) zip.file(nome, conteudo);
  return zip.generateAsync({ type: "uint8array" });
}

describe("arquivo .docx", () => {
  it("o .docx se reconhece pela parte word/document.xml, e o .zip do LaTeX não", async () => {
    const docx = await zipCom({ "[Content_Types].xml": "<x/>", "word/document.xml": "<w/>" });
    const projeto = await zipCom({ "main.tex": "\\documentclass{article}" });
    expect(eDocx(docx)).toBe(true);
    expect(recusaDoDocx(docx)).toBeNull();
    expect(eDocx(projeto)).toBe(false);
  });

  it("o .doc antigo e o .zip sem documento são recusados com a saída pelo Word", async () => {
    // A assinatura do formato binário antigo (OLE), seguida de zeros.
    const doc = new Uint8Array(48);
    doc.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(eDocAntigo(doc)).toBe(true);
    expect(recusaDoDocx(doc)).toContain("Salvar como → Documento do Word (.docx)");
    expect(recusaDoDocx(await zipCom({ "main.tex": "x" }))).toContain("não é um .docx legível");
  });

  it("acima do limite de partes, recusa antes de descompactar", async () => {
    const partes: Record<string, string> = { "word/document.xml": "<w/>" };
    for (let i = 0; i < 300; i++) partes[`word/media/i${i}.png`] = "x";
    expect(recusaDoDocx(await zipCom(partes))).toContain("o limite é 300");
  });
});
