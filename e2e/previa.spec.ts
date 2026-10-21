import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { novaTabela, novoDocumento } from "../src/core/document/factory";
import type { Documento, NoInline } from "../src/core/document/types";
import { abrirDocumento } from "./apoio";

// Passo 8.6.1 — a prévia paginada. O Vitest prova o modelo (`previa.test.ts`);
// aqui, o que só existe com o Paged.js rodando no navegador: as folhas, a
// numeração e a quebra de página.

const paragrafo = (texto: string): NoInline[] => [{ type: "text", text: texto }];

function trabalho(): Documento {
  const documento = novoDocumento();
  documento.metadados.titulo = "Trabalho de teste";
  const longo = "Texto do trabalho para encher a página com linhas. ".repeat(40);
  const tabela = novaTabela(2, 2);
  tabela.legenda = "Resultados";
  tabela.fonte = "Dados da pesquisa";
  tabela.linhas[0].celulas[0].content = [{ type: "text", text: "Grupo" }];
  documento.sections = [
    {
      id: "s1",
      ordem: 0,
      nivel: 1,
      titulo: "Introdução",
      content: [
        { type: "paragraph", content: paragrafo(longo) },
        { type: "paragraph", content: paragrafo(longo) },
        { type: "paragraph", content: paragrafo(longo) },
        { type: "paragraph", content: paragrafo(longo) },
      ],
    },
    {
      id: "s2",
      ordem: 1,
      nivel: 1,
      titulo: "Método",
      content: [{ type: "paragraph", content: paragrafo("Curto.") }, tabela],
    },
    {
      id: "s3",
      ordem: 2,
      nivel: 2,
      titulo: "Amostra",
      content: [{ type: "paragraph", content: paragrafo("Sub.") }],
    },
  ];
  documento.references = [{ id: "r1", type: "book", title: "Um livro qualquer" }];
  documento.apendices = [
    {
      id: "a1",
      titulo: "Questionário",
      content: [{ type: "paragraph", content: paragrafo("Perguntas.") }],
    },
  ];
  return documento;
}

async function abrirPrevia(page: Page) {
  await page.getByRole("button", { name: "Prévia", exact: true }).click();
  const tela = page.getByRole("dialog", { name: "Prévia do trabalho" });
  await expect(tela).toBeVisible();
  await expect(tela.getByRole("status")).toHaveText(/\d+ páginas?/, { timeout: 30_000 });
  return tela;
}

