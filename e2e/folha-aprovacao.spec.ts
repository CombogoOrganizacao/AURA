import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import JSZip from "jszip";

// Passo 4B.3 — a banca cadastrada no painel chega à folha de aprovação do
// `.docx` e sobrevive a um recarregamento. O conteúdo e a ordem da folha são
// provados no Vitest (`elements/folhaDeAprovacao.test.ts`); aqui, o caminho
// da tela ao arquivo.

async function xmlDoDocxExportado(page: Page) {
  // Mesma espera de `listas-abreviaturas.spec.ts`: o exportador lê da
  // persistência, não da tela.
  await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("banner").getByRole("button", { name: "Exportar .docx" }).click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  return zip.file("word/document.xml")!.async("string");
}

test("a banca cadastrada sai na folha de aprovação, com data e assinaturas em branco", async ({
  page,
}) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);

  // Sem banca, a folha não sai.
  expect(await xmlDoDocxExportado(page)).not.toContain("Data de aprovação:");

  await page.getByText("Folha de aprovação", { exact: true }).click();
  await page.getByRole("button", { name: "Adicionar membro da banca" }).click();
  await page.getByLabel("Nome de membro 1").fill("Ana Lima");
  await page.getByLabel("Titulação de Ana Lima").fill("Doutora em Educação");
  await page.getByLabel("Instituição de Ana Lima").fill("UFPE");

  const xml = await xmlDoDocxExportado(page);
  expect(xml).toContain("Data de aprovação:");
  expect(xml.indexOf("Ana Lima")).toBeGreaterThan(xml.indexOf("Data de aprovação:"));
  expect(xml).toContain("Doutora em Educação");

  await page.reload();
  await page.getByText("Folha de aprovação", { exact: true }).click();
  await expect(page.getByLabel("Nome de Ana Lima")).toHaveValue("Ana Lima");
});
