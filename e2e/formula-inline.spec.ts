import { expect, test } from "@playwright/test";

import { novoDocumento } from "../src/core/document/factory";
import { abrirDocumento, documentoSalvo } from "./apoio";

// Fórmula no meio da frase (passo 6.2.11): inserir pela barra, escrever o
// LaTeX, continuar a frase, e o KaTeX desenhar na linha. O caminho do `.docx`
// está em `src/core/export/docx/formulaInline.test.ts`; como o Word desenha a
// equação só se confere abrindo nele.

const BOTAO = "Fórmula no texto (só no computador) — escrita em LaTeX, no meio da frase";
const CAMPO = "LaTeX da fórmula no texto";

test("insere no meio da frase, desenha com o KaTeX e é salva no parágrafo", async ({ page }) => {
  const documento = novoDocumento();
  documento.sections = [
    {
      id: "s1",
      ordem: 0,
      nivel: 1,
      titulo: "Métricas",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Expressa por" }] }],
    },
  ];
  await abrirDocumento(page, documento);

  await page.locator(".ProseMirror p", { hasText: "Expressa por" }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ");
  await page.getByRole("button", { name: BOTAO }).click();

  const campo = page.getByLabel(CAMPO);
  await expect(campo).toBeFocused();
  await campo.fill("PDR = \\frac{a}{b}");
  await campo.press("Enter");
  await page.keyboard.type(" na frase.");

  const formula = page.locator(".doc-formula-inline .katex");
  await expect(formula).toBeVisible();
  await expect(page.locator(".doc-formula-inline mfrac")).toHaveCount(1);
  // Na mesma linha do texto: dentro do parágrafo.
  await expect(page.locator(".ProseMirror p .doc-formula-inline")).toHaveCount(1);

  await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });
  const salvo = await documentoSalvo(page, documento.id);
  expect(salvo.sections[0].content).toEqual([
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Expressa por " },
        { type: "formula_inline", texto: "PDR = \\frac{a}{b}" },
        { type: "text", text: " na frase." },
      ],
    },
  ]);
});

test("fórmula deixada vazia some quando o cursor sai dela", async ({ page }) => {
  const documento = novoDocumento();
  documento.sections = [
    {
      id: "s1",
      ordem: 0,
      nivel: 1,
      titulo: "Métricas",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Texto." }] }],
    },
  ];
  await abrirDocumento(page, documento);

  await page.locator(".ProseMirror p", { hasText: "Texto." }).click();
  await page.getByRole("button", { name: BOTAO }).click();
  await expect(page.getByLabel(CAMPO)).toBeFocused();
  await page.getByLabel(CAMPO).press("Escape");

  await expect(page.locator(".doc-formula-inline")).toHaveCount(0);
});
