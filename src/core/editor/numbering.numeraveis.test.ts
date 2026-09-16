import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";

import { Figura } from "./nodes/figure";
import { Secao } from "./nodes/section";
import { CelulaTabela, LinhaTabela, Tabela } from "./nodes/table";
import { numerarNumeraveisProseMirror } from "./numbering";

const schema = getSchema([
  Document,
  Paragraph,
  Text,
  Secao,
  Figura,
  Tabela,
  LinhaTabela,
  CelulaTabela,
]);

function figura(id: string) {
  return schema.nodes.figura.create({ id });
}

function tabela(id: string) {
  return schema.nodes.tabela.create({ id }, [
    schema.nodes.linha_tabela.create(null, [schema.nodes.celula_tabela.create()]),
  ]);
}

function secao(id: string, filhos: ReturnType<typeof figura>[]) {
  return schema.nodes.secao.create({ id, nivel: 1, titulo: "" }, filhos);
}

// Esta é a numeração que a pessoa vê enquanto digita — vem do documento
// ProseMirror, sem passar pelo formato canônico. O que este arquivo prova é
// que ela acompanha a edição; que ela CONCORDA com a do `.docx` é garantido
// por construção, não por teste: as duas entradas terminam em
// `numerarPorOrdem()` (src/core/document/numbering.ts).
describe("numerarNumeraveisProseMirror (passo 3.6.3)", () => {
  it("numera na ordem de leitura, atravessando seções", () => {
    const doc = schema.nodes.doc.create(null, [
      secao("s1", [figura("f1"), figura("f2")]),
      secao("s2", [figura("f3")]),
    ]);

    const numeracao = numerarNumeraveisProseMirror(doc, "figura");

    expect(numeracao.get("f1")).toBe(1);
    expect(numeracao.get("f2")).toBe(2);
    expect(numeracao.get("f3")).toBe(3);
  });

  it("inserir uma figura no meio renumera as seguintes", () => {
    const antes = schema.nodes.doc.create(null, [secao("s1", [figura("f1"), figura("f2")])]);
    expect(numerarNumeraveisProseMirror(antes, "figura").get("f2")).toBe(2);

    const depois = schema.nodes.doc.create(null, [
      secao("s1", [figura("f1"), figura("nova"), figura("f2")]),
    ]);
    const numeracao = numerarNumeraveisProseMirror(depois, "figura");

    expect(numeracao.get("nova")).toBe(2);
    expect(numeracao.get("f2")).toBe(3);
  });

  it("figura e tabela têm contagens independentes", () => {
    const doc = schema.nodes.doc.create(null, [
      secao("s1", [tabela("t1"), figura("f1"), tabela("t2")]),
    ]);

    expect(numerarNumeraveisProseMirror(doc, "figura").get("f1")).toBe(1);
    expect(numerarNumeraveisProseMirror(doc, "tabela").get("t2")).toBe(2);
  });

  it("ignora figura sem id em vez de quebrar a contagem das outras", () => {
    const doc = schema.nodes.doc.create(null, [
      secao("s1", [figura("f1"), schema.nodes.figura.create(), figura("f2")]),
    ]);

    const numeracao = numerarNumeraveisProseMirror(doc, "figura");

    expect(numeracao.size).toBe(2);
    expect(numeracao.get("f2")).toBe(2);
  });

  it("documento sem figura nenhuma devolve mapa vazio", () => {
    const doc = schema.nodes.doc.create(null, [secao("s1", [])]);

    expect(numerarNumeraveisProseMirror(doc, "figura").size).toBe(0);
  });
});
