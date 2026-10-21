import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  novaFigura,
  novaTabela,
  novoDocumento as novoDocumentoBase,
} from "../src/core/document/factory";
import type { Documento } from "../src/core/document/types";
import { abrirDocumento, confirmarTabela, secao } from "./apoio";

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
  await confirmarTabela(page);

  // O cursor cai na primeira célula (8.5.1); a linha abaixo da tabela existe
  // de qualquer jeito, e é nela que se continua o texto. Era o que faltava.
  await page.keyboard.type("Primeira célula.");
  await expect(page.locator(".doc-tabela th").first()).toHaveText("Primeira célula.");
  await page.locator(".ProseMirror p").last().click();
  await page.keyboard.type("Texto depois da tabela.");

  await expect(page.locator(".ProseMirror p", { hasText: "Texto depois da tabela." })).toHaveCount(
    1,
  );
});

test("com a tabela inserida ainda é possível inserir uma figura", async ({ page }) => {
  await novoDocumento(page);

  await page.getByRole("button", { name: BOTAO_TABELA }).click();
  await confirmarTabela(page);
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
  await confirmarTabela(page);

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

// Clicar no vazio com a tabela carregada de um documento salvo (passo 8.1.3).
// Nos testes acima a tabela é inserida pela barra, que já deixa um parágrafo
// embaixo dela. Aqui ela vem pronta, sem parágrafo depois, e o clique tem
// que ser no vazio de verdade: a margem de baixo da folha e a faixa entre o
// fim da tabela e o título da seção seguinte.

function paragrafoVazio(i: number) {
  return {
    type: "paragraph" as const,
    content: [{ type: "text" as const, text: `Parágrafo ${i + 1} para encher a folha.` }],
  };
}

function documentoComTabela(opcoes: { paragrafos: number; segundaSecao: boolean }): Documento {
  const documento = novoDocumentoBase();
  documento.sections = [
    {
      id: "s1",
      ordem: 0,
      nivel: 1,
      titulo: "Introdução",
      content: [
        ...Array.from({ length: opcoes.paragrafos }, (_, i) => paragrafoVazio(i)),
        novaTabela(),
      ],
    },
    ...(opcoes.segundaSecao ? [secao("s2", 1, "Método", "Texto da segunda seção.")] : []),
  ];
  return documento;
}

// O ProseMirror só registra a seleção de um clique no `selectionchange`, que
// é assíncrono. Uma pessoa aperta a seta bem depois disso; o Playwright, não.
// Sem esta espera, a seta chega com a seleção ainda velha e o teste mede a
// pressa do robô, não o editor.
async function aguardarSelecao(page: Page) {
  await page.evaluate(
    () => new Promise<void>((resolver) => requestAnimationFrame(() => resolver())),
  );
}

const DEPOIS_DA_TABELA = ".doc-tabela >> xpath=following::p[normalize-space()='Escrito depois.']";

for (const paragrafos of [1, 60]) {
  test(`tabela no fim do documento, com ${paragrafos} parágrafos antes: clicar na margem de baixo da folha cria a linha`, async ({
    page,
  }) => {
    await abrirDocumento(page, documentoComTabela({ paragrafos, segundaSecao: false }));

    const folha = page
      .locator(".ProseMirror")
      .locator("xpath=ancestor::div[contains(@class,'shadow-sheet')][1]");
    await folha.scrollIntoViewIfNeeded();
    // Rola a folha até o fim, para a margem de baixo estar à vista.
    await page.locator(".doc-tabela").last().scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Negrito" }).focus();

    const caixa = (await folha.boundingBox())!;
    const naTela = await page.evaluate(() => window.innerHeight);
    const y = Math.min(caixa.y + caixa.height - 12, naTela - 60);
    await page.mouse.click(caixa.x + caixa.width / 2, y);
    await page.keyboard.type("Escrito depois.");

    await expect(page.locator(DEPOIS_DA_TABELA)).toHaveCount(1);
  });
}

// Entre a tabela e o título da seção seguinte não existe faixa em branco
// para clicar (a margem do bloco é interna a ele), então o gesto é a seta
// para baixo.
test("tabela no fim de uma seção seguida de outra: seta para baixo na última linha cria a linha ali", async ({
  page,
}) => {
  await abrirDocumento(page, documentoComTabela({ paragrafos: 1, segundaSecao: true }));

  const ultimaCelula = page.locator(".doc-tabela tr").last().locator("td, th").last();
  await ultimaCelula.click();
  await aguardarSelecao(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("Escrito depois.");

  // O texto fica na primeira seção, depois da tabela e antes do título da
  // segunda: não vai parar dentro da segunda seção.
  await expect(page.locator(DEPOIS_DA_TABELA)).toHaveCount(1);
  await expect(page.locator("[data-id='s1'] p", { hasText: "Escrito depois." })).toHaveCount(1);
  await expect(
    page.locator("[data-id='s2'] p", { hasText: "Texto da segunda seção." }),
  ).toHaveCount(1);
});

// Fora da última linha a seta não é nossa: não pode criar parágrafo. (Para
// onde ela leva dentro da tabela é o teclado da tabela, passo 8.5.2.)
test("seta para baixo numa linha que não é a última não cria parágrafo", async ({ page }) => {
  await abrirDocumento(page, documentoComTabela({ paragrafos: 1, segundaSecao: true }));

  await page.locator(".doc-tabela tr").first().locator("th, td").first().click();
  await aguardarSelecao(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("Qualquer coisa.");

  await expect(page.locator(DEPOIS_DA_TABELA)).toHaveCount(0);
  await expect(page.locator("[data-id='s1'] p")).toHaveCount(1);
});

test("figura no fim de uma seção seguida de outra: seta para baixo, com a figura selecionada, cria a linha", async ({
  page,
}) => {
  const documento = novoDocumentoBase();
  documento.sections = [
    {
      id: "s1",
      ordem: 0,
      nivel: 1,
      titulo: "Introdução",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Antes." }] }, novaFigura()],
    },
    secao("s2", 1, "Método", "Texto da segunda seção."),
  ];
  await abrirDocumento(page, documento);

  // A figura se seleciona pelo teclado: a seta para baixo, a partir do
  // parágrafo de cima, seleciona o bloco atômico; a segunda sai para baixo.
  await page.locator("[data-id='s1'] p").first().click();
  await aguardarSelecao(page);
  await page.keyboard.press("ArrowDown");
  await aguardarSelecao(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("Escrito depois.");

  await expect(page.locator("[data-id='s1'] p", { hasText: "Escrito depois." })).toHaveCount(1);
  await expect(
    page.locator("[data-id='s2'] p", { hasText: "Texto da segunda seção." }),
  ).toHaveCount(1);
});
