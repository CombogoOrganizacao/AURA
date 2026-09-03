import { readFileSync } from "node:fs";
import path from "node:path";

import { Paragraph } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { gerarDocx } from "./index";

// Estas verificações são sobre a estrutura das três seções e os estilos —
// não sobre o corpo, então um parágrafo qualquer basta.
const conteudoDeTeste = { corpo: [new Paragraph("Corpo de teste")] };

// Compara as PARTES ESTRUTURAIS do zip gerado com as de `poc/docx/saida.docx`
// — não é comparação byte a byte nem julgamento de semelhança (o to-do é
// explícito nisso). `poc/docx/` é congelada (ver CLAUDE.md); `saida.docx` já
// existe lá, gerada e com o XML inspecionado — ler esse arquivo aqui não é
// editar a pasta.
const CAMINHO_REFERENCIA = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "poc",
  "docx",
  "saida.docx",
);

async function abrirZip(buffer: Buffer) {
  return JSZip.loadAsync(buffer);
}

function extrairSectPrs(xmlDocumento: string): string[] {
  return xmlDocumento.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) ?? [];
}

function temPgNumTypeComStart(sectPr: string): boolean {
  const tag = sectPr.match(/<w:pgNumType[^/]*\/>/)?.[0] ?? "";
  return tag.includes('w:start="');
}

function idsDeEstilo(xmlEstilos: string): string[] {
  return [...xmlEstilos.matchAll(/<w:style [^>]*w:styleId="([^"]+)"/g)].map((m) => m[1]).sort();
}

describe("gerarDocx — esqueleto das três seções OOXML (passo 1.4.1)", () => {
  it("word/document.xml tem os mesmos três <w:sectPr> da PoC, só o segundo com w:pgNumType/w:start", async () => {
    const referencia = await abrirZip(readFileSync(CAMINHO_REFERENCIA));
    const xmlReferencia = await referencia.file("word/document.xml")!.async("string");
    const sectPrsReferencia = extrairSectPrs(xmlReferencia);

    const zip = await abrirZip(await gerarDocx(conteudoDeTeste));
    const xmlGerado = await zip.file("word/document.xml")!.async("string");
    const sectPrsGerado = extrairSectPrs(xmlGerado);

    expect(sectPrsReferencia).toHaveLength(3);
    expect(sectPrsGerado).toHaveLength(3);

    const padraoReferencia = sectPrsReferencia.map(temPgNumTypeComStart);
    const padraoGerado = sectPrsGerado.map(temPgNumTypeComStart);

    expect(padraoReferencia).toEqual([false, true, false]);
    expect(padraoGerado).toEqual(padraoReferencia);
  });

  it("word/styles.xml declara os mesmos estilos nomeados da PoC", async () => {
    const referencia = await abrirZip(readFileSync(CAMINHO_REFERENCIA));
    const idsReferencia = idsDeEstilo(await referencia.file("word/styles.xml")!.async("string"));

    const zip = await abrirZip(await gerarDocx(conteudoDeTeste));
    const idsGerado = idsDeEstilo(await zip.file("word/styles.xml")!.async("string"));

    expect(idsGerado).toEqual(idsReferencia);
  });

  it("gera um pacote OOXML válido com as partes essenciais", async () => {
    const zip = await abrirZip(await gerarDocx(conteudoDeTeste));

    expect(zip.file("word/document.xml")).not.toBeNull();
    expect(zip.file("word/styles.xml")).not.toBeNull();
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
  });
});
