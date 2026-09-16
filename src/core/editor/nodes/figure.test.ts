import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";

import { Figura } from "./figure";

// `getSchema` monta só o Schema do ProseMirror a partir das extensões — sem
// EditorView, sem DOM (mesma técnica de section.test.ts/longQuote.test.ts).
const schema = getSchema([Document, Paragraph, Text, Figura]);

describe("nó figura (passo 3.6.3)", () => {
  it("serializa id, legenda, fonte e imagem, e sobrevive ao round-trip", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.figura.create({
        id: "f1",
        legenda: "Fluxo do processo",
        fonte: "Elaborado pela autora (2026)",
        imagem: null,
      }),
    ]);

    expect(() => doc.check()).not.toThrow();

    const json = doc.toJSON();
    expect(json.content[0]).toEqual({
      type: "figura",
      attrs: {
        id: "f1",
        legenda: "Fluxo do processo",
        fonte: "Elaborado pela autora (2026)",
        imagem: null,
      },
    });

    expect(schema.nodeFromJSON(json).toJSON()).toEqual(json);
  });

  // docs/schema-tiptap.md §2: nenhum nó guarda um número que dê para calcular
  // a partir da própria posição. É o que permite inserir no meio sem
  // corrigir nada.
  it("não tem atributo de número — 'Figura 3' é derivado, nunca gravado", () => {
    expect(Object.keys(schema.nodes.figura.spec.attrs ?? {})).toEqual([
      "id",
      "legenda",
      "fonte",
      "imagem",
    ]);
  });

  it("é atômico: legenda e fonte são atributos, não conteúdo editável", () => {
    expect(schema.nodes.figura.isAtom).toBe(true);
    expect(schema.nodes.figura.isLeaf).toBe(true);
  });

  it("pertence ao grupo block — cabe onde um parágrafo cabe", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text("Antes.")),
      schema.nodes.figura.create({ id: "f1" }),
      schema.nodes.paragraph.create(null, schema.text("Depois.")),
    ]);

    expect(() => doc.check()).not.toThrow();
  });

  it("nasce sem id por default — quem cria é `novaFigura()`, nunca o schema", () => {
    expect(schema.nodes.figura.create().attrs).toEqual({
      id: null,
      legenda: "",
      fonte: "",
      imagem: null,
    });
  });
});
