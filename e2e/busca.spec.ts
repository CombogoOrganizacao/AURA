import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { novoDocumento } from "../src/core/document/factory";
import type { Documento, Secao } from "../src/core/document/types";

// Passo 5.4.3 — localizar e substituir, e a barra de estatísticas. O Vitest
// prova a busca e a troca (5.4.2) e a ponte com o editor
// (`core/editor/busca.ts`); aqui, o caminho do aluno.
//
// A interface ainda não cria seções (só a seção-semente existe), então o
// documento de três seções é gravado direto no IndexedDB do app, no formato
// do adaptador (`core/persistence/indexeddb.ts`), e o editor o abre como
// abriria qualquer documento salvo.

function secao(id: string, ordem: number, titulo: string, texto: string): Secao {
  return {
    id,
    ordem,
    nivel: 1,
    titulo,
    content: [{ type: "paragraph", content: [{ type: "text", text: texto }] }],
  };
}

async function abrirDocumento(page: Page, documento: Documento) {
  // Abre o app primeiro: é ele que cria o banco na versão certa. Até lá, o
  // banco pode não ter a loja ainda, e a gravação espera, sempre fechando a
  // conexão (uma conexão aberta travaria a atualização de versão do app).
  await page.goto("/documentos");
  await page.evaluate(
    (doc) =>
      new Promise<void>((resolve, reject) => {
        const tentar = () => {
          const pedido = indexedDB.open("aura");
          pedido.onerror = () => reject(pedido.error);
          pedido.onsuccess = () => {
            const banco = pedido.result;
            if (!banco.objectStoreNames.contains("documentos")) {
              banco.close();
              setTimeout(tentar, 100);
              return;
            }
            const tr = banco.transaction("documentos", "readwrite");
            tr.objectStore("documentos").put({
              id: doc.id,
              documento: doc,
              atualizadoEm: new Date(),
            });
            tr.oncomplete = () => {
              banco.close();
              resolve();
            };
            tr.onerror = () => reject(tr.error);
          };
        };
        tentar();
      }),
    documento,
  );
  await page.goto(`/documento/${documento.id}`);
  await expect(page.locator(".ProseMirror")).toBeVisible();
}

// O documento como o adaptador o guardou, para conferir o que foi salvo.
async function documentoSalvo(page: Page, id: string): Promise<Documento> {
  return page.evaluate(
    (idDoc) =>
      new Promise<Documento>((resolve, reject) => {
        const pedido = indexedDB.open("aura");
        pedido.onerror = () => reject(pedido.error);
        pedido.onsuccess = () => {
          const banco = pedido.result;
          const leitura = banco.transaction("documentos").objectStore("documentos").get(idDoc);
          leitura.onsuccess = () => {
            banco.close();
            resolve(leitura.result.documento);
          };
          leitura.onerror = () => reject(leitura.error);
        };
      }),
    id,
  );
}

function tresSecoes(): Documento {
  const documento = novoDocumento();
  documento.sections = [
    secao("s1", 0, "Introdução", "O questionario inicial."),
    secao("s2", 1, "Método", "Aplicamos o questionario em campo."),
    secao("s3", 2, "Resultados", "As respostas do questionario final."),
  ];
  return documento;
}

test("substitui em três seções de uma vez, e o Ctrl+Z desfaz tudo", async ({ page }) => {
  const documento = tresSecoes();
  await abrirDocumento(page, documento);
  const paragrafos = page.locator(".ProseMirror p");

  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.press("ControlOrMeta+h");
  const busca = page.getByRole("search", { name: "Localizar e substituir" });
  await expect(busca.getByRole("textbox", { name: "Substituir por" })).toBeFocused();

  await busca.getByRole("textbox", { name: "Localizar" }).fill("questionario");
  await expect(busca).toContainText("3 resultados");
  await busca.getByRole("textbox", { name: "Substituir por" }).fill("questionário");
  await busca.getByRole("button", { name: "Substituir todas" }).click();

  await expect(busca).toContainText("3 ocorrências substituídas.");
  await expect(busca).toContainText("Nenhum resultado");
  await expect(paragrafos).toHaveText([
    "O questionário inicial.",
    "Aplicamos o questionário em campo.",
    "As respostas do questionário final.",
  ]);

  // E chega ao documento salvo, nas três seções.
  await expect
    .poll(async () =>
      (await documentoSalvo(page, documento.id)).sections.map(
        (s) => (s.content[0] as { content: { text: string }[] }).content[0].text,
      ),
    )
    .toEqual([
      "O questionário inicial.",
      "Aplicamos o questionário em campo.",
      "As respostas do questionário final.",
    ]);

  // Uma transação só: um Ctrl+Z desfaz as três trocas.
  await page.keyboard.press("Escape");
  await expect(busca).toBeHidden();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(paragrafos).toHaveText([
    "O questionario inicial.",
    "Aplicamos o questionario em campo.",
    "As respostas do questionario final.",
  ]);
});

