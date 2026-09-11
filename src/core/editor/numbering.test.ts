import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import type { Node as NoProseMirror } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import { Secao } from "./nodes/section";
import { numerarDocumentoProseMirror } from "./numbering";

// Mesma técnica de section.test.ts: `getSchema()` monta só o Schema do
// ProseMirror, sem EditorView nem DOM — o que mantém este teste dentro de
// src/core (ver CLAUDE.md).
const schema = getSchema([Document, Paragraph, Text, Secao]);

function criarSecao(id: string, nivel: 1 | 2 | 3, filhos: NoProseMirror[] = []) {
  return schema.nodes.secao.create(
    { id, nivel, titulo: "" },
    filhos.length > 0 ? filhos : schema.nodes.paragraph.create(),
  );
}

describe("numerarDocumentoProseMirror", () => {
  it("numera seções de nível 1 na ordem em que aparecem no documento", () => {
    const doc = schema.nodes.doc.create(null, [criarSecao("s1", 1), criarSecao("s2", 1)]);

    const numeracao = numerarDocumentoProseMirror(doc);

    expect(numeracao.get("s1")).toBe("1");
    expect(numeracao.get("s2")).toBe("2");
  });

  it("numera subseção aninhada (nó secao dentro de outro secao)", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.secao.create({ id: "s1", nivel: 1, titulo: "" }, [
        schema.nodes.paragraph.create(),
        criarSecao("s1-1", 2),
      ]),
      criarSecao("s2", 1),
    ]);

    const numeracao = numerarDocumentoProseMirror(doc);

    expect(numeracao.get("s1")).toBe("1");
    expect(numeracao.get("s1-1")).toBe("1.1");
    expect(numeracao.get("s2")).toBe("2");
  });

  it("não numera uma seção sem id, sem lançar", () => {
    const semId = schema.nodes.secao.create(null, schema.nodes.paragraph.create());
    const doc = schema.nodes.doc.create(null, [criarSecao("s1", 1), semId]);

    expect(() => numerarDocumentoProseMirror(doc)).not.toThrow();
    const numeracao = numerarDocumentoProseMirror(doc);
    expect(numeracao.get("s1")).toBe("1");
    expect(numeracao.size).toBe(1);
  });
});
