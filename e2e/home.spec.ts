import { expect, test } from "@playwright/test";

test("abre a home e confere o título", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AURA/);
});
