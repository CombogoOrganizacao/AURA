import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { novoDocumento } from "../src/core/document/factory";
import { abrirDocumento, secao } from "./apoio";

// Passo 6.2.12, na janela de exportação desde o 6.3.2. Um TCC importado de
// fora chega sem título, autor nem orientador, e o `.docx` saía com a capa só
// com o ano. A janela avisa o que falta no topo, leva ao campo, e não impede
// de exportar.

async function abrirJanela(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: "Exportar", exact: true }).click();
  return page.getByRole("dialog", { name: "Exportar" });
}

test("sem os dados da capa, a janela avisa o que falta e leva ao campo", async ({ page }) => {
  const documento = novoDocumento();
  documento.sections = [secao("s1", 0, "Introdução", "Texto.")];
  await abrirDocumento(page, documento);

  const dialogo = await abrirJanela(page);
  await expect(dialogo).toContainText("Faltam dados da capa");
  await expect(dialogo).toContainText("o título");
  await expect(dialogo).toContainText("o nome do autor");
  await expect(dialogo).toContainText("o nome do orientador");

  await dialogo.getByRole("button", { name: "Preencher dados" }).click();
  await expect(dialogo).toHaveCount(0);
  // O primeiro que falta é o autor; o painel "Dados do trabalho" abre nele.
  await expect(page.locator('[data-campo="autores"]').first()).toBeFocused();
});

test("com dado faltando, o .docx baixa assim mesmo", async ({ page }) => {
  const documento = novoDocumento();
  documento.sections = [secao("s1", 0, "Introdução", "Texto.")];
  await abrirDocumento(page, documento);

  const dialogo = await abrirJanela(page);
  const download = page.waitForEvent("download");
  await dialogo.getByRole("button", { name: "Baixar .docx" }).click();
  expect((await download).suggestedFilename()).toBe("documento.docx");
});

test("com os dados completos, a janela não avisa nada", async ({ page }) => {
  const documento = novoDocumento();
  Object.assign(documento.metadados, {
    titulo: "Trabalho completo",
    autores: ["Ana Lima"],
    naturezaTrabalho: "Trabalho de Conclusão de Curso.",
    orientador: "Prof. Dr. Beto",
    local: "Recife",
    ano: 2026,
  });
  documento.sections = [secao("s1", 0, "Introdução", "Texto.")];
  await abrirDocumento(page, documento);

  const dialogo = await abrirJanela(page);
  await expect(dialogo.getByRole("button", { name: "Baixar .docx" })).toBeVisible();
  await expect(dialogo).not.toContainText("Faltam dados da capa");
  const download = page.waitForEvent("download");
  await dialogo.getByRole("button", { name: "Baixar .docx" }).click();
  expect((await download).suggestedFilename()).toBe("Trabalho completo.docx");
});
