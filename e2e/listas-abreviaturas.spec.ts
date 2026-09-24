import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import JSZip from "jszip";

// Passo 3.6.4 — o critério é comportamental: "acompanham inserção e remoção;
// as abreviaturas saem em ordem alfabética". O Vitest prova os geradores
// isoladamente; o que só se prova aqui é que cadastrar no painel e escrever
// no editor chegam mesmo ao `.docx`.

async function xmlDoDocxExportado(page: Page) {
  // `BotaoExportar` lê o documento da persistência, não do estado da tela —
  // exportar antes do autosave fechar devolveria a versão anterior. Mesma
  // espera de `fatia-vertical.spec.ts`/`elementos-opcionais.spec.ts`.
  await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("banner").getByRole("button", { name: "Exportar .docx" }).click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  return zip.file("word/document.xml")!.async("string");
}

async function novoDocumento(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();
}

async function cadastrarAbreviatura(page: Page, sigla: string, significado: string) {
  await page.getByLabel("Nova abreviatura").fill(sigla);
  await page.getByLabel("Significado por extenso").fill(significado);
  await page.getByRole("button", { name: "Adicionar abreviatura" }).click();
}

test("a lista de abreviaturas sai em ordem alfabética, não na ordem de cadastro", async ({
  page,
}) => {
  await novoDocumento(page);
  await page.keyboard.type("Os dados do IBGE e as normas da ABNT orientam este trabalho.");

  await page.getByText("Abreviaturas e siglas").click();
  // Cadastradas fora de ordem de propósito.
  await cadastrarAbreviatura(page, "IBGE", "Instituto Brasileiro de Geografia e Estatistica");
  await cadastrarAbreviatura(page, "ABNT", "Associacao Brasileira de Normas Tecnicas");

  const xml = await xmlDoDocxExportado(page);

  expect(xml).toContain("LISTA DE ABREVIATURAS E SIGLAS");
  expect(xml.indexOf("Associacao Brasileira")).toBeLessThan(xml.indexOf("Instituto Brasileiro"));
});

test("sigla cadastrada mas não usada no texto fica fora da lista, com aviso no painel", async ({
  page,
}) => {
  await novoDocumento(page);
  await page.keyboard.type("Um parágrafo sem sigla nenhuma.");

  await page.getByText("Abreviaturas e siglas").click();
  await cadastrarAbreviatura(page, "ABNT", "Associacao Brasileira de Normas Tecnicas");

  // O painel explica a ausência em vez de a sigla sumir em silêncio.
  await expect(page.getByText("Ainda não aparece no texto")).toBeVisible();

  expect(await xmlDoDocxExportado(page)).not.toContain("LISTA DE ABREVIATURAS");
});

test("a lista de figuras aparece ao inserir uma figura e some ao removê-la", async ({ page }) => {
  await novoDocumento(page);
  await page.keyboard.type("Texto do corpo.");

  expect(await xmlDoDocxExportado(page)).not.toContain("LISTA DE FIGURAS");

  await page
    .getByRole("button", { name: "Figura — legenda e fonte numeradas automaticamente" })
    .click();
  await page.getByLabel("Legenda — Figura 1").fill("Fluxo do processo");

  const comFigura = await xmlDoDocxExportado(page);
  expect(comFigura).toContain("LISTA DE FIGURAS");
  // Campo TOC de legendas, ligado ao rótulo "Figura" — quem preenche página
  // e texto é o Word, a partir dos campos SEQ das legendas (3.6.3).
  expect(comFigura).toMatch(/TOC[^<]*\\c &quot;Figura&quot;/);

  // Apagar a figura tira o elemento inteiro: clicar na moldura seleciona o
  // nó (é atômico e `selectable`), e Backspace o remove. O clique vai no
  // texto do espaço reservado, e não no centro da moldura: desde o 6.1.2 o
  // centro tem o botão "Inserir imagem".
  await page.locator(".ProseMirror .doc-figura-moldura").getByText("espaço reservado").click();
  await page.keyboard.press("Backspace");
  await expect(page.locator(".ProseMirror figure")).toHaveCount(0);

  expect(await xmlDoDocxExportado(page)).not.toContain("LISTA DE FIGURAS");
});
