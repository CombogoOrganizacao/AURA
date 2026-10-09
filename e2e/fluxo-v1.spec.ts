import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import JSZip from "jszip";

import { clicarExportar } from "./apoio";

// Passo 6.6.1 — o fluxo inteiro da v1, numa sessão só, pela interface:
// criar o TCC, preencher os dados do trabalho, escrever três seções, citar,
// importar um .bib, conferir, salvar uma versão e exportar o .docx.
//
// Cada etapa já tem spec próprio; este prova que elas funcionam EM SEQUÊNCIA,
// sobre o mesmo documento, e que o .docx final leva o que cada uma
// produziu. As etapas se amarram de propósito: a conferência aponta a
// referência importada que ninguém citou, e a lista de referências do .docx
// tem as duas, em ordem alfabética.
//
// A conferência no Word (margens, paginação, sumário) continua sendo humana,
// como diz CLAUDE.md. Aqui o .docx é lido pelo XML.

const DADOS = {
  titulo: "Educação e globalização no ensino médio",
  autor: "Maria Souza",
  instituicao: "Universidade Católica de Pernambuco",
  curso: "Licenciatura em Pedagogia",
  orientador: "Prof. Dr. João Lima",
  cidade: "Recife",
  ano: "2026",
  natureza: "Trabalho de Conclusão de Curso apresentado ao curso de Licenciatura em Pedagogia.",
};

const SECOES = [
  { titulo: "Introdução", texto: "Este trabalho discute a escola diante da globalização." },
  { titulo: "Desenvolvimento", texto: "A globalização divide tanto quanto une" },
  { titulo: "Conclusão", texto: "A escola precisa tratar a globalização como tema." },
];

const BIB = `
@book{silva2019,
  author = {Silva, Ana},
  title = {Educação popular},
  publisher = {Atlas}, address = {São Paulo}, year = {2019}
}`;

// Seleciona o parágrafo inteiro por clique triplo, como em citacoes.spec.ts:
// as teclas de navegação às vezes não chegam ao editor com a suíte em
// paralelo (pendência do 6.4.2). A seleção é conferida antes de seguir.
async function selecionarParagrafo(page: Page, texto: string) {
  const paragrafo = page.locator(".ProseMirror p", { hasText: texto });
  await paragrafo.click({ clickCount: 3 });
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(texto);
}

// O texto corrido do document.xml, sem as tags: um trecho pode estar partido
// em vários `<w:r>` (o título da referência em negrito, a chamada à parte).
function textoDoXml(xml: string): string {
  return xml.replace(/<w:tab\/>/g, " ").replace(/<[^>]+>/g, "");
}

