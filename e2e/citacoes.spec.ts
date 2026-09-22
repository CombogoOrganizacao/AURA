import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Passo 4.10 — inserir citação direta, indireta, longa e apud pela interface.
// O Vitest prova a chamada (4.9) e onde as citações estão na árvore (4.10);
// aqui o que se prova é o caminho da pessoa: escrever o texto, selecionar,
// citar, e ver a chamada da NBR 10520:2023 aparecer sem ter sido digitada.

const BIB = `
@book{bauman1999,
  author = {Bauman, Zygmunt},
  title = {Globaliza{\\c{c}}{\\~a}o: as consequ{\\^e}ncias humanas},
  publisher = {Jorge Zahar}, address = {Rio de Janeiro}, year = {1999}
}
@book{silva2019,
  author = {Silva, Ana},
  title = {Educação popular},
  publisher = {Atlas}, address = {São Paulo}, year = {2019}
}`;

async function documentoComReferencias(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.getByText("Referências", { exact: true }).click();
  await page
    .getByLabel("Arquivo .bib")
    .setInputFiles({ name: "tcc.bib", mimeType: "text/plain", buffer: Buffer.from(BIB, "utf-8") });
  await page.getByRole("button", { name: "Importar 2 referências" }).click();
}

// Escreve um parágrafo e o deixa inteiro selecionado — o trecho a citar.
async function escreverESelecionar(page: Page, texto: string) {
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type(texto);
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
}

function abrirMenu(page: Page) {
  return page.getByRole("button", { name: /^Citar/ }).click();
}

function dialogo(page: Page) {
  return page.getByRole("dialog", { name: /Citar|Editar citação/ });
}

// Rádio e caixa do design system têm o `<input>` `sr-only`: quem recebe o
// clique é o rótulo, como para quem usa o mouse.
async function escolherModo(page: Page, modo: "Direta" | "Indireta" | "Longa") {
  await dialogo(page).getByText(modo, { exact: true }).click();
}

function chamadas(page: Page) {
  return page.locator(".ProseMirror .doc-chamada");
}

