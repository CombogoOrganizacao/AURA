import { getSchema } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { apagarSecao, podeApagarSecao, secaoDoCursor, secaoPorId } from "./apagarSecao";
import { Documento } from "./nodes/documento";
import { Secao } from "./nodes/section";
import { numerarDocumentoProseMirror } from "./numbering";

// Mesma técnica de novaSecao.test.ts: só `EditorState`, sem DOM.
const schema = getSchema([Documento, Paragraph, Text, Secao]);

function secao(id: string, nivel = 1, texto = "", titulo = "") {
  return schema.nodes.secao.create(
    { id, nivel, titulo },
    schema.nodes.paragraph.create(null, texto ? schema.text(texto) : undefined),
  );
}

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

function apagar(estado: EditorState, id: string) {
  const tr = estado.tr;
  const apagou = apagarSecao(tr, id);
  return { apagou, depois: estado.apply(tr) };
}

describe("apagarSecao", () => {
  it("tira a seção e renumera as seguintes", () => {
    const antes = estadoCom("s1", secao("s1"), secao("s2"), secao("s3"));
    const { apagou, depois } = apagar(antes, "s2");
    expect(apagou).toBe(true);
    expect(numeros(depois)).toEqual(["s1=1", "s3=2"]);
  });

  it("não leva as subseções junto: elas passam para a seção anterior", () => {
    const antes = estadoCom("s1", secao("s1"), secao("s2"), secao("s21", 2), secao("s3"));
    expect(numeros(apagar(antes, "s2").depois)).toEqual(["s1=1", "s21=1.1", "s3=2"]);
  });

  it("nunca apaga a última seção que sobrou", () => {
    const antes = estadoCom("s1", secao("s1", 1, "Texto"));
    expect(podeApagarSecao(antes.doc)).toBe(false);
    const { apagou, depois } = apagar(antes, "s1");
    expect(apagou).toBe(false);
    expect(depois.doc.eq(antes.doc)).toBe(true);
  });

  it("id que não existe: não mexe em nada", () => {
    const antes = estadoCom("s1", secao("s1"), secao("s2"));
    expect(apagar(antes, "nao-existe").apagou).toBe(false);
  });

  it("apagando a última, o cursor vai para o fim da anterior", () => {
    const antes = estadoCom("s2", secao("s1", 1, "Fim"), secao("s2"));
    const { depois } = apagar(antes, "s2");
    expect(depois.selection.$from.node(1).attrs.id).toBe("s1");
  });

  it("apagando do meio, o cursor vai para a seção que ocupou o lugar", () => {
    const antes = estadoCom("s2", secao("s1"), secao("s2"), secao("s3"));
    const { depois } = apagar(antes, "s2");
    expect(depois.selection.$from.node(1).attrs.id).toBe("s3");
  });
});

describe("descrição da seção, para decidir se pede confirmação", () => {
  it("seção recém-criada (sem título, parágrafo vazio) não tem conteúdo", () => {
    const estado = estadoCom("s2", secao("s1"), secao("s2"));
    expect(secaoDoCursor(estado)).toEqual({ id: "s2", titulo: "", temConteudo: false });
  });

  it("título ou texto contam como conteúdo", () => {
    const estado = estadoCom("s1", secao("s1", 1, "", "Introdução"), secao("s2", 1, "Texto"));
    expect(secaoPorId(estado.doc, "s1")?.temConteudo).toBe(true);
    expect(secaoPorId(estado.doc, "s2")?.temConteudo).toBe(true);
  });
});
