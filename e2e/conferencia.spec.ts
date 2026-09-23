import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Passo 5.2.3 — o painel de Conferência. O Vitest prova as regras (5.2.2) e a
// tradução do local para posição no editor (`core/editor/localizar.ts`); aqui,
// o caminho do aluno: ver o achado, clicar, e chegar ao problema.

const BIB = `
@book{bauman1999,
  author = {Bauman, Zygmunt},
  title = {Globaliza{\\c{c}}{\\~a}o: as consequ{\\^e}ncias humanas},
  publisher = {Jorge Zahar}, address = {Rio de Janeiro}, year = {1999}
}`;

async function novoDocumento(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
}

test("citação órfã: clicar no achado seleciona o trecho citado no texto", async ({ page }) => {
  await novoDocumento(page);

  await page.getByText("Referências", { exact: true }).click();
  await page
    .getByLabel("Arquivo .bib")
    .setInputFiles({ name: "tcc.bib", mimeType: "text/plain", buffer: Buffer.from(BIB, "utf-8") });
  await page.getByRole("button", { name: "Importar 1 referência" }).click();

  // Um parágrafo com um trecho citado no meio.
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type("Antes do trecho. O mundo se globaliza. Depois do trecho.");
  const paragrafo = page.locator(".ProseMirror p").first();
  await paragrafo.evaluate((elemento) => {
    const texto = elemento.firstChild!;
    const inicio = texto.textContent!.indexOf("O mundo se globaliza");
    const faixa = document.createRange();
    faixa.setStart(texto, inicio);
    faixa.setEnd(texto, inicio + "O mundo se globaliza".length);
    const selecao = window.getSelection()!;
    selecao.removeAllRanges();
    selecao.addRange(faixa);
  });
  await page.getByRole("button", { name: /^Citar/ }).click();
  const dialogo = page.getByRole("dialog", { name: /Citar/ });
  await dialogo.getByText("Indireta", { exact: true }).click();
  await dialogo.getByRole("button", { name: "Inserir citação" }).click();

  // Exclui a referência: a citação fica órfã (4.8).
  await page.getByRole("button", { name: "Editar Globalização" }).click();
  await page.getByRole("button", { name: "Excluir Globalização" }).click();

  // Tira o cursor do trecho, para o clique no achado ter de trazê-lo de volta.
  await page
    .locator(".ProseMirror p")
    .first()
    .click({ position: { x: 5, y: 5 } });

  const achado = page.getByRole("button", {
    name: /aponta para uma referência que foi excluída/,
  });
  await expect(achado).toBeVisible();
  await expect(achado).toContainText("NBR 10520:2023 §5.1");
  await achado.click();

  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("O mundo se globaliza");
  await expect(page.locator(".ProseMirror")).toBeFocused();
});

test("achado de metadado abre o campo na coluna esquerda; agrupado e sem nota", async ({
  page,
}) => {
  await novoDocumento(page);

  // Um resumo curto demais: aviso pela NBR 6028 §4.1.8 ("convém").
  await page.getByText("Resumo e palavras-chave", { exact: true }).click();
  await page.getByRole("textbox", { name: "Resumo" }).fill("Um resumo curto demais.");
  // Fecha o painel, para o clique no achado ter de abri-lo.
  await page.getByText("Resumo e palavras-chave", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Resumo" })).toBeHidden();

  // Erros e avisos em grupos separados, com a contagem; nenhuma nota.
  await expect(page.getByRole("region", { name: "Erros" })).toBeVisible();
  const avisos = page.getByRole("region", { name: "Avisos" });
  await expect(avisos).toBeVisible();
  await expect(page.getByText(/\d+ erros? · \d+ avisos?/)).toBeVisible();
  await expect(page.getByText(/\d+\s?%/)).toHaveCount(0);

  const achado = avisos.getByRole("button", { name: /O resumo tem 4 palavras/ });
  await expect(achado).toContainText("NBR 6028:2021 §4.1.8 a)");
  await achado.click();

  await expect(page.getByRole("textbox", { name: "Resumo" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Resumo" })).toBeFocused();
});
