import { describe, expect, it } from "vitest";

import { palavrasIniciais } from "./primeiraPalavra";

function inicio(titulo: string): string {
  const palavras = titulo.split(" ");
  return palavras.slice(0, palavrasIniciais(palavras)).join(" ");
}

describe("primeira palavra do título (6023 §6.7, 10520 §6.1.1.4)", () => {
  it.each([
    // Exemplos das duas normas.
    ["Nos canaviais, mutilações em vez de lazer", "Nos canaviais,"],
    ["A flor prometida", "A flor"],
    ["Anteprojeto de lei", "Anteprojeto"],
    ["Inglês", "Inglês"],
    // Artigos, inclusive os de duas sílabas.
    ["Uma história da leitura", "Uma história"],
    ["Os sertões", "Os sertões"],
  ])("%s → %s", (titulo, esperado) => {
    expect(inicio(titulo)).toBe(esperado);
  });

  it.each(["Paz", "Mãe", "Pão", "Mais", "Deus", "Quem", "Sol", "Céu", "Ao", "Que", "Põe"])(
    "%s é monossílabo",
    (palavra) => {
      expect(palavrasIniciais([palavra, "seguinte"])).toBe(2);
    },
  );

  it.each(["Rio", "Dia", "Lua", "País", "Saúde", "Guerra", "Brasil", "Educação", "Voo", "Área"])(
    "%s não é monossílabo",
    (palavra) => {
      expect(palavrasIniciais([palavra, "seguinte"])).toBe(1);
    },
  );

  it("número no início não é monossílabo", () => {
    expect(palavrasIniciais(["500", "anos"])).toBe(1);
  });
});
