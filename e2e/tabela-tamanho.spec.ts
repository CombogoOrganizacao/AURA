import { expect, test } from "@playwright/test";

// Passo 8.5.1 — escolher o tamanho da tabela e cair na primeira célula.

const BOTAO_TABELA = "Tabela (só no computador) — padrão IBGE, laterais abertas";

async function documentoVazio(page: import("@playwright/test").Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();
}

const janela = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Inserir tabela" });

test("pela grade do mouse: 3 colunas × 4 linhas, e o cursor na primeira célula", async ({
  page,
}) => {
  await documentoVazio(page);
  await page.getByRole("button", { name: BOTAO_TABELA }).click();

  // A célula da coluna 3, linha 4, na grade de 8 colunas.
  const celula = janela(page).locator("div.cursor-pointer").nth(3 * 8 + 2);
  await celula.hover();
  await expect(janela(page).getByText("3 colunas × 4 linhas")).toBeVisible();
  await celula.click();
  await expect(janela(page)).toHaveCount(0);

  await expect(page.locator(".doc-tabela tr")).toHaveCount(4);
  await expect(page.locator(".doc-tabela th")).toHaveCount(3);
  await expect(page.locator(".doc-tabela td")).toHaveCount(9);

  // Sem clicar em lugar nenhum: o que se digita entra no cabeçalho.
  await page.keyboard.type("Curso");
  await expect(page.locator(".doc-tabela th").first()).toHaveText("Curso");
});

test("pelo teclado: Enter na janela insere o tamanho dos campos", async ({ page }) => {
  await documentoVazio(page);
  await page.getByRole("button", { name: BOTAO_TABELA }).click();

  // O foco já está em Colunas.
  await expect(janela(page).getByLabel("Colunas")).toBeFocused();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("4");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Control+a");
  await page.keyboard.type("3");
  await page.keyboard.press("Enter");

  await expect(janela(page)).toHaveCount(0);
  await expect(page.locator(".doc-tabela th")).toHaveCount(4);
  await expect(page.locator(".doc-tabela tr")).toHaveCount(3);
  await page.keyboard.type("A");
  await expect(page.locator(".doc-tabela th").first()).toHaveText("A");
});

test("números fora do limite são recolhidos, e vazio não insere", async ({ page }) => {
  await documentoVazio(page);
  await page.getByRole("button", { name: BOTAO_TABELA }).click();

  await janela(page).getByLabel("Colunas").fill("");
  await expect(janela(page).getByRole("button", { name: "Inserir tabela" })).toBeDisabled();

  await janela(page).getByLabel("Colunas").fill("99");
  await janela(page).getByLabel("Linhas").fill("2");
  await janela(page).getByRole("button", { name: "Inserir tabela" }).click();
  await expect(page.locator(".doc-tabela th")).toHaveCount(10);
});
