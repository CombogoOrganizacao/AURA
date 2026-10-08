import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import JSZip from "jszip";

import { novoDocumento } from "../src/core/document/factory";
import type { Documento } from "../src/core/document/types";

import { abrirDocumento, documentoSalvo, secao } from "./apoio";

// "Meus documentos" (passo 6.4.1): as ações de cada linha (renomear,
// exportar o `.docx`, baixar o projeto LaTeX e excluir com confirmação) e o
// estado vazio. Os arquivos saem do documento salvo, pelas mesmas funções do
// editor.

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

test("renomear troca o título do trabalho, e cancelar ou deixar em branco não muda nada", async ({
  page,
}) => {
  const antigo = trabalho("Antigo", true);
  const outro = trabalho("Outro", true);
  // `abrirLista` grava na ordem: o "Outro" é o mais recente e vem primeiro.
  await abrirLista(page, [antigo, outro]);
  await expect(page.getByRole("link").filter({ hasText: /^(Antigo|Outro)$/ })).toHaveText([
    "Outro",
    "Antigo",
  ]);

  // Cancelar: nada muda.
  await linha(page, "Antigo").getByRole("button", { name: "Renomear Antigo" }).click();
  let dialogo = page.getByRole("dialog", { name: "Renomear o trabalho" });
  const campo = dialogo.getByLabel("Título do trabalho");
  // O campo abre focado, com o título todo selecionado para digitar por cima.
  await expect(campo).toBeFocused();
  await expect(campo).toHaveValue("Antigo");
  expect(
    await campo.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
  ).toEqual([0, "Antigo".length]);
  await expect(dialogo).toContainText("muda também na capa");
  await page.keyboard.type("Descartado");
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();
  await expect(linha(page, "Antigo")).toHaveCount(1);

  // Em branco: não dá para confirmar.
  await linha(page, "Antigo").getByRole("button", { name: "Renomear Antigo" }).click();
  dialogo = page.getByRole("dialog", { name: "Renomear o trabalho" });
  await dialogo.getByLabel("Título do trabalho").fill("   ");
  await expect(dialogo.getByRole("button", { name: "Renomear" })).toBeDisabled();

  // Enter grava, sem os espaços das pontas, e a linha sobe em "Recentes".
  await dialogo.getByLabel("Título do trabalho").fill("  Novo título  ");
  await page.keyboard.press("Enter");
  await expect(dialogo).toBeHidden();
  await expect(linha(page, "Novo título")).toHaveCount(1);
  await expect(linha(page, "Antigo")).toHaveCount(0);
  await expect(page.getByRole("link").filter({ hasText: /^(Novo título|Outro)$/ })).toHaveText([
    "Novo título",
    "Outro",
  ]);

  // É o título do trabalho (o da capa), e está gravado.
  expect((await documentoSalvo(page, antigo.id)).metadados.titulo).toBe("Novo título");
  await page.reload();
  await expect(linha(page, "Novo título")).toHaveCount(1);
  // O resto do trabalho não foi tocado.
  const salvo = await documentoSalvo(page, antigo.id);
  expect(salvo.metadados.autores).toEqual(["Ana Lima"]);
  expect(salvo.sections.map((s) => s.titulo)).toEqual(["Introdução"]);
});

test("sem nenhum documento: só a mensagem e o botão de criar, sem lista nem filtro", async ({
  page,
}) => {
  await page.goto("/documentos");
  await expect(page.getByRole("heading", { name: "Meus documentos" })).toBeVisible();
  await expect(page.getByText("Nenhum documento ainda.")).toBeVisible();

  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Buscar documentos" })).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByText(/\d+ documentos? ·/)).toHaveCount(0);
  // Fora da barra de cima, a única ação é criar.
  const conteudo = page.getByRole("banner").locator("xpath=following-sibling::*[1]");
  await expect(conteudo.getByRole("button")).toHaveText(["Novo documento"]);

  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\/[^/]+$/);
});
