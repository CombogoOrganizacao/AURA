import { Packer, Paragraph } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { montarDocumento } from "./index";

// Conferência do `<w:style>` gerado para os três níveis de título (passo
// 3.2.5). NBR 6024 exige gradação visível entre níveis e consistência
// sumário↔texto — não esta combinação (caixa alta+negrito / negrito /
// itálico), que é escolha de estilo do AURA (docs/auditoria-abnt.md,
// achado do passo 3.1.1). Por isso os testes conferem que os três níveis
// se distinguem entre si no XML, não que esta seja "a" combinação exigida
// pela norma.

async function estilosGerados(): Promise<string> {
  const buffer = await Packer.toBuffer(
    montarDocumento({ corpo: [new Paragraph("Corpo de teste")] }),
  );
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("word/styles.xml")!.async("string");
}

function blocoDeEstilo(xmlEstilos: string, styleId: string): string {
  const padrao = new RegExp(`<w:style [^>]*w:styleId="${styleId}"[^>]*>[\\s\\S]*?</w:style>`);
  const bloco = xmlEstilos.match(padrao)?.[0];
  if (!bloco) throw new Error(`Estilo ${styleId} não encontrado em word/styles.xml`);
  return bloco;
}

describe("ESTILOS_DOCUMENTO — gradação h1/h2/h3 no `.docx` (passo 3.2.5)", () => {
  it("Heading1 é negrito e caixa alta, sem itálico", async () => {
    const heading1 = blocoDeEstilo(await estilosGerados(), "Heading1");
    expect(heading1).toContain("<w:b/>");
    expect(heading1).toContain("<w:caps/>");
    expect(heading1).not.toContain("<w:i/>");
  });

  it("Heading2 é negrito, sem caixa alta e sem itálico", async () => {
    const heading2 = blocoDeEstilo(await estilosGerados(), "Heading2");
    expect(heading2).toContain("<w:b/>");
    expect(heading2).not.toContain("<w:caps/>");
    expect(heading2).not.toContain("<w:i/>");
  });

  it("Heading3 é itálico, sem negrito e sem caixa alta", async () => {
    const heading3 = blocoDeEstilo(await estilosGerados(), "Heading3");
    expect(heading3).toContain("<w:i/>");
    expect(heading3).not.toContain("<w:b/>");
    expect(heading3).not.toContain("<w:caps/>");
  });

  it("os três níveis têm blocos de propriedades diferentes entre si — a gradação existe", async () => {
    const xml = await estilosGerados();
    const [heading1, heading2, heading3] = ["Heading1", "Heading2", "Heading3"].map((id) =>
      blocoDeEstilo(xml, id),
    );

    expect(heading1).not.toBe(heading2);
    expect(heading2).not.toBe(heading3);
    expect(heading1).not.toBe(heading3);
  });
});
