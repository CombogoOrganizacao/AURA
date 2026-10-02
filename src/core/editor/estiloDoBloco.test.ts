import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import type { Node as NoProseMirror } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { estiloDaSelecao } from "./estiloDoBloco";
import { Citacao } from "./marks/citation";
import { Italico } from "./marks/italico";
import { Negrito } from "./marks/negrito";
import { CitacaoLonga } from "./nodes/longQuote";
import { CelulaTabela, LinhaTabela, Tabela } from "./nodes/table";

const schema = getSchema([
  Document,
  Paragraph,
  Text,
  CitacaoLonga,
  Negrito,
  Italico,
  Citacao,
  Tabela,
  LinhaTabela,
  CelulaTabela,
]);
const { paragraph, citacao_longa, tabela, linha_tabela, celula_tabela } = schema.nodes;

const doc = schema.nodes.doc.create(null, [
  paragraph.create(null, schema.text("Corpo")), // 0..7
  citacao_longa.create(null, schema.text("Citação")), // 7..16
  tabela.create(null, linha_tabela.create(null, celula_tabela.create(null, schema.text("Célula")))),
]);

// Posição de texto dentro do n-ésimo bloco de texto do documento.
function dentroDo(indice: number, documento: NoProseMirror = doc): number {
  let achada = -1;
  let n = 0;
  documento.descendants((no, pos) => {
    if (achada >= 0) return false;
    if (no.isTextblock) {
      if (n === indice) achada = pos + 1;
      n++;
    }
    return true;
  });
  return achada;
}

function comCursor(de: number, ate = de) {
  return EditorState.create({ schema, doc, selection: TextSelection.create(doc, de, ate) });
}

describe("estiloDaSelecao", () => {
  it("parágrafo de corpo: 12 pt, da NBR 14724", () => {
    expect(estiloDaSelecao(comCursor(dentroDo(0)))).toEqual({ estilo: "corpo", tamanhoPt: 12 });
  });

  it("citação longa: o tamanho menor, 10 pt", () => {
    expect(estiloDaSelecao(comCursor(dentroDo(1)))).toEqual({
      estilo: "citacao_longa",
      tamanhoPt: 10,
    });
  });

  it("célula de tabela: 12 pt, e não troca de estilo", () => {
    expect(estiloDaSelecao(comCursor(dentroDo(2)))).toEqual({ estilo: "celula", tamanhoPt: 12 });
  });

  it("seleção de corpo até citação: estilo misto, sem tamanho único", () => {
    expect(estiloDaSelecao(comCursor(dentroDo(0), dentroDo(1) + 2))).toEqual({
      estilo: "misto",
      tamanhoPt: null,
    });
  });

  it("tabela selecionada inteira: nenhum estilo de texto", () => {
    let posTabela = 0;
    doc.forEach((no, offset) => {
      if (no.type === tabela) posTabela = offset;
    });
    const estado = EditorState.create({
      schema,
      doc,
      selection: NodeSelection.create(doc, posTabela),
    });
    expect(estiloDaSelecao(estado)).toEqual({ estilo: "outro", tamanhoPt: null });
  });
});
