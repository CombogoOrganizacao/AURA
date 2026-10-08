import { expect, test } from "@playwright/test";

import { abrirDocumento, tresSecoes } from "./apoio";

// Passo 6.4.2 — sem login, o trabalho vive só neste navegador. O aviso diz
// isso e incentiva exportar, na lista e no editor. É fixo: não tem X, porque
// dispensado uma vez sumiria para sempre e o risco continuaria o mesmo.

test("na lista: diz que fica só neste navegador e incentiva exportar, sem X", async ({ page }) => {
  await abrirDocumento(page, tresSecoes());
  await page.goto("/documentos");

  const aviso = page.getByRole("status").filter({ hasText: "só neste navegador" });
  await expect(aviso).toContainText("Seus trabalhos ficam salvos só neste navegador");
  await expect(aviso).toContainText("aba anônima");
  await expect(aviso).toContainText("Exporte uma cópia");
  await expect(aviso.getByRole("button")).toHaveCount(0);

  // Continua lá depois de recarregar.
  await page.reload();
  await expect(aviso).toBeVisible();
});

test("na lista vazia, o aviso não aparece: só a ação de criar", async ({ page }) => {
  await page.goto("/documentos");
  await expect(page.getByText("Nenhum documento ainda.")).toBeVisible();
  await expect(page.getByText("só neste navegador")).toHaveCount(0);
});

test("no editor: selo ao lado do status, com a explicação na dica pelo teclado", async ({
  page,
}) => {
  await abrirDocumento(page, tresSecoes());

  // O elemento que recebe o foco e leva a dica, não o texto dentro dele.
  const selo = page
    .getByRole("banner")
    .locator("[aria-describedby]", { hasText: "Só neste navegador" });
  await expect(selo).toBeVisible();
  await selo.focus();
  const dica = page.locator(`[id="${await selo.getAttribute("aria-describedby")}"]`);
  await expect(dica).toBeVisible();
  await expect(dica).toContainText("trocar de computador apaga o trabalho");
  await expect(dica).toContainText("Exporte uma cópia");
});
