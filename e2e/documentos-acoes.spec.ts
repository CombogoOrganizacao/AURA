import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import JSZip from "jszip";

import { novoDocumento } from "../src/core/document/factory";
import type { Documento } from "../src/core/document/types";

import { abrirDocumento, secao } from "./apoio";

// Ações de cada linha de "Meus documentos" (07/10/2026, parte do 6.4.1):
// exportar o `.docx`, baixar o projeto LaTeX e excluir com confirmação. Os
// arquivos saem do documento salvo, pelas mesmas funções do editor.

function trabalho(titulo: string, completo: boolean): Documento {
  const documento = novoDocumento();
  documento.metadados.titulo = titulo;
  if (completo) {
    Object.assign(documento.metadados, {
      autores: ["Ana Lima"],
      naturezaTrabalho: "Trabalho de Conclusão de Curso.",
      orientador: "Prof. Dr. Beto",
      local: "Recife",
      ano: 2026,
    });
  }
  documento.sections = [secao("s1", 0, "Introdução", `Texto de ${titulo}.`)];
  return documento;
}

async function abrirLista(page: Page, documentos: Documento[]) {
  for (const documento of documentos) await abrirDocumento(page, documento);
  await page.goto("/documentos");
  await expect(page.getByRole("heading", { name: "Meus documentos" })).toBeVisible();
}

function linha(page: Page, titulo: string) {
  return page.getByRole("row").filter({ has: page.getByRole("link", { name: titulo }) });
}

test("as ações aparecem ao passar o mouse na linha, com a dica curta", async ({ page }) => {
  await abrirLista(page, [trabalho("Primeiro", true)]);
  const excluir = linha(page, "Primeiro").getByRole("button", { name: "Excluir Primeiro" });
  // Quem some é o contêiner das ações; o botão continua no teclado.
  const acoes = linha(page, "Primeiro").locator("td").last().locator("> div");

  await page.mouse.move(0, 0);
  await expect(acoes).toHaveCSS("opacity", "0");
  await linha(page, "Primeiro").hover();
  await expect(acoes).toHaveCSS("opacity", "1");
  await excluir.hover();
  const dica = page.locator(`[id="${await excluir.getAttribute("aria-describedby")}"]`);
  await expect(dica).toHaveText("Excluir");
  await expect(dica).toBeVisible();
});

test("excluir pede confirmação; cancelar mantém, confirmar apaga de vez", async ({ page }) => {
  await abrirLista(page, [trabalho("Fica", true), trabalho("Sai", true)]);
  await expect(page.getByText("2 documentos")).toBeVisible();

  await linha(page, "Sai").getByRole("button", { name: "Excluir Sai" }).click();
  let dialogo = page.getByRole("dialog", { name: "Excluir o trabalho?" });
  await expect(dialogo).toContainText("Não dá para desfazer");
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(linha(page, "Sai")).toHaveCount(1);

  await linha(page, "Sai").getByRole("button", { name: "Excluir Sai" }).click();
  dialogo = page.getByRole("dialog", { name: "Excluir o trabalho?" });
  await dialogo.getByRole("button", { name: "Excluir" }).click();
  await expect(linha(page, "Sai")).toHaveCount(0);
  await expect(linha(page, "Fica")).toHaveCount(1);
  await expect(page.getByText("1 documento ·")).toBeVisible();

  // Gravado: depois de recarregar, continua fora.
  await page.reload();
  await expect(linha(page, "Fica")).toHaveCount(1);
  await expect(linha(page, "Sai")).toHaveCount(0);
});

test("exportar .docx e baixar LaTeX pela lista entregam os arquivos do trabalho", async ({
  page,
}) => {
  await abrirLista(page, [trabalho("Completo", true)]);
  const acoes = linha(page, "Completo");

  const [docx] = await Promise.all([
    page.waitForEvent("download"),
    acoes.getByRole("button", { name: "Exportar .docx de Completo" }).click(),
  ]);
  expect(docx.suggestedFilename()).toBe("Completo.docx");
  const pacoteDocx = await JSZip.loadAsync(readFileSync(await docx.path()));
  expect(await pacoteDocx.file("word/document.xml")!.async("string")).toContain(
    "Texto de Completo.",
  );

  const [zip] = await Promise.all([
    page.waitForEvent("download"),
    acoes.getByRole("button", { name: "Baixar o projeto LaTeX (.zip) de Completo" }).click(),
  ]);
  expect(zip.suggestedFilename()).toBe("Completo.zip");
  const projeto = await JSZip.loadAsync(readFileSync(await zip.path()));
  expect(Object.keys(projeto.files)).toContain("main.tex");
});

test("sem os dados da capa, a lista avisa e oferece abrir o trabalho", async ({ page }) => {
  const documento = trabalho("Rascunho", false);
  await abrirLista(page, [documento]);

  await linha(page, "Rascunho").getByRole("button", { name: "Exportar .docx de Rascunho" }).click();
  const dialogo = page.getByRole("dialog", { name: "Faltam dados da capa" });
  await expect(dialogo).toContainText("o nome do autor");
  await dialogo.getByRole("button", { name: "Abrir o trabalho" }).click();
  await page.waitForURL(`**/documento/${documento.id}`);
});
