import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { documentoCompleto, IMAGENS, imagensDoZip, PNG_1X1 } from "./__fixtures__/documento";
import { gerarTex } from "./document";
import { gerarZipTex } from "./zip";

// Passo 6.2.1 — o `.tex` compila com pdfLaTeX (docs/latex-abntex.md §1.4).
//
// Roda só onde há LaTeX instalado: `PDFLATEX` no ambiente, `pdflatex` no
// PATH, ou o MiKTeX instalado por usuário no Windows. Sem LaTeX, o teste é
// pulado, não aprovado: "pulado" aparece no relatório do Vitest. Compilar
// não prova que o PDF sai conforme a norma; isso é a conferência no
// Overleaf (🔍 do passo).

function acharPdflatex(): string | null {
  const candidatos = [
    process.env.PDFLATEX,
    "pdflatex",
    process.env.LOCALAPPDATA &&
      join(process.env.LOCALAPPDATA, "Programs", "MiKTeX", "miktex", "bin", "x64", "pdflatex.exe"),
  ].filter((candidato): candidato is string => Boolean(candidato));
  for (const candidato of candidatos) {
    const resultado = spawnSync(candidato, ["--version"], { encoding: "utf8" });
    if (resultado.status === 0) return candidato;
  }
  return null;
}

const pdflatex = acharPdflatex();

describe("gerarTex — compilação com pdfLaTeX", () => {
  it.skipIf(!pdflatex)(
    "o documento completo compila sem erro e gera o PDF",
    () => {
      const pasta = mkdtempSync(join(tmpdir(), "aura-tex-"));
      mkdirSync(join(pasta, "figuras"));
      writeFileSync(join(pasta, "figuras", "img1.png"), PNG_1X1);
      writeFileSync(join(pasta, "main.tex"), gerarTex(documentoCompleto(), IMAGENS), "utf8");

      // Duas passadas: a segunda resolve sumário e listas.
      const compilar = () =>
        spawnSync(pdflatex!, ["-interaction=nonstopmode", "-halt-on-error", "main.tex"], {
          cwd: pasta,
          encoding: "utf8",
        });
      for (const resultado of [compilar(), compilar()]) {
        expect(resultado.status, `pdflatex falhou; log em ${join(pasta, "main.log")}`).toBe(0);
      }
      expect(existsSync(join(pasta, "main.pdf"))).toBe(true);
    },
    300_000,
  );

  // Passo 6.2.3: o projeto do `.zip`, descompactado como o Overleaf faz, com
  // os capítulos em `sections/` por `\input`.
  it.skipIf(!pdflatex)(
    "o projeto do .zip, descompactado, compila sem erro",
    async () => {
      const documento = documentoCompleto();
      const zip = await JSZip.loadAsync(await gerarZipTex(documento, imagensDoZip(documento.id)));
      const pasta = mkdtempSync(join(tmpdir(), "aura-zip-"));
      for (const arquivo of Object.values(zip.files)) {
        if (arquivo.dir) continue;
        mkdirSync(dirname(join(pasta, arquivo.name)), { recursive: true });
        writeFileSync(join(pasta, arquivo.name), await arquivo.async("uint8array"));
      }

      const compilar = () =>
        spawnSync(pdflatex!, ["-interaction=nonstopmode", "-halt-on-error", "main.tex"], {
          cwd: pasta,
          encoding: "utf8",
        });
      for (const resultado of [compilar(), compilar()]) {
        expect(resultado.status, `pdflatex falhou; log em ${join(pasta, "main.log")}`).toBe(0);
      }
      expect(existsSync(join(pasta, "main.pdf"))).toBe(true);
    },
    300_000,
  );
});
