import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { novoDocumento } from "../src/core/document/factory";
import type { Documento } from "../src/core/document/types";

import { abrirDocumento, secao } from "./apoio";

// Passo 6.4.5 — no celular, tabela, fórmulas, citar, reordenar seções e o
// cadastro de referências ficam para o computador (decisão §1.12). Eles
// aparecem **desabilitados com explicação**: à vista, anunciados como
// indisponíveis, e tocar mostra o motivo em vez de agir. Antes sumiam sem
// aviso.

test.use({ viewport: { width: 375, height: 740 } });

function trabalho(): Documento {
  const documento = novoDocumento();
  documento.sections = [
    secao("s1", 0, "Introdução", "Texto da introdução."),
    secao("s2", 1, "Método", "Texto do método."),
  ];
  documento.references = [
    {
      id: "bauman",
      type: "book",
      author: [{ family: "Bauman", given: "Zygmunt" }],
      title: "Globalização",
      publisher: "Jorge Zahar",
      "publisher-place": "Rio de Janeiro",
      issued: { "date-parts": [[1999]] },
    },
  ];
  return documento;
}

// Tocar no botão restrito abre a dica com o motivo (a dica abre no foco).
// `force`: o Playwright trata `aria-disabled` como desabilitado e esperaria
// para sempre o botão "habilitar"; uma pessoa toca nele normalmente.
async function motivoAoTocar(page: Page, botao: Locator): Promise<string> {
  // Sem a espera do `force`, a gaveta pode estar ainda deslizando.
  await expect(botao).toBeInViewport({ ratio: 1 });
  await botao.click({ force: true });
  await expect(botao).toBeFocused();
  const dica = page.locator(`[id="${await botao.getAttribute("aria-describedby")}"]`);
  await expect(dica).toBeVisible();
  return (await dica.textContent()) ?? "";
}

const BOTOES = [
  { nome: /^Tabela \(só no computador\)/, motivo: "Criar tabela é só no computador" },
  { nome: /^Fórmula \(só no computador\)/, motivo: "Criar fórmula é só no computador" },
  { nome: /^Fórmula no texto \(só no computador\)/, motivo: "Criar fórmula é só no computador" },
  { nome: /^Citar \(só no computador\)/, motivo: "Citar é só no computador" },
];

test("os botões da barra ficam à vista, desabilitados, e tocar mostra o motivo sem agir", async ({
  page,
}) => {
  await abrirDocumento(page, trabalho());
  await page.locator(".ProseMirror p").first().click();
  const blocosAntes = await page.locator(".ProseMirror > *").count();

  for (const { nome, motivo } of BOTOES) {
    const botao = page.getByRole("button", { name: nome });
    await expect(botao).toBeVisible();
    await expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(await motivoAoTocar(page, botao)).toContain(motivo);
  }

  // Nada foi criado: nem tabela, nem fórmula, nem a janela de citar.
  await expect(page.locator(".ProseMirror table")).toHaveCount(0);
  await expect(page.locator(".doc-formula-render, .doc-formula-inline")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: /Citar/ })).toHaveCount(0);
  await expect(page.locator(".ProseMirror > *")).toHaveCount(blocosAntes);
});

test("a alça de reordenar fica à vista, desabilitada, com o motivo", async ({ page }) => {
  await abrirDocumento(page, trabalho());
  await page.getByRole("button", { name: "Abrir: Seções e dados do trabalho" }).click();

  const alca = page.getByRole("button", { name: 'Reordenar "Método" (só no computador)' });
  await expect(alca).toBeVisible();
  await expect(alca).toHaveAttribute("aria-disabled", "true");
  expect(await motivoAoTocar(page, alca)).toContain("Reordenar seções é só no computador");
});

test("o painel de referências mostra a lista e explica por que o cadastro é do computador", async ({
  page,
}) => {
  await abrirDocumento(page, trabalho());
  await page.getByRole("button", { name: "Abrir: Seções e dados do trabalho" }).click();
  const gaveta = page.getByRole("dialog", { name: "Seções e dados do trabalho" });
  await gaveta.getByText("Referências", { exact: true }).click();

  const painel = gaveta.locator('details[data-painel="referencias"]');
  await expect(painel).toContainText("Cadastrar referências é só no computador");
  await expect(painel).toContainText("Globalização");
  await expect(painel.getByRole("button", { name: "Nova referência" })).toBeDisabled();
  await expect(painel.getByRole("button", { name: "Importar .bib" })).toBeDisabled();
  await expect(painel.getByRole("button", { name: /^Editar / })).toBeDisabled();
});

test("no desktop, nada disso muda: os botões agem normalmente", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirDocumento(page, trabalho());

  for (const { nome } of BOTOES) {
    await expect(page.getByRole("button", { name: nome })).not.toHaveAttribute("aria-disabled");
  }
  await page.getByText("Referências", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Nova referência" })).toBeEnabled();
  await page.locator(".ProseMirror p").first().click();
  await page.getByRole("button", { name: BOTOES[0].nome }).click();
  await expect(page.locator(".ProseMirror table")).toHaveCount(1);
});
