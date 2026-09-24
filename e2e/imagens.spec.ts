import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import JSZip from "jszip";

// Passo 6.1.2 — imagem de verdade na figura, na tela e no `.docx`. O Vitest
// prova a leitura dos bytes, a persistência e o pacote (`word/media/` e os
// relacionamentos); aqui, o caminho do aluno. **Ver as duas figuras no Word
// é a conferência humana** (CLAUDE.md, "Verificação").
//
// As imagens são capturas de tela do próprio navegador, uma em PNG e outra
// em JPEG: arquivos reais, gerados na hora, sem fixture binária no repositório.

test("duas figuras com imagem: aparecem na tela, voltam ao recarregar e saem no .docx", async ({
  page,
}) => {
  await page.goto("/documentos");
  const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 320, height: 200 } });
  const jpeg = await page.screenshot({
    type: "jpeg",
    quality: 80,
    clip: { x: 0, y: 0, width: 200, height: 300 },
  });

  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);

  const botaoFigura = page.getByRole("button", { name: /^Figura/ });
  await page.locator(".ProseMirror p").first().click();
  await botaoFigura.click();
  await page.locator(".ProseMirror p").last().click();
  await botaoFigura.click();
  const figuras = page.locator(".ProseMirror figure");
  await expect(figuras).toHaveCount(2);

  await figuras
    .nth(0)
    .getByRole("textbox", { name: /Legenda/ })
    .fill("Tela em PNG");
  await figuras
    .nth(0)
    .getByLabel(/Arquivo de imagem/)
    .setInputFiles({ name: "tela.png", mimeType: "image/png", buffer: png });
  await figuras
    .nth(1)
    .getByRole("textbox", { name: /Legenda/ })
    .fill("Tela em JPEG");
  await figuras
    .nth(1)
    .getByLabel(/Arquivo de imagem/)
    .setInputFiles({ name: "tela.jpg", mimeType: "image/jpeg", buffer: jpeg });

  const imagens = page.locator(".ProseMirror img.doc-figura-imagem");
  await expect(imagens).toHaveCount(2);
  await expect(imagens.nth(0)).toHaveAttribute("alt", "Tela em PNG");
  await expect(imagens.nth(1)).toHaveAttribute("alt", "Tela em JPEG");
  for (const i of [0, 1]) {
    expect(
      await imagens.nth(i).evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
  }

  // O documento guarda só o id: recarregar busca a imagem na persistência.
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(imagens).toHaveCount(2);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar .docx" }).first().click();
  const caminho = await (await download).path();
  const zip = await JSZip.loadAsync(readFileSync(caminho!));

  const midias = Object.keys(zip.files).filter(
    (nome) => nome.startsWith("word/media/") && !zip.files[nome].dir,
  );
  expect(midias.map((nome) => nome.split(".").pop()).sort()).toEqual(["jpg", "png"]);
  const xml = await zip.file("word/document.xml")!.async("string");
  expect(xml.match(/<a:blip r:embed=/g)).toHaveLength(2);
  expect(xml).not.toContain("espaço reservado para a imagem");
});

test("arquivo que não é PNG nem JPEG é recusado com aviso, e a figura fica como estava", async ({
  page,
}) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();
  await page.getByRole("button", { name: /^Figura/ }).click();

  const figura = page.locator(".ProseMirror figure");
  await figura.getByLabel(/Arquivo de imagem/).setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: Buffer.from("isto é texto com nome de imagem"),
  });

  await expect(figura.getByRole("alert")).toHaveText("Use uma imagem PNG ou JPEG.");
  await expect(figura.locator("img")).toHaveCount(0);
  await expect(figura).toContainText("espaço reservado para a imagem");
});
