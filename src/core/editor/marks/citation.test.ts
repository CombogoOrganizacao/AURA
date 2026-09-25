import { getSchema } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";

import { fromDocumento, toDocumento } from "../../document/serialize";
import type { AtributosCitacao, Secao } from "../../document/types";
import { Documento } from "../nodes/documento";
import { CitacaoLonga } from "../nodes/longQuote";
import { Secao as SecaoNode } from "../nodes/section";
import { Citacao, lerAtributosCitacao } from "./citation";
import { Italico } from "./italico";
import { Negrito } from "./negrito";

// Sem DOM: `getSchema` monta só o Schema do ProseMirror (técnica de
// section.test.ts). O caminho testado é o que o editor faz de verdade:
// canônico → JSON do TipTap → nó do ProseMirror → JSON → canônico.
const schema = getSchema([
  Documento,
  Paragraph,
  Text,
  SecaoNode,
  CitacaoLonga,
  Negrito,
  Italico,
  Citacao,
]);

const INDIRETA: AtributosCitacao = {
  refId: "ref-freire",
  modo: "indireta",
  pagina: null,
  apud: null,
};

function secaoCom(content: Secao["content"]): Secao[] {
  return [{ id: "s1", ordem: 0, nivel: 1, titulo: "Introdução", content }];
}

// Canônico → editor → canônico, passando pelo schema real.
function idaEVolta(secoes: Secao[]): Secao[] {
  const no = schema.nodeFromJSON(fromDocumento(secoes));
  no.check();
  return toDocumento(no.toJSON());
}

describe("marca citacao — guarda a ligação, não o texto formatado (4.8)", () => {
  it("a marca tem refId, modo, página e apud — e nada de chamada pronta", () => {
    const marca = schema.marks.citacao.create(INDIRETA);

    expect(marca.attrs).toEqual(INDIRETA);
    // Nenhum atributo guarda o que a chamada vai dizer: "(Freire, 1987)" é
    // sintetizado no 4.9 a partir da referência.
    expect(Object.keys(marca.attrs).sort()).toEqual(["apud", "modo", "pagina", "refId"]);
    expect(JSON.stringify(marca.toJSON())).not.toMatch(/\(|Freire|1987/);
  });

  it("o texto marcado é só o texto do aluno", () => {
    const secoes = secaoCom([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "A educação é um ato político, " },
          {
            type: "text",
            text: "ninguém educa ninguém",
            marks: [
              {
                type: "citacao",
                attrs: { refId: "ref-freire", modo: "direta_curta", pagina: "68", apud: null },
              },
            ],
          },
          { type: "text", text: "." },
        ],
      },
    ]);

    const volta = idaEVolta(secoes);

    expect(volta).toEqual(secoes);
    const [paragrafo] = volta[0].content;
    // Nem aspas nem chamada entram no texto: quem as acrescenta é o
    // exportador (docs/schema-tiptap.md §5.2).
    expect(paragrafo.type === "paragraph" && paragrafo.content?.map((t) => (t.type === "text" ? t.text : "")).join("")).toBe(
      "A educação é um ato político, ninguém educa ninguém.",
    );
  });

  it("sobrevive ao round-trip junto com negrito e itálico", () => {
    const secoes = secaoCom([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "trecho",
            marks: [{ type: "italico" }, { type: "citacao", attrs: INDIRETA }],
          },
        ],
      },
    ]);

    expect(idaEVolta(secoes)).toEqual(secoes);
  });

  it("apud guarda a fonte original em campos, e a referência é a consultada", () => {
    const attrs: AtributosCitacao = {
      refId: "ref-silva",
      modo: "indireta",
      pagina: "12",
      apud: {
        author: [{ family: "Freire", given: "Paulo" }],
        issued: { "date-parts": [[1987]] },
        pagina: "68",
      },
    };
    const secoes = secaoCom([
      {
        type: "paragraph",
        content: [{ type: "text", text: "paráfrase", marks: [{ type: "citacao", attrs }] }],
      },
    ]);

    expect(idaEVolta(secoes)).toEqual(secoes);
  });

  it("digitar logo depois da citação não estende a marca", () => {
    expect(schema.marks.citacao.spec.inclusive).toBe(false);
  });

  it("um trecho aponta para uma referência só", () => {
    const primeira = schema.marks.citacao.create(INDIRETA);
    const segunda = schema.marks.citacao.create({ ...INDIRETA, refId: "ref-outra" });

    // Aplicar a segunda substitui a primeira, não empilha.
    expect(segunda.addToSet([primeira])).toEqual([segunda]);
  });
});

describe("marca citacao — atributo fora de forma é recusado, não consertado", () => {
  it.each([
    ["sem refId", { ...INDIRETA, refId: null }],
    ["refId vazio", { ...INDIRETA, refId: "" }],
    ["modo desconhecido", { ...INDIRETA, modo: "longa" }],
    ["página que não é texto", { ...INDIRETA, pagina: 45 }],
    ["apud sem autoria", { ...INDIRETA, apud: { author: [], pagina: null } }],
    ["apud com nome vazio", { ...INDIRETA, apud: { author: [{ family: "" }], pagina: null } }],
    [
      "apud com data inválida",
      { ...INDIRETA, apud: { author: [{ family: "Freire" }], issued: { "date-parts": [["x"]] } } },
    ],
  ])("%s", (_, attrs) => {
    expect(lerAtributosCitacao(attrs)).toBeNull();
  });

  it("a serialização lança em vez de gravar uma ligação quebrada", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "secao",
          attrs: { id: "s1", nivel: 1, titulo: "T" },
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "x",
                  marks: [{ type: "citacao", attrs: { refId: null, modo: "indireta" } }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(() => toDocumento(json)).toThrow(/citação/);
  });

  it("chaves estranhas no apud não passam adiante", () => {
    const lido = lerAtributosCitacao({
      ...INDIRETA,
      apud: {
        author: [{ family: "Freire", extra: "x" }],
        issued: { "date-parts": [[1987]], extra: "y" },
        pagina: null,
      },
    });

    expect(lido?.apud).toEqual({
      author: [{ family: "Freire" }],
      issued: { "date-parts": [[1987]] },
      pagina: null,
    });
  });
});
