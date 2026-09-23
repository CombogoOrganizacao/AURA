import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento, NoConteudo } from "../../document/types";
import type { Referencia } from "../../references/types";
import { fromDocumento } from "./fromDocumento";

// Passo 4B.2 — negrito, itálico e citações chegam ao `.docx`. Isto prova o que
// o XML diz. **Não substitui abrir o arquivo no Word** (CLAUDE.md): a
// conferência humana do passo fica registrada como pendente.

const FREIRE: Referencia = {
  id: "freire",
  type: "book",
  author: [{ family: "Freire", given: "Paulo" }],
  title: "Pedagogia do oprimido",
  publisher: "Paz e Terra",
  "publisher-place": "Rio de Janeiro",
  issued: { "date-parts": [[1987]] },
};

function documentoCom(content: NoConteudo[], local: "corpo" | "apendice" = "corpo"): Documento {
  const documento: Documento = { ...novoDocumento(), references: [FREIRE] };
  const secao = { id: "s1", ordem: 0, nivel: 1 as const, titulo: "Introdução", content };
  if (local === "corpo") {
    documento.sections = [secao];
  } else {
    documento.sections = [{ ...secao, content: [] }];
    documento.apendices = [{ id: "a1", titulo: "Questionário", content }];
  }
  return documento;
}

async function xmlDe(documento: Documento): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return zip.file("word/document.xml")!.async("string");
}

// O `<w:r>` que contém exatamente este texto.
function runCom(xml: string, texto: string): string {
  const runs = xml.match(/<w:r>[\s\S]*?<\/w:r>/g) ?? [];
  const run = runs.find((item) => item.includes(`>${texto}</w:t>`));
  expect(run, `run com "${texto}"`).toBeDefined();
  return run!;
}

function paragrafoCom(xml: string, texto: string): string {
  const paragrafos = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  const paragrafo = paragrafos.find((item) => item.includes(texto));
  expect(paragrafo, `parágrafo com "${texto}"`).toBeDefined();
  return paragrafo!;
}

describe("negrito e itálico no .docx (passo 4B.2)", () => {
  it("cada marca sai só no run marcado", async () => {
    const xml = await xmlDe(
      documentoCom([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Texto comum " },
            { type: "text", text: "em negrito", marks: [{ type: "negrito" }] },
            { type: "text", text: " e " },
            { type: "text", text: "em itálico", marks: [{ type: "italico" }] },
          ],
        },
      ]),
    );

    expect(runCom(xml, "em negrito")).toContain("<w:b/>");
    expect(runCom(xml, "em negrito")).not.toContain("<w:i/>");
    expect(runCom(xml, "em itálico")).toContain("<w:i/>");
    expect(runCom(xml, "em itálico")).not.toContain("<w:b/>");
    // Sem destaque, o atributo é omitido, não gravado como falso.
    expect(runCom(xml, "Texto comum ")).not.toMatch(/<w:b[ /]|<w:i[ /]/);
  });
});

describe("citações no .docx (passo 4B.2, NBR 10520:2023)", () => {
  it("direta curta: aspas duplas e chamada no mesmo parágrafo, na ordem (§7.1)", async () => {
    const xml = await xmlDe(
      documentoCom([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Segundo o autor, " },
            {
              type: "text",
              text: "ensinar exige risco",
              marks: [
                { type: "citacao", attrs: { refId: "freire", modo: "direta_curta", pagina: "35", apud: null } },
              ],
            },
            { type: "text", text: "." },
          ],
        },
      ]),
    );

    const paragrafo = paragrafoCom(xml, "ensinar exige risco");
    const textos = [...paragrafo.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
    expect(textos.join("")).toBe("Segundo o autor, “ensinar exige risco” (Freire, 1987, p. 35).");
  });

  it("citação longa termina com a chamada e mantém o estilo CitacaoLonga (§7.1.1)", async () => {
    const xml = await xmlDe(
      documentoCom([
        {
          type: "citacao_longa",
          refId: "freire",
          pagina: "181",
          content: [{ type: "text", text: "Trecho com mais de três linhas." }],
        },
      ]),
    );

    const paragrafo = paragrafoCom(xml, "Trecho com mais de três linhas.");
    expect(paragrafo).toContain('<w:pStyle w:val="CitacaoLonga"/>');
    expect(paragrafo).toContain("> (Freire, 1987, p. 181)</w:t>");
  });

  it("em apêndice, o mesmo tratamento do corpo, com a citação longa no estilo dela", async () => {
    const xml = await xmlDe(
      documentoCom(
        [
          {
            type: "paragraph",
            content: [{ type: "text", text: "termo do apêndice", marks: [{ type: "italico" }] }],
          },
          {
            type: "citacao_longa",
            refId: "freire",
            pagina: "",
            content: [{ type: "text", text: "Citação no apêndice." }],
          },
        ],
        "apendice",
      ),
    );

    expect(runCom(xml, "termo do apêndice")).toContain("<w:i/>");
    const longa = paragrafoCom(xml, "Citação no apêndice.");
    expect(longa).toContain('<w:pStyle w:val="CitacaoLonga"/>');
    expect(longa).toContain("> (Freire, 1987)</w:t>");
  });
});
