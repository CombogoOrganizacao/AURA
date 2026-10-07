import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { BrowserContext, Page, Request } from "@playwright/test";
import JSZip from "jszip";

import { ENDERECO_OVERLEAF } from "../src/core/export/latex/overleaf";

import { abrirDocumento, tresSecoes } from "./apoio";

// Passos 6.3.1 e 6.3.2 — a janela "Exportar": `.docx` como formato principal,
// projeto LaTeX em `.zip` (com "Abrir no Overleaf" quando cabe no limite) e
// só o `.tex`. Nenhum PDF. O Overleaf de verdade não é chamado: o POST é
// interceptado no navegador, e o teste confere o que iria nele. Se a CSP
// barrasse o formulário (`form-action`), a interceptação nunca seria
// acionada.

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
  await page.getByRole("banner").getByRole("button", { name: "Exportar", exact: true }).click();
  return page.getByRole("dialog", { name: "Exportar" });
}

test("abrir a janela e fechar não envia nada", async ({ page, context }) => {
  const fora = requisicoesDeFora(context);
  await abrirDocumento(page, tresSecoes());

  const dialogo = await abrirJanela(page);
  await expect(dialogo).toContainText("não volta sozinho");
  await expect(dialogo).toContainText("Importar LaTeX");
  await expect(dialogo).toContainText("Tamanho do projeto");

  await dialogo.getByRole("button", { name: "Fechar" }).click();
  await expect(dialogo).toBeHidden();
  expect(fora).toEqual([]);
});

test("baixar o projeto entrega o .zip, sem enviar nada para fora", async ({ page, context }) => {
  const fora = requisicoesDeFora(context);
  await abrirDocumento(page, tresSecoes());

  const dialogo = await abrirJanela(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialogo.getByRole("button", { name: "Baixar .zip" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const nomes = Object.keys(zip.files);
  expect(nomes).toContain("main.tex");
  expect(nomes).toContain("referencias.bib");
  expect(nomes.some((nome) => nome.startsWith("sections/"))).toBe(true);
  // A janela fica aberta, para baixar outro formato se quiser.
  await expect(dialogo).toBeVisible();
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
  await expect(dialogo).toContainText("Grande demais para abrir direto");
  await expect(dialogo).toContainText("Upload Project");
  await expect(dialogo.getByRole("button", { name: "Abrir no Overleaf" })).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialogo.getByRole("button", { name: "Baixar .zip" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  expect(Object.keys(zip.files)).toContain("main.tex");
  expect(Object.keys(zip.files).some((nome) => nome.startsWith("figuras/"))).toBe(true);
  // A janela fica aberta, para baixar outro formato se quiser.
  await expect(dialogo).toBeVisible();
  expect(fora).toEqual([]);
});

test("o .docx é o formato principal, com a nota do PDF, e não há PDF em lugar nenhum", async ({
  page,
}) => {
  await abrirDocumento(page, tresSecoes());
  const dialogo = await abrirJanela(page);

  const word = dialogo.getByRole("region", { name: "Word (.docx)" });
  await expect(word).toContainText("Formato principal");
  await expect(word).toContainText("Salvar como → PDF");
  // O .docx vem antes dos formatos LaTeX.
  const formatos = await dialogo
    .getByRole("region")
    .evaluateAll((secoes) => secoes.map((secao) => secao.getAttribute("aria-label")));
  expect(formatos).toEqual(["Word (.docx)", "Projeto LaTeX (.zip)", "Só o .tex"]);

  // Nenhum botão ou link de PDF, nem na janela nem na página atrás dela.
  await expect(page.getByRole("button", { name: /pdf/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /pdf/i })).toHaveCount(0);
});

test("só o .tex: baixa o main.tex e avisa que as figuras ficam de fora", async ({ page }) => {
  const documento = tresSecoes();
  await abrirDocumento(page, documento);

  // Sem figura com imagem, não há aviso de figura.
  let dialogo = await abrirJanela(page);
  const soTex = dialogo.getByRole("region", { name: "Só o .tex" });
  await expect(soTex).not.toContainText("figura");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    soTex.getByRole("button", { name: "Baixar .tex" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("Trabalho de teste.tex");
  const tex = readFileSync(await download.path(), "utf-8");
  expect(tex).toMatch(new RegExp(`^% AURA-DOCUMENTO: ${documento.id} v`));
  expect(tex).toContain("Aplicamos o questionário em campo.");
  await dialogo.getByRole("button", { name: "Fechar" }).click();

  // Com uma figura com imagem, o aviso aparece.
  const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 32, height: 32 } });
  await page.locator(".ProseMirror p").first().click();
  await page.getByRole("button", { name: /^Figura/ }).click();
  await page
    .locator(".ProseMirror figure")
    .getByLabel(/Arquivo de imagem/)
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".ProseMirror img.doc-figura-imagem")).toBeVisible();
  dialogo = await abrirJanela(page);
  await expect(dialogo.getByRole("region", { name: "Só o .tex" })).toContainText(
    "sem a imagem: elas vêm no .zip",
  );
});
