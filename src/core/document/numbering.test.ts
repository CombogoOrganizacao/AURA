import { describe, expect, it } from "vitest";

import { numerarSecoes } from "./numbering";
import type { Secao } from "./types";

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

describe("numerarSecoes", () => {
  it("numera uma sequência simples de nível 1", () => {
    const introducao = criarSecao({ ordem: 1, nivel: 1, titulo: "Introdução" });
    const conclusao = criarSecao({ ordem: 2, nivel: 1, titulo: "Conclusão" });

    const numeracao = numerarSecoes([introducao, conclusao]);

    expect(numeracao.get(introducao.id)).toBe("1");
    expect(numeracao.get(conclusao.id)).toBe("2");
  });

  it("numera até o nível 3 (docs pedem cobertura explícita)", () => {
    const nivel1 = criarSecao({ ordem: 1, nivel: 1, titulo: "Introdução" });
    const nivel2 = criarSecao({ ordem: 2, nivel: 2, titulo: "Contexto" });
    const nivel3 = criarSecao({ ordem: 3, nivel: 3, titulo: "Detalhe" });

    const numeracao = numerarSecoes([nivel1, nivel2, nivel3]);

    expect(numeracao.get(nivel1.id)).toBe("1");
    expect(numeracao.get(nivel2.id)).toBe("1.1");
    expect(numeracao.get(nivel3.id)).toBe("1.1.1");
  });

  it("reinicia o contador de um nível quando o nível-mãe avança", () => {
    // 1, 1.1, 1.2, 2, 2.1 — o "1" de "2.1" não pode carregar o "2" que
    // "1.2" deixou no contador de nível 2.
    const s1 = criarSecao({ ordem: 1, nivel: 1, titulo: "Um" });
    const s1_1 = criarSecao({ ordem: 2, nivel: 2, titulo: "Um-um" });
    const s1_2 = criarSecao({ ordem: 3, nivel: 2, titulo: "Um-dois" });
    const s2 = criarSecao({ ordem: 4, nivel: 1, titulo: "Dois" });
    const s2_1 = criarSecao({ ordem: 5, nivel: 2, titulo: "Dois-um" });

    const numeracao = numerarSecoes([s1, s1_1, s1_2, s2, s2_1]);

    expect(numeracao.get(s1.id)).toBe("1");
    expect(numeracao.get(s1_1.id)).toBe("1.1");
    expect(numeracao.get(s1_2.id)).toBe("1.2");
    expect(numeracao.get(s2.id)).toBe("2");
    expect(numeracao.get(s2_1.id)).toBe("2.1");
  });

  it("não depende da posição no array, só de `ordem` (mesma convenção de fromDocumento)", () => {
    const primeira = criarSecao({ ordem: 1, nivel: 1, titulo: "Primeira" });
    const segunda = criarSecao({ ordem: 2, nivel: 1, titulo: "Segunda" });

    // Array fora de ordem — a função ordena por `ordem` internamente.
    const numeracao = numerarSecoes([segunda, primeira]);

    expect(numeracao.get(primeira.id)).toBe("1");
    expect(numeracao.get(segunda.id)).toBe("2");
  });

  it("renumera ao inserir uma seção no meio", () => {
    const s1 = criarSecao({ ordem: 1, nivel: 1, titulo: "Introdução" });
    const s2 = criarSecao({ ordem: 2, nivel: 1, titulo: "Conclusão" });

    const antes = numerarSecoes([s1, s2]);
    expect(antes.get(s2.id)).toBe("2");

    // Insere "Metodologia" entre as duas, empurrando a ordem de "Conclusão"
    // — exatamente como quem chama já faz ao inserir uma seção nova.
    const nova = criarSecao({ ordem: 2, nivel: 1, titulo: "Metodologia" });
    const s2Deslocada: Secao = { ...s2, ordem: 3 };

    const depois = numerarSecoes([s1, nova, s2Deslocada]);

    expect(depois.get(s1.id)).toBe("1");
    expect(depois.get(nova.id)).toBe("2");
    expect(depois.get(s2Deslocada.id)).toBe("3");
  });

  it("renumera ao remover uma seção", () => {
    const s1 = criarSecao({ ordem: 1, nivel: 1, titulo: "Introdução" });
    const s2 = criarSecao({ ordem: 2, nivel: 1, titulo: "Metodologia" });
    const s3 = criarSecao({ ordem: 3, nivel: 1, titulo: "Conclusão" });

    const antes = numerarSecoes([s1, s2, s3]);
    expect(antes.get(s3.id)).toBe("3");

    // Remove "Metodologia" e fecha a ordem — a seção sobrevivente não
    // guarda "3" gravado em lugar nenhum, é recalculada do zero.
    const s3Deslocada: Secao = { ...s3, ordem: 2 };
    const depois = numerarSecoes([s1, s3Deslocada]);

    expect(depois.get(s1.id)).toBe("1");
    expect(depois.get(s3Deslocada.id)).toBe("2");
    expect(depois.has(s2.id)).toBe(false);
  });

  it("renumera ao promover uma seção de nível 2 para nível 1", () => {
    const s1 = criarSecao({ ordem: 1, nivel: 1, titulo: "Introdução" });
    const s1_1 = criarSecao({ ordem: 2, nivel: 2, titulo: "Contexto" });
    const s2 = criarSecao({ ordem: 3, nivel: 1, titulo: "Conclusão" });

    const antes = numerarSecoes([s1, s1_1, s2]);
    expect(antes.get(s1_1.id)).toBe("1.1");
    expect(antes.get(s2.id)).toBe("2");

    // "Contexto" promovida de 1.1 para seção de nível 1 própria — passa a
    // virar "2", e o que era "2" vira "3".
    const promovida: Secao = { ...s1_1, nivel: 1 };
    const depois = numerarSecoes([s1, promovida, s2]);

    expect(depois.get(s1.id)).toBe("1");
    expect(depois.get(promovida.id)).toBe("2");
    expect(depois.get(s2.id)).toBe("3");
  });

  it("renumera ao rebaixar uma seção de nível 1 para nível 2", () => {
    const s1 = criarSecao({ ordem: 1, nivel: 1, titulo: "Introdução" });
    const s2 = criarSecao({ ordem: 2, nivel: 1, titulo: "Metodologia" });

    const antes = numerarSecoes([s1, s2]);
    expect(antes.get(s2.id)).toBe("2");

    const rebaixada: Secao = { ...s2, nivel: 2 };
    const depois = numerarSecoes([s1, rebaixada]);

    expect(depois.get(rebaixada.id)).toBe("1.1");
  });

  it("nunca escreve a numeração na string do título", () => {
    const s1 = criarSecao({ ordem: 1, nivel: 1, titulo: "Introdução" });
    const s1_1 = criarSecao({ ordem: 2, nivel: 2, titulo: "Contexto" });

    numerarSecoes([s1, s1_1]);

    // A função não muta `sections` — o título continua exatamente o que
    // era antes de calcular a numeração, nunca "1 Introdução" nem
    // "1.1 Contexto".
    expect(s1.titulo).toBe("Introdução");
    expect(s1_1.titulo).toBe("Contexto");
  });
});
