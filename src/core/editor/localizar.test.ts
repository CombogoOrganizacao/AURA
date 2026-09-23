import { getSchema } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";

import { fromDocumento } from "../document/serialize";
import type { Secao } from "../document/types";
import { alvoNoEditor } from "./localizar";
import { Citacao } from "./marks/citation";
import { Italico } from "./marks/italico";
import { Negrito } from "./marks/negrito";
import { Documento } from "./nodes/documento";
import { Figura } from "./nodes/figure";
import { CitacaoLonga } from "./nodes/longQuote";
import { Secao as SecaoNode } from "./nodes/section";

// Passo 5.2.3 — o local de um achado vira posição no editor. Parte do
// formato canônico e passa por `fromDocumento()`, a mesma conversão que o
// editor usa ao carregar: o índice `no` do achado e a árvore do editor têm
// de concordar.

const schema = getSchema([
  Documento,
  Paragraph,
  Text,
  SecaoNode,
  CitacaoLonga,
  Figura,
  Negrito,
  Italico,
  Citacao,
]);

const SECOES: Secao[] = [
  {
    id: "s1",
    ordem: 0,
    nivel: 1,
    titulo: "Introdução",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Primeiro parágrafo." }] },
      { type: "figura", id: "f1", legenda: "Fluxo", fonte: "Autora", imagem: null },
    ],
  },
  // Subseção: vira um `secao` aninhado dentro de s1 no editor.
  {
    id: "s1-1",
    ordem: 1,
    nivel: 2,
    titulo: "Contexto",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Texto da subseção." }] }],
  },
  {
    id: "s2",
    ordem: 2,
    nivel: 1,
    titulo: "Conclusão",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "A educação liberta." }] },
      {
        type: "citacao_longa",
        refId: null,
        pagina: "",
        content: [{ type: "text", text: "Longa." }],
      },
    ],
  },
];

const doc = schema.nodeFromJSON(fromDocumento(SECOES));

function textoEntre(de: number, ate: number): string {
  return doc.textBetween(de, ate);
}

describe("alvoNoEditor", () => {
  it("trecho num parágrafo: a seleção cobre exatamente o texto do achado", () => {
    const alvo = alvoNoEditor(doc, {
      tipo: "bloco",
      onde: { tipo: "secao", id: "s2" },
      no: 0,
      trecho: { inicio: 2, fim: 10 },
    });
    expect(alvo?.alvo).toBe("trecho");
    if (alvo?.alvo === "trecho") expect(textoEntre(alvo.de, alvo.ate)).toBe("educação");
  });

  it("nó sem trecho: aponta o início do nó (a figura, aqui)", () => {
    const alvo = alvoNoEditor(doc, { tipo: "bloco", onde: { tipo: "secao", id: "s1" }, no: 1 });
    expect(alvo?.alvo).toBe("no");
    if (alvo?.alvo === "no") expect(doc.nodeAt(alvo.posicao)?.type.name).toBe("figura");
  });

  it("o índice conta só blocos: a subseção aninhada não desloca a contagem", () => {
    // Em s1, a subseção s1-1 vem depois da figura no editor. O nó 1 de s1
    // continua sendo a figura, e o nó 0 de s1-1 é o parágrafo dela.
    const alvo = alvoNoEditor(doc, {
      tipo: "bloco",
      onde: { tipo: "secao", id: "s1-1" },
      no: 0,
      trecho: { inicio: 0, fim: 5 },
    });
    if (alvo?.alvo === "trecho") expect(textoEntre(alvo.de, alvo.ate)).toBe("Texto");
    else throw new Error("esperava um trecho");
  });

  it("citação longa com trecho também seleciona o texto", () => {
    const alvo = alvoNoEditor(doc, {
      tipo: "bloco",
      onde: { tipo: "secao", id: "s2" },
      no: 1,
      trecho: { inicio: 0, fim: 5 },
    });
    if (alvo?.alvo === "trecho") expect(textoEntre(alvo.de, alvo.ate)).toBe("Longa");
    else throw new Error("esperava um trecho");
  });

  it("achado do título: aponta a seção", () => {
    const alvo = alvoNoEditor(doc, { tipo: "bloco", onde: { tipo: "secao", id: "s2" } });
    expect(alvo?.alvo).toBe("secao");
    if (alvo?.alvo === "secao") expect(doc.nodeAt(alvo.posicao)?.attrs.id).toBe("s2");
  });

  it("trecho maior que o texto (editado depois da conferência) fica dentro do nó", () => {
    const alvo = alvoNoEditor(doc, {
      tipo: "bloco",
      onde: { tipo: "secao", id: "s2" },
      no: 0,
      trecho: { inicio: 2, fim: 999 },
    });
    if (alvo?.alvo === "trecho") expect(textoEntre(alvo.de, alvo.ate)).toBe("educação liberta.");
    else throw new Error("esperava um trecho");
  });

  it.each([
    ["metadado", { tipo: "metadado", campo: "resumo" } as const],
    ["referência", { tipo: "referencia", refId: "r1" } as const],
    ["documento", { tipo: "documento" } as const],
    [
      "apêndice (sem tela de edição)",
      { tipo: "bloco", onde: { tipo: "apendice", id: "a1" } } as const,
    ],
    [
      "seção que não existe mais",
      { tipo: "bloco", onde: { tipo: "secao", id: "sumiu" }, no: 0 } as const,
    ],
    [
      "nó que não existe mais",
      { tipo: "bloco", onde: { tipo: "secao", id: "s2" }, no: 9 } as const,
    ],
  ])("%s: fora do editor, null", (_, local) => {
    expect(alvoNoEditor(doc, local)).toBeNull();
  });
});
