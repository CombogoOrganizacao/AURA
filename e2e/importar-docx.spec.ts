import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

import { fromDocumento } from "../src/core/export/docx/fromDocumento";
import type { Documento } from "../src/core/document/types";

import { abrirDocumento, documentoSalvo, secao, tresSecoes } from "./apoio";

// Passo 8.7.1 — importar um `.docx`. O Vitest prova a leitura da árvore
// (`core/import/docx/`); aqui, o caminho inteiro no navegador: o mammoth, o
// `DOMParser`, o relatório e a gravação.

async function importar(page: Page, bytes: Uint8Array, nome = "trabalho.docx") {
  await page.getByLabel("Arquivo .docx, .tex ou .zip").setInputFiles({
    name: nome,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(bytes),
  });
}

function trabalhoExportado(): Documento {
  const documento = tresSecoes();
  documento.metadados.resumo = "Resumo do trabalho em um parágrafo.";
  documento.metadados.palavrasChave = ["educação", "escola"];
  documento.sections = [
    secao("s1", 0, "Introdução", "Texto da introdução."),
    { ...secao("s2", 1, "Objetivos", "Os objetivos."), nivel: 2 },
    { ...secao("s3", 2, "Específicos", "Os específicos."), nivel: 3 },
    secao("s4", 3, "Método", ""),
  ];
  documento.sections[3].content = [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Um " },
        { type: "text", text: "termo", marks: [{ type: "italico" }] },
        { type: "text", text: " e um " },
        { type: "text", text: "destaque", marks: [{ type: "negrito" }] },
        { type: "text", text: "." },
      ],
    },
  ];
  documento.apendices = [
    {
      id: "ap1",
      titulo: "Questionário",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Perguntas." }] }],
    },
  ];
  return documento;
}

test("o .docx exportado pelo AURA volta com títulos, níveis, texto e resumo", async ({ page }) => {
  const aberto = tresSecoes();
  await abrirDocumento(page, aberto);
  const bytes = await Packer.toBuffer(fromDocumento(trabalhoExportado(), new Map()));
  await importar(page, bytes);

  const dialogo = page.getByRole("dialog", { name: "Importar do Word" });
  await expect(dialogo).toContainText("Lido pelos estilos do Word");
  await dialogo.getByRole("radio", { name: /Substituir o conteúdo de/ }).check({ force: true });
  const secoes = dialogo.getByRole("region", { name: "Seções" });
  await expect(secoes).toContainText("Novos (4)");
  await expect(secoes).toContainText("Específicos");
  await expect(dialogo.getByRole("region", { name: "Dados do trabalho alterados" })).toContainText(
    "Resumo do trabalho em um parágrafo.",
  );
  await dialogo.getByRole("button", { name: "Substituir" }).click();
  await expect(dialogo).toBeHidden();

  await expect
    .poll(async () => {
      const salvo = await documentoSalvo(page, aberto.id);
      return salvo.sections.map(({ nivel, titulo }) => [nivel, titulo]);
    })
    .toEqual([
      [1, "Introdução"],
      [2, "Objetivos"],
      [3, "Específicos"],
      [1, "Método"],
    ]);
  const salvo = await documentoSalvo(page, aberto.id);
  expect(salvo.metadados.resumo).toBe("Resumo do trabalho em um parágrafo.");
  expect(salvo.metadados.palavrasChave).toEqual(["educação", "escola"]);
  expect(salvo.sections[3].content).toEqual(trabalhoExportado().sections[3].content);
  expect(salvo.apendices.map((apendice) => apendice.titulo)).toEqual(["QUESTIONÁRIO"]);

  await expect(page.locator(".ProseMirror em")).toHaveText("termo");
  await page.getByRole("tab", { name: /Histórico/ }).click();
  await expect(page.getByRole("list", { name: "Versões" })).toContainText("Antes da reimportação");
});

test("TCC feito à mão no Word: o negrito sem estilo vira aviso, e o trabalho novo abre", async ({
  page,
}) => {
  const aberto = tresSecoes();
  await abrirDocumento(page, aberto);
  const negrito = (texto: string) =>
    new Paragraph({ children: [new TextRun({ text: texto, bold: true })] });
  const docx = new Document({
    sections: [
      {
        children: [
          negrito("UNIVERSIDADE DE TESTE"),
          new Paragraph("Fulana de Tal"),
          negrito("RESUMO"),
          new Paragraph("O resumo do aluno."),
          new Paragraph("Palavras-chave: leitura; escrita."),
          new Paragraph({ text: "1 INTRODUÇÃO", heading: HeadingLevel.HEADING_1 }),
          negrito("Contexto da pesquisa"),
          new Paragraph("Texto da introdução, com (Freire, 1987) citado à mão."),
          negrito("REFERÊNCIAS"),
          new Paragraph("FREIRE, Paulo. Pedagogia do oprimido. 1987."),
        ],
      },
    ],
  });
  await importar(page, await Packer.toBuffer(docx), "TCC do aluno.docx");

  const dialogo = page.getByRole("dialog", { name: "Importar do Word" });
  await dialogo.getByRole("radio", { name: /Criar um trabalho novo/ }).check({ force: true });
  const avisos = dialogo.getByRole("region", { name: "Avisos da reimportação" });
  await expect(avisos).toContainText("Possível título em “INTRODUÇÃO”: “Contexto da pesquisa”");
  await expect(avisos).toContainText("A lista de referências (1 parágrafo) não foi convertida");
  await expect(avisos).toContainText("Uma citação digitada");
  await expect(avisos).toContainText("2 parágrafos antes do primeiro título");
  await expect(dialogo.getByRole("region", { name: "Seções" })).toContainText("INTRODUÇÃO");
  await dialogo.getByRole("button", { name: "Criar trabalho" }).click();

  await page.waitForURL((url) => !url.pathname.endsWith(aberto.id));
  await expect(page.locator(".ProseMirror p")).toHaveText([
    "Contexto da pesquisa",
    "Texto da introdução, com (Freire, 1987) citado à mão.",
  ]);
  await expect(page.locator(".ProseMirror strong")).toHaveText("Contexto da pesquisa");
});

test("o .doc antigo é recusado, com o caminho para salvar como .docx", async ({ page }) => {
  await abrirDocumento(page, tresSecoes());
  // O `.doc` antigo, binário: a assinatura do formato OLE.
  const doc = new Uint8Array(64);
  doc.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  await page.getByLabel("Arquivo .docx, .tex ou .zip").setInputFiles({
    name: "antigo.doc",
    mimeType: "application/msword",
    buffer: Buffer.from(doc),
  });
  await expect(page.getByRole("status").filter({ hasText: "Importação recusada" })).toContainText(
    "Salvar como → Documento do Word (.docx)",
  );
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".ProseMirror p").first()).toHaveText("Texto da introdução.");
});
