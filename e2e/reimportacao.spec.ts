import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import JSZip from "jszip";

import { gerarTex } from "../src/core/export/latex/document";
import { PNG_1X1 } from "../src/core/export/latex/__fixtures__/documento";
import { gerarZipTex } from "../src/core/export/latex/zip";

import { abrirDocumento, documentoSalvo, tresSecoes } from "./apoio";

// Passo 6.2.4 — reimportar o `.tex` e o `.zip`. O Vitest prova a leitura e o relatório
// (`core/import/latex/`); aqui, o caminho do aluno: exportar, editar por
// fora, reimportar, ver o relatório, confirmar e achar a edição no lugar
// certo, com o texto de antes guardado no histórico.
//
// A tela ainda não tem o botão de exportar `.tex` (passo 6.3.2): o arquivo
// sai do mesmo `gerarTex()` que o botão vai usar, a partir do documento
// gravado no IndexedDB, como em `busca.spec.ts`.

async function reimportar(page: Page, conteudo: string, nome = "trabalho.tex") {
  await page.getByLabel("Arquivo .tex ou .zip").setInputFiles({
    name: nome,
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

test("capítulo solto, sem \\begin{document}, é recusado com mensagem clara", async ({ page }) => {
  const documento = tresSecoes();
  await abrirDocumento(page, documento);

  await reimportar(page, "\\chapter{Introdução}\nTexto de um capítulo solto.\n");

  await expect(page.getByRole("status").filter({ hasText: "Importação recusada" })).toContainText(
    "parece um capítulo solto",
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

test("nome de arquivo comprido não alarga a janela: rola para o lado, a partir da esquerda", async ({
  page,
}) => {
  const documento = tresSecoes();
  await abrirDocumento(page, documento);
  const nome =
    "Construção_e_Avaliação_de_uma_Rede_Veicular_Definida_por_Software_com_Priorização_de_Pacotes_de_Segurança_em_Ambiente_Emulado.tex";

  await reimportar(page, gerarTex(documento), nome);

  const dialogo = page.getByRole("dialog", { name: "Reimportar do LaTeX" });
  await expect(dialogo).toContainText("Nada mudou");
  // Nada passa da largura da janela, e o título continua à vista.
  expect(await dialogo.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(dialogo.getByRole("heading", { name: "Reimportar do LaTeX" })).toBeInViewport({
    ratio: 1,
  });
  // O nome inteiro, numa linha que rola, começando do início.
  const linha = dialogo.getByTitle(nome);
  await expect(linha).toHaveText(nome);
  const rolagem = await linha.evaluate((el) => ({
    rola: el.scrollWidth > el.clientWidth,
    inicio: el.scrollLeft,
    cabe:
      el.getBoundingClientRect().right <=
      el.closest("[role=dialog]")!.getBoundingClientRect().right,
  }));
  expect(rolagem).toEqual({ rola: true, inicio: 0, cabe: true });
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
  await page.getByLabel("Arquivo .tex ou .zip").setInputFiles({
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

// Passo 6.2.5 — o TCC que o aluno começou em LaTeX, sem nada do AURA.
const TCC_DE_FORA = readFileSync(
  join(__dirname, "../src/core/import/latex/__fixtures__/tcc-abntex2.tex"),
  "utf8",
);

test("TCC de fora: o destino é perguntado, e criar um trabalho novo o abre", async ({ page }) => {
  const aberto = tresSecoes();
  await abrirDocumento(page, aberto);
  await reimportar(page, TCC_DE_FORA);

  const dialogo = page.getByRole("dialog", { name: "Importar do LaTeX" });
  await expect(dialogo).toContainText("Este arquivo não foi exportado pelo AURA");
  // Nada vem marcado: sem escolha, não há o que confirmar.
  await expect(dialogo.getByRole("button", { name: "Importar" })).toBeDisabled();

  await dialogo.getByRole("radio", { name: /Criar um trabalho novo/ }).check({ force: true });
  await expect(dialogo.getByRole("region", { name: "Seções" })).toContainText("Introdução");
  await dialogo.getByRole("button", { name: "Criar trabalho" }).click();

  await page.waitForURL((url) => !url.pathname.endsWith(aberto.id));
  await expect(page.getByRole("banner")).toContainText("Educação e diálogo na escola pública");
  await expect(page.locator(".ProseMirror p").first()).toContainText(
    "A escola é espaço de diálogo",
  );
});

test("TCC de fora: substituir o aberto troca o conteúdo e guarda o de antes", async ({ page }) => {
  const aberto = tresSecoes();
  await abrirDocumento(page, aberto);
  await reimportar(page, TCC_DE_FORA);

  const dialogo = page.getByRole("dialog", { name: "Importar do LaTeX" });
  await dialogo.getByRole("radio", { name: /Substituir o conteúdo de/ }).check({ force: true });
  await expect(dialogo.getByRole("region", { name: "Seções" })).toContainText(
    "Removidos no arquivo (3)",
  );
  await dialogo.getByRole("button", { name: "Substituir" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.locator(".ProseMirror p").first()).toContainText(
    "A escola é espaço de diálogo",
  );
  await page.getByRole("tab", { name: /Histórico/ }).click();
  await expect(page.getByRole("list", { name: "Versões" })).toContainText("Antes da reimportação");
});

test("projeto de fora em .zip, com quaisquer nomes, vira trabalho novo com a figura", async ({
  page,
}) => {
  const aberto = tresSecoes();
  await abrirDocumento(page, aberto);

  const zip = new JSZip();
  zip.file(
    "tcc.tex",
    [
      "\\documentclass{abntex2}",
      "\\graphicspath{{imagens/}}",
      "\\titulo{Projeto do Overleaf}",
      "\\begin{document}",
      "\\textual",
      "\\include{capitulos/introducao}",
      "\\end{document}",
    ].join("\n"),
  );
  zip.file(
    "capitulos/introducao.tex",
    "\\chapter{Introdução}\nTexto do capítulo.\n\n\\begin{figure}\\caption{Fluxo}\\includegraphics{fluxo}\\end{figure}",
  );
  zip.file("imagens/fluxo.png", PNG_1X1);
  await page.getByLabel("Arquivo .tex ou .zip").setInputFiles({
    name: "Projeto.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(await zip.generateAsync({ type: "uint8array" })),
  });

  const dialogo = page.getByRole("dialog", { name: "Importar do LaTeX" });
  await dialogo.getByRole("radio", { name: /Criar um trabalho novo/ }).check({ force: true });
  await expect(dialogo.getByRole("region", { name: "Imagens" })).toContainText(
    "1 imagem vem do pacote.",
  );
  await dialogo.getByRole("button", { name: "Criar trabalho" }).click();

  await page.waitForURL((url) => !url.pathname.endsWith(aberto.id));
  await expect(page.getByRole("banner")).toContainText("Projeto do Overleaf");
  await expect(page.locator(".ProseMirror p").first()).toHaveText("Texto do capítulo.");
  await expect(page.locator(".ProseMirror img")).toHaveCount(1);
});
