import { describe, expect, it } from "vitest";

import { mapearHtmlColado, type NoHtmlColado } from "./paste";

// Fixtures são a árvore já "parseada" (`NoHtmlColado`), não string de HTML —
// de propósito: quem faz HTML virar essa árvore é `DOMParser`, que só existe
// no navegador (ver comentário em paste.ts). Testar aqui, sobre a árvore,
// mantém a suíte em `src/core/` sem DOM (CLAUDE.md) e cobre exatamente a
// parte que este passo pede: o que a árvore vira, não como o HTML virou
// árvore (isso é DOM parsing de fábrica, nada do AURA pra testar).

function texto(t: string): NoHtmlColado {
  return { tipo: "texto", texto: t };
}

function elemento(tag: string, filhos: NoHtmlColado[]): NoHtmlColado {
  return { tipo: "elemento", tag, filhos };
}

describe("mapearHtmlColado — colar do Word e de outras fontes (passo 3.3.4)", () => {
  it("negrito (b e strong) vira a marca `negrito`", () => {
    const arvore = [
      elemento("p", [
        texto("Texto "),
        elemento("strong", [texto("em negrito")]),
        texto(" e "),
        elemento("b", [texto("também")]),
        texto("."),
      ]),
    ];

    expect(mapearHtmlColado(arvore)).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Texto " },
          { type: "text", text: "em negrito", marks: [{ type: "negrito" }] },
          { type: "text", text: " e " },
          { type: "text", text: "também", marks: [{ type: "negrito" }] },
          { type: "text", text: "." },
        ],
      },
    ]);
  });

  it("itálico (em e i) vira a marca `italico`", () => {
    const arvore = [
      elemento("p", [
        elemento("em", [texto("Itálico")]),
        texto(" e "),
        elemento("i", [texto("também")]),
      ]),
    ];

    expect(mapearHtmlColado(arvore)).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Itálico", marks: [{ type: "italico" }] },
          { type: "text", text: " e " },
          { type: "text", text: "também", marks: [{ type: "italico" }] },
        ],
      },
    ]);
  });

  it("negrito e itálico aninhados acumulam as duas marcas no mesmo texto", () => {
    const arvore = [elemento("p", [elemento("strong", [elemento("em", [texto("os dois")])])])];

    expect(mapearHtmlColado(arvore)).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "os dois", marks: [{ type: "negrito" }, { type: "italico" }] },
        ],
      },
    ]);
  });

  it("lista (ul/li) não tem nó próprio ainda — cada item vira um parágrafo simples", () => {
    const arvore = [
      elemento("ul", [
        elemento("li", [texto("Primeiro item")]),
        elemento("li", [texto("Segundo item")]),
      ]),
    ];

    expect(mapearHtmlColado(arvore)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Primeiro item" }] },
      { type: "paragraph", content: [{ type: "text", text: "Segundo item" }] },
    ]);
  });

  it("lista ordenada (ol/li) segue a mesma regra", () => {
    const arvore = [elemento("ol", [elemento("li", [texto("Único item")])])];

    expect(mapearHtmlColado(arvore)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Único item" }] },
    ]);
  });

  it("título de estilo do Word (h1-h6) não tem nó de seção via colar — vira parágrafo simples, sem negrito", () => {
    const arvore = [elemento("h1", [texto("Introdução")]), elemento("h2", [texto("Metodologia")])];

    expect(mapearHtmlColado(arvore)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Introdução" }] },
      { type: "paragraph", content: [{ type: "text", text: "Metodologia" }] },
    ]);
  });

  it("nenhum HTML bruto entra no documento: script e style são descartados por inteiro, com o texto de dentro", () => {
    const arvore = [
      elemento("p", [
        texto("Antes "),
        elemento("script", [texto("alert('injetado')")]),
        elemento("style", [texto(".x { color: red }")]),
        texto("depois."),
      ]),
    ];

    const resultado = mapearHtmlColado(arvore);

    expect(resultado).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Antes " },
          { type: "text", text: "depois." },
        ],
      },
    ]);
    expect(JSON.stringify(resultado)).not.toContain("alert");
    expect(JSON.stringify(resultado)).not.toContain("color: red");
  });

  it("mídia sem equivalente em texto (img) é descartada sem deixar parágrafo vazio", () => {
    const arvore = [elemento("p", [elemento("img", [])])];

    expect(mapearHtmlColado(arvore)).toEqual([]);
  });

  it("texto solto sem nenhum bloco em volta ainda vira um parágrafo", () => {
    const arvore = [texto("Colado direto, sem tag nenhuma.")];

    expect(mapearHtmlColado(arvore)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Colado direto, sem tag nenhuma." }] },
    ]);
  });

  it("<br> quebra em parágrafos separados — não existe nó de quebra de linha no schema", () => {
    const arvore = [elemento("p", [texto("Linha um"), elemento("br", []), texto("Linha dois")])];

    expect(mapearHtmlColado(arvore)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Linha um" }] },
      { type: "paragraph", content: [{ type: "text", text: "Linha dois" }] },
    ]);
  });

  it("texto puramente de espaçamento entre tags (indentação do HTML de origem) não vira parágrafo", () => {
    const arvore = [
      elemento("div", [texto("\n  "), elemento("p", [texto("Real")]), texto("\n  ")]),
    ];

    expect(mapearHtmlColado(arvore)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Real" }] },
    ]);
  });

  it("entrada vazia devolve array vazio", () => {
    expect(mapearHtmlColado([])).toEqual([]);
  });
});
