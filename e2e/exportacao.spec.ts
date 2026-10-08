import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { BrowserContext, Page, Request } from "@playwright/test";
import JSZip from "jszip";

import { ENDERECO_OVERLEAF } from "../src/core/export/latex/overleaf";

import { abrirDocumento, tresSecoes } from "./apoio";

// Passos 6.3.1 a 6.3.3 — a janela "Exportar": `.docx` como formato principal,
// projeto LaTeX em `.zip` (com "Abrir no Overleaf" quando cabe no limite) e
// só o `.tex`. Nenhum PDF. O Overleaf de verdade não é chamado: o POST é
// interceptado no navegador, e o teste confere o que iria nele. Se a CSP
// barrasse o formulário (`form-action`), a interceptação nunca seria
// acionada.

// Toda requisição que sai da máquina, fora o servidor de teste.
function requisicoesDeFora(contexto: BrowserContext): Request[] {
  const fora: Request[] = [];
  contexto.on("request", (requisicao) => {
    const { hostname } = new URL(requisicao.url());
    if (hostname !== "localhost" && hostname !== "127.0.0.1") fora.push(requisicao);
  });
  return fora;
}

async function abrirJanela(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: "Exportar", exact: true }).click();
  return page.getByRole("dialog", { name: "Exportar" });
}

async function inserirFigura(page: Page, png: Buffer) {
  await page.locator(".ProseMirror p").first().click();
  await page.getByRole("button", { name: /^Figura/ }).click();
  await page
    .locator(".ProseMirror figure")
    .getByLabel(/Arquivo de imagem/)
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".ProseMirror img.doc-figura-imagem")).toBeVisible();
}

test("abrir a janela e fechar não envia nada", async ({ page, context }) => {
  const fora = requisicoesDeFora(context);
  await abrirDocumento(page, tresSecoes());

  const dialogo = await abrirJanela(page);
  await expect(dialogo).toContainText("não volta sozinho");
  await expect(dialogo).toContainText("Importar LaTeX");
  await expect(dialogo).toContainText("Tamanho do projeto");

  await dialogo.getByRole("button", { name: "Fechar" }).click();
  await expect(dialogo).toBeHidden();
  expect(fora).toEqual([]);
});

