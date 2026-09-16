import { describe, expect, it } from "vitest";

import { numerarFiguras, numerarTabelas } from "./numbering";
import type { NoConteudo, Secao } from "./types";

// O critério de aceite do passo 3.6.3 — "inserir no meio renumera as
// seguintes" — não é um ramo de código: o resultado inteiro é recalculado a
// cada chamada a partir da ordem de aparição, então não existe contador
// incremental a corrigir. Os testes provam isso construindo o "antes" e o
// "depois" da operação e conferindo a numeração nova, como os de
// `numerarSecoes()` (3.2.1) já faziam.

function figura(id: string): NoConteudo {
  return { type: "figura", id, legenda: "", fonte: "", imagem: null };
}

function tabela(id: string): NoConteudo {
  return { type: "tabela", id, legenda: "", fonte: "", linhas: [] };
}

function paragrafo(): NoConteudo {
  return { type: "paragraph" };
}

function secao(id: string, ordem: number, content: NoConteudo[]): Secao {
  return { id, ordem, nivel: 1, titulo: "", content };
}

describe("numerarFiguras — número derivado da ordem de aparição (passo 3.6.3)", () => {
  it("numera 1..n na ordem de leitura, atravessando seções", () => {
    const sections = [
      secao("s1", 0, [figura("f1"), paragrafo(), figura("f2")]),
      secao("s2", 1, [figura("f3")]),
    ];

    expect([...numerarFiguras(sections)]).toEqual([
      ["f1", 1],
      ["f2", 2],
      ["f3", 3],
    ]);
  });

  it("inserir uma figura no meio renumera as seguintes", () => {
    const antes = [secao("s1", 0, [figura("f1"), figura("f2")])];
    expect(numerarFiguras(antes).get("f2")).toBe(2);

    const depois = [secao("s1", 0, [figura("f1"), figura("nova"), figura("f2")])];

    expect(numerarFiguras(depois).get("f1")).toBe(1);
    expect(numerarFiguras(depois).get("nova")).toBe(2);
    expect(numerarFiguras(depois).get("f2")).toBe(3);
  });

  it("remover uma figura no meio renumera as seguintes", () => {
    const depois = [secao("s1", 0, [figura("f1"), figura("f3")])];

    expect(numerarFiguras(depois).get("f3")).toBe(2);
  });

  it("inserir uma seção inteira no meio renumera as figuras das seguintes", () => {
    const antes = [secao("s1", 0, [figura("f1")]), secao("s2", 1, [figura("f2")])];
    expect(numerarFiguras(antes).get("f2")).toBe(2);

    // Seção nova entre as duas: a de `ordem` 1 vira 2, como o painel de
    // seções faz ao inserir.
    const depois = [
      secao("s1", 0, [figura("f1")]),
      secao("nova", 1, [figura("fNova")]),
      secao("s2", 2, [figura("f2")]),
    ];

    expect(numerarFiguras(depois).get("fNova")).toBe(2);
    expect(numerarFiguras(depois).get("f2")).toBe(3);
  });

  it("segue `ordem`, não a posição no array", () => {
    const sections = [secao("s2", 1, [figura("f2")]), secao("s1", 0, [figura("f1")])];

    expect(numerarFiguras(sections).get("f1")).toBe(1);
    expect(numerarFiguras(sections).get("f2")).toBe(2);
  });

  it("figura e tabela têm contagens independentes", () => {
    const sections = [secao("s1", 0, [tabela("t1"), figura("f1"), tabela("t2"), figura("f2")])];

    // A tabela entre as duas figuras não empurra a numeração delas, e
    // vice-versa: são duas sequências, não uma de "ilustrações".
    expect(numerarFiguras(sections).get("f1")).toBe(1);
    expect(numerarFiguras(sections).get("f2")).toBe(2);
    expect(numerarTabelas(sections).get("t1")).toBe(1);
    expect(numerarTabelas(sections).get("t2")).toBe(2);
  });

  it("parágrafo e citação longa não entram na contagem", () => {
    const sections = [
      secao("s1", 0, [
        paragrafo(),
        { type: "citacao_longa", refId: null, pagina: "", content: [] },
        figura("f1"),
      ]),
    ];

    expect(numerarFiguras(sections).get("f1")).toBe(1);
  });

  it("documento sem figura nenhuma devolve mapa vazio", () => {
    expect(numerarFiguras([secao("s1", 0, [paragrafo()])]).size).toBe(0);
  });

  it("não muta o array recebido", () => {
    const sections = [secao("s2", 1, [figura("f2")]), secao("s1", 0, [figura("f1")])];
    const antes = sections.map((s) => s.id);

    numerarFiguras(sections);

    expect(sections.map((s) => s.id)).toEqual(antes);
  });
});
