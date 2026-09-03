import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";

import { Secao } from "./section";

// `getSchema` monta só o Schema do ProseMirror a partir das extensões — sem
// EditorView, sem DOM. É o que permite testar o nó aqui em `src/core`, que
// não pode depender de navegador (ver CLAUDE.md).
const schema = getSchema([Document, Paragraph, Text, Secao]);

function criarSecao(id: string, nivel: 1 | 2 | 3, titulo: string, texto: string) {
  return schema.nodes.secao.create(
    { id, nivel, titulo },
    schema.nodes.paragraph.create(null, schema.text(texto)),
  );
}

describe("nó secao", () => {
  it("monta um documento com três seções em níveis diferentes e serializa", () => {
    const doc = schema.nodes.doc.create(null, [
      criarSecao("s1", 1, "Introdução", "Texto da introdução."),
      criarSecao("s2", 2, "Revisão de literatura", "Texto da revisão."),
      criarSecao("s3", 3, "Metodologia", "Texto da metodologia."),
    ]);

    // `check()` roda a validação estrutural do próprio ProseMirror contra o
    // schema (content, atributos) — lança se o documento montado for inválido.
    expect(() => doc.check()).not.toThrow();

    const json = doc.toJSON();
    expect(json.content).toHaveLength(3);
    expect(json.content.map((no: { attrs?: unknown }) => no.attrs)).toEqual([
      { id: "s1", nivel: 1, titulo: "Introdução" },
      { id: "s2", nivel: 2, titulo: "Revisão de literatura" },
      { id: "s3", nivel: 3, titulo: "Metodologia" },
    ]);

    // round-trip: reconstruir a partir do JSON serializado reproduz o mesmo
    // documento — é a garantia mínima de que a serialização não perde nada.
    const reconstruido = schema.nodeFromJSON(json);
    expect(reconstruido.toJSON()).toEqual(json);
  });

  it("aceita subseção aninhada, porque secao pertence ao grupo block", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.secao.create({ id: "s1", nivel: 1, titulo: "Introdução" }, [
        schema.nodes.paragraph.create(null, schema.text("Texto do corpo.")),
        criarSecao("s1-1", 2, "Objetivos", "Objetivo geral."),
      ]),
    ]);

    expect(() => doc.check()).not.toThrow();
    expect(doc.toJSON().content[0].content).toHaveLength(2);
    expect(doc.toJSON().content[0].content[1].attrs).toEqual({
      id: "s1-1",
      nivel: 2,
      titulo: "Objetivos",
    });
  });

  it("usa nivel 1 e titulo vazio como default quando não informados", () => {
    const noSecao = schema.nodes.secao.create();
    expect(noSecao.attrs).toEqual({ id: null, nivel: 1, titulo: "" });
  });
});
