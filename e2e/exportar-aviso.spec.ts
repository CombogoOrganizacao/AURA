import { expect, test } from "@playwright/test";

import { novoDocumento } from "../src/core/document/factory";
import { abrirDocumento, secao } from "./apoio";

// Passo 6.2.12. Um TCC importado de fora chega sem título, autor nem
// orientador, e o `.docx` saía com a capa só com o ano. O botão de exportar
// avisa o que falta antes, e deixa exportar assim mesmo.

test("sem os dados da capa, avisa o que falta e leva ao campo", async ({ page }) => {
  const documento = novoDocumento();
  documento.sections = [secao("s1", 0, "Introdução", "Texto.")];
  await abrirDocumento(page, documento);

  await page.getByRole("banner").getByRole("button", { name: "Exportar .docx" }).click();
  const dialogo = page.getByRole("dialog", { name: "Faltam dados da capa" });
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText("o título");
  await expect(dialogo).toContainText("o nome do autor");
  await expect(dialogo).toContainText("o nome do orientador");

  await dialogo.getByRole("button", { name: "Preencher dados" }).click();
  await expect(dialogo).toHaveCount(0);
  // O primeiro que falta é o autor; o painel "Dados do trabalho" abre nele.
  await expect(page.locator('[data-campo="autores"]').first()).toBeFocused();
});

test("exportar assim mesmo baixa o arquivo", async ({ page }) => {
  const documento = novoDocumento();
  documento.sections = [secao("s1", 0, "Introdução", "Texto.")];
  await abrirDocumento(page, documento);

  const download = page.waitForEvent("download");
  await page.getByRole("banner").getByRole("button", { name: "Exportar .docx" }).click();
  await page.getByRole("button", { name: "Exportar assim mesmo" }).click();
  expect((await download).suggestedFilename()).toBe("documento.docx");
});

test("com os dados completos, exporta sem perguntar", async ({ page }) => {
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

  const download = page.waitForEvent("download");
  await page.getByRole("banner").getByRole("button", { name: "Exportar .docx" }).click();
  expect((await download).suggestedFilename()).toBe("Trabalho completo.docx");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
