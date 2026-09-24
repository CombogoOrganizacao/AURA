import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Passo 5.3.2 — a aba Histórico. O Vitest prova a regra de quando gravar
// (`core/persistence/versaoAutomatica.ts`, com timers falsos) e a retenção;
// aqui, o caminho do aluno: dar nome a uma versão e vê-la na lista, e a
// versão automática aparecendo depois de 10 min de edição na tela de verdade.

async function novoDocumento(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
}

async function abrirHistorico(page: Page) {
  await page.getByRole("tab", { name: /Histórico/ }).click();
}

test("o nome dado à versão aparece na lista e continua lá depois de recarregar", async ({
  page,
}) => {
  await novoDocumento(page);
  await abrirHistorico(page);

  await expect(page.getByText("Nenhuma versão ainda")).toBeVisible();
  const salvar = page.getByRole("button", { name: "Salvar versão" });
  await expect(salvar).toBeDisabled();

  await page.getByRole("textbox", { name: "Nome da versão" }).fill("Enviada ao orientador");
  await salvar.click();

  const versoes = page.getByRole("list", { name: "Versões" });
  await expect(versoes.getByRole("listitem")).toHaveCount(1);
  await expect(versoes).toContainText("Enviada ao orientador");
  await expect(page.getByRole("textbox", { name: "Nome da versão" })).toHaveValue("");

  await page.reload();
  await abrirHistorico(page);
  await expect(page.getByRole("list", { name: "Versões" })).toContainText("Enviada ao orientador");
});

test("10 min de edição geram uma versão automática; parado, não", async ({ page }) => {
  await page.clock.install();
  await novoDocumento(page);
  await abrirHistorico(page);

  // Parado por 10 min: nada.
  await page.clock.runFor("10:00");
  await expect(page.getByText("Nenhuma versão ainda")).toBeVisible();

  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type("Primeiro parágrafo.");
  await page.clock.runFor("09:59");
  await expect(page.getByText("Nenhuma versão ainda")).toBeVisible();

  await page.clock.runFor("00:02");
  const versoes = page.getByRole("list", { name: "Versões" });
  await expect(versoes.getByRole("listitem")).toHaveCount(1);
  await expect(versoes).toContainText("Versão automática");
});

// Passo 5.3.3 — restaurar, com confirmação; o texto de antes vira versão.
test("restaurar traz o conteúdo antigo, e o texto de antes vira uma versão nova", async ({
  page,
}) => {
  await novoDocumento(page);
  await abrirHistorico(page);
  const paragrafo = page.locator(".ProseMirror p").first();

  await paragrafo.click();
  await page.keyboard.type("Texto antigo.");
  await page.getByRole("textbox", { name: "Nome da versão" }).fill("Primeira");
  await page.getByRole("button", { name: "Salvar versão" }).click();
  const versoes = page.getByRole("list", { name: "Versões" });
  await expect(versoes.getByRole("listitem")).toHaveCount(1);

  await paragrafo.click({ clickCount: 3 });
  await page.keyboard.type("Texto novo.");
  await expect(paragrafo).toHaveText("Texto novo.");

  // Cancelar não muda nada.
  await page.getByRole("button", { name: "Restaurar Primeira" }).click();
  const dialogo = page.getByRole("dialog", { name: "Restaurar esta versão?" });
  await expect(dialogo).toContainText("Antes de restaurar “Primeira”");
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();
  await expect(paragrafo).toHaveText("Texto novo.");
  await expect(versoes.getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "Restaurar Primeira" }).click();
  await dialogo.getByRole("button", { name: "Restaurar" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.locator(".ProseMirror p").first()).toHaveText("Texto antigo.");
  await expect(page.getByText("Versão restaurada")).toBeVisible();
  // O texto de antes não some: é a versão mais recente.
  await expect(versoes.getByRole("listitem")).toHaveCount(2);
  await expect(versoes.getByRole("listitem").first()).toContainText(
    "Antes de restaurar “Primeira”",
  );

  // E dá para voltar a ele do mesmo jeito.
  await page.getByRole("button", { name: "Restaurar Antes de restaurar “Primeira”" }).click();
  await dialogo.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.locator(".ProseMirror p").first()).toHaveText("Texto novo.");
  await expect(versoes.getByRole("listitem")).toHaveCount(3);

  // A restauração é gravada no documento na hora, sem esperar o autosave.
  await page.reload();
  await expect(page.locator(".ProseMirror p").first()).toHaveText("Texto novo.");
});
