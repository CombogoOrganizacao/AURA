import { describe, expect, it } from "vitest";

import { novoDocumento } from "./factory";
import type { Documento, Secao } from "./types";
import { validarDocumento } from "./validate";

function criarSecao(overrides: Partial<Secao> = {}): Secao {
  return {
    id: crypto.randomUUID(),
    ordem: 1,
    nivel: 1,
    titulo: "Seção de teste",
    content: [],
    ...overrides,
  };
}

function comSecoes(...sections: Secao[]): Documento {
  return { ...novoDocumento(), sections };
}

describe("validarDocumento", () => {
  it("aceita um documento sem seções", () => {
    expect(validarDocumento(novoDocumento())).toEqual([]);
  });

  it("aceita uma sequência válida de níveis (1, 2, 3, 2, 1)", () => {
    const documento = comSecoes(
      criarSecao({ ordem: 1, nivel: 1, titulo: "Introdução" }),
      criarSecao({ ordem: 2, nivel: 2, titulo: "Contexto" }),
      criarSecao({ ordem: 3, nivel: 3, titulo: "Detalhe" }),
      criarSecao({ ordem: 4, nivel: 2, titulo: "Outro contexto" }),
      criarSecao({ ordem: 5, nivel: 1, titulo: "Conclusão" }),
    );

    expect(validarDocumento(documento)).toEqual([]);
  });

  it("rejeita nível fora do intervalo 1–3", () => {
    // Simula um dado vindo de fora do TypeScript (JSON persistido, por
    // exemplo) — daí o cast: o tipo já proíbe isso em tempo de compilação.
    const secaoInvalida = criarSecao({ nivel: 4 as Secao["nivel"] });
    const erros = validarDocumento(comSecoes(secaoInvalida));

    expect(erros).toContainEqual(expect.objectContaining({ campo: "sections[0].nivel" }));
  });

  it("rejeita ordem repetida entre seções", () => {
    const documento = comSecoes(
      criarSecao({ id: "a", ordem: 1, nivel: 1 }),
      criarSecao({ id: "b", ordem: 1, nivel: 1 }),
    );
    const erros = validarDocumento(documento);

    expect(erros).toContainEqual(expect.objectContaining({ campo: "sections[1].ordem" }));
  });

  it("rejeita id de seção repetido", () => {
    const documento = comSecoes(
      criarSecao({ id: "mesmo-id", ordem: 1, nivel: 1 }),
      criarSecao({ id: "mesmo-id", ordem: 2, nivel: 1 }),
    );
    const erros = validarDocumento(documento);

    expect(erros).toContainEqual(expect.objectContaining({ campo: "sections[1].id" }));
  });

  it("rejeita a primeira seção com nível diferente de 1", () => {
    const documento = comSecoes(criarSecao({ nivel: 2 }));
    const erros = validarDocumento(documento);

    expect(erros).toContainEqual(expect.objectContaining({ campo: "sections[0].nivel" }));
  });

  it("rejeita salto de nível sem passar pelo intermediário", () => {
    const documento = comSecoes(
      criarSecao({ ordem: 1, nivel: 1 }),
      criarSecao({ ordem: 2, nivel: 3 }),
    );
    const erros = validarDocumento(documento);

    expect(erros).toContainEqual(expect.objectContaining({ campo: "sections[1].nivel" }));
  });
});