test("substituir uma a uma: mostra a ocorrência, troca, e segue para a próxima", async ({
  page,
}) => {
  await abrirDocumento(page, tresSecoes());
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.press("ControlOrMeta+f");
  const busca = page.getByRole("search", { name: "Localizar e substituir" });

  await busca.getByRole("textbox", { name: "Localizar" }).fill("questionario");
  await busca.getByRole("textbox", { name: "Substituir por" }).fill("formulário");

  // O foco fica na barra, então o que mostra a ocorrência atual é o realce
  // em destaque (a seleção do editor só aparece no DOM com o foco nele).
  const atual = page.locator(".ProseMirror .realce-busca-atual");
  const paragrafos = page.locator(".ProseMirror p");

  // O primeiro clique mostra; o segundo troca a mostrada.
  await busca.getByRole("button", { name: "Substituir", exact: true }).click();
  await expect(busca).toContainText("1 de 3");
  await expect(paragrafos.first().locator(".realce-busca-atual")).toHaveText("questionario");

  await busca.getByRole("button", { name: "Substituir", exact: true }).click();
  await expect(paragrafos.first()).toHaveText("O formulário inicial.");
  await expect(busca).toContainText("1 de 2");
  // A atual já é a próxima, na segunda seção.
  await expect(atual).toHaveCount(1);
  await expect(paragrafos.nth(1).locator(".realce-busca-atual")).toHaveText("questionario");

  // Enter no campo de busca avança; Shift+Enter volta.
  await busca.getByRole("textbox", { name: "Localizar" }).press("Enter");
  await expect(busca).toContainText("2 de 2");
  await expect(paragrafos.nth(2).locator(".realce-busca-atual")).toHaveText("questionario");
  await busca.getByRole("textbox", { name: "Localizar" }).press("Shift+Enter");
  await expect(busca).toContainText("1 de 2");
});

test("o realce não é persistido no documento", async ({ page }) => {
  const documento = tresSecoes();
  await abrirDocumento(page, documento);
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.press("ControlOrMeta+f");
  const busca = page.getByRole("search", { name: "Localizar e substituir" });
  await busca.getByRole("textbox", { name: "Localizar" }).fill("questionario");

  const realces = page.locator(".ProseMirror .realce-busca");
  await expect(realces).toHaveCount(3);

  // Uma edição com o realce na tela, para o autosave gravar esse estado.
  await page.locator(".ProseMirror p").nth(2).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Fim.");
  await expect(realces).toHaveCount(3);
  await expect
    .poll(async () => JSON.stringify(await documentoSalvo(page, documento.id)))
    .toContain("Fim.");

  const salvo = JSON.stringify(await documentoSalvo(page, documento.id));
  expect(salvo).not.toContain("realce");
  expect(salvo).not.toContain("marks");

  // Fechar tira o realce; recarregar não traz nada de volta.
  await page.keyboard.press("ControlOrMeta+f");
  await page.keyboard.press("Escape");
  await expect(realces).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".ProseMirror p").nth(2)).toHaveText(
    "As respostas do questionario final. Fim.",
  );
  await expect(realces).toHaveCount(0);
});

test("a barra de estatísticas conta o documento, e só a seleção quando há uma", async ({
  page,
}) => {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  const barra = page.getByRole("region", { name: "Estatísticas do texto" });
  await expect(barra).toContainText("Documento");
  await expect(barra).toContainText("0 palavras");

  const paragrafo = page.locator(".ProseMirror p").first();
  await paragrafo.click();
  await page.keyboard.type("Um dois três quatro.");
  await expect(barra).toContainText("Documento");
  await expect(barra).toContainText("4 palavras");
  await expect(barra).toContainText("20 caracteres (17 sem espaços)");
  await expect(barra).toContainText("1 parágrafo");

  // Seleciona "dois três".
  await paragrafo.evaluate((elemento) => {
    const texto = elemento.firstChild!;
    const faixa = document.createRange();
    faixa.setStart(texto, 3);
    faixa.setEnd(texto, 12);
    const selecao = window.getSelection()!;
    selecao.removeAllRanges();
    selecao.addRange(faixa);
  });
  await expect(barra).toContainText("Seleção");
  await expect(barra).toContainText("2 palavras");
  await expect(barra).toContainText("9 caracteres (8 sem espaços)");

  // Sem seleção, volta ao documento.
  await page.keyboard.press("End");
  await expect(barra).toContainText("Documento");
  await expect(barra).toContainText("4 palavras");
});
