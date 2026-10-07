import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { BrowserContext, Page, Request } from "@playwright/test";
import JSZip from "jszip";

import { ENDERECO_OVERLEAF } from "../src/core/export/latex/overleaf";

import { abrirDocumento, tresSecoes } from "./apoio";

// Passo 6.3.1 — "Exportar LaTeX": baixar o projeto em `.zip` e, quando ele
// cabe no limite do Overleaf, "Abrir no Overleaf". O Overleaf de verdade não
// é chamado: o POST é interceptado no navegador, e o teste confere o que iria
// nele. Se a CSP barrasse o formulário (`form-action`), a interceptação nunca
// seria acionada. A conferência no Overleaf de verdade é humana (🔍 do to-do).

// Toda requisição que sai da máquina, fora o servidor de teste.
function requisicoesDeFora(contexto: BrowserContext): Request[] {
  const fora: Request[] = [];
  contexto.on("request", (requisicao) => {
    const { hostname } = new URL(requisicao.url());
    if (hostname !== "localhost" && hostname !== "127.0.0.1") fora.push(requisicao);
  });
  return fora;
}

async function abrirJanela(page: Page) {
  await page.getByRole("button", { name: "Exportar LaTeX" }).click();
  return page.getByRole("dialog", { name: "Exportar LaTeX" });
}

test("o aviso de mão única vem antes, e cancelar não envia nada", async ({ page, context }) => {
  const fora = requisicoesDeFora(context);
  await abrirDocumento(page, tresSecoes());

  const dialogo = await abrirJanela(page);
  await expect(dialogo).toContainText("O caminho é de mão única");
  await expect(dialogo).toContainText("Importar LaTeX");
  await expect(dialogo).toContainText("Tamanho do projeto");

  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();
  expect(fora).toEqual([]);
});

test("baixar o projeto entrega o .zip, sem enviar nada para fora", async ({ page, context }) => {
  const fora = requisicoesDeFora(context);
  await abrirDocumento(page, tresSecoes());

  const dialogo = await abrirJanela(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialogo.getByRole("button", { name: "Baixar o projeto (.zip)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const nomes = Object.keys(zip.files);
  expect(nomes).toContain("main.tex");
  expect(nomes).toContain("referencias.bib");
  expect(nomes.some((nome) => nome.startsWith("sections/"))).toBe(true);
  await expect(dialogo).toBeHidden();
  expect(fora).toEqual([]);
});

test("confirmar abre o Overleaf numa aba nova com o projeto dentro do POST", async ({
  page,
  context,
}) => {
  const fora = requisicoesDeFora(context);
  let recebido: Request | null = null;
  await context.route(ENDERECO_OVERLEAF, async (rota) => {
    recebido = rota.request();
    await rota.fulfill({ contentType: "text/html", body: "<p>Overleaf simulado</p>" });
  });

  const documento = tresSecoes();
  await abrirDocumento(page, documento);
  const dialogo = await abrirJanela(page);
  const confirmar = dialogo.getByRole("button", { name: "Abrir no Overleaf" });
  await expect(confirmar).toBeEnabled();

  const [aba] = await Promise.all([context.waitForEvent("page"), confirmar.click()]);
  await expect(aba.getByText("Overleaf simulado")).toBeVisible();
  await expect(dialogo).toBeHidden();

  // Só uma requisição saiu da máquina: o POST, sem nada no endereço.
  expect(fora.map((requisicao) => [requisicao.method(), requisicao.url()])).toEqual([
    ["POST", ENDERECO_OVERLEAF],
  ]);
  const campos = new URLSearchParams(recebido!.postData() ?? "");
  expect(campos.get("engine")).toBe("pdflatex");
  expect(campos.get("main_document")).toBe("main.tex");
  // A aba nova não sabe de onde veio.
  expect(recebido!.headers()["referer"]).toBeUndefined();

  const dataUrl = campos.get("snip_uri") ?? "";
  expect(dataUrl.startsWith("data:application/zip;base64,")).toBe(true);
  const zip = await JSZip.loadAsync(
    Buffer.from(dataUrl.slice("data:application/zip;base64,".length), "base64"),
  );
  const main = await zip.file("main.tex")!.async("string");
  expect(main).toMatch(new RegExp(`^% AURA-DOCUMENTO: ${documento.id} v`));
  const capitulos = await Promise.all(
    Object.keys(zip.files)
      .filter((nome) => nome.startsWith("sections/") && !zip.files[nome].dir)
      .map((nome) => zip.file(nome)!.async("string")),
  );
  expect(capitulos.join("\n")).toContain("Aplicamos o questionário em campo.");
});

test("projeto acima do limite do Overleaf: sem o botão do Overleaf, com o motivo, e o .zip baixa", async ({
  page,
  context,
}) => {
  const fora = requisicoesDeFora(context);
  await abrirDocumento(page, tresSecoes());

  // PNG válido com 1,7 MB de bytes aleatórios depois do fim: o `.zip` não
  // os comprime, e o projeto passa do limite medido (~1,4 MB).
  const captura = await page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: 64, height: 64 },
  });
  const png = Buffer.concat([captura, randomBytes(1_700_000)]);
  await page.locator(".ProseMirror p").first().click();
  await page.getByRole("button", { name: /^Figura/ }).click();
  const figura = page.locator(".ProseMirror figure");
  await figura.getByLabel(/Arquivo de imagem/).setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(figura.locator("img.doc-figura-imagem")).toBeVisible();

  const dialogo = await abrirJanela(page);
  await expect(dialogo).toContainText("Grande demais para abrir direto no Overleaf");
  await expect(dialogo).toContainText("Upload Project");
  await expect(dialogo.getByRole("button", { name: "Abrir no Overleaf" })).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialogo.getByRole("button", { name: "Baixar o projeto (.zip)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  expect(Object.keys(zip.files)).toContain("main.tex");
  expect(Object.keys(zip.files).some((nome) => nome.startsWith("figuras/"))).toBe(true);
  await expect(dialogo).toBeHidden();
  expect(fora).toEqual([]);
});