test.describe("inserir citação pela interface (passo 4.10)", () => {
  test("direta: aspas e chamada com página, nenhuma das duas digitada", async ({ page }) => {
    await documentoComReferencias(page);
    await escreverESelecionar(page, "O mundo se globaliza");
    await abrirMenu(page);

    await escolherModo(page, "Direta");
    await dialogo(page)
      .getByLabel("Referência", { exact: true })
      .selectOption({ label: "Bauman — 1999 — Globalização" });
    await dialogo(page).getByLabel("Página ou localização").fill("45");
    // A prévia mostra a chamada antes de inserir.
    await expect(dialogo(page).getByLabel("Prévia da chamada")).toHaveText("(Bauman, 1999, p. 45)");
    await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();

    await expect(chamadas(page)).toHaveText([" (Bauman, 1999, p. 45)"]);
    await expect(page.locator(".ProseMirror .doc-aspas")).toHaveText(["“", "”"]);
    // O texto do aluno continua sendo só o que ele escreveu.
    await expect(page.locator(".ProseMirror .doc-citado")).toHaveText("O mundo se globaliza");
  });

  test("indireta: chamada sem aspas, página opcional", async ({ page }) => {
    await documentoComReferencias(page);
    await escreverESelecionar(page, "A globalização divide tanto quanto une");
    await abrirMenu(page);

    await escolherModo(page, "Indireta");
    await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();

    await expect(chamadas(page)).toHaveText([" (Bauman, 1999)"]);
    await expect(page.locator(".ProseMirror .doc-aspas")).toHaveCount(0);
  });

  test("longa: o parágrafo vira bloco recuado, com a chamada no fim", async ({ page }) => {
    await documentoComReferencias(page);
    await page.locator(".ProseMirror p").first().click();
    await page.keyboard.type("Um trecho transcrito de mais de três linhas.");
    await abrirMenu(page);

    await escolherModo(page, "Longa");
    await dialogo(page).getByLabel("Página ou localização").fill("12");
    await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();

    const bloco = page.locator(".ProseMirror blockquote");
    await expect(bloco).toContainText("Um trecho transcrito de mais de três linhas.");
    await expect(bloco.locator(".doc-chamada")).toHaveText(" (Bauman, 1999, p. 12)");
    // Sem aspas na longa (10520 §7.1.1).
    await expect(page.locator(".ProseMirror .doc-aspas")).toHaveCount(0);
  });

  test("apud: (AUTOR, ANO apud FONTE, ANO)", async ({ page }) => {
    await documentoComReferencias(page);
    await escreverESelecionar(page, "A educação é um ato político");
    await abrirMenu(page);

    await escolherModo(page, "Indireta");
    await dialogo(page)
      .getByLabel("Referência", { exact: true })
      .selectOption({ label: "Silva — 2019 — Educação popular" });
    await dialogo(page).getByText("Citação de citação (apud)").click();
    await dialogo(page).getByLabel("Sobrenome do autor original").fill("Freire");
    await dialogo(page).getByLabel("Ano do original").fill("1987");
    await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();

    await expect(chamadas(page)).toHaveText([" (Freire, 1987 apud Silva, 2019)"]);
  });

  test("direta e indireta pedem um trecho selecionado", async ({ page }) => {
    await documentoComReferencias(page);
    await page.locator(".ProseMirror p").first().click();
    await abrirMenu(page);

    await escolherModo(page, "Direta");
    await expect(dialogo(page).getByText("Selecione no texto o trecho citado")).toBeVisible();
    await expect(dialogo(page).getByRole("button", { name: "Inserir citação" })).toBeDisabled();
  });

  test("excluir a referência deixa a citação órfã e mantém o texto", async ({ page }) => {
    await documentoComReferencias(page);
    await escreverESelecionar(page, "O mundo se globaliza");
    await abrirMenu(page);
    await escolherModo(page, "Indireta");
    await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();
    await expect(chamadas(page)).toHaveText([" (Bauman, 1999)"]);

    await page.getByRole("button", { name: "Editar Globalização" }).click();
    await page.getByRole("button", { name: "Excluir Globalização" }).click();

    await expect(chamadas(page)).toHaveText([" (referência excluída)"]);
    await expect(page.locator(".ProseMirror .doc-citado-orfa")).toHaveText("O mundo se globaliza");

    // Desfazer a exclusão reata a ligação sozinho (4.8).
    await page.getByRole("button", { name: "Desfazer exclusão da referência" }).click();
    await expect(chamadas(page)).toHaveText([" (Bauman, 1999)"]);
  });

  test("a citação sobrevive ao recarregar, e editar muda a chamada", async ({ page }) => {
    await documentoComReferencias(page);
    await escreverESelecionar(page, "O mundo se globaliza");
    await abrirMenu(page);
    await escolherModo(page, "Indireta");
    await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();

    await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });
    await page.reload();
    await expect(chamadas(page)).toHaveText([" (Bauman, 1999)"]);

    // Cursor dentro do trecho citado: o menu abre em modo de edição.
    await page.locator(".ProseMirror .doc-citado").click();
    await abrirMenu(page);
    await expect(page.getByRole("dialog", { name: "Editar citação" })).toBeVisible();
    await dialogo(page).getByLabel("Página ou localização").fill("30");
    await dialogo(page).getByRole("button", { name: "Salvar citação" }).click();

    await expect(chamadas(page)).toHaveText([" (Bauman, 1999, p. 30)"]);
  });
});

test("depois de citar, o foco volta ao texto — Enter quebra a linha, não reabre o menu", async ({
  page,
}) => {
  await documentoComReferencias(page);
  await escreverESelecionar(page, "O mundo se globaliza");
  await abrirMenu(page);
  await escolherModo(page, "Indireta");
  await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();
  await expect(dialogo(page)).toHaveCount(0);
  await expect(page.locator(".ProseMirror")).toBeFocused();

  // Sem "End": o cursor já tem de estar no fim do trecho citado, sem seleção.
  // Com o trecho ainda selecionado, a primeira tecla apagava o texto do aluno.
  await page.keyboard.press("Enter");
  await page.keyboard.type("Parágrafo seguinte.");

  await expect(dialogo(page)).toHaveCount(0);
  await expect(page.locator(".ProseMirror .doc-citado")).toHaveText("O mundo se globaliza");
  await expect(page.locator(".ProseMirror p", { hasText: "Parágrafo seguinte." })).toHaveCount(1);
});
