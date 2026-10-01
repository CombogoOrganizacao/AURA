import { getSchema } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { Documento } from "./nodes/documento";
import { Secao } from "./nodes/section";
import { numerarDocumentoProseMirror } from "./numbering";
import { inserirSecao } from "./novaSecao";

// Mesma técnica de reorder.test.ts: só `EditorState`, sem DOM.
const schema = getSchema([Documento, Paragraph, Text, Secao]);

function secao(id: string, nivel = 1, texto = "") {
  return schema.nodes.secao.create(
    { id, nivel, titulo: "" },
    schema.nodes.paragraph.create(null, texto ? schema.text(texto) : undefined),
  );
}

// Estado com o cursor dentro da seção `idCursor`.
function estadoCom(idCursor: string, ...secoes: ReturnType<typeof secao>[]) {
  const doc = schema.nodes.doc.create(null, secoes);
  let pos = 0;
  doc.forEach((no, offset) => {
    if (no.attrs.id === idCursor) pos = offset + 2;
  });
  return EditorState.create({ schema, doc, selection: TextSelection.create(doc, pos) });
}

function numeros(estado: EditorState) {
  const numeracao = numerarDocumentoProseMirror(estado.doc);
  const saida: string[] = [];
  estado.doc.forEach((no) => saida.push(`${no.attrs.id}=${numeracao.get(no.attrs.id)}`));
  return saida;
}

function aplicar(estado: EditorState, subsecao: boolean) {
  const tr = estado.tr;
  inserirSecao(tr, { id: "nova", subsecao });
  return estado.apply(tr);
}

describe("inserirSecao", () => {
  it("nova seção depois da única: vira 2", () => {
    const depois = aplicar(estadoCom("s1", secao("s1")), false);
    expect(numeros(depois)).toEqual(["s1=1", "nova=2"]);
  });

  it("nova subseção: vira 1.1", () => {
    const depois = aplicar(estadoCom("s1", secao("s1")), true);
    expect(numeros(depois)).toEqual(["s1=1", "nova=1.1"]);
  });

  it("nova seção com o cursor em 2 cai depois das subseções de 2", () => {
    const antes = estadoCom("s2", secao("s1"), secao("s2"), secao("s21", 2), secao("s3"));
    expect(numeros(aplicar(antes, false))).toEqual(["s1=1", "s2=2", "s21=2.1", "nova=3", "s3=4"]);
  });

  it("nova subseção com o cursor em 2 vira a última subseção de 2", () => {
    const antes = estadoCom("s2", secao("s1"), secao("s2"), secao("s21", 2), secao("s3"));
    expect(numeros(aplicar(antes, true))).toEqual(["s1=1", "s2=2", "s21=2.1", "nova=2.2", "s3=3"]);
  });

  it("subseção de uma seção de nível 3 continua no nível 3", () => {
    const antes = estadoCom("c", secao("a"), secao("b", 2), secao("c", 3));
    expect(numeros(aplicar(antes, true))).toEqual(["a=1", "b=1.1", "c=1.1.1", "nova=1.1.2"]);
  });

  it("deixa o cursor no parágrafo da seção nova", () => {
    const depois = aplicar(estadoCom("s1", secao("s1", 1, "Texto")), false);
    const { $from } = depois.selection;
    expect($from.parent.type.name).toBe("paragraph");
    expect($from.node(1).attrs.id).toBe("nova");
  });
});