test("baixar o projeto entrega o .zip, sem enviar nada para fora", async ({ page, context }) => {
  const fora = requisicoesDeFora(context);
  await abrirDocumento(page, tresSecoes());

  const dialogo = await abrirJanela(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialogo.getByRole("button", { name: "Baixar .zip" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const nomes = Object.keys(zip.files);
  expect(nomes).toContain("main.tex");
  expect(nomes).toContain("referencias.bib");
  expect(nomes.some((nome) => nome.startsWith("sections/"))).toBe(true);
  // A janela fica aberta, para baixar outro formato se quiser.
  await expect(dialogo).toBeVisible();
  expect(fora).toEqual([]);
});

test("confirmar abre o Overleaf numa aba nova com o projeto dentro do POST", async ({
  page,
  context,
}) => {
  const fora = requisicoesDeFora(context);
  let recebido: Request | null = null;
  await context.route(ENDERECO_OVERLEAF, async (rota) => {
    recebido = rota.request();
    await rota.fulfill({ contentType: "text/html", body: "<p>Overleaf simulado</p>" });
  });

  const documento = tresSecoes();
  await abrirDocumento(page, documento);
  const dialogo = await abrirJanela(page);
  const confirmar = dialogo.getByRole("button", { name: "Abrir no Overleaf" });
  await expect(confirmar).toBeEnabled();

  const [aba] = await Promise.all([context.waitForEvent("page"), confirmar.click()]);
  await expect(aba.getByText("Overleaf simulado")).toBeVisible();
  await expect(dialogo).toBeHidden();

  // Só uma requisição saiu da máquina: o POST, sem nada no endereço.
  expect(fora.map((requisicao) => [requisicao.method(), requisicao.url()])).toEqual([
    ["POST", ENDERECO_OVERLEAF],
  ]);
  const campos = new URLSearchParams(recebido!.postData() ?? "");
  expect(campos.get("engine")).toBe("pdflatex");
  expect(campos.get("main_document")).toBe("main.tex");
  // A aba nova não sabe de onde veio.
  expect(recebido!.headers()["referer"]).toBeUndefined();

  const dataUrl = campos.get("snip_uri") ?? "";
  expect(dataUrl.startsWith("data:application/zip;base64,")).toBe(true);
  const zip = await JSZip.loadAsync(
    Buffer.from(dataUrl.slice("data:application/zip;base64,".length), "base64"),
  );
  const main = await zip.file("main.tex")!.async("string");
  expect(main).toMatch(new RegExp(`^% AURA-DOCUMENTO: ${documento.id} v`));
  const capitulos = await Promise.all(
    Object.keys(zip.files)
      .filter((nome) => nome.startsWith("sections/") && !zip.files[nome].dir)
      .map((nome) => zip.file(nome)!.async("string")),
  );
  expect(capitulos.join("\n")).toContain("Aplicamos o questionário em campo.");
});

test("projeto acima do limite do Overleaf: sem o botão do Overleaf, com o motivo, e o .zip baixa", async ({
  page,
  context,
}) => {
  const fora = requisicoesDeFora(context);
  await abrirDocumento(page, tresSecoes());

  // PNG válido com 1,7 MB de bytes aleatórios depois do fim: o `.zip` não
  // os comprime, e o projeto passa do limite medido (~1,4 MB).
  const captura = await page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: 64, height: 64 },
  });
  await inserirFigura(page, Buffer.concat([captura, randomBytes(1_700_000)]));

  const dialogo = await abrirJanela(page);
  await expect(dialogo).toContainText("Grande demais para abrir direto");
  await expect(dialogo).toContainText("Upload Project");
  await expect(dialogo.getByRole("button", { name: "Abrir no Overleaf" })).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialogo.getByRole("button", { name: "Baixar .zip" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  expect(Object.keys(zip.files)).toContain("main.tex");
  expect(Object.keys(zip.files).some((nome) => nome.startsWith("figuras/"))).toBe(true);
  // A janela fica aberta, para baixar outro formato se quiser.
  await expect(dialogo).toBeVisible();
  expect(fora).toEqual([]);
});

test("o .docx é o formato principal, com a nota do PDF, e não há PDF em lugar nenhum", async ({
  page,
}) => {
  await abrirDocumento(page, tresSecoes());
  const dialogo = await abrirJanela(page);

  const word = dialogo.getByRole("region", { name: "Word (.docx)" });
  await expect(word).toContainText("Formato principal");
  await expect(word).toContainText("Salvar como → PDF");
  // O .docx vem antes dos formatos LaTeX.
  const formatos = await dialogo
    .getByRole("region")
    .evaluateAll((secoes) => secoes.map((secao) => secao.getAttribute("aria-label")));
  expect(formatos).toEqual(["Word (.docx)", "Projeto LaTeX (.zip)", "Só o .tex"]);

  // Nenhum botão ou link de PDF, nem na janela nem na página atrás dela.
  await expect(page.getByRole("button", { name: /pdf/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /pdf/i })).toHaveCount(0);
});

// Passo 6.3.3 — um pacote OOXML só abre no Word se cada parte XML for bem
// formada, se toda parte tiver tipo em `[Content_Types].xml` e se todo
// relacionamento interno apontar para uma parte que existe. Abrir o `.zip` e
// achar `word/document.xml` não pega nenhum dos três. Isto não substitui
// abrir o arquivo no Word; só garante que ele não chega lá quebrado.
async function problemasDoDocx(page: Page, pacote: JSZip): Promise<string[]> {
  const problemas: string[] = [];
  const partes = Object.keys(pacote.files).filter((nome) => !pacote.files[nome].dir);
  for (const obrigatoria of ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]) {
    if (!partes.includes(obrigatoria)) problemas.push(`falta ${obrigatoria}`);
  }

  const xmls = await Promise.all(
    partes
      .filter((nome) => /\.(xml|rels)$/.test(nome))
      .map(async (nome) => ({ nome, texto: await pacote.file(nome)!.async("string") })),
  );
  // O DOMParser do navegador é um parser XML de verdade; o Node não tem um.
  const malFormadas = await page.evaluate(
    (arquivos) =>
      arquivos
        .filter(
          ({ texto }) =>
            new DOMParser()
              .parseFromString(texto, "application/xml")
              .getElementsByTagName("parsererror").length > 0,
        )
        .map(({ nome }) => nome),
    xmls,
  );
  problemas.push(...malFormadas.map((nome) => `XML mal formado: ${nome}`));

  const tipos = xmls.find(({ nome }) => nome === "[Content_Types].xml")?.texto ?? "";
  const extensoes = [...tipos.matchAll(/<Default\b[^>]*\bExtension="([^"]+)"/g)].map((m) =>
    m[1].toLowerCase(),
  );
  const sobrescritas = [...tipos.matchAll(/<Override\b[^>]*\bPartName="([^"]+)"/g)].map(
    (m) => m[1],
  );
  for (const parte of partes.filter((nome) => nome !== "[Content_Types].xml")) {
    const extensao = parte.split(".").pop()!.toLowerCase();
    if (!sobrescritas.includes(`/${parte}`) && !extensoes.includes(extensao)) {
      problemas.push(`sem tipo em [Content_Types].xml: ${parte}`);
    }
  }

  for (const { nome, texto } of xmls.filter(({ nome }) => nome.endsWith(".rels"))) {
    // `word/_rels/document.xml.rels` fala de `word/document.xml`: os alvos
    // relativos partem de `word/`.
    const base = nome.replace(/_rels\/[^/]*$/, "");
    for (const [relacao] of texto.matchAll(/<Relationship\b[^>]*>/g)) {
      if (/\bTargetMode="External"/.test(relacao)) continue;
      const alvo = /\bTarget="([^"]+)"/.exec(relacao)?.[1] ?? "";
      const caminho = new URL(alvo, `http://pacote/${base}`).pathname.slice(1);
      if (!partes.includes(decodeURIComponent(caminho))) {
        problemas.push(`${nome} aponta para parte que não existe: ${alvo}`);
      }
    }
  }
  return problemas;
}

