import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import JSZip from "jszip";

// Passo 6.1.3c — nota de rodapé pelo caminho do aluno: inserir pela barra,
// escrever a nota, continuar o texto, exportar. A numeração é derivada da
// ordem: inserir uma nota antes de outra renumera a de depois. Onde a nota
// cai na página só se confere no Word.

const BOTAO_NOTA = "Nota de rodapé — numerada automaticamente, no pé da página no .docx";

test("nota inserida pela barra sai numerada no rodapé do .docx", async ({ page }) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type("O Estatuto da Criança");

  await page.getByRole("button", { name: BOTAO_NOTA }).click();
  // O campo da nota abre já com o cursor dentro.
  const campo = page.getByRole("textbox", { name: "Texto da nota de rodapé 1" });
  await expect(campo).toBeFocused();
  await page.keyboard.type("Lei nº 8.069, de 13 de julho de 1990.");
  await page.keyboard.press("Enter");
  // Enter conclui e devolve o cursor ao texto, logo depois do expoente.
  await expect(campo).toBeHidden();
  await page.keyboard.type(" protege a infância.");

  const expoentes = page.locator(".doc-nota-numero");
  await expect(expoentes).toHaveText(["1"]);
  await expect(page.locator(".ProseMirror p").first()).toContainText(
    "O Estatuto da Criança1 protege a infância.",
  );

  // Uma nota antes da primeira renumera: a de antes vira 1, a outra, 2.
  await page.locator(".ProseMirror p").first().click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press("End");
  await page.keyboard.press("Home");
  for (let i = 0; i < "O Estatuto".length; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: BOTAO_NOTA }).click();
  await page.keyboard.type("Brasil, 1990.");
  await page.keyboard.press("Enter");
  await expect(expoentes).toHaveText(["1", "2"]);
  await expect(expoentes.nth(1)).toHaveAttribute("title", "Lei nº 8.069, de 13 de julho de 1990.");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("banner").getByRole("button", { name: "Exportar .docx" }).click();
  const download = await downloadPromise;

  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  const documento = await zip.file("word/document.xml")!.async("string");
  const notas = await zip.file("word/footnotes.xml")!.async("string");

  expect(documento.match(/<w:footnoteReference w:id="\d+"\/>/g)).toHaveLength(2);
  expect(documento).not.toContain("Lei nº 8.069");
  // Na ordem do documento: a nota inserida depois, mas antes no texto, vem
  // primeiro — é essa ordem que o Word numera.
  const [primeira, segunda] = documento.match(/<w:footnoteReference w:id="(\d+)"\/>/g)!;
  const idDe = (ref: string) => ref.match(/w:id="(\d+)"/)![1];
  const textoDaNota = (id: string) =>
    notas.match(new RegExp(`<w:footnote w:id="${id}"[\\s\\S]*?</w:footnote>`))![0];
  expect(textoDaNota(idDe(primeira))).toContain("Brasil, 1990.");
  expect(textoDaNota(idDe(segunda))).toContain("Lei nº 8.069, de 13 de julho de 1990.");
});

test("nota vazia some quando se sai dela sem escrever", async ({ page }) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type("Texto");

  await page.getByRole("button", { name: BOTAO_NOTA }).click();
  await expect(page.locator(".doc-nota-numero")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".doc-nota-numero")).toHaveCount(0);
});

test("o botão de nota fica desligado dentro de uma tabela", async ({ page }) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();

  await page
    .getByRole("button", { name: "Tabela (só no computador) — padrão IBGE, laterais abertas" })
    .click();
  await page.locator(".doc-tabela td").first().click();
  await expect(page.getByRole("button", { name: BOTAO_NOTA })).toBeDisabled();
});
