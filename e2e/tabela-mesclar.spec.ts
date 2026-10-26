import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import JSZip from "jszip";

import { clicarExportar, confirmarTabela } from "./apoio";

// Passo 8.5.4 — mesclar e separar células pela tela: o botão da seleção, os
// itens dos menus, o desfazer e o `.docx`. O Vitest prova a regra e cada
// comando (`tabelaMescla.test.ts`, `export/docx/table.test.ts`); aqui, o
// caminho do aluno no navegador. Como o Word e o LibreOffice desenham a
// mescla só se confere abrindo-os (passo 🔍).

const BOTAO_TABELA = "Tabela (só no computador) — padrão IBGE, laterais abertas";

async function tabela3x3(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();
  await page.getByRole("button", { name: BOTAO_TABELA }).click();
  await confirmarTabela(page, 3, 3);
  const celulas = page.locator(".doc-tabela th, .doc-tabela td");
  const textos = ["Região", "Ano", "Total", "Sul", "2020", "10", "Norte", "2021", "20"];
  for (let i = 0; i < textos.length; i++) {
    await celulas.nth(i).click();
    await page.keyboard.type(textos[i]);
  }
}

// As células visíveis: a coberta fica no documento, mas fora do layout.
const visiveis = (page: Page) =>
  page.locator(".doc-tabela th:not([data-coberta]), .doc-tabela td:not([data-coberta])");

test("arrastar de uma célula a outra mostra o botão, e mesclar junta o texto", async ({ page }) => {
  await tabela3x3(page);
  const celulas = page.locator(".doc-tabela th, .doc-tabela td");
  // Linha 1: "Sul" a "2020".
  const de = await celulas.nth(3).boundingBox();
  const ate = await celulas.nth(4).boundingBox();
  await page.mouse.move(de!.x + 8, de!.y + de!.height / 2);
  await page.mouse.down();
  await page.mouse.move(ate!.x + 8, ate!.y + ate!.height / 2, { steps: 6 });
  await page.mouse.up();

  await page.getByRole("button", { name: "Mesclar células" }).click();
  await expect(page.locator(".doc-tabela [data-coberta]")).toHaveCount(1);
  await expect(visiveis(page)).toHaveCount(8);
  await expect(page.locator(".doc-tabela td[colspan='2']")).toHaveText("Sul 2020");
});

test("o menu mescla com a vizinha, separar devolve as células, e o desfazer volta tudo", async ({
  page,
}) => {
  await tabela3x3(page);
  const celulas = page.locator(".doc-tabela th, .doc-tabela td");

  // "Sul" com a de baixo ("Norte"), pelo menu da linha.
  await celulas.nth(3).click();
  await page.getByRole("button", { name: "Linha: mais opções" }).click();
  await page.getByRole("menuitem", { name: "Mesclar com a célula de baixo" }).click();
  await expect(page.locator(".doc-tabela td[rowspan='2']")).toHaveText("Sul Norte");

  // Com a mescla, o menu oferece separar, e a linha presa não anda.
  await page.getByRole("button", { name: "Linha: mais opções" }).click();
  await expect(page.getByRole("menuitem", { name: "Mover linha para baixo" })).toBeDisabled();
  await page.getByRole("menuitem", { name: "Separar células" }).click();
  await expect(page.locator(".doc-tabela [data-coberta]")).toHaveCount(0);
  await expect(celulas.nth(3)).toHaveText("Sul Norte");
  await expect(celulas.nth(6)).toHaveText("");

  // Ctrl+Z desfaz a separação num passo, e de novo, a mescla.
  await page.keyboard.press("Control+z");
  await expect(page.locator(".doc-tabela td[rowspan='2']")).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".doc-tabela [rowspan]")).toHaveCount(0);
  await expect(celulas.nth(3)).toHaveText("Sul");
  await expect(celulas.nth(6)).toHaveText("Norte");
});

test("Tab pula a célula coberta, e cabeçalho com corpo não se mescla", async ({ page }) => {
  await tabela3x3(page);
  const celulas = page.locator(".doc-tabela th, .doc-tabela td");

  await celulas.nth(3).click();
  await page.getByRole("button", { name: "Coluna: mais opções" }).click();
  await page.getByRole("menuitem", { name: "Mesclar com a célula à direita" }).click();
  await celulas.nth(3).click();
  await page.keyboard.press("Tab");
  await page.keyboard.type("!");
  // Sul+2020 mesclados; o Tab foi para "10" (no começo dele), pulando a coberta.
  await expect(celulas.nth(5)).toHaveText("!10");

  // O cabeçalho (linha 0) não se junta ao corpo.
  await celulas.nth(0).click();
  await page.getByRole("button", { name: "Linha: mais opções" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Mesclar com a célula de baixo" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
});

test("a mescla sai no .docx com gridSpan e vMerge", async ({ page }) => {
  await tabela3x3(page);
  const celulas = page.locator(".doc-tabela th, .doc-tabela td");
  await celulas.nth(3).click();
  await page.getByRole("button", { name: "Coluna: mais opções" }).click();
  await page.getByRole("menuitem", { name: "Mesclar com a célula à direita" }).click();
  // "10" com a de baixo ("20"): a mescla de duas linhas.
  await celulas.nth(5).click();
  await page.getByRole("button", { name: "Linha: mais opções" }).click();
  await page.getByRole("menuitem", { name: "Mesclar com a célula de baixo" }).click();

  const baixou = page.waitForEvent("download");
  await clicarExportar(page);
  const zip = await JSZip.loadAsync(readFileSync((await (await baixou).path())!));
  const xml = await zip.file("word/document.xml")!.async("string");
  const tbl = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)![0];
  expect(tbl).toContain('<w:gridSpan w:val="2"/>');
  expect(tbl).toContain(">Sul 2020</w:t>");
  expect(tbl).toContain('<w:vMerge w:val="restart"/>');
  expect(tbl).toContain('<w:vMerge w:val="continue"/>');
  // Cada linha do aluno soma 3 colunas da grade.
  for (const tr of tbl.match(/<w:tr>[\s\S]*?<\/w:tr>|<w:tr [\s\S]*?<\/w:tr>/g)!) {
    if (/w:hRule="exact"/.test(tr)) continue;
    const soma = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).reduce(
      (n, tc) => n + Number(/<w:gridSpan w:val="(\d+)"/.exec(tc)?.[1] ?? 1),
      0,
    );
    expect(soma).toBe(3);
  }
});

test("a mescla sobrevive ao recarregar a página", async ({ page }) => {
  await tabela3x3(page);
  const celulas = page.locator(".doc-tabela th, .doc-tabela td");
  await celulas.nth(3).click();
  await page.getByRole("button", { name: "Coluna: mais opções" }).click();
  await page.getByRole("menuitem", { name: "Mesclar com a célula à direita" }).click();
  await expect(page.locator(".doc-tabela td[colspan='2']")).toHaveText("Sul 2020");
  // O autosave grava depois de uma pausa.
  await expect(page.getByRole("banner").getByRole("status")).toHaveText("Salvo", {
    timeout: 15_000,
  });

  await page.reload();
  await expect(page.locator(".doc-tabela td[colspan='2']")).toHaveText("Sul 2020");
  await expect(page.locator(".doc-tabela [data-coberta]")).toHaveCount(1);
});
