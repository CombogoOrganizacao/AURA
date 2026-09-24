import { Packer, Paragraph } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { ABNT } from "./constants";
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

// Passo 6.1.1 — a lista de estilos nomeados fechada. O critério do passo é
// no Word ("o painel de Estilos lista todos e o sumário automático os
// reconhece"); aqui, o que o XML consegue provar.
describe("ESTILOS_DOCUMENTO — estilos nomeados completos (passo 6.1.1)", () => {
  it("declara Título 1–3, Corpo, Citação Longa, Referência, Legenda, os títulos sem indicativo e o sumário", async () => {
    const xml = await estilosGerados();
    for (const id of [
      "Heading1",
      "Heading2",
      "Heading3",
      "Corpo",
      "CitacaoLonga",
      "Referencia",
      "Legenda",
      "TituloPreTextual",
      "TituloPosTextual",
      "TOC1",
      "TOC2",
      "TOC3",
    ]) {
      expect(() => blocoDeEstilo(xml, id)).not.toThrow();
    }
  });

  it("Corpo: justificado, entrelinha 1,5 e recuo de primeira linha de 1,25 cm", async () => {
    const corpo = blocoDeEstilo(await estilosGerados(), "Corpo");
    expect(corpo).toContain('<w:jc w:val="both"/>');
    expect(corpo).toMatch(/<w:spacing [^>]*w:line="360"/);
    expect(corpo).toMatch(new RegExp(`<w:ind [^>]*w:firstLine="${ABNT.recuoParagrafo}"`));
  });

  it("títulos 1–3 não ficam sozinhos no pé da página (keepNext)", async () => {
    const xml = await estilosGerados();
    for (const id of ["Heading1", "Heading2", "Heading3"]) {
      expect(blocoDeEstilo(xml, id)).toContain("<w:keepNext/>");
    }
  });

  describe("entradas do sumário (NBR 6027:2012)", () => {
    it("têm o nome interno que o Word reconhece como sumário", async () => {
      const xml = await estilosGerados();
      for (const nivel of [1, 2, 3]) {
        expect(blocoDeEstilo(xml, `TOC${nivel}`)).toContain(`<w:name w:val="toc ${nivel}"/>`);
      }
    });

    it("§5.1: nenhum nível recua — os indicativos alinham à esquerda", async () => {
      const xml = await estilosGerados();
      for (const nivel of [1, 2, 3]) {
        const estilo = blocoDeEstilo(xml, `TOC${nivel}`);
        expect(estilo).toMatch(/<w:ind [^>]*w:left="0"/);
        expect(estilo).toMatch(/<w:ind [^>]*w:firstLine="0"/);
      }
    });

    it("§5.4: a página à margem direita, numa tabulação na largura útil, sem pontilhado", async () => {
      const xml = await estilosGerados();
      for (const nivel of [1, 2, 3]) {
        const tab = blocoDeEstilo(xml, `TOC${nivel}`).match(/<w:tab [^>]*\/>/)?.[0] ?? "";
        expect(tab).toContain('w:val="right"');
        // 16 cm: 21 cm da folha menos 3 e 2 de margem.
        expect(tab).toContain(`w:pos="${ABNT.larguraUtil}"`);
        expect(tab).not.toContain("w:leader");
      }
    });

    it("§6.2: cada nível com o destaque do título correspondente", async () => {
      const xml = await estilosGerados();
      const [toc1, toc2, toc3] = [1, 2, 3].map((nivel) => blocoDeEstilo(xml, `TOC${nivel}`));

      expect(toc1).toContain("<w:b/>");
      expect(toc1).toContain("<w:caps/>");
      expect(toc2).toContain("<w:b/>");
      expect(toc2).not.toContain("<w:caps/>");
      expect(toc3).toContain("<w:i/>");
      expect(toc3).not.toContain("<w:b/>");
    });
  });
});
