import { expect, test } from "@playwright/test";

import { novoDocumento } from "../src/core/document/factory";
import { abrirDocumento, secao, tresSecoes } from "./apoio";

// O editor fica preso à janela (passo 8.1.1). Antes, com os painéis da coluna
// esquerda abertos, os `<input>` invisíveis (`sr-only`, absolutos) de
// Checkbox, Radio e Switch escapavam da coluna e esticavam a página: a roda
// do mouse fora da folha rolava o documento inteiro, e sobrava fundo bege
// vazio embaixo do editor.

test("com todos os painéis abertos, a página não rola para fora do editor", async ({ page }) => {
  await abrirDocumento(page, tresSecoes());

  await page.locator("details[data-painel]").evaluateAll((paineis) => {
    for (const painel of paineis) (painel as HTMLDetailsElement).open = true;
  });

  // Roda do mouse sobre a barra de estatísticas, fora da folha e das colunas
  // que rolam: se a página tiver altura sobrando, é ela que rola.
  const barra = page.getByText(/palavras/).last();
  await barra.hover();
  await page.mouse.wheel(0, 2000);

  const medidas = await page.evaluate(() => ({
    altura: document.documentElement.scrollHeight,
    janela: window.innerHeight,
    rolagem: window.scrollY,
  }));
  expect(medidas.altura).toBeLessThanOrEqual(medidas.janela);
  expect(medidas.rolagem).toBe(0);
});

// Coluna esquerda (passo 8.1.2): os dados do trabalho e as seções rolam cada
// um por conta própria. Antes, os `<details>` abertos empurravam a lista de
// seções para altura zero, e nada rolava.

test("coluna esquerda: painéis abertos rolam, e as seções continuam à vista", async ({ page }) => {
  const documento = novoDocumento();
  documento.metadados.titulo = "Trabalho de teste";
  documento.sections = Array.from({ length: 10 }, (_, i) =>
    secao(`s${i + 1}`, i, `Seção ${i + 1}`, `Texto ${i + 1}.`),
  );
  await abrirDocumento(page, documento);

  await page.locator("details[data-painel]").evaluateAll((paineis) => {
    for (const painel of paineis) (painel as HTMLDetailsElement).open = true;
  });

  // A lista de seções não some: o botão de nova seção e um pedaço da lista
  // seguem visíveis com todos os painéis abertos.
  const lista = page.getByRole("navigation", { name: "Seções do documento" });
  await expect(page.getByRole("button", { name: "Nova seção", exact: true })).toBeInViewport();
  const caixaLista = await lista.boundingBox();
  expect(caixaLista!.height).toBeGreaterThan(150);

  // A lista rola até a última seção.
  const ultima = lista.locator('[data-secao-id="s10"]');
  await ultima.scrollIntoViewIfNeeded();
  await expect(ultima).toBeInViewport();

  // Os painéis rolam com a roda do mouse, e o último fica alcançável.
  const primeiroTitulo = page.locator('details[data-painel="dados"] > summary');
  const antes = (await primeiroTitulo.boundingBox())!.y;
  await page.locator('details[data-painel="referencias"] > summary').hover();
  await page.mouse.wheel(0, 3000);
  await expect.poll(async () => (await primeiroTitulo.boundingBox())!.y).toBeLessThan(antes);
  await expect(page.getByRole("button", { name: "Importar .bib" })).toBeInViewport();
});
