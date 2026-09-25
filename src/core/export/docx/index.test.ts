import { readFileSync } from "node:fs";
import path from "node:path";

import { Packer, Paragraph } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { montarDocumento } from "./index";

// Estas verificações são sobre a estrutura das três seções e os estilos —
// não sobre o corpo, então um parágrafo qualquer basta.
const conteudoDeTeste = { corpo: [new Paragraph("Corpo de teste")] };

// `montarDocumento()` devolve o `Document` sem empacotar (passo 1.4.4) —
// `Packer.toBuffer()` é a escolha certa aqui, em Node; o navegador usa
// `Packer.toBlob()` (ver `BotaoExportar.tsx`).
function gerarBuffer() {
  return Packer.toBuffer(montarDocumento(conteudoDeTeste));
}

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

// A PoC não nomeia todo estilo — citação longa, por exemplo, é formatação
// solta no `Paragraph` (`poc/docx/gerar.js`, `case "citacao_longa"`), nunca
// um `paragraphStyles` próprio. `CitacaoLonga` (passo 3.4.2) é o primeiro
// estilo que a AURA nomeia e a PoC nunca nomeou — a paridade abaixo passa a
// ser "referência + isto", não mais igualdade estrita; 6.1.1 (Corpo,
// Referencia, Legenda) vai crescer esta lista do mesmo jeito, um de cada vez.
// `Legenda` chegou junto com a correção da lista de figuras/tabelas (o número
// da legenda é um campo com resultado em cache, e o run desse cache só herda
// o corpo 10 da norma se o tamanho vier do parágrafo — ver `styles.ts`), o
// que adianta uma das três linhas que o 6.1.1 ainda vai acrescentar.
// `TituloPosTextual` entrou em 18/09/2026: é gêmeo visual do
// `TituloPreTextual` (NBR 14724:2024 §5.2.3) e existe separado só para o campo
// `TOC` conseguir recolher os pós-textuais sem arrastar os pré-textuais junto
// (NBR 6027 §5.2 contra §6.3) — ver `styles.ts` e `toc.ts`.
// O 6.1.1 fechou a lista: `Corpo`, `Referencia` e as três entradas de
// sumário (`TOC1`–`TOC3`), que a PoC deixava o Word criar sozinho, com o
// recuo por nível que a NBR 6027 §5.1 não aceita.
// `CelulaTabela` entrou no 6.1.3, com a grade da tabela: a PoC formatava cada
// célula solta, em 10 pt, e a NBR 14724:2024 §5.1/§5.2 pede 12 pt e 1,5.
const ESTILOS_ALEM_DA_POC = [
  "CelulaTabela",
  "CitacaoLonga",
  "Corpo",
  "Legenda",
  "Referencia",
  "TOC1",
  "TOC2",
  "TOC3",
  "TituloPosTextual",
];

describe("montarDocumento — esqueleto das três seções OOXML (passo 1.4.1)", () => {
  it("word/document.xml tem os mesmos três <w:sectPr> da PoC, só o segundo com w:pgNumType/w:start", async () => {
    const referencia = await abrirZip(readFileSync(CAMINHO_REFERENCIA));
    const xmlReferencia = await referencia.file("word/document.xml")!.async("string");
    const sectPrsReferencia = extrairSectPrs(xmlReferencia);

    const zip = await abrirZip(await gerarBuffer());
    const xmlGerado = await zip.file("word/document.xml")!.async("string");
    const sectPrsGerado = extrairSectPrs(xmlGerado);

    expect(sectPrsReferencia).toHaveLength(3);
    expect(sectPrsGerado).toHaveLength(3);

    const padraoReferencia = sectPrsReferencia.map(temPgNumTypeComStart);
    const padraoGerado = sectPrsGerado.map(temPgNumTypeComStart);

    expect(padraoReferencia).toEqual([false, true, false]);
    expect(padraoGerado).toEqual(padraoReferencia);
  });

  it("word/styles.xml declara os estilos nomeados da PoC, mais os que a AURA nomeou além dela", async () => {
    const referencia = await abrirZip(readFileSync(CAMINHO_REFERENCIA));
    const idsReferencia = idsDeEstilo(await referencia.file("word/styles.xml")!.async("string"));

    const zip = await abrirZip(await gerarBuffer());
    const idsGerado = idsDeEstilo(await zip.file("word/styles.xml")!.async("string"));

    expect(idsGerado).toEqual([...idsReferencia, ...ESTILOS_ALEM_DA_POC].sort());
  });

  it("gera um pacote OOXML válido com as partes essenciais", async () => {
    const zip = await abrirZip(await gerarBuffer());

    expect(zip.file("word/document.xml")).not.toBeNull();
    expect(zip.file("word/styles.xml")).not.toBeNull();
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
  });
});
