import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { Secao } from "./nodes/section";
import { moverSecaoDeTopo } from "./reorder";

// Mesma técnica de section.test.ts/numbering.test.ts: só `EditorState`
// (nem `EditorView`, nem DOM) — o que mantém este teste dentro de src/core.
const schema = getSchema([Document, Paragraph, Text, Secao]);

function secao(id: string, texto = "") {
  return schema.nodes.secao.create(
    { id, nivel: 1, titulo: "" },
    schema.nodes.paragraph.create(null, texto ? schema.text(texto) : undefined),
  );
}

function idsDoDoc(doc: ReturnType<typeof schema.nodeFromJSON>): string[] {
  const ids: string[] = [];
  doc.forEach((no) => ids.push(no.attrs.id as string));
  return ids;
}

function estadoCom(...secoes: ReturnType<typeof secao>[]) {
  return EditorState.create({ schema, doc: schema.nodes.doc.create(null, secoes) });
}

describe("moverSecaoDeTopo", () => {
  it("move a seção 3 pra antes da seção 2 (o cenário do critério de aceite)", () => {
    const estado = estadoCom(secao("s1"), secao("s2"), secao("s3"));
    const tr = estado.tr;

    const aplicado = moverSecaoDeTopo(tr, "s3", "s2", false);

    expect(aplicado).toBe(true);
    expect(idsDoDoc(estado.apply(tr).doc)).toEqual(["s1", "s3", "s2"]);
  });

  it("move pra depois do destino quando inserirDepois é true", () => {
    const estado = estadoCom(secao("s1"), secao("s2"), secao("s3"));
    const tr = estado.tr;

    moverSecaoDeTopo(tr, "s1", "s2", true);

    expect(idsDoDoc(estado.apply(tr).doc)).toEqual(["s2", "s1", "s3"]);
  });

  it("preserva o conteúdo (parágrafo com texto) da seção movida", () => {
    const estado = estadoCom(secao("s1", "Primeiro"), secao("s2", "Segundo"));
    const tr = estado.tr;

    moverSecaoDeTopo(tr, "s2", "s1", false);

    const novoDoc = estado.apply(tr).doc;
    expect(idsDoDoc(novoDoc)).toEqual(["s2", "s1"]);
    expect(novoDoc.toJSON().content[0].content[0].content[0].text).toBe("Segundo");
    expect(novoDoc.toJSON().content[1].content[0].content[0].text).toBe("Primeiro");
  });

  it("não faz nada e devolve false se idOrigem não existe", () => {
    const estado = estadoCom(secao("s1"), secao("s2"));
    const tr = estado.tr;

    const aplicado = moverSecaoDeTopo(tr, "fantasma", "s2", false);

    expect(aplicado).toBe(false);
    expect(tr.docChanged).toBe(false);
  });

  it("não faz nada e devolve false se idDestino não existe", () => {
    const estado = estadoCom(secao("s1"), secao("s2"));
    const tr = estado.tr;

    const aplicado = moverSecaoDeTopo(tr, "s1", "fantasma", false);

    expect(aplicado).toBe(false);
    expect(tr.docChanged).toBe(false);
  });

  it("não faz nada e devolve false se origem e destino forem a mesma seção", () => {
    const estado = estadoCom(secao("s1"), secao("s2"));
    const tr = estado.tr;

    const aplicado = moverSecaoDeTopo(tr, "s1", "s1", false);

    expect(aplicado).toBe(false);
    expect(tr.docChanged).toBe(false);
  });
});