test("os três formatos baixam da mesma janela e cada arquivo é válido", async ({
  page,
  context,
}) => {
  const fora = requisicoesDeFora(context);
  const documento = tresSecoes();
  await abrirDocumento(page, documento);
  // Com figura, os três caminhos de imagem entram no teste: `word/media/` no
  // `.docx`, `figuras/` no `.zip` e o aviso no `.tex`.
  await inserirFigura(
    page,
    await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 32, height: 32 } }),
  );

  const dialogo = await abrirJanela(page);
  async function baixar(formato: string, botao: string) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      dialogo.getByRole("region", { name: formato }).getByRole("button", { name: botao }).click(),
    ]);
    return download;
  }

  // Word (.docx)
  const docx = await baixar("Word (.docx)", "Baixar .docx");
  expect(docx.suggestedFilename()).toBe("Trabalho de teste.docx");
  const pacoteDocx = await JSZip.loadAsync(readFileSync(await docx.path()));
  expect(await problemasDoDocx(page, pacoteDocx)).toEqual([]);
  expect(await pacoteDocx.file("word/document.xml")!.async("string")).toContain(
    "Aplicamos o questionário em campo.",
  );
  expect(Object.keys(pacoteDocx.files).some((nome) => nome.startsWith("word/media/"))).toBe(true);

  // Projeto LaTeX (.zip): todo `\input` e todo `\includegraphics` do
  // projeto aponta para um arquivo que está nele.
  const zip = await baixar("Projeto LaTeX (.zip)", "Baixar .zip");
  expect(zip.suggestedFilename()).toBe("Trabalho de teste.zip");
  const projeto = await JSZip.loadAsync(readFileSync(await zip.path()));
  const arquivos = Object.keys(projeto.files).filter((nome) => !projeto.files[nome].dir);
  const main = await projeto.file("main.tex")!.async("string");
  expect(main).toMatch(new RegExp(`^% AURA-DOCUMENTO: ${documento.id} v`));
  expect(main).toContain("\\begin{document}");
  expect(main.trimEnd()).toMatch(/\\end\{document\}$/);
  const entradas = [...main.matchAll(/\\input\{([^}]+)\}/g)].map((m) => `${m[1]}.tex`);
  expect(entradas.length).toBeGreaterThan(0);
  for (const entrada of entradas) expect(arquivos).toContain(entrada);
  const capitulos = (
    await Promise.all(entradas.map((nome) => projeto.file(nome)!.async("string")))
  ).join("\n");
  expect(capitulos).toContain("Aplicamos o questionário em campo.");
  const imagens = [...capitulos.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)].map(
    (m) => m[1],
  );
  expect(imagens).toHaveLength(1);
  expect(arquivos).toContain(imagens[0]);
  expect(arquivos).toContain("referencias.bib");

  // Só o .tex: o mesmo documento num arquivo só, sem `\input`.
  const tex = await baixar("Só o .tex", "Baixar .tex");
  expect(tex.suggestedFilename()).toBe("Trabalho de teste.tex");
  const avulso = readFileSync(await tex.path(), "utf-8");
  expect(avulso).toMatch(new RegExp(`^% AURA-DOCUMENTO: ${documento.id} v`));
  expect(avulso).toContain("\\begin{document}");
  expect(avulso.trimEnd()).toMatch(/\\end\{document\}$/);
  expect(avulso).not.toMatch(/\\input\{sections\//);
  expect(avulso).toContain("Aplicamos o questionário em campo.");

  // Os três saíram da mesma janela, que continua aberta, e nada foi para fora.
  await expect(dialogo).toBeVisible();
  expect(fora).toEqual([]);
});

test("só o .tex: baixa o main.tex e avisa que as figuras ficam de fora", async ({ page }) => {
  const documento = tresSecoes();
  await abrirDocumento(page, documento);

  // Sem figura com imagem, não há aviso de figura.
  let dialogo = await abrirJanela(page);
  const soTex = dialogo.getByRole("region", { name: "Só o .tex" });
  await expect(soTex).not.toContainText("figura");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    soTex.getByRole("button", { name: "Baixar .tex" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("Trabalho de teste.tex");
  const tex = readFileSync(await download.path(), "utf-8");
  expect(tex).toMatch(new RegExp(`^% AURA-DOCUMENTO: ${documento.id} v`));
  expect(tex).toContain("Aplicamos o questionário em campo.");
  await dialogo.getByRole("button", { name: "Fechar" }).click();

  // Com uma figura com imagem, o aviso aparece.
  await inserirFigura(
    page,
    await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 32, height: 32 } }),
  );
  dialogo = await abrirJanela(page);
  await expect(dialogo.getByRole("region", { name: "Só o .tex" })).toContainText(
    "sem a imagem: elas vêm no .zip",
  );
});
