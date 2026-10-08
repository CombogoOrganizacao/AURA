import { expect, test } from "@playwright/test";

test("abre a home e confere o título", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AURA/);
});

// O `LinkButton` numa página de servidor recebia as classes do `Button`
// (módulo de cliente) como referência de cliente: o `class` saía com o texto
// de uma função de erro e o link, sem forma de botão (achado no 6.4.3).
test("os CTAs da landing têm a forma de botão", async ({ page }) => {
  await page.goto("/");
  const comece = page.getByRole("link", { name: "Comece agora!" }).first();
  const conta = page.getByRole("link", { name: "Já tenho conta" });
  for (const link of [comece, conta]) {
    await expect(link).not.toHaveAttribute("class", /function|Error/);
    await expect(link).toHaveCSS("border-top-width", "1px");
    await expect(link).toHaveCSS("border-top-color", "rgb(112, 0, 27)");
  }
  await expect(comece).toHaveCSS("background-color", "rgb(112, 0, 27)");
});
