import { expect, test } from "@playwright/test";
import type { BrowserContext, Request } from "@playwright/test";
import JSZip from "jszip";

import { ENDERECO_OVERLEAF } from "../src/core/export/latex/overleaf";

import { abrirDocumento, tresSecoes } from "./apoio";

// Passo 6.3.1 — "Abrir no Overleaf". O Overleaf de verdade não é chamado: o
// POST é interceptado no navegador, e o teste confere o que iria nele. Se a
// CSP barrasse o formulário (`form-action`), a interceptação nunca seria
// acionada. A conferência no Overleaf de verdade é humana (🔍 do to-do).

// Toda requisição que sai da máquina, fora o servidor de teste.
function requisicoesDeFora(contexto: BrowserContext): Request[] {
  const fora: Request[] = [];
  contexto.on("request", (requisicao) => {
    const { hostname } = new URL(requisicao.url());
    if (hostname !== "localhost" && hostname !== "127.0.0.1") fora.push(requisicao);
  });
  return fora;
}

test("o aviso de mão única vem antes, e cancelar não envia nada", async ({ page, context }) => {
  const fora = requisicoesDeFora(context);
  await abrirDocumento(page, tresSecoes());

  await page.getByRole("button", { name: "Abrir no Overleaf" }).click();
  const dialogo = page.getByRole("dialog", { name: "Abrir no Overleaf" });
  await expect(dialogo).toContainText("O caminho é de mão única");
  await expect(dialogo).toContainText("Reimportar LaTeX");
  await expect(dialogo).toContainText("Tamanho do pacote");

  await dialogo.getByRole("button", { name: "Cancelar" }).click();
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
  await page.getByRole("button", { name: "Abrir no Overleaf" }).click();
  const dialogo = page.getByRole("dialog", { name: "Abrir no Overleaf" });
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
