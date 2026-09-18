import { describe, expect, it } from "vitest";

import type { ElementoPosTextual } from "../types";
import { gerarAnexos } from "./anexos";
import { gerarApendices } from "./apendices";
import { textoTituloPosTextual } from "./posTextual";

// "Inserir no meio reletra as seguintes" (critério do passo 3.7.1) não é um
// ramo de código: a lista inteira é derivada da posição a cada chamada, como
// o sumário (3.6.1) e as listas de ilustrações (3.6.4). Os testes provam isso
// montando o "antes" e o "depois", não chamando a função uma vez com um
// cenário estático.

function elemento(id: string, titulo = ""): ElementoPosTextual {
  return { id, titulo, content: [] };
}

function letras(itens: { letra: string }[]): string[] {
  return itens.map((item) => item.letra);
}

describe("gerarApendices (passo 3.7.1)", () => {
  it("letra cada apêndice pela posição, começando em A", () => {
    const apendices = [
      elemento("a1", "Questionário aplicado"),
      elemento("a2", "Roteiro de entrevista"),
    ];

    expect(gerarApendices(apendices)).toEqual([
      { id: "a1", rotulo: "APÊNDICE", letra: "A", titulo: "Questionário aplicado" },
      { id: "a2", rotulo: "APÊNDICE", letra: "B", titulo: "Roteiro de entrevista" },
    ]);
  });

  it("inserir um apêndice no meio reletra todos os seguintes", () => {
    const antes = [elemento("a1", "Primeiro"), elemento("a2", "Segundo")];
    expect(letras(gerarApendices(antes))).toEqual(["A", "B"]);

    const depois = [
      elemento("a1", "Primeiro"),
      elemento("novo", "Novo"),
      elemento("a2", "Segundo"),
    ];

    expect(gerarApendices(depois)).toEqual([
      { id: "a1", rotulo: "APÊNDICE", letra: "A", titulo: "Primeiro" },
      { id: "novo", rotulo: "APÊNDICE", letra: "B", titulo: "Novo" },
      // O que era "APÊNDICE B" virou "APÊNDICE C" sem ninguém editar nada: é
      // a letra derivada fazendo o trabalho que um campo gravado não faria.
      { id: "a2", rotulo: "APÊNDICE", letra: "C", titulo: "Segundo" },
    ]);
  });

  it("remover o primeiro apêndice reletra os que ficam", () => {
    const antes = [elemento("a1"), elemento("a2"), elemento("a3")];
    expect(letras(gerarApendices(antes))).toEqual(["A", "B", "C"]);

    const depois = antes.filter((item) => item.id !== "a1");

    expect(gerarApendices(depois).map((item) => [item.id, item.letra])).toEqual([
      ["a2", "A"],
      ["a3", "B"],
    ]);
  });

  it("reordenar reletra pela nova posição, não pelo id", () => {
    const apendices = [elemento("a1"), elemento("a2")];
    const invertidos = [apendices[1], apendices[0]];

    expect(gerarApendices(invertidos).map((item) => [item.id, item.letra])).toEqual([
      ["a2", "A"],
      ["a1", "B"],
    ]);
  });

  it("documento sem apêndice nenhum produz lista vazia, não uma entrada em branco", () => {
    expect(gerarApendices([])).toEqual([]);
  });
});

describe("textoTituloPosTextual (passo 3.7.1)", () => {
  it("monta identificação, travessão e título", () => {
    const [item] = gerarApendices([elemento("a1", "Questionário aplicado")]);
    expect(textoTituloPosTextual(item)).toBe("APÊNDICE A — Questionário aplicado");
  });

  it("apêndice ainda sem título sai sem o travessão solto", () => {
    const [item] = gerarApendices([elemento("a1")]);
    // "APÊNDICE A — " é o que a pessoa veria enquanto digita; mesma decisão
    // de `textoLegenda()` em ./legenda.ts.
    expect(textoTituloPosTextual(item)).toBe("APÊNDICE A");
  });

  it("usa o rótulo que veio no item, sem redescobrir de onde ele saiu", () => {
    const [item] = gerarAnexos([elemento("x1", "Lei 9.610/1998")]);
    expect(textoTituloPosTextual(item)).toBe("ANEXO A — Lei 9.610/1998");
  });
});
