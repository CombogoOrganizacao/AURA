import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento } from "../../document/types";
import { fromDocumento } from "./fromDocumento";

// `fromDocumento()` devolve o `Document` sem empacotar (passo 1.4.4) —
// `Packer.toBuffer()` é a escolha certa em Node; o navegador usa
// `Packer.toBlob()` (ver `BotaoExportar.tsx`).
function empacotar(documento: Documento) {
  return Packer.toBuffer(fromDocumento(documento));
}

function documentoComDuasSecoes(): Documento {
  const documento = novoDocumento();
  documento.sections = [
    {
      id: "s1",
      ordem: 0,
      nivel: 1,
      titulo: "Introdução",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Texto da introdução." }] }],
    },
    {
      id: "s2",
      ordem: 1,
      nivel: 1,
      titulo: "Metodologia",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Texto da metodologia." }] }],
    },
  ];
  return documento;
}

describe("fromDocumento — exportador ligado ao formato canônico (passo 1.4.2)", () => {
  it("exporta um documento montado por novoDocumento() + duas seções; o zip abre com as partes essenciais", async () => {
    const buffer = await empacotar(documentoComDuasSecoes());
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file("word/document.xml")).not.toBeNull();
    expect(zip.file("word/styles.xml")).not.toBeNull();
    expect(zip.file("word/header1.xml")).not.toBeNull();
  });

  it("o corpo traz o título e o texto das duas seções, na ordem", async () => {
    const buffer = await empacotar(documentoComDuasSecoes());
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");

    const posIntroducao = xml.indexOf("Introdução");
    const posTextoIntroducao = xml.indexOf("Texto da introdução.");
    const posMetodologia = xml.indexOf("Metodologia");
    const posTextoMetodologia = xml.indexOf("Texto da metodologia.");

    for (const posicao of [
      posIntroducao,
      posTextoIntroducao,
      posMetodologia,
      posTextoMetodologia,
    ]) {
      expect(posicao).toBeGreaterThan(-1);
    }
    expect(posIntroducao).toBeLessThan(posTextoIntroducao);
    expect(posTextoIntroducao).toBeLessThan(posMetodologia);
    expect(posMetodologia).toBeLessThan(posTextoMetodologia);
  });

  it("respeita `ordem`, não a posição no array", async () => {
    const documento = documentoComDuasSecoes();
    documento.sections.reverse(); // array fora de ordem; `ordem` continua correta

    const buffer = await empacotar(documento);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");

    expect(xml.indexOf("Introdução")).toBeLessThan(xml.indexOf("Metodologia"));
  });

  // Passo 3.4.2: citação longa exporta com o estilo nomeado `CitacaoLonga`
  // (docx/styles.ts), não um parágrafo comum sem recuo fingindo ser citação.
  it("citação longa exporta com o estilo nomeado CitacaoLonga (passo 3.4.2)", async () => {
    const documento = novoDocumento();
    documento.sections = [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "Revisão de literatura",
        content: [
          {
            type: "citacao_longa",
            refId: null,
            pagina: "42",
            content: [{ type: "text", text: "Trecho citado com mais de três linhas." }],
          },
        ],
      },
    ];

    const buffer = await empacotar(documento);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");

    const posTexto = xml.indexOf("Trecho citado com mais de três linhas.");
    expect(posTexto).toBeGreaterThan(-1);

    // O `<w:p>` que envolve o texto referencia o estilo nomeado — não
    // formatação solta (`w:ind`/`w:spacing` direto no parágrafo), que é
    // como a PoC congelada faz e a AURA decidiu não repetir neste passo.
    const paragrafo = xml.slice(xml.lastIndexOf("<w:p>", posTexto), posTexto);
    expect(paragrafo).toContain('<w:pStyle w:val="CitacaoLonga"/>');
  });

  // Passo 3.5.2: resumo/abstract exportam de verdade, a partir dos
  // metadados — não mais o placeholder fixo que `sections.ts` tinha antes.
  it("exporta resumo e abstract com palavras-chave/keywords separadas por ponto e vírgula", async () => {
    const documento = novoDocumento();
    documento.metadados.resumo = "Este trabalho investiga X.";
    documento.metadados.palavrasChave = ["Educação", "Tecnologia"];
    documento.metadados.abstract = "This work investigates X.";
    documento.metadados.keywords = ["Education", "Technology"];

    const buffer = await empacotar(documento);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");

    // Rótulo e termos vão em runs separados (negrito só no rótulo, porte da
    // PoC), então o XML não traz "Palavras-chave: Educação; Tecnologia."
    // como um `<w:t>` único — o que este passo promete é a junção por ponto
    // e vírgula, que é a parte procurada aqui.
    expect(xml.indexOf("RESUMO")).toBeGreaterThan(-1);
    expect(xml.indexOf("Palavras-chave")).toBeGreaterThan(-1);
    expect(xml.indexOf("Educação; Tecnologia.")).toBeGreaterThan(-1);
    expect(xml.indexOf("ABSTRACT")).toBeGreaterThan(-1);
    expect(xml.indexOf("Keywords")).toBeGreaterThan(-1);
    expect(xml.indexOf("Education; Technology.")).toBeGreaterThan(-1);

    // Ordem: resumo antes do abstract (docs/to-do.md 3.7.2 já define a
    // ordem canônica completa; aqui só a parte que este passo entrega).
    expect(xml.indexOf("RESUMO")).toBeLessThan(xml.indexOf("ABSTRACT"));
  });

  it("não exporta o elemento ABSTRACT quando o campo está vazio", async () => {
    const documento = novoDocumento();
    documento.metadados.resumo = "Este trabalho investiga X.";

    const buffer = await empacotar(documento);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");

    expect(xml.indexOf("RESUMO")).toBeGreaterThan(-1);
    expect(xml.indexOf("ABSTRACT")).toBe(-1);
  });
});
