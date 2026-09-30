import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { documentoCompleto, imagensDoZip } from "./__fixtures__/documento";
import { camposOverleaf, paraBase64 } from "./overleaf";
import { gerarZipTex } from "./zip";

// Passo 6.3.1: o POST do "Abrir no Overleaf" (docs/latex-abntex.md §3.3).

describe("paraBase64", () => {
  it("dá o mesmo base64 do Node, também acima do tamanho de um pedaço", () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 37) % 256);
    expect(paraBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    expect(paraBase64(new Uint8Array())).toBe("");
  });
});

describe("camposOverleaf", () => {
  it("leva o projeto inteiro como data URL, com pdfLaTeX e o main.tex", async () => {
    const documento = documentoCompleto();
    const zip = await gerarZipTex(documento, imagensDoZip(documento.id));
    const campos = camposOverleaf(zip);

    expect(campos.engine).toBe("pdflatex");
    expect(campos.main_document).toBe("main.tex");
    expect(campos.snip_uri.startsWith("data:application/zip;base64,")).toBe(true);

    // O que o Overleaf recebe abre como o mesmo projeto.
    const base64 = campos.snip_uri.slice("data:application/zip;base64,".length);
    const recebido = await JSZip.loadAsync(Buffer.from(base64, "base64"));
    expect(Object.keys(recebido.files)).toContain("main.tex");
    expect(Object.keys(recebido.files)).toContain("referencias.bib");
    expect(Object.keys(recebido.files)).toContain("figuras/img1.png");
    expect(await recebido.file("main.tex")!.async("string")).toMatch(
      new RegExp(`^% AURA-DOCUMENTO: ${documento.id} v`),
    );
  });
});
