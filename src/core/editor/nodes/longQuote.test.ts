import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";

import { Citacao } from "../marks/citation";
import { Italico } from "../marks/italico";
import { Negrito } from "../marks/negrito";
import { CitacaoLonga } from "./longQuote";

// `getSchema` monta só o Schema do ProseMirror a partir das extensões — sem
// EditorView, sem DOM (mesma técnica de section.test.ts). As três marcas
// entram porque o nó as nomeia em `marks` desde o 4.8, e o ProseMirror
// recusa um schema que cita marca desconhecida.
const schema = getSchema([Document, Paragraph, Text, CitacaoLonga, Negrito, Italico, Citacao]);

describe("nó citacao_longa (passo 3.4.1)", () => {
  it("serializa com refId, pagina e o texto citado, e sobrevive ao round-trip", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.citacao_longa.create(
        { refId: "ref-1", pagina: "42" },
        schema.text("Trecho citado com mais de três linhas."),
      ),
    ]);

    expect(() => doc.check()).not.toThrow();

    const json = doc.toJSON();
    expect(json.content[0]).toEqual({
      type: "citacao_longa",
      attrs: { refId: "ref-1", pagina: "42" },
      content: [{ type: "text", text: "Trecho citado com mais de três linhas." }],
    });

    const reconstruido = schema.nodeFromJSON(json);
    expect(reconstruido.toJSON()).toEqual(json);
  });

  it("usa refId nulo e pagina vazia como default quando não informados", () => {
    const no = schema.nodes.citacao_longa.create();
    expect(no.attrs).toEqual({ refId: null, pagina: "" });
  });

  it("aceita conteúdo vazio, sem exigir texto", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.citacao_longa.create({ refId: null, pagina: "" }),
    ]);
    expect(() => doc.check()).not.toThrow();
  });

  it("pertence ao grupo block — cabe onde um parágrafo cabe", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text("Antes.")),
      schema.nodes.citacao_longa.create({ refId: "ref-1", pagina: "10" }, schema.text("Citação.")),
      schema.nodes.paragraph.create(null, schema.text("Depois.")),
    ]);
    expect(() => doc.check()).not.toThrow();
  });

  it("aceita negrito e itálico, mas não a marca citacao (4.8)", () => {
    const tipo = schema.nodes.citacao_longa;
    expect(tipo.allowsMarkType(schema.marks.negrito)).toBe(true);
    expect(tipo.allowsMarkType(schema.marks.italico)).toBe(true);
    // A ligação com a referência é do bloco (`refId`); uma marca dentro dele
    // seria uma segunda ligação.
    expect(tipo.allowsMarkType(schema.marks.citacao)).toBe(false);
  });
});
