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

  it("faz o round-trip de texto com marca negrito e itálico (passo 2.5)", () => {
    const secoes: Secao[] = [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "Introdução",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "normal " },
              { type: "text", text: "negrito", marks: [{ type: "negrito" }] },
              { type: "text", text: " " },
              {
                type: "text",
                text: "negrito e itálico",
                marks: [{ type: "negrito" }, { type: "italico" }],
              },
            ],
          },
        ],
      },
    ];

    const doc = fromDocumento(secoes);
    expect(toDocumento(doc)).toEqual(secoes);
  });

  it("faz o round-trip de citação longa com refId e pagina (passo 3.4.1)", () => {
    const secoes: Secao[] = [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "Revisão de literatura",
        content: [
          {
            type: "citacao_longa",
            refId: "ref-1",
            pagina: "42",
            content: [{ type: "text", text: "Trecho citado com mais de três linhas." }],
          },
        ],
      },
    ];

    const doc = fromDocumento(secoes);
    expect(doc.content?.[0]?.content?.[0]).toEqual({
      type: "citacao_longa",
      attrs: { refId: "ref-1", pagina: "42" },
      content: [{ type: "text", text: "Trecho citado com mais de três linhas." }],
    });
    expect(toDocumento(doc)).toEqual(secoes);
  });

  it("citação longa sem refId/pagina preenchidos (sem UI pra isso ainda) faz round-trip com os defaults", () => {
    const secoes: Secao[] = [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "Revisão de literatura",
        content: [{ type: "citacao_longa", refId: null, pagina: "", content: [] }],
      },
    ];

    const doc = fromDocumento(secoes);
    expect(doc.content?.[0]?.content?.[0]).toEqual({
      type: "citacao_longa",
      attrs: { refId: null, pagina: "" },
    });
    expect(toDocumento(doc)).toEqual([
      { ...secoes[0], content: [{ type: "citacao_longa", refId: null, pagina: "" }] },
    ]);
  });

  it("recusa marca fora da lista fechada", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "secao",
          attrs: { id: "s1", nivel: 1, titulo: "Introdução" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "sublinhado", marks: [{ type: "sublinhado" }] }],
            },
          ],
        },
      ],
    };

    expect(() => toDocumento(doc)).toThrow(/Marca ainda não suportada/);
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
  // Passo 3.6.3: figura e tabela entram no union fechado, então o round-trip
  // (o "maior risco remanescente" que a Fase 1 existe pra provar) precisa
  // cobri-las também — inclusive a estrutura aninhada linha/célula, que é o
  // único conteúdo do schema com dois níveis dentro de um bloco.
  it("faz o round-trip de uma figura sem perder atributo nenhum", () => {
    const secoes: Secao[] = [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "Resultados",
        content: [
          {
            type: "figura",
            id: "f1",
            legenda: "Fluxo do processo",
            fonte: "Elaborado pela autora (2026)",
            imagem: null,
          },
        ],
      },
    ];

    expect(toDocumento(fromDocumento(secoes))).toEqual(secoes);
  });

  it("faz o round-trip de uma tabela com cabeçalho, corpo e marcas na célula", () => {
    const secoes: Secao[] = [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "Resultados",
        content: [
          {
            type: "tabela",
            id: "t1",
            legenda: "Distribuição por faixa etária",
            fonte: "IBGE (2024)",
            linhas: [
              {
                celulas: [
                  { cabecalho: true, content: [{ type: "text", text: "Faixa" }] },
                  { cabecalho: true, content: [{ type: "text", text: "Total" }] },
                ],
              },
              {
                celulas: [
                  {
                    cabecalho: false,
                    content: [{ type: "text", text: "18–24", marks: [{ type: "negrito" }] }],
                  },
                  // Célula vazia: `content` ausente, não `[]` — mesma
                  // convenção de `NoParagrafo`, e é o que o round-trip
                  // precisa preservar pra `toEqual` bater.
                  { cabecalho: false },
                ],
              },
            ],
          },
        ],
      },
    ];

    expect(toDocumento(fromDocumento(secoes))).toEqual(secoes);
  });

  it("recusa figura sem id", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "secao",
          attrs: { id: "s1", nivel: 1, titulo: "Introdução" },
          content: [{ type: "figura", attrs: { legenda: "", fonte: "", imagem: null } }],
        },
      ],
    };

    expect(() => toDocumento(doc)).toThrow(/Figura sem id/);
  });

  it("recusa tabela sem id", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "secao",
          attrs: { id: "s1", nivel: 1, titulo: "Introdução" },
          content: [{ type: "tabela", attrs: { legenda: "", fonte: "" }, content: [] }],
        },
      ],
    };

    expect(() => toDocumento(doc)).toThrow(/Tabela sem id/);
  });

  it("recusa nó inesperado dentro de uma tabela", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "secao",
          attrs: { id: "s1", nivel: 1, titulo: "Introdução" },
          content: [
            {
              type: "tabela",
              attrs: { id: "t1", legenda: "", fonte: "" },
              content: [{ type: "paragraph" }],
            },
          ],
        },
      ],
    };

    expect(() => toDocumento(doc)).toThrow(/esperava "linha_tabela"/);
  });
});
