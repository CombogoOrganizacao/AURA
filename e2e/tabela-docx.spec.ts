import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import JSZip from "jszip";

// Passo 6.1.3 — a grade da tabela no `.docx`, pelo caminho que o aluno faz:
// inserir a tabela pela barra, digitar nas células e exportar. O Vitest
// (`src/core/export/docx/table.test.ts`) confere traço a traço contra o IBGE;
// aqui o que se prova é que o que foi digitado na tela chega à grade, e não
// ao aviso que ocupava o lugar dela até este passo.

const BOTAO_TABELA = "Tabela (só no computador) — padrão IBGE, laterais abertas";

test("tabela digitada na tela sai como grade no .docx", async ({ page }) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type("Parágrafo antes da tabela.");

  await page.getByRole("button", { name: BOTAO_TABELA }).click();
  await page.getByLabel("Legenda — Tabela 1").fill("Matrículas por curso");

  // `novaTabela()` nasce 2×2, com a primeira linha de cabeçalho.
  const celulas = page.locator(".doc-tabela th, .doc-tabela td");
  await expect(celulas).toHaveCount(4);
  const textos = ["Curso", "Alunos", "Letras", "33"];
  for (const [indice, texto] of textos.entries()) {
    await celulas.nth(indice).click();
    await page.keyboard.type(texto);
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("banner").getByRole("button", { name: "Exportar .docx" }).click();
  const download = await downloadPromise;

  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  const xml = await zip.file("word/document.xml")!.async("string");

  const grade = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)?.[0];
  expect(grade).toBeDefined();
  for (const texto of textos) expect(grade).toContain(`>${texto}</w:t>`);
  // Só a linha de cabeçalho repete quando a tabela quebra página.
  expect(grade!.match(/<w:tblHeader\/>/g)).toHaveLength(1);
  expect(xml).not.toContain("grade da tabela ainda não exportada");
});
