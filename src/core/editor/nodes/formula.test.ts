import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";

import { Formula } from "./formula";

// `getSchema` monta só o Schema do ProseMirror a partir das extensões — sem
// EditorView, sem DOM (mesma técnica de figure.test.ts/longQuote.test.ts).
const schema = getSchema([Document, Paragraph, Text, Formula]);

describe("nó formula (passo 3.6.5)", () => {
  it("serializa o LaTeX e sobrevive ao round-trip", () => {
    const doc = schema.nodes.doc.create(null, [schema.nodes.formula.create({ texto: "E = mc^2" })]);

    expect(() => doc.check()).not.toThrow();

    const json = doc.toJSON();
    expect(json.content[0]).toEqual({ type: "formula", attrs: { texto: "E = mc^2" } });

    expect(schema.nodeFromJSON(json).toJSON()).toEqual(json);
  });

  // O ponto do passo: o que atravessa o round-trip é a FONTE, não o desenho.
  // Barra invertida, chave e espaço passam intactos — se algum deles fosse
  // escapado ou normalizado no caminho, a fórmula voltaria diferente da que
  // foi escrita.
  it("preserva barra invertida, chaves e espaços do LaTeX", () => {
    const latex = "\\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}";
    const json = schema.nodes.doc
      .create(null, [schema.nodes.formula.create({ texto: latex })])
      .toJSON();

    expect(schema.nodeFromJSON(json).firstChild?.attrs.texto).toBe(latex);
  });

  // docs/schema-tiptap.md §4.8: um campo só. Sem `id` (a fórmula não é
  // numerada nem entra em lista automática, ao contrário de figura/tabela) e
  // sem número (§2 — nada que se derive da posição fica gravado).
  it("tem `texto` como único atributo — sem id e sem número", () => {
    expect(Object.keys(schema.nodes.formula.spec.attrs ?? {})).toEqual(["texto"]);
  });

  it("é atômico: o LaTeX é atributo, não conteúdo editável do ProseMirror", () => {
    expect(schema.nodes.formula.isAtom).toBe(true);
    expect(schema.nodes.formula.isLeaf).toBe(true);
  });

  it("pertence ao grupo block — cabe onde um parágrafo cabe", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text("Antes.")),
      schema.nodes.formula.create({ texto: "a^2 + b^2 = c^2" }),
      schema.nodes.paragraph.create(null, schema.text("Depois.")),
    ]);

    expect(() => doc.check()).not.toThrow();
  });

  // Fórmula recém-inserida nasce vazia: é o estado de todo bloco criado pelo
  // botão da toolbar, antes de a pessoa digitar. O AURA não sugere fórmula
  // de exemplo (CLAUDE.md — não escreve o conteúdo do trabalho).
  it("nasce com o LaTeX vazio", () => {
    expect(schema.nodes.formula.create().attrs).toEqual({ texto: "" });
  });
});
