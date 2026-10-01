import { expect, test } from "@playwright/test";

// Criar seção pela interface (passo 6.2.7). Antes não havia comando nenhum:
// os botões de nível só mudavam o nível da seção do cursor, e o documento
// nunca passava de "1".

test("cria seção pelo painel e subseção pela barra, digitando em cada uma", async ({ page }) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);

  await page.getByLabel("1 Título da seção").fill("Introdução");
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type("Texto da introdução.");

  // Painel: "Nova seção" cria a 2 e põe o foco no título dela.
  await page.getByRole("button", { name: "Nova seção", exact: true }).click();
  const titulo2 = page.getByLabel("2 Título da seção");
  await expect(titulo2).toBeFocused();
  await page.keyboard.type("Método");
  // Enter no título leva ao texto da seção.
  await page.keyboard.press("Enter");
  await page.keyboard.type("Texto do método.");

  // Barra: "Nova subseção" cria a 2.1.
  await page.getByRole("button", { name: /^Nova subseção/ }).click();
  await expect(page.getByLabel("2.1 Título da seção")).toBeFocused();
  await page.keyboard.type("Amostra");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Texto da amostra.");

  const painel = page.getByRole("navigation", { name: "Seções do documento" });
  await expect(painel).toContainText("1");
  await expect(painel).toContainText("Introdução");
  await expect(painel).toContainText("Método");
  await expect(painel).toContainText("2.1");
  await expect(painel).toContainText("Amostra");

  await expect(page.locator('section[data-nivel="2"] p')).toHaveText("Texto da amostra.");
  await expect(page.locator(".ProseMirror p", { hasText: "Texto do método." })).toHaveCount(1);
});
