import { describe, expect, it } from "vitest";

import type { NoConteudo, Secao } from "../types";
import { gerarListaDeFiguras, gerarListaDeTabelas } from "./listas";

// "Acompanham inserção e remoção" (critério do passo 3.6.4) não é um ramo de
// código: a lista inteira é derivada da árvore a cada chamada, como o sumário
// (3.6.1). Os testes provam isso montando o "antes" e o "depois" de cada
// operação, não chamando a função uma vez com um cenário estático.

function figura(id: string, legenda = ""): NoConteudo {
  return { type: "figura", id, legenda, fonte: "", imagem: null };
}

function tabela(id: string, legenda = ""): NoConteudo {
  return { type: "tabela", id, legenda, fonte: "", linhas: [] };
}

function secao(id: string, ordem: number, content: NoConteudo[]): Secao {
  return { id, ordem, nivel: 1, titulo: "", content };
}

describe("gerarListaDeFiguras / gerarListaDeTabelas (passo 3.6.4)", () => {
  it("relaciona cada figura na ordem de leitura, com a legenda do corpo", () => {
    const sections = [
      secao("s1", 0, [figura("f1", "Fluxo do processo"), { type: "paragraph" }]),
      secao("s2", 1, [figura("f2", "Amostra coletada")]),
    ];

    expect(gerarListaDeFiguras(sections)).toEqual([
      { id: "f1", numero: 1, texto: "Figura 1 — Fluxo do processo" },
      { id: "f2", numero: 2, texto: "Figura 2 — Amostra coletada" },
    ]);
  });

  it("inserir uma figura no meio renumera as entradas seguintes da lista", () => {
    const antes = [secao("s1", 0, [figura("f1", "Primeira"), figura("f2", "Segunda")])];
    expect(gerarListaDeFiguras(antes)[1].texto).toBe("Figura 2 — Segunda");

    const depois = [
      secao("s1", 0, [figura("f1", "Primeira"), figura("nova", "Nova"), figura("f2", "Segunda")]),
    ];

    expect(gerarListaDeFiguras(depois).map((item) => item.texto)).toEqual([
      "Figura 1 — Primeira",
      "Figura 2 — Nova",
      "Figura 3 — Segunda",
    ]);
  });

  it("remover uma figura tira a entrada e renumera as seguintes", () => {
    const depois = [secao("s1", 0, [figura("f1", "Primeira"), figura("f3", "Terceira")])];

    expect(gerarListaDeFiguras(depois)).toEqual([
      { id: "f1", numero: 1, texto: "Figura 1 — Primeira" },
      { id: "f3", numero: 2, texto: "Figura 2 — Terceira" },
    ]);
  });

  it("mudar a legenda no corpo muda a entrada da lista", () => {
    const antes = [secao("s1", 0, [figura("f1", "Rascunho")])];
    expect(gerarListaDeFiguras(antes)[0].texto).toBe("Figura 1 — Rascunho");

    const depois = [secao("s1", 0, [figura("f1", "Fluxo do processo")])];
    expect(gerarListaDeFiguras(depois)[0].texto).toBe("Figura 1 — Fluxo do processo");
  });

  // Mesma `textoLegenda()` que o corpo usa (3.6.3) — a norma pede que a lista
  // reproduza a legenda como ela aparece no texto.
  it("figura sem legenda digitada entra como 'Figura N', sem travessão solto", () => {
    expect(gerarListaDeFiguras([secao("s1", 0, [figura("f1")])])[0].texto).toBe("Figura 1");
  });

  it("segue `ordem`, não a posição no array", () => {
    const sections = [
      secao("s2", 1, [figura("f2", "Segunda")]),
      secao("s1", 0, [figura("f1", "Primeira")]),
    ];

    expect(gerarListaDeFiguras(sections).map((item) => item.id)).toEqual(["f1", "f2"]);
  });

  it("as duas listas são independentes — tabela não aparece na de figuras", () => {
    const sections = [secao("s1", 0, [tabela("t1", "Faixas"), figura("f1", "Fluxo")])];

    expect(gerarListaDeFiguras(sections)).toEqual([
      { id: "f1", numero: 1, texto: "Figura 1 — Fluxo" },
    ]);
    expect(gerarListaDeTabelas(sections)).toEqual([
      { id: "t1", numero: 1, texto: "Tabela 1 — Faixas" },
    ]);
  });

  it("documento sem figura nenhuma devolve lista vazia, para quem exporta omitir o elemento", () => {
    expect(gerarListaDeFiguras([secao("s1", 0, [{ type: "paragraph" }])])).toEqual([]);
  });

  it("não muta o array recebido", () => {
    const sections = [secao("s2", 1, [figura("f2")]), secao("s1", 0, [figura("f1")])];
    const antes = sections.map((s) => s.id);

    gerarListaDeFiguras(sections);

    expect(sections.map((s) => s.id)).toEqual(antes);
  });
});
