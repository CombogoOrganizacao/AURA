import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

// Passo 6.4.3 — a Central de editais fica fora da v1: só o link de
// navegação entra (CLAUDE.md). A página diz que é "em breve", que é
// trabalho paralelo de outra frente, e não oferece nada que finja funcionar.

test('o link leva a uma página de "em breve" que explica a frente paralela', async ({ page }) => {
  await page.goto("/documentos");
  await page.getByRole("link", { name: "Central de editais" }).click();
  await page.waitForURL(/\/editais$/);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Central de editais");
  await expect(page.getByText(/^Em breve\./)).toBeVisible();
  await expect(page.getByText("desenvolvida em paralelo ao editor")).toBeVisible();
  // Nada que finja funcionar: nem campo, nem envio de edital.
  await expect(page.locator("input, textarea, select, form")).toHaveCount(0);

  // Com a forma do botão `outline`, não texto solto (ver `classesBotao.ts`).
  const voltar = page.getByRole("link", { name: "Ir para meus documentos" });
  await expect(voltar).toHaveCSS("border-top-color", "rgb(112, 0, 27)");
  await voltar.click();
  await page.waitForURL(/\/documentos$/);
});

// O `noticeParser` do legado é da Central, fora da v1 (decisões §1.14): nada
// dele vira código. Só o parâmetro `noticeConfig` de `resolveRules` fica,
// vazio, por decisão registrada.
test("nada do noticeParser foi portado", () => {
  const arquivos = (pasta: string): string[] =>
    readdirSync(pasta, { withFileTypes: true }).flatMap((item) =>
      item.isDirectory() ? arquivos(join(pasta, item.name)) : [join(pasta, item.name)],
    );
  const portados = [...arquivos("src"), ...arquivos("app")].filter((caminho) =>
    /notice|parser.?de.?edita/i.test(caminho),
  );
  expect(portados).toEqual([]);

  // As funções de `legacy/js/engine/noticeParser.js`, pelo nome.
  const identificadores =
    /(auraNoticeParser|parseNoticeText|extractMaxPages|extractAbstractLimit|extractDuration|extractMaxBudget)/;
  const comIdentificador = [...arquivos("src"), ...arquivos("app")].filter(
    (caminho) =>
      /\.(ts|tsx)$/.test(caminho) && identificadores.test(readFileSync(caminho, "utf-8")),
  );
  expect(comIdentificador).toEqual([]);
});
