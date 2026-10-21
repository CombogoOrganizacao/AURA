import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { confirmarTabela } from "./apoio";

// Passo 8.5.3 — os controles da grade no estilo do Canva: alças "⋯" na
// coluna e na linha do cursor, e "+" nas bordas.

const BOTAO_TABELA = "Tabela (só no computador) — padrão IBGE, laterais abertas";

async function tabela3x3(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();
  await page.getByRole("button", { name: BOTAO_TABELA }).click();
  await confirmarTabela(page, 3, 3);
  // Cursor já na primeira célula: preenche a grade pelo teclado, célula a
  // célula, clicando em cada uma.
  const celulas = page.locator(".doc-tabela th, .doc-tabela td");
  const textos = ["A", "B", "C", "1", "2", "3", "4", "5", "6"];
  for (let i = 0; i < textos.length; i++) {
    await celulas.nth(i).click();
    await page.keyboard.type(textos[i]);
  }
}

const celulas = (page: Page) => page.locator(".doc-tabela th, .doc-tabela td");
const textos = (page: Page) => celulas(page).allTextContents();

test("as alças só aparecem com o cursor numa célula", async ({ page }) => {
  await tabela3x3(page);
  await expect(page.getByRole("button", { name: "Coluna: mais opções" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Linha: mais opções" })).toBeVisible();

  await page.locator(".ProseMirror p").first().click();
  await expect(page.getByRole("button", { name: "Coluna: mais opções" })).toHaveCount(0);
});

test("o + da direita acrescenta coluna e o de baixo acrescenta linha, no fim", async ({ page }) => {
  await tabela3x3(page);
  await celulas(page).nth(0).click();

  await page.getByRole("button", { name: "Acrescentar coluna no fim" }).click();
  await expect(page.locator(".doc-tabela th")).toHaveCount(4);
  // O cursor vai para a coluna nova, na mesma linha: dá para digitar.
  await page.keyboard.type("D");
  await expect(celulas(page).nth(3)).toHaveText("D");

  await page.getByRole("button", { name: "Acrescentar linha no fim" }).click();
  await expect(page.locator(".doc-tabela tr")).toHaveCount(4);
});

test("mover a linha e a coluna pelos menus", async ({ page }) => {
  await tabela3x3(page);

  // Coluna "B" (2ª) vai para a direita.
  await celulas(page).nth(1).click();
  await page.getByRole("button", { name: "Coluna: mais opções" }).click();
  await page.getByRole("menuitem", { name: "Mover coluna para a direita" }).click();
  expect(await textos(page)).toEqual(["A", "C", "B", "1", "3", "2", "4", "6", "5"]);

  // Linha "1 3 2" desce; o cabeçalho continua na primeira.
  await celulas(page).nth(3).click();
  await page.getByRole("button", { name: "Linha: mais opções" }).click();
  await page.getByRole("menuitem", { name: "Mover linha para baixo" }).click();
  expect(await textos(page)).toEqual(["A", "C", "B", "4", "6", "5", "1", "3", "2"]);
  await expect(page.locator(".doc-tabela th")).toHaveCount(3);
});

test("itens sem efeito ficam desabilitados, Esc fecha e devolve o foco ao texto", async ({
  page,
}) => {
  await tabela3x3(page);
  await celulas(page).nth(0).click();

  await page.getByRole("button", { name: "Coluna: mais opções" }).click();
  await expect(page.getByRole("menuitem", { name: "Mover coluna para a esquerda" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator(".ProseMirror")).toBeFocused();
});

test("linha de cabeçalho liga e desliga, e a tabela se exclui pelo menu", async ({ page }) => {
  await tabela3x3(page);
  await celulas(page).nth(3).click();

  await page.getByRole("button", { name: "Linha: mais opções" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Linha de cabeçalho" }).click();
  await expect(page.locator(".doc-tabela th")).toHaveCount(6);

  await page.getByRole("button", { name: "Linha: mais opções" }).click();
  await page.getByRole("menuitem", { name: "Excluir tabela" }).click();
  await expect(page.locator(".doc-tabela")).toHaveCount(0);
});

test("o espaço depois do travessão da legenda aparece", async ({ page }) => {
  await tabela3x3(page);
  const rotulo = page.locator(".doc-tabela .doc-legenda-rotulo");
  await expect(rotulo).toHaveCSS("white-space", "pre");
  await expect(rotulo).toHaveText("Tabela 1 — ");
});
