import { expect, test } from "@playwright/test";

// Caixa de estilo e indicador de tamanho da barra. Antes eram prévias
// desligadas, e o tamanho mostrava "10" no corpo de 12.

test("estilo troca corpo ↔ citação longa, e o tamanho acompanha o que a norma fixa", async ({
  page,
}) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);

  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type("Trecho que vai virar citação longa.");

  const estilo = page.getByRole("combobox", { name: "Estilo do parágrafo" });
  const tamanho = page.getByLabel("Tamanho da fonte");

  await expect(estilo).toHaveValue("corpo");
  await expect(tamanho).toHaveText("12");

  await estilo.selectOption("citacao_longa");
  await expect(page.locator(".ProseMirror blockquote")).toContainText(
    "Trecho que vai virar citação longa.",
  );
  await expect(estilo).toHaveValue("citacao_longa");
  await expect(tamanho).toHaveText("10");

  await estilo.selectOption("corpo");
  await expect(page.locator(".ProseMirror p", { hasText: "Trecho que vai virar" })).toHaveCount(1);
  await expect(tamanho).toHaveText("12");
});

test("fonte do trabalho: Arial muda a folha e continua escolhida depois de recarregar", async ({
  page,
}) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.getByLabel("1 Título da seção").fill("Introdução");

  const fonte = page.getByRole("combobox", { name: "Fonte do trabalho" });
  const familiaDaFolha = () =>
    page.locator(".ProseMirror").evaluate((no) => getComputedStyle(no).fontFamily);

  await expect(fonte).toHaveValue("times");
  expect(await familiaDaFolha()).toContain("Times New Roman");

  await fonte.selectOption("arial");
  await expect.poll(familiaDaFolha).toContain("Arial");

  // O salvamento automático grava a escolha junto com o documento.
  await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Fonte do trabalho" })).toHaveValue("arial");
  expect(await familiaDaFolha()).toContain("Arial");
});
