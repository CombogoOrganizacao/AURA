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
//
// Seleciona com clique triplo, não com Home e Shift+End. Com a suíte inteira
// em paralelo, o Chromium às vezes deixa de executar as teclas de navegação
// que o Playwright injeta (a tecla chega, ninguém a cancela, e o cursor não
// anda), e isso persiste naquela página; digitar continua funcionando.
// Investigado em 08/10/2026 (docs/to-do.md, pendência do 6.4.2). A seleção
// é conferida no navegador e no editor antes de seguir.
async function escreverESelecionar(page: Page, texto: string) {
  const paragrafo = page.locator(".ProseMirror p").first();
  await paragrafo.click();
  await page.keyboard.type(texto);
  await paragrafo.click({ clickCount: 3 });
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(texto);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            document.querySelector(".ProseMirror") as unknown as {
              editor: { state: { selection: { empty: boolean } } };
            }
          ).editor.state.selection.empty,
      ),
    )
    .toBe(false);
}

function abrirMenu(page: Page) {
  return page.getByRole("button", { name: /^Citar/ }).click();
}

function dialogo(page: Page) {
  return page.getByRole("dialog", { name: /Citar|Editar citação/ });
}

// Rádio e caixa do design system têm o `<input>` `sr-only`: quem recebe o
// clique é o rótulo, como para quem usa o mouse.
async function escolherModo(
  page: Page,
  modo: "Direta" | "Indireta" | "Longa" | "Autor na frase",
) {
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

  // NBR 10520:2023 §7.1.5 e §7.1.6: "como último elemento da chamada".
  test("grifo nosso entra na chamada e sai ao ser desmarcado", async ({ page }) => {
    await documentoComReferencias(page);
    await escreverESelecionar(page, "O mundo se globaliza");
    await abrirMenu(page);

    await escolherModo(page, "Direta");
    await dialogo(page).getByLabel("Página ou localização").fill("45");
    await dialogo(page).getByText("Grifo nosso", { exact: true }).click();
    await expect(dialogo(page).getByLabel("Prévia da chamada")).toHaveText(
      "(Bauman, 1999, p. 45, grifo nosso)",
    );
    await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();
    await expect(chamadas(page)).toHaveText([" (Bauman, 1999, p. 45, grifo nosso)"]);

    // Editar e desmarcar: o `setMark` mescla com os atributos antigos, e o
    // grifo ficava se o menu não mandasse o `false`.
    await page.locator(".ProseMirror .doc-citado").click();
    await abrirMenu(page);
    await dialogo(page).getByText("Grifo nosso", { exact: true }).click();
    await dialogo(page).getByRole("button", { name: "Salvar citação" }).click();
    await expect(chamadas(page)).toHaveText([" (Bauman, 1999, p. 45)"]);
  });

  test("tradução nossa na citação longa; a indireta não oferece as duas", async ({ page }) => {
    await documentoComReferencias(page);
    await page.locator(".ProseMirror p").first().click();
    await page.keyboard.type("Um trecho traduzido de mais de três linhas.");
    await abrirMenu(page);

    await escolherModo(page, "Indireta");
    await expect(dialogo(page).getByText("Tradução nossa", { exact: true })).toHaveCount(0);

    await escolherModo(page, "Longa");
    await dialogo(page).getByLabel("Página ou localização").fill("21");
    await dialogo(page).getByText("Tradução nossa", { exact: true }).click();
    await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();

    await expect(page.locator(".ProseMirror blockquote .doc-chamada")).toHaveText(
      " (Bauman, 1999, p. 21, tradução nossa)",
    );
  });

  // NBR 10520:2023 §6.1.4: "Bauman (1999, p. 45)" entra na frase do aluno,
  // sintetizado da referência; o resto da frase é digitado.
  test("autor na frase: entra no cursor, volta ao recarregar e se edita pelo menu", async ({
    page,
  }) => {
    await documentoComReferencias(page);
    const paragrafo = page.locator(".ProseMirror p").first();
    await paragrafo.click();
    await page.keyboard.type("Segundo ");
    await abrirMenu(page);

    await escolherModo(page, "Autor na frase");
    // Não precisa de trecho selecionado: o aviso das outras não aparece.
    await expect(dialogo(page).getByText("Selecione no texto o trecho citado")).toHaveCount(0);
    await dialogo(page).getByLabel("Página ou localização").fill("45");
    await expect(dialogo(page).getByLabel("Prévia da chamada")).toHaveText("Bauman (1999, p. 45)");
    await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();

    // O cursor fica logo depois: a frase continua dali.
    await page.keyboard.type(", o mundo se globaliza.");
    const narrativa = page.locator(".ProseMirror .doc-citacao-narrativa");
    await expect(narrativa).toHaveText("Bauman (1999, p. 45)");
    await expect(paragrafo).toHaveText("Segundo Bauman (1999, p. 45), o mundo se globaliza.");

    await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });
    await page.reload();
    await expect(narrativa).toHaveText("Bauman (1999, p. 45)");

    // Selecionado, o menu o edita: outra página, sem trocar de modo.
    await narrativa.click();
    await abrirMenu(page);
    await expect(dialogo(page)).toHaveAccessibleName(/Editar citação/);
    await expect(dialogo(page).getByRole("radio", { name: /^Direta/ })).toBeDisabled();
    await dialogo(page).getByLabel("Página ou localização").fill("50");
    await dialogo(page).getByRole("button", { name: "Salvar citação" }).click();
    await expect(narrativa).toHaveText("Bauman (1999, p. 50)");
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

// Passo 8.4.1 — citar com menos cliques.
test.describe("citar só com o teclado (passo 8.4.1)", () => {
  test("selecionar, Ctrl+K, página, Enter", async ({ page }) => {
    await documentoComReferencias(page);
    await escreverESelecionar(page, "O mundo se globaliza");

    await page.keyboard.press("Control+k");
    await expect(dialogo(page)).toBeVisible();
    // O foco já está na página, e não no X de fechar.
    await expect(dialogo(page).getByLabel("Página ou localização")).toBeFocused();
    await page.keyboard.type("45");
    await page.keyboard.press("Enter");

    await expect(dialogo(page)).toHaveCount(0);
    await expect(chamadas(page)).toHaveText([" (Bauman, 1999, p. 45)"]);
    await expect(page.locator(".ProseMirror")).toBeFocused();
  });

  test("a janela lembra a última referência e o último tipo", async ({ page }) => {
    await documentoComReferencias(page);
    await escreverESelecionar(page, "Primeiro trecho");
    await abrirMenu(page);
    await escolherModo(page, "Indireta");
    await dialogo(page)
      .getByLabel("Referência", { exact: true })
      .selectOption({ label: "Silva — 2019 — Educação popular" });
    await dialogo(page).getByRole("button", { name: "Inserir citação" }).click();
    await expect(chamadas(page)).toHaveText([" (Silva, 2019)"]);

    await page.keyboard.press("Enter");
    await page.keyboard.type("Segundo trecho");
    await page.locator(".ProseMirror p").last().click({ clickCount: 3 });
    await abrirMenu(page);

    await expect(
      dialogo(page).getByLabel("Referência", { exact: true }).locator("option:checked"),
    ).toHaveText("Silva — 2019 — Educação popular");
    await expect(dialogo(page).getByRole("radio", { name: /^Indireta/ })).toBeChecked();
  });

  test("Enter logo ao abrir não fecha a janela sem citar: com o trecho, insere; sem, segue aberta", async ({
    page,
  }) => {
    await documentoComReferencias(page);
    await escreverESelecionar(page, "Um trecho");
    await abrirMenu(page);
    await page.keyboard.press("Enter");
    await expect(dialogo(page)).toHaveCount(0);
    await expect(chamadas(page)).toHaveCount(1);

    // Sem trecho selecionado, direta não pode ser inserida: o Enter não fecha.
    await page.keyboard.press("Enter");
    await page.keyboard.type("Outra linha");
    await abrirMenu(page);
    await page.keyboard.press("Enter");
    await expect(dialogo(page)).toBeVisible();
    await expect(chamadas(page)).toHaveCount(1);
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
