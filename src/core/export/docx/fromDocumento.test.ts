import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento } from "../../document/types";
import { fromDocumento } from "./fromDocumento";

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
    const buffer = await fromDocumento(documentoComDuasSecoes());
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file("word/document.xml")).not.toBeNull();
    expect(zip.file("word/styles.xml")).not.toBeNull();
    expect(zip.file("word/header1.xml")).not.toBeNull();
  });

  it("o corpo traz o título e o texto das duas seções, na ordem", async () => {
    const buffer = await fromDocumento(documentoComDuasSecoes());
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

    const buffer = await fromDocumento(documento);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");

    expect(xml.indexOf("Introdução")).toBeLessThan(xml.indexOf("Metodologia"));
  });
});
