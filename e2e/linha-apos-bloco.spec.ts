import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// O defeito relatado ao conferir a exportação no Word: inserida uma tabela,
// não havia como escrever depois dela — e, por tabu­la­men­to, nem como
// inserir a figura seguinte. A causa é estrutural: entre o fim da tabela e o
// fim da seção não existe posição de texto, então o clique não tinha para
// onde ir.
//
// Este spec fica no repositório porque nada disso aparece no Vitest: as
// funções puras (`src/core/editor/caret.ts`) são testadas lá, mas "clicar na
// folha e conseguir digitar" só existe com um editor montado, com layout e
// eventos de mouse de verdade.

async function novoDocumento(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type("Um parágrafo qualquer.");
}

const BOTAO_FIGURA = "Figura — legenda e fonte numeradas automaticamente";
const BOTAO_TABELA = "Tabela (só no computador) — padrão IBGE, laterais abertas";

test("depois de inserir uma tabela dá para continuar escrevendo", async ({ page }) => {
  await novoDocumento(page);

  await page.getByRole("button", { name: BOTAO_TABELA }).click();

  // Sem clicar em lugar nenhum: inserir já deixa o cursor numa linha abaixo
  // da tabela. Era exatamente o que faltava.
  await page.keyboard.type("Texto depois da tabela.");

  await expect(page.locator(".ProseMirror p", { hasText: "Texto depois da tabela." })).toHaveCount(
    1,
  );
});

test("com a tabela inserida ainda é possível inserir uma figura", async ({ page }) => {
  await novoDocumento(page);

  await page.getByRole("button", { name: BOTAO_TABELA }).click();
  await page.getByRole("button", { name: BOTAO_FIGURA }).click();

  // O caminho que estava bloqueado: a figura entra DEPOIS da tabela, não
  // dentro dela nem por cima dela.
  await expect(page.getByLabel("Legenda — Figura 1")).toHaveValue("");
  await expect(page.getByLabel("Legenda — Tabela 1")).toHaveValue("");
});

test("clicar no vazio da folha, abaixo do texto, põe o cursor na última linha", async ({
  page,
}) => {
  await novoDocumento(page);
  await page.getByRole("button", { name: BOTAO_TABELA }).click();

  // Tira o foco do editor para o clique seguinte ser o único gesto em jogo.
  await page.getByRole("button", { name: "Negrito" }).focus();

  // Bem abaixo do conteúdo, dentro da folha: a região que antes não
  // respondia a clique nenhum.
  const folha = page.locator(".ProseMirror").locator("xpath=ancestor::div[1]");
  const caixa = await folha.boundingBox();
  await page.mouse.click(caixa!.x + caixa!.width / 2, caixa!.y + caixa!.height - 12);

  await page.keyboard.type("Escrito depois de clicar no vazio.");

  await expect(
    page.locator(".ProseMirror p", { hasText: "Escrito depois de clicar no vazio." }),
  ).toHaveCount(1);
});

test("clicar no meio do texto não joga o cursor para o fim", async ({ page }) => {
  await novoDocumento(page);

  // O clique que o ProseMirror já tratava sozinho continua sendo dele: se o
  // handler da folha o roubasse, escrever no meio de um parágrafo viraria
  // impossível.
  const paragrafo = page.locator(".ProseMirror p").first();
  await paragrafo.click();
  await page.keyboard.press("Home");
  await page.keyboard.type("INÍCIO ");

  await expect(paragrafo).toHaveText("INÍCIO Um parágrafo qualquer.");
});
