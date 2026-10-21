import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import JSZip from "jszip";

import { clicarExportar, confirmarTabela } from "./apoio";

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
  await confirmarTabela(page);
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
  await clicarExportar(page);
  const download = await downloadPromise;

  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  const xml = await zip.file("word/document.xml")!.async("string");

  const grade = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)?.[0];
  expect(grade).toBeDefined();
  for (const texto of textos) expect(grade).toContain(`>${texto}</w:t>`);
  // Repetem na quebra de página a linha de cabeçalho e a linha vazia de
  // respiro logo abaixo do traço dele (`table.ts`); as de dados, não.
  expect(grade!.match(/<w:tblHeader\/>/g)).toHaveLength(2);
  expect(xml).not.toContain("grade da tabela ainda não exportada");
});

// Passo 6.1.3b — a grade muda pela interface, e a mudança chega ao `.docx`.
test("tabela criada 2×2 vira 3×3 pela barra de grade e sai assim no .docx", async ({ page }) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();

  await page.getByRole("button", { name: BOTAO_TABELA }).click();
  await confirmarTabela(page);
  await page.getByLabel("Legenda — Tabela 1").fill("Matrículas por curso");

  const barra = page.getByRole("toolbar", { name: "Grade da tabela" });
  const celulas = page.locator(".doc-tabela th, .doc-tabela td");
  // A barra só aparece com o cursor numa célula.
  await celulas.nth(3).click();
  await expect(barra).toBeVisible();

  await barra.getByRole("button", { name: "Linha abaixo", exact: true }).click();
  await barra.getByRole("button", { name: "Coluna à direita", exact: true }).click();
  await expect(celulas).toHaveCount(9);
  // A linha nova é de corpo: o cabeçalho continua só na primeira.
  await expect(page.locator(".doc-tabela th")).toHaveCount(3);

  // O cursor segue a operação: linha nova, depois coluna nova — a última
  // célula da grade. Dá pra digitar direto, sem clicar de novo.
  await page.keyboard.type("novo");
  await expect(celulas.nth(8)).toHaveText("novo");

  const downloadPromise = page.waitForEvent("download");
  await clicarExportar(page);
  const download = await downloadPromise;

  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  const xml = await zip.file("word/document.xml")!.async("string");
  const grade = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)?.[0];
  expect(grade).toBeDefined();

  // Sem a linha vazia de respiro abaixo do traço do cabeçalho (`table.ts`),
  // que tem altura exata e também repete.
  const linhas = (grade!.match(/<w:tr>[\s\S]*?<\/w:tr>/g) ?? []).filter(
    (linha) => !linha.includes('w:hRule="exact"'),
  );
  expect(linhas).toHaveLength(3);
  for (const linha of linhas) expect(linha.match(/<w:tc>/g)).toHaveLength(3);
  expect(grade!.match(/<w:tblHeader\/>/g)).toHaveLength(2);
  expect(grade).toContain(">novo</w:t>");
});
