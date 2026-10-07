import { expect, test } from "@playwright/test";

import { abrirDocumento, tresSecoes } from "./apoio";

// A dica de um botão da barra perto do painel esquerdo era cortada pela
// coluna central (`overflow-auto`) e ficava sob o painel. Agora é desenhada no
// `body`, com posição fixa, limitada à janela (`components/ui/Tooltip.tsx`).

test("a dica do botão de tabela aparece inteira, fora da coluna central", async ({ page }) => {
  await abrirDocumento(page, tresSecoes());
  const botao = page.getByRole("button", { name: /^Tabela/ });
  await botao.hover();

  const id = await botao.getAttribute("aria-describedby");
  const dica = page.locator(`[id="${id}"]`);
  await expect(dica).toBeVisible();
  await expect(dica).toContainText("padrão IBGE");

  // No `body`, não dentro da coluna que a cortava.
  expect(await dica.evaluate((el) => el.parentElement === document.body)).toBe(true);
  const caixa = (await dica.boundingBox())!;
  const janela = page.viewportSize()!;
  expect(caixa.x).toBeGreaterThanOrEqual(0);
  expect(caixa.y).toBeGreaterThanOrEqual(0);
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(janela.width);
  expect(caixa.y + caixa.height).toBeLessThanOrEqual(janela.height);

  // Ninguém fica por cima dela: o elemento mais alto no centro da dica, sem
  // contar ela mesma (que não recebe o mouse), é o que estaria embaixo.
  const porCima = await dica.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const zDica = Number(getComputedStyle(el).zIndex);
    return document
      .elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      .some((outro) => outro !== el && Number(getComputedStyle(outro).zIndex) > zDica);
  });
  expect(porCima).toBe(false);

  await botao.blur();
  await page.mouse.move(0, 0);
  await expect(dica).toBeHidden();
});
