import { describe, expect, it } from "vitest";

import type { Metadados } from "../types";

import { LINHA_ASSINATURA, LINHA_DATA_APROVACAO, gerarFolhaDeAprovacao } from "./folhaDeAprovacao";

// Passo 4B.3 — NBR 14724:2024 §4.2.1.3, §5.2 e §5.2.4.

const NATUREZA =
  "Trabalho de Conclusão de Curso apresentado ao curso de Ciência da Computação da UNICAP como requisito parcial para obtenção do título de bacharel.";

function criarMetadados(overrides: Partial<Metadados> = {}): Metadados {
  return {
    tipo: "tcc",
    norma: "abnt",
    titulo: "A formatação de trabalhos acadêmicos",
    subtitulo: "um estudo de caso",
    autores: ["Maria da Silva"],
    instituicao: "Universidade Católica de Pernambuco",
    curso: "Ciência da Computação",
    orientador: "João Souza",
    local: "Recife",
    ano: 2026,
    naturezaTrabalho: NATUREZA,
    resumo: "",
    palavrasChave: [],
    abstract: "",
    keywords: [],
    bancaExaminadora: [
      { id: "b1", nome: "João Souza", titulacao: "Doutor em Computação", instituicao: "UNICAP" },
      { id: "b2", nome: "Ana Lima", titulacao: "Mestra em Educação", instituicao: "UFPE" },
    ],
    ...overrides,
  };
}

describe("gerarFolhaDeAprovacao (NBR 14724:2024 §4.2.1.3)", () => {
  it("segue a enumeração: autor, título e subtítulo, natureza, data, e cada membro da banca", () => {
    const linhas = gerarFolhaDeAprovacao(criarMetadados());

    expect(linhas.map((linha) => linha.texto)).toEqual([
      "Maria da Silva",
      "A formatação de trabalhos acadêmicos: um estudo de caso",
      NATUREZA,
      LINHA_DATA_APROVACAO,
      LINHA_ASSINATURA,
      "João Souza",
      "Doutor em Computação",
      "UNICAP",
      LINHA_ASSINATURA,
      "Ana Lima",
      "Mestra em Educação",
      "UFPE",
    ]);
  });

  it("data e assinaturas saem em branco, para preencher depois da aprovação", () => {
    const linhas = gerarFolhaDeAprovacao(criarMetadados());
    expect(linhas.find((linha) => linha.papel === "dataAprovacao")?.texto).toMatch(/_{2,}/);
    expect(linhas.filter((linha) => linha.papel === "assinatura")).toHaveLength(2);
  });

  it("não tem título (§5.2.4)", () => {
    const linhas = gerarFolhaDeAprovacao(criarMetadados());
    expect(linhas.some((linha) => linha.titulo)).toBe(false);
    expect(linhas.map((linha) => linha.texto)).not.toContain("FOLHA DE APROVAÇÃO");
  });

  it("a natureza vai recuada do meio da mancha à margem direita, como na folha de rosto (§5.2)", () => {
    const natureza = gerarFolhaDeAprovacao(criarMetadados()).find(
      (linha) => linha.papel === "natureza",
    );
    expect(natureza?.alinhamento).toBe("recuada-a-direita");
  });

  it("sem membro da banca, a folha não sai (a falta é achado da conferência)", () => {
    expect(gerarFolhaDeAprovacao(criarMetadados({ bancaExaminadora: [] }))).toEqual([]);
    expect(gerarFolhaDeAprovacao(criarMetadados({ bancaExaminadora: undefined }))).toEqual([]);
  });

  it("membro sem nome não conta; campo vazio não vira linha em branco", () => {
    const linhas = gerarFolhaDeAprovacao(
      criarMetadados({
        bancaExaminadora: [
          { id: "b1", nome: "  ", titulacao: "Doutor", instituicao: "UNICAP" },
          { id: "b2", nome: "Ana Lima", titulacao: "", instituicao: "UFPE" },
        ],
      }),
    );

    expect(linhas.filter((linha) => linha.papel === "assinatura")).toHaveLength(1);
    expect(linhas.slice(-2).map((linha) => linha.texto)).toEqual(["Ana Lima", "UFPE"]);
  });
});
