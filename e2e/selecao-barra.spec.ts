import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { novoDocumento } from "../src/core/document/factory";
import type { Documento } from "../src/core/document/types";

import { abrirDocumento, secao } from "./apoio";

// O ProseMirror só lê a seleção do navegador no `selectionchange`, uma
// tarefa comum. Numa máquina ocupada, o Chrome processa antes o clique num
// botão da barra (evento de entrada tem prioridade): o botão agia sobre a
// seleção antiga do editor, e o "Citar" pedia para selecionar um trecho que
// estava selecionado na tela. Era o que deixava `citacoes.spec.ts` instável.
//
// Aqui o atraso é forçado, não sorteado: o `selectionchange` é barrado antes
// de chegar ao ProseMirror, e o trecho é selecionado pelo próprio navegador.
// A seleção existe no navegador e não no editor, que é o momento exato do
// defeito. O texto já vem no trabalho, sem digitar: com o evento barrado, o
// editor nunca aprende a seleção, e uma atualização pendente da digitação
// regravaria o cursor dele por cima.

function trabalho(texto: string): Documento {
  const documento = novoDocumento();
  documento.sections = [secao("s1", 0, "Introdução", texto)];
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

async function selecionarSemAvisarOEditor(page: Page, texto: string) {
  // O editor recebe o foco antes, com o cursor que ele conhece: ao ganhar
  // foco, o ProseMirror regrava a própria seleção no navegador (20 ms
  // depois), o que apagaria o trecho selecionado com o evento barrado.
  await page.locator(".ProseMirror p").first().click();
  await expect(page.locator(".ProseMirror")).toBeFocused();
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.addEventListener("selectionchange", (e) => e.stopImmediatePropagation(), true);
    const paragrafo = document.querySelector(".ProseMirror p")!.firstChild!;
    window.getSelection()!.setBaseAndExtent(paragrafo, 0, paragrafo, paragrafo.textContent!.length);
  });

  // O navegador tem o trecho; o editor ainda acha que há só um cursor.
  expect(await page.evaluate(() => window.getSelection()!.toString())).toBe(texto);
  const editorVazio = await page.evaluate(
    () =>
      (
        document.querySelector(".ProseMirror") as unknown as {
          editor: { state: { selection: { empty: boolean } } };
        }
      ).editor.state.selection.empty,
  );
  expect(editorVazio).toBe(true);
}

test("negrito logo depois de selecionar vale para o trecho selecionado", async ({ page }) => {
  await abrirDocumento(page, trabalho("Trecho em negrito"));
  await selecionarSemAvisarOEditor(page, "Trecho em negrito");

  await page.getByRole("button", { name: "Negrito (Ctrl+B)" }).click();
  await expect(page.locator(".ProseMirror strong").first()).toHaveText("Trecho em negrito");
});

test("citar logo depois de selecionar liga o trecho selecionado", async ({ page }) => {
  await abrirDocumento(page, trabalho("O mundo se globaliza"));
  await selecionarSemAvisarOEditor(page, "O mundo se globaliza");

  await page.getByRole("button", { name: /^Citar/ }).click();
  const dialogo = page.getByRole("dialog", { name: /Citar/ });
  await expect(dialogo).not.toContainText("Selecione no texto o trecho citado");
  await dialogo.getByText("Indireta", { exact: true }).click();
  await dialogo.getByRole("button", { name: "Inserir citação" }).click();

  await expect(page.locator(".ProseMirror .doc-citado")).toHaveText("O mundo se globaliza");
});
