import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { abrirDocumento, tresSecoes } from "./apoio";

// Passo 6.4.4 — edição funcional no celular (decisão §1.12, "Recorte
// mobile"): digitar, formatar e navegar entre seções numa tela de 375 px.
// As colunas viram gavetas por cima do texto, e nada rola para os lados.

test.use({ viewport: { width: 375, height: 740 } });

const ABRIR_SECOES = "Abrir: Seções e dados do trabalho";
const ABRIR_INSPETOR = "Abrir: Conferência, histórico e exportação";

function gaveta(page: Page, nome: string) {
  return page.getByRole("dialog", { name: nome });
}

test("o texto ocupa a tela, sem rolagem lateral, e as gavetas começam fechadas", async ({
  page,
}) => {
  await abrirDocumento(page, tresSecoes());

  const larguras = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(larguras[0]).toBe(larguras[1]);
  await expect(page.locator(".ProseMirror")).toBeInViewport();
  await expect(gaveta(page, "Seções e dados do trabalho")).toBeHidden();
  await expect(gaveta(page, "Conferência, histórico e exportação")).toBeHidden();
  // A barra de cima cabe: as duas ações e o status à vista.
  await expect(
    page.getByRole("button", { name: "Exportar", exact: true }).first(),
  ).toBeInViewport();
  await expect(page.getByRole("button", { name: "Importar LaTeX" })).toBeInViewport();
  await expect(page.getByRole("banner").getByRole("status")).toBeVisible();
});

test("digita, aplica negrito e troca de seção pela gaveta", async ({ page }) => {
  await abrirDocumento(page, tresSecoes());

  // Digitar.
  const introducao = page.locator(".ProseMirror p").first();
  await introducao.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Escrito no celular.");
  await expect(introducao).toHaveText("Texto da introdução. Escrito no celular.");

  // Negrito: clique triplo seleciona o parágrafo (ver `citacoes.spec.ts`).
  await introducao.click({ clickCount: 3 });
  await page.getByRole("button", { name: "Negrito (Ctrl+B)" }).click();
  await expect(introducao.locator("strong")).toHaveText("Texto da introdução. Escrito no celular.");

  // Trocar de seção: a gaveta abre por cima, e escolher a seção a fecha.
  await page.getByRole("button", { name: ABRIR_SECOES }).click();
  const secoes = gaveta(page, "Seções e dados do trabalho");
  await expect(secoes).toBeVisible();
  await secoes.getByRole("button", { name: "Resultados", exact: true }).click();
  await expect(secoes).toBeHidden();
  const resultados = page.locator('section[data-id="s3"] p').first();
  await expect(resultados).toBeInViewport();

  // E escreve na seção nova.
  await resultados.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Mais uma linha.");
  await expect(resultados).toHaveText("As respostas do questionário. Mais uma linha.");
});

test("Esc e o fundo escuro fecham a gaveta", async ({ page }) => {
  await abrirDocumento(page, tresSecoes());

  await page.getByRole("button", { name: ABRIR_INSPETOR }).click();
  const inspetor = gaveta(page, "Conferência, histórico e exportação");
  await expect(inspetor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(inspetor).toBeHidden();

  await page.getByRole("button", { name: ABRIR_SECOES }).click();
  const secoes = gaveta(page, "Seções e dados do trabalho");
  await expect(secoes).toBeVisible();
  // O fundo fica à direita da gaveta esquerda.
  await page.mouse.click(360, 400);
  await expect(secoes).toBeHidden();
});

test("um achado de metadado leva da gaveta da conferência ao campo, na outra gaveta", async ({
  page,
}) => {
  await abrirDocumento(page, tresSecoes());

  await page.getByRole("button", { name: ABRIR_INSPETOR }).click();
  const inspetor = gaveta(page, "Conferência, histórico e exportação");
  await inspetor.getByRole("button", { name: /Falta o nome do autor/ }).click();

  await expect(inspetor).toBeHidden();
  await expect(gaveta(page, "Seções e dados do trabalho")).toBeVisible();
  await expect(page.locator('[data-campo="autores"]').first()).toBeFocused();
});

// Girar um celular grande ou redimensionar a janela atravessa os 768 px. Se
// o layout trocasse de componente, o React remontaria o editor: o desfazer
// se perderia e os painéis fechariam (achado no próprio 6.4.4).
test("atravessar os 768 px não remonta o editor: o desfazer continua", async ({ page }) => {
  await abrirDocumento(page, tresSecoes());
  const introducao = page.locator(".ProseMirror p").first();
  await introducao.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Antes de girar.");
  await expect(introducao).toHaveText("Texto da introdução. Antes de girar.");

  await page.setViewportSize({ width: 1280, height: 740 });
  await expect(page.getByRole("button", { name: "Ocultar painel de seções" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 740 });
  await expect(page.getByRole("button", { name: ABRIR_SECOES })).toBeVisible();

  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(introducao).toHaveText("Texto da introdução.");
});