test("a prévia abre, pagina o trabalho em A4 e fecha com Esc", async ({ page }) => {
  await abrirDocumento(page, trabalho());
  const tela = await abrirPrevia(page);

  await expect(tela).toContainText(
    "Prévia aproximada: o Word pode quebrar a página em outro ponto.",
  );
  const folhas = page.locator(".pagedjs_page");
  // Introdução (mais de uma página), Método, referências e apêndice: ao menos
  // cinco folhas, cada seção primária abrindo a sua.
  expect(await folhas.count()).toBeGreaterThanOrEqual(5);

  const medida = await folhas.first().evaluate((el) => {
    const caixa = el.getBoundingClientRect();
    return { largura: (caixa.width / 96) * 2.54, altura: (caixa.height / 96) * 2.54 };
  });
  expect(medida.largura).toBeCloseTo(21, 0);
  expect(medida.altura).toBeCloseTo(29.7, 0);

  // Os títulos saem numerados, e o apêndice em caixa alta.
  await expect(page.locator(".pagedjs_page h1.pv-titulo", { hasText: "1 Introdução" })).toHaveCount(
    1,
  );
  await expect(page.locator(".pagedjs_page h1.pv-titulo", { hasText: "2 Método" })).toHaveCount(1);
  await expect(page.locator(".pagedjs_page h2.pv-titulo", { hasText: "2.1 Amostra" })).toHaveCount(
    1,
  );
  await expect(
    page.locator(".pagedjs_page .pv-titulo-centro", { hasText: "REFERÊNCIAS" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".pagedjs_page .pv-titulo-centro", { hasText: "APÊNDICE A — QUESTIONÁRIO" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".pagedjs_page .pv-legenda", { hasText: "Tabela 1 — Resultados" }),
  ).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(tela).toHaveCount(0);
  await expect(page.locator(".pagedjs_page")).toHaveCount(0);
  // O foco volta ao botão que abriu.
  await expect(page.getByRole("button", { name: "Prévia", exact: true })).toBeFocused();
});

// O número da folha como o Paged.js o conta: cada folha traz `counter-reset`
// (quando a parte recomeça a contagem) ou `counter-increment`.
async function numerosDasFolhas(page: Page): Promise<number[]> {
  return page.locator(".pagedjs_page").evaluateAll((folhas) => {
    let numero = 0;
    return folhas.map((folha) => {
      const estilo = getComputedStyle(folha);
      const reinicio = estilo.counterReset.replace("page", "").trim();
      const incremento = estilo.counterIncrement.replace("page", "").trim();
      if (reinicio !== "none") numero = parseInt(reinicio, 10);
      if (incremento !== "none") numero += parseInt(incremento, 10);
      return numero;
    });
  });
}

function trabalhoCompleto(): Documento {
  const documento = trabalho();
  Object.assign(documento.metadados, {
    titulo: "Robótica inclusiva",
    autores: ["Eduarda"],
    instituicao: "UNICAP",
    local: "Recife",
    ano: 2026,
    naturezaTrabalho: "Trabalho de conclusão de curso",
    orientador: "Maria",
    resumo: "Um resumo do trabalho.",
    palavrasChave: ["robôs"],
  });
  return documento;
}

test("a capa fica fora da contagem, os pré-textuais contam sem mostrar e o texto mostra o número", async ({
  page,
}) => {
  await abrirDocumento(page, trabalhoCompleto());
  await abrirPrevia(page);

  const folhas = page.locator(".pagedjs_page");
  const textos = await folhas.evaluateAll((els) =>
    els.map((el) => (el.querySelector(".pagedjs_page_content")?.textContent ?? "").trim()),
  );
  const rosto = textos.findIndex((t) => t.includes("Trabalho de conclusão de curso"));
  const introducao = textos.findIndex((t) => t.startsWith("1 Introdução"));
  expect(rosto).toBe(1);
  expect(introducao).toBeGreaterThan(rosto);

  const numeros = await numerosDasFolhas(page);
  // A folha de rosto é a página 1; a introdução vem depois dos pré-textuais.
  expect(numeros[rosto]).toBe(1);
  expect(numeros[introducao]).toBe(introducao); // folhas pré-textuais = introducao - 1

  // O número do canto só existe do texto em diante: nas outras folhas a caixa
  // do canto não tem conteúdo (`content: none`).
  const cantos = await folhas.evaluateAll((els) =>
    els.map((el) => {
      const caixa = el.querySelector(".pagedjs_margin-top-right .pagedjs_margin-content");
      return caixa ? getComputedStyle(caixa, "::after").content : "sem caixa";
    }),
  );
  expect(cantos.slice(0, introducao).every((c) => c === "none")).toBe(true);
  expect(cantos.slice(introducao).every((c) => c.includes("counter(page)"))).toBe(true);
});

test("o sumário lista cada título com o número da folha onde ele cai", async ({ page }) => {
  await abrirDocumento(page, trabalhoCompleto());
  await abrirPrevia(page);

  const numeros = await numerosDasFolhas(page);
  const alvos = await page.locator(".pagedjs_page .pv-indice a").evaluateAll((links, todos) => {
    return links.map((a) => {
      const href = a.getAttribute("href") ?? "";
      const folha = Array.from(document.querySelectorAll(".pagedjs_page")).findIndex((f) =>
        f.querySelector(`[id="${href.slice(1)}"]`),
      );
      // O Paged.js grava o número da página no `counter-reset` do ::after.
      const reinicio = getComputedStyle(a, "::after").counterReset;
      return {
        texto: a.textContent,
        escrito: parseInt(reinicio.split(" ").at(-1) ?? "", 10),
        folha,
        todos,
      };
    });
  }, numeros);

  // As quatro entradas do trabalho (a lista de tabelas tem a sua, à parte).
  const doSumario = alvos.filter((a) => /^(\d|REFER|AP[ÊE]NDICE)/.test(a.texto ?? ""));
  expect(doSumario.map((a) => a.texto)).toEqual([
    "1 Introdução",
    "2 Método",
    "2.1 Amostra",
    "REFERÊNCIAS",
    "APÊNDICE A — QUESTIONÁRIO",
  ]);
  for (const entrada of doSumario) {
    expect(entrada.folha).toBeGreaterThanOrEqual(0);
    expect(entrada.escrito).toBe(numeros[entrada.folha]);
  }
  // E em ordem: nunca volta atrás.
  const escritos = doSumario.map((a) => a.escrito);
  expect([...escritos].sort((a, b) => a - b)).toEqual(escritos);
});

test("reabrir a prévia monta de novo, sem acumular folhas", async ({ page }) => {
  await abrirDocumento(page, trabalho());
  await abrirPrevia(page);
  const primeira = await page.locator(".pagedjs_page").count();
  await page.getByRole("button", { name: "Fechar a prévia" }).click();

  await abrirPrevia(page);
  expect(await page.locator(".pagedjs_page").count()).toBe(primeira);
});

test("a prévia mostra o que está na tela, sem esperar o autosave", async ({ page }) => {
  await abrirDocumento(page, trabalho());
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("PALAVRA-NOVA ");
  await abrirPrevia(page);
  await expect(page.locator(".pagedjs_page", { hasText: "PALAVRA-NOVA" }).first()).toBeVisible();
});

test("documento sem seção avisa em vez de montar folhas vazias", async ({ page }) => {
  const vazio = novoDocumento();
  vazio.sections = [];
  await abrirDocumento(page, vazio);
  await page.getByRole("button", { name: "Prévia", exact: true }).click();
  await expect(page.getByText("Ainda não há nada para mostrar")).toBeVisible();
});

test("a tela da prévia passa no axe", async ({ page }) => {
  await abrirDocumento(page, trabalho());
  const tela = await abrirPrevia(page);
  const resultado = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    resultado.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 120)).join(" | ")}`,
    ),
  ).toEqual([]);
  await expect(tela).toBeVisible();
});
