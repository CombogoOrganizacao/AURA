import { expect, test } from "@playwright/test";

import { novoDocumento } from "../src/core/document/factory";
import type { Secao } from "../src/core/document/types";
import { abrirDocumento } from "./apoio";

// A folha do editor cresce com o texto (passo 6.2.6). Antes ela tinha a
// altura de uma A4 e recortava o resto: o texto além da primeira página
// sumia da tela, e só reaparecia trocando de seção.

function secaoLonga(): Secao {
  return {
    id: "longa",
    ordem: 0,
    nivel: 1,
    titulo: "Introdução",
    content: Array.from({ length: 60 }, (_, i) => ({
      type: "paragraph" as const,
      content: [
        {
          type: "text" as const,
          text: `Parágrafo ${i + 1}. Texto longo o bastante para ocupar mais de uma página da folha A4 do editor.`,
        },
      ],
    })),
  };
}

test("texto além de uma página continua visível rolando a folha", async ({ page }) => {
  const documento = novoDocumento();
  documento.sections = [secaoLonga()];
  await abrirDocumento(page, documento);

  const ultimo = page.locator(".ProseMirror p", { hasText: "Parágrafo 60." });
  await ultimo.scrollIntoViewIfNeeded();
  await expect(ultimo).toBeInViewport();

  // A folha ficou mais alta que uma A4 (297mm ≈ 1123px a 96dpi).
  const folha = page
    .locator(".ProseMirror")
    .locator("xpath=ancestor::div[contains(@class,'shadow-sheet')][1]");
  const caixa = await folha.boundingBox();
  expect(caixa!.height).toBeGreaterThan(1200);
});
