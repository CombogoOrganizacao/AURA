import { describe, expect, it } from "vitest";

import { fromDocumento, toDocumento } from "./serialize";
import type { Secao } from "./types";

describe("fromDocumento / toDocumento", () => {
  it("faz o round-trip de um documento com duas seções e confere igualdade estrutural", () => {
    const secoes: Secao[] = [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "Introdução",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Texto da introdução." }] }],
      },
      {
        id: "s2",
        ordem: 1,
        nivel: 1,
        titulo: "Metodologia",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Texto da metodologia." }] },
        ],
      },
    ];

    const doc = fromDocumento(secoes);
    const reconstruido = toDocumento(doc);

    expect(reconstruido).toEqual(secoes);
  });

  it("reconstrói subseção aninhada a partir do nível, na ordem de leitura", () => {
    const secoes: Secao[] = [
      { id: "s1", ordem: 0, nivel: 1, titulo: "Introdução", content: [] },
      { id: "s1-1", ordem: 1, nivel: 2, titulo: "Objetivos", content: [] },
      { id: "s2", ordem: 2, nivel: 1, titulo: "Metodologia", content: [] },
    ];

    const doc = fromDocumento(secoes);

    // s1-1 vira filha de s1 na árvore; s2 volta a ser irmã de s1 na raiz —
    // porque nível 1 fecha qualquer nível mais fundo aberto na pilha.
    expect(doc.content).toHaveLength(2);
    expect(doc.content?.[0]).toMatchObject({ attrs: { id: "s1" } });
    expect(doc.content?.[0]?.content).toHaveLength(1);
    expect(doc.content?.[0]?.content?.[0]).toMatchObject({ attrs: { id: "s1-1" } });
    expect(doc.content?.[1]).toMatchObject({ attrs: { id: "s2" } });

    expect(toDocumento(doc)).toEqual(secoes);
  });

  it("trata parágrafo vazio sem inventar texto", () => {
    const secoes: Secao[] = [
      { id: "s1", ordem: 0, nivel: 1, titulo: "Introdução", content: [{ type: "paragraph" }] },
    ];

    const doc = fromDocumento(secoes);
    expect(doc.content?.[0]?.content?.[0]).toEqual({ type: "paragraph" });
    expect(toDocumento(doc)).toEqual(secoes);
  });

  it("recusa nó de conteúdo fora da lista fechada", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "secao",
          attrs: { id: "s1", nivel: 1, titulo: "Introdução" },
          content: [{ type: "heading" }],
        },
      ],
    };

    expect(() => toDocumento(doc)).toThrow(/não suportado/);
  });

  it("recusa seção sem id", () => {
    const doc = {
      type: "doc",
      content: [{ type: "secao", attrs: { nivel: 1, titulo: "Introdução" }, content: [] }],
    };

    expect(() => toDocumento(doc)).toThrow(/sem id/);
  });
});
