import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Passo 3.6.3 — o critério de aceite é literal e comportamental: "inserir no
// meio renumera as seguintes; a tabela é restrita ao desktop". Nenhum teste
// de unidade prova isso ponta a ponta: a numeração da tela vem de
// `numerarNumeraveisProseMirror()` recalculada a cada transação DENTRO do
// editor, e o "só desktop" é um breakpoint CSS. Por isso este spec fica no
// repositório, como o de 3.5.3.

async function novoDocumento(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  // Materializa a seção-semente: o editor só existe de verdade depois que há
  // onde o cursor entrar.
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type("Um parágrafo qualquer.");
}

const BOTAO_FIGURA = "Figura — legenda e fonte numeradas automaticamente";
const BOTAO_TABELA = "Tabela (só no computador) — padrão IBGE, laterais abertas";

test("inserir uma figura no meio renumera as seguintes", async ({ page }) => {
  await novoDocumento(page);

  await page.getByRole("button", { name: BOTAO_FIGURA }).click();

  // A legenda digitada é o que identifica ESTA figura ao longo do teste — o
  // número muda, o texto não.
  const legenda = page.getByLabel("Legenda — Figura 1");
  await legenda.fill("Primeira figura inserida");
  await expect(legenda).toHaveValue("Primeira figura inserida");

  // Cursor de volta ao começo do parágrafo, ANTES da figura.
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.press("Home");
  await page.getByRole("button", { name: BOTAO_FIGURA }).click();

  // A figura de antes passou a ser a 2: o número não estava gravado em lugar
  // nenhum, foi recalculado da posição (docs/schema-tiptap.md §2).
  await expect(page.getByLabel("Legenda — Figura 2")).toHaveValue("Primeira figura inserida");
  await expect(page.getByLabel("Legenda — Figura 1")).toHaveValue("");
});

test("figura e tabela têm contagens independentes", async ({ page }) => {
  await novoDocumento(page);

  await page.getByRole("button", { name: BOTAO_TABELA }).click();
  await page.getByRole("button", { name: BOTAO_FIGURA }).click();

  // A tabela antes da figura não empurrou a numeração dela: são duas
  // sequências, não uma de "ilustrações".
  await expect(page.getByLabel("Legenda — Tabela 1")).toBeVisible();
  await expect(page.getByLabel("Legenda — Figura 1")).toBeVisible();
});

test("o botão de tabela é restrito ao desktop; a figura continua em qualquer largura", async ({
  page,
}) => {
  await novoDocumento(page);

  await expect(page.getByRole("button", { name: BOTAO_TABELA })).toBeVisible();

  // Abaixo do breakpoint `md` do Tailwind (768px).
  await page.setViewportSize({ width: 420, height: 800 });
  await expect(page.getByRole("button", { name: BOTAO_TABELA })).toBeHidden();
  await expect(page.getByRole("button", { name: BOTAO_FIGURA })).toBeVisible();
});

test("a tabela já criada continua editável abaixo do breakpoint", async ({ page }) => {
  await novoDocumento(page);

  await page.getByRole("button", { name: BOTAO_TABELA }).click();
  await page.getByLabel("Legenda — Tabela 1").fill("Distribuição por faixa");

  // O que o breakpoint tira é o botão de CRIAR uma tabela, não a tabela.
  await page.setViewportSize({ width: 420, height: 800 });
  await expect(page.getByLabel("Legenda — Tabela 1")).toHaveValue("Distribuição por faixa");
  await expect(page.locator(".ProseMirror table")).toBeVisible();
});
