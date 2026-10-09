import { expect, test } from "@playwright/test";

// Apagar seção pela interface — pela barra (a seção do cursor) e pelo menu de
// botão direito do painel. Antes disto, uma seção criada não saía mais.

test.beforeEach(async ({ page }) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
});

test("seção vazia sai pela barra sem pedir confirmação", async ({ page }) => {
  await page.getByLabel("1 Título da seção").fill("Introdução");
  await page.getByRole("button", { name: "Nova seção", exact: true }).click();
  await expect(page.getByLabel("2 Título da seção")).toBeFocused();

  await page.locator("section").nth(1).locator("p").click();
  await page.getByRole("button", { name: /^Apagar a seção atual/ }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("2 Título da seção")).toHaveCount(0);
  await expect(page.getByLabel("1 Título da seção")).toHaveValue("Introdução");
});

test("seção com texto: o menu do painel pede confirmação, e Ctrl+Z traz de volta", async ({ page }) => {
  await page.getByLabel("1 Título da seção").fill("Introdução");
  await page.getByRole("button", { name: "Nova seção", exact: true }).click();
  // O foco chega ao título novo depois do render. Contra o build de produção
  // (6.6.5) a digitação ganhava dele, e "Mé" caía no título da seção 1.
  await expect(page.getByLabel("2 Título da seção")).toBeFocused();
  await page.keyboard.type("Método");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Texto do método.");

  const painel = page.getByRole("navigation", { name: "Seções do documento" });
  await painel.getByRole("button", { name: "Método", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Apagar seção" }).click();

  const dialogo = page.getByRole("dialog", { name: "Apagar seção?" });
  await expect(dialogo).toContainText("“Método”");
  await dialogo.getByRole("button", { name: "Apagar seção" }).click();

  await expect(painel).not.toContainText("Método");
  await expect(page.locator(".ProseMirror p", { hasText: "Texto do método." })).toHaveCount(0);

  await page.keyboard.press("Control+z");
  await expect(painel).toContainText("Método");
  await expect(page.locator(".ProseMirror p", { hasText: "Texto do método." })).toHaveCount(1);
});

test("a única seção não pode ser apagada", async ({ page }) => {
  // O painel só lista a seção depois da primeira edição do documento novo.
  await page.getByLabel("1 Título da seção").fill("Introdução");
  await page.locator(".ProseMirror p").first().click();
  await expect(page.getByRole("button", { name: /^Apagar a seção atual/ })).toBeDisabled();

  const painel = page.getByRole("navigation", { name: "Seções do documento" });
  await painel.getByRole("button", { name: "Introdução", exact: true }).click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Apagar seção" })).toBeDisabled();
});
