import { Document, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { montarSecoes } from "./sections";

// `montarSecoes()` só descreve as seções — para inspecionar `<w:sectPr>` é
// preciso empacotar de verdade (é XML que só existe depois do `Packer`).
// Um `Document` mínimo, sem os estilos nomeados de `index.ts`, já basta:
// este teste é sobre a estrutura das seções, não sobre estilo.
async function documentXmlDe(corpo: readonly Paragraph[]): Promise<string> {
  const documento = new Document({ sections: montarSecoes(corpo) });
  const buffer = await Packer.toBuffer(documento);
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("word/document.xml")!.async("string");
}

function extrairSectPrs(xmlDocumento: string): string[] {
  return xmlDocumento.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) ?? [];
}

function temPgNumTypeComStart(sectPr: string): boolean {
  const tag = sectPr.match(/<w:pgNumType[^/]*\/>/)?.[0] ?? "";
  return tag.includes('w:start="');
}

describe("montarSecoes — as três seções OOXML (passo 1.4.3)", () => {
  it("produz três <w:sectPr>, só o segundo com w:pgNumType/w:start", async () => {
    const xml = await documentXmlDe([new Paragraph("Corpo de teste")]);
    const sectPrs = extrairSectPrs(xml);

    expect(sectPrs).toHaveLength(3);
    expect(sectPrs.map(temPgNumTypeComStart)).toEqual([false, true, false]);
  });

  it("só a terceira seção carrega o corpo recebido", async () => {
    const corpo = [new Paragraph("Parágrafo único do corpo")];
    const secoes = montarSecoes(corpo);

    expect(secoes).toHaveLength(3);
    expect(secoes[0].children).not.toEqual(corpo);
    expect(secoes[1].children).not.toEqual(corpo);
    expect(secoes[2].children).toEqual(corpo);
  });

  it("só a terceira seção tem cabeçalho (número de página)", () => {
    const secoes = montarSecoes([]);

    expect(secoes[0].headers).toBeUndefined();
    expect(secoes[1].headers).toBeUndefined();
    expect(secoes[2].headers?.default).toBeDefined();
  });
});
