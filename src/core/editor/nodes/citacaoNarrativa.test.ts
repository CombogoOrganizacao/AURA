import { getSchema } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { fromDocumento, toDocumento } from "../../document/serialize";
import type { Secao } from "../../document/types";
import { Citacao } from "../marks/citation";
import { Italico } from "../marks/italico";
import { Negrito } from "../marks/negrito";
import {
  CitacaoNarrativa,
  inserirCitacaoNarrativa,
  podeInserirCitacaoNarrativa,
} from "./citacaoNarrativa";
import { Documento } from "./documento";
import { CitacaoLonga } from "./longQuote";
import { Secao as SecaoNode } from "./section";
import { CelulaTabela, LinhaTabela, Tabela } from "./table";

// Citação com o autor na frase — NBR 10520:2023 §6.1.4. Sem DOM, pelo mesmo
// caminho de citation.test.ts: canônico → JSON do TipTap → nó do ProseMirror
// → JSON → canônico.
const schema = getSchema([
  Documento,
  Paragraph,
  Text,
  SecaoNode,
  CitacaoLonga,
  Tabela,
  LinhaTabela,
  CelulaTabela,
  CitacaoNarrativa,
  Negrito,
  Italico,
  Citacao,
]);

function secaoCom(content: Secao["content"]): Secao[] {
  return [{ id: "s1", ordem: 0, nivel: 1, titulo: "Introdução", content }];
}

function idaEVolta(secoes: Secao[]): Secao[] {
  const no = schema.nodeFromJSON(fromDocumento(secoes));
  no.check();
  return toDocumento(no.toJSON());
}

const FRASE = secaoCom([
  {
    type: "paragraph",
    content: [
      { type: "citacao_narrativa", refId: "oliveira", pagina: "146" },
      { type: "text", text: " dizem que a relação é muito clara." },
    ],
  },
]);

describe("nó citacao_narrativa (10520 §6.1.4)", () => {
  it("vai e volta pelo editor guardando só a ligação", () => {
    expect(idaEVolta(FRASE)).toEqual(FRASE);
    // Nada do que a frase mostra ("Oliveira e Leonardos (1943...") fica no dado.
    expect(JSON.stringify(FRASE)).not.toMatch(/Leonardos|1943/);
  });

  it("grifo e tradução vão e voltam; sem eles, os campos não aparecem", () => {
    const comAcrescimos = secaoCom([
      {
        type: "paragraph",
        content: [
          {
            type: "citacao_narrativa",
            refId: "souto",
            pagina: "46",
            grifoNosso: true,
            traducaoNossa: true,
          },
        ],
      },
    ]);
    expect(idaEVolta(comAcrescimos)).toEqual(comAcrescimos);
    expect(JSON.stringify(idaEVolta(FRASE))).not.toMatch(/grifoNosso|traducaoNossa/);
  });

  it("recusa nó sem refId, em vez de ligar a frase a uma obra adivinhada", () => {
    const doc = fromDocumento(FRASE);
    const paragrafo = doc.content![0].content![0];
    paragrafo.content![0].attrs = { refId: null, pagina: null };
    expect(() => toDocumento(doc)).toThrow(/autor na frase/);
  });

  it("não aceita negrito, itálico nem a marca de citação", () => {
    expect(schema.nodes.citacao_narrativa.allowsMarkType(schema.marks.negrito)).toBe(false);
    expect(schema.nodes.citacao_narrativa.allowsMarkType(schema.marks.citacao)).toBe(false);
  });
});

describe("inserirCitacaoNarrativa", () => {
  const ATTRS = { refId: "freire", pagina: "68", grifoNosso: false, traducaoNossa: false };

  function estadoCom(secoes: Secao[], posicao: number) {
    const doc = schema.nodeFromJSON(fromDocumento(secoes));
    return EditorState.create({
      schema,
      doc,
      selection: TextSelection.create(doc, posicao),
    });
  }

  it("entra no cursor e deixa o cursor logo depois, para continuar a frase", () => {
    const secoes = secaoCom([
      { type: "paragraph", content: [{ type: "text", text: "Segundo , a educação." }] },
    ]);
    // 1 (secao) + 1 (paragraph) + "Segundo ".length
    const posicao = 2 + "Segundo ".length;
    const estado = estadoCom(secoes, posicao);
    expect(podeInserirCitacaoNarrativa(estado)).toBe(true);

    const tr = estado.tr;
    expect(inserirCitacaoNarrativa(tr, ATTRS)).toBe(true);
    const depois = estado.apply(tr);
    expect(depois.selection.from).toBe(posicao + 1);

    const [secao] = toDocumento(depois.doc.toJSON());
    expect(secao.content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Segundo " },
        { type: "citacao_narrativa", refId: "freire", pagina: "68" },
        { type: "text", text: ", a educação." },
      ],
    });
  });

  it("não entra em célula de tabela, que só aceita texto", () => {
    const secoes = secaoCom([
      {
        type: "tabela",
        id: "t1",
        legenda: "",
        fonte: "",
        linhas: [{ celulas: [{ cabecalho: false, content: [{ type: "text", text: "x" }] }] }],
      },
    ]);
    // secao(1) tabela(1) linha(1) celula(1) → texto começa em 4
    const estado = estadoCom(secoes, 5);
    expect(podeInserirCitacaoNarrativa(estado)).toBe(false);
    expect(inserirCitacaoNarrativa(estado.tr, ATTRS)).toBe(false);
  });
});
