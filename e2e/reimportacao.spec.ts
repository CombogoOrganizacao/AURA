import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import JSZip from "jszip";

import { novoDocumento } from "../src/core/document/factory";
import type { Documento, Secao } from "../src/core/document/types";
import { gerarTex } from "../src/core/export/latex/document";
import { gerarZipTex } from "../src/core/export/latex/zip";

// Passo 6.2.4 — reimportar o `.tex` e o `.zip`. O Vitest prova a leitura e o relatório
// (`core/import/latex/`); aqui, o caminho do aluno: exportar, editar por
// fora, reimportar, ver o relatório, confirmar e achar a edição no lugar
// certo, com o texto de antes guardado no histórico.
//
// A tela ainda não tem o botão de exportar `.tex` (passo 6.3.2): o arquivo
// sai do mesmo `gerarTex()` que o botão vai usar, a partir do documento
// gravado no IndexedDB, como em `busca.spec.ts`.

function secao(id: string, ordem: number, titulo: string, texto: string): Secao {
  return {
    id,
    ordem,
    nivel: 1,
    titulo,
    content: [{ type: "paragraph", content: [{ type: "text", text: texto }] }],
  };
}

function tresSecoes(): Documento {
  const documento = novoDocumento();
  documento.metadados.titulo = "Trabalho de teste";
  documento.sections = [
    secao("s1", 0, "Introdução", "Texto da introdução."),
    secao("s2", 1, "Método", "Aplicamos o questionário em campo."),
    secao("s3", 2, "Resultados", "As respostas do questionário."),
  ];
  return documento;
}

async function abrirDocumento(page: Page, documento: Documento) {
  // Abre o app primeiro: é ele que cria o banco na versão certa.
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
  await expect(page.locator(".ProseMirror p").first()).toBeVisible();
}

async function reimportar(page: Page, conteudo: string) {
  await page.getByLabel("Arquivo .tex ou .zip exportado pelo AURA").setInputFiles({
    name: "trabalho.tex",
    mimeType: "application/x-tex",
    buffer: Buffer.from(conteudo),
  });
}

test("a edição feita fora volta na seção certa, e o texto de antes fica no histórico", async ({
  page,
}) => {
  const documento = tresSecoes();
  await abrirDocumento(page, documento);

  const editado = gerarTex(documento).replace(
    "Aplicamos o questionário em campo.",
    "Aplicamos o questionário em campo, com \\textit{duas} rodadas.",
  );
  await reimportar(page, editado);

  const dialogo = page.getByRole("dialog", { name: "Reimportar do LaTeX" });
  await expect(dialogo).toBeVisible();
  const secoes = dialogo.getByRole("region", { name: "Seções" });
  await expect(secoes).toContainText("Alterados (1)");
  await expect(secoes).toContainText("Método — texto");
  await expect(dialogo).toContainText("“Antes da reimportação”");

  await dialogo.getByRole("button", { name: "Reimportar" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.locator(".ProseMirror p")).toHaveText([
    "Texto da introdução.",
    "Aplicamos o questionário em campo, com duas rodadas.",
    "As respostas do questionário.",
  ]);
  await expect(page.locator(".ProseMirror p").nth(1).locator("em")).toHaveText("duas");

  await page.getByRole("tab", { name: /Histórico/ }).click();
  await expect(page.getByRole("list", { name: "Versões" })).toContainText("Antes da reimportação");
});

test("arquivo sem os marcadores do AURA é recusado com mensagem clara", async ({ page }) => {
  const documento = tresSecoes();
  await abrirDocumento(page, documento);

  await reimportar(page, "\\documentclass{article}\n\\begin{document}\nOi.\n\\end{document}\n");

  await expect(page.getByRole("status").filter({ hasText: "Reimportação recusada" })).toContainText(
    "não foi gerado pelo AURA",
  );
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".ProseMirror p").first()).toHaveText("Texto da introdução.");
});

test("arquivo igual ao trabalho: o relatório diz que nada mudou, e não há o que gravar", async ({
  page,
}) => {
  const documento = tresSecoes();
  await abrirDocumento(page, documento);

  await reimportar(page, gerarTex(documento));

  const dialogo = page.getByRole("dialog", { name: "Reimportar do LaTeX" });
  await expect(dialogo).toContainText("Nada mudou");
  await expect(dialogo.getByRole("button", { name: "Reimportar" })).toHaveCount(0);
  await dialogo.getByText("Fechar", { exact: true }).click();
  await expect(dialogo).toBeHidden();
});

test("arquivo de um trabalho que não está no navegador cria um trabalho novo e o abre", async ({
  page,
}) => {
  const aberto = tresSecoes();
  await abrirDocumento(page, aberto);

  const deOutraMaquina = tresSecoes();
  deOutraMaquina.metadados.titulo = "Trabalho de outro computador";
  await reimportar(page, gerarTex(deOutraMaquina));

  const dialogo = page.getByRole("dialog", { name: "Reimportar do LaTeX" });
  await expect(dialogo).toContainText("Trabalho novo");
  await dialogo.getByRole("button", { name: "Criar trabalho" }).click();

  await page.waitForURL(`**/documento/${deOutraMaquina.id}`);
  await expect(page.getByRole("banner")).toContainText("Trabalho de outro computador");
  await expect(page.locator(".ProseMirror p").first()).toHaveText("Texto da introdução.");
});

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

test("o .zip traz a edição do capítulo e a referência escolhida do .bib", async ({ page }) => {
  const documento = tresSecoes();
  documento.references = [
    {
      id: "freire",
      type: "book",
      author: [{ family: "Freire", given: "Paulo" }],
      title: "Pedagogia do oprimido",
      publisher: "Paz e Terra",
      "publisher-place": "Rio de Janeiro",
      issued: { "date-parts": [[1987]] },
    },
  ];
  await abrirDocumento(page, documento);

  const zip = await JSZip.loadAsync(await gerarZipTex(documento));
  const capitulo = Object.keys(zip.files).find((nome) => nome.startsWith("sections/02-"))!;
  const texto = await zip.file(capitulo)!.async("string");
  zip.file(capitulo, texto.replace("Aplicamos o questionário em campo.", "Aplicamos duas vezes."));
  const bib = await zip.file("referencias.bib")!.async("string");
  zip.file("referencias.bib", bib.replace("Pedagogia do oprimido", "Pedagogia da autonomia"));
  await page.getByLabel("Arquivo .tex ou .zip exportado pelo AURA").setInputFiles({
    name: "projeto.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(await zip.generateAsync({ type: "uint8array" })),
  });

  const dialogo = page.getByRole("dialog", { name: "Reimportar do LaTeX" });
  await expect(dialogo.getByRole("region", { name: "Seções" })).toContainText("Método — texto");
  const referencias = dialogo.getByRole("region", { name: "Referências" });
  await expect(referencias).toContainText("Diferentes no arquivo (1)");
  await expect(referencias).toContainText("Pedagogia da autonomia");
  const caixa = referencias.getByRole("checkbox", {
    name: "Usar a versão do arquivo de Pedagogia do oprimido",
  });
  await caixa.press("Space");
  await expect(caixa).toBeChecked();
  await dialogo.getByRole("button", { name: "Reimportar" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.locator(".ProseMirror p").nth(1)).toHaveText("Aplicamos duas vezes.");
  await expect
    .poll(async () => (await documentoSalvo(page, documento.id)).references[0].title)
    .toBe("Pedagogia da autonomia");
});