test("fluxo completo da v1: criar, preencher, escrever, citar, importar, conferir, versionar, exportar", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // --- Criar o TCC ----------------------------------------------------------
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);

  // Controle: no documento novo, a conferência (aba aberta por padrão) aponta
  // a falta do autor. É o que dá sentido a conferir, mais adiante, que o
  // achado sumiu.
  const faltaAutor = page.getByRole("button", { name: /Falta o nome do autor/ });
  await expect(faltaAutor).toBeVisible();

  // --- Dados do trabalho (metadados, não nós do editor) ----------------------
  await page.getByText("Dados do trabalho").click();
  const dados = page.getByRole("form", { name: "Metadados do trabalho" });
  await dados.getByLabel("Título", { exact: true }).fill(DADOS.titulo);
  await dados.getByLabel("Autor", { exact: true }).fill(DADOS.autor);
  await dados.getByLabel("Instituição", { exact: true }).fill(DADOS.instituicao);
  await dados.getByLabel("Curso", { exact: true }).fill(DADOS.curso);
  await dados.getByLabel("Orientador", { exact: true }).fill(DADOS.orientador);
  await dados.getByLabel("Cidade", { exact: true }).fill(DADOS.cidade);
  await dados.getByLabel("Ano", { exact: true }).fill(DADOS.ano);
  await dados.getByLabel("Natureza do trabalho", { exact: true }).fill(DADOS.natureza);

  // --- Três seções -------------------------------------------------------------
  await page.getByLabel("1 Título da seção").fill(SECOES[0].titulo);
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type(SECOES[0].texto);

  for (const [indice, secao] of SECOES.slice(1).entries()) {
    const numero = indice + 2;
    await page.getByRole("button", { name: "Nova seção", exact: true }).click();
    await expect(page.getByLabel(`${numero} Título da seção`)).toBeFocused();
    await page.keyboard.type(secao.titulo);
    await page.keyboard.press("Enter");
    await page.keyboard.type(secao.texto);
  }

  const painelSecoes = page.getByRole("navigation", { name: "Seções do documento" });
  for (const secao of SECOES) await expect(painelSecoes).toContainText(secao.titulo);

  // --- Citação -----------------------------------------------------------------
  // A referência citada é cadastrada à mão; a do .bib, importada depois,
  // fica sem citação de propósito (a conferência tem de apontá-la).
  await page.getByText("Referências", { exact: true }).click();
  await page.getByRole("button", { name: "Nova referência" }).click();
  const formulario = page.getByLabel("Dados da referência");
  await formulario.getByLabel("Título", { exact: true }).fill("Globalização");
  await page.getByRole("button", { name: "+ Adicionar autoria" }).click();
  await formulario.getByLabel("Autoria 1 — sobrenome").fill("Bauman");
  await formulario.getByLabel("Autoria 1 — prenome").fill("Zygmunt");
  await formulario.getByLabel("Local", { exact: true }).fill("Rio de Janeiro");
  await formulario.getByLabel("Editora", { exact: true }).fill("Zahar");
  await formulario.getByLabel("Ano de publicação — ano").fill("1999");
  await page.getByRole("button", { name: "Fechar Globalização" }).click();

  // Controle: cadastrada e ainda não citada, ela é apontada.
  const naoCitadaBauman = page.getByRole("button", { name: /"Globalização" está na lista/ });
  await expect(naoCitadaBauman).toBeVisible();

  await selecionarParagrafo(page, SECOES[1].texto);
  await page.getByRole("button", { name: /^Citar/ }).click();
  const citar = page.getByRole("dialog", { name: /Citar/ });
  await citar.getByText("Indireta", { exact: true }).click();
  await expect(citar.getByLabel("Prévia da chamada")).toHaveText("(Bauman, 1999)");
  await citar.getByRole("button", { name: "Inserir citação" }).click();
  await expect(page.locator(".ProseMirror .doc-chamada")).toHaveText([" (Bauman, 1999)"]);

  // --- Importar .bib -----------------------------------------------------------
  await page
    .getByLabel("Arquivo .bib")
    .setInputFiles({ name: "tcc.bib", mimeType: "text/plain", buffer: Buffer.from(BIB, "utf-8") });
  await page.getByRole("button", { name: "Importar 1 referência" }).click();
  const painelReferencias = page.locator('details[data-painel="referencias"]');
  await expect(painelReferencias.getByText("Educação popular")).toBeVisible();

  // --- Conferir ----------------------------------------------------------------
  await page.getByRole("tab", { name: /Conformidade/ }).click();
  // A importada, nunca citada, é apontada (NBR 6023 não proíbe; é aviso).
  await expect(
    page.getByRole("button", {
      name: /"Educação popular" está na lista de referências mas não é citada no texto/,
    }),
  ).toBeVisible();
  // A citada deixou de ser.
  await expect(naoCitadaBauman).toHaveCount(0);
  // Os dados da capa preenchidos acima não faltam mais.
  await expect(faltaAutor).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Falta o título/ })).toHaveCount(0);

  // --- Salvar versão -----------------------------------------------------------
  await page.getByRole("tab", { name: /Histórico/ }).click();
  await page.getByRole("textbox", { name: "Nome da versão" }).fill("Enviada ao orientador");
  await page.getByRole("button", { name: "Salvar versão" }).click();
  await expect(page.getByRole("list", { name: "Versões" })).toContainText("Enviada ao orientador");

  // --- Exportar .docx ------------------------------------------------------------
  const download = page.waitForEvent("download");
  await clicarExportar(page);
  const zip = await JSZip.loadAsync(readFileSync((await (await download).path())!));
  const texto = textoDoXml(await zip.file("word/document.xml")!.async("string"));

  // Dados do trabalho na capa e na folha de rosto.
  for (const valor of [DADOS.titulo, DADOS.autor, DADOS.instituicao, DADOS.cidade, DADOS.ano]) {
    expect(texto.toLocaleLowerCase("pt-BR")).toContain(valor.toLocaleLowerCase("pt-BR"));
  }

  // As três seções, com título e texto, na ordem. A ordem é conferida pelo
  // texto de cada seção, que é único: o título "Conclusão" também aparece na
  // natureza do trabalho, na folha de rosto ("Trabalho de Conclusão de
  // Curso"), antes de qualquer seção.
  const minusculo = texto.toLocaleLowerCase("pt-BR");
  for (const secao of SECOES) expect(minusculo).toContain(secao.titulo.toLocaleLowerCase("pt-BR"));
  const posicoes = SECOES.map((secao) => texto.indexOf(secao.texto));
  for (const posicao of posicoes) expect(posicao).toBeGreaterThan(-1);
  expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));

  // A chamada sintetizada da citação, logo depois do trecho citado.
  expect(texto).toContain(`${SECOES[1].texto} (Bauman, 1999)`);

  // As duas referências, citada e importada, em ordem alfabética.
  const bauman = texto.indexOf("BAUMAN, Zygmunt. Globalização. Rio de Janeiro: Zahar, 1999.");
  const silva = texto.indexOf("SILVA, Ana. Educação popular. São Paulo: Atlas, 2019.");
  expect(bauman).toBeGreaterThan(-1);
  expect(silva).toBeGreaterThan(bauman);
});
