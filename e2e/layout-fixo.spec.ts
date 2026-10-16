import { expect, test } from "@playwright/test";

import { abrirDocumento, tresSecoes } from "./apoio";

// O editor fica preso à janela (passo 8.1.1). Antes, com os painéis da coluna
// esquerda abertos, os `<input>` invisíveis (`sr-only`, absolutos) de
// Checkbox, Radio e Switch escapavam da coluna e esticavam a página: a roda
// do mouse fora da folha rolava o documento inteiro, e sobrava fundo bege
// vazio embaixo do editor.

test("com todos os painéis abertos, a página não rola para fora do editor", async ({
  page,
}) => {
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
