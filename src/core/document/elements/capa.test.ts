import { describe, expect, it } from "vitest";

import type { Metadados } from "../types";

import { gerarCapa } from "./capa";

function criarMetadados(overrides: Partial<Metadados> = {}): Metadados {
  return {
    tipo: "tcc",
    norma: "abnt",
    titulo: "A formatação de trabalhos acadêmicos",
    autores: ["Maria da Silva"],
    instituicao: "Universidade Católica de Pernambuco",
    curso: "Ciência da Computação",
    orientador: "João Souza",
    local: "Recife",
    ano: 2026,
    naturezaTrabalho:
      "Trabalho de Conclusão de Curso apresentado ao curso de Ciência da Computação da UNICAP como requisito parcial para obtenção do título de bacharel.",
    resumo: "",
    palavrasChave: [],
    abstract: "",
    keywords: [],
    ...overrides,
  };
}

describe("gerarCapa", () => {
  it("segue a ordem da NBR 14724 §5.1: instituição, autor, título, local, ano", () => {
    const linhas = gerarCapa(criarMetadados());

    expect(linhas.map((linha) => linha.texto)).toEqual([
      "Universidade Católica de Pernambuco",
      "Maria da Silva",
      "A formatação de trabalhos acadêmicos",
      "Recife",
      "2026",
    ]);
  });

  it("centraliza todas as linhas — a capa não tem elemento recuado", () => {
    const linhas = gerarCapa(criarMetadados());

    expect(linhas.every((linha) => linha.alinhamento === "centro")).toBe(true);
  });

  it("põe um autor por linha, na ordem em que aparecem nos metadados", () => {
    const linhas = gerarCapa(criarMetadados({ autores: ["Maria da Silva", "João Pereira"] }));

    expect(linhas.map((linha) => linha.texto)).toEqual([
      "Universidade Católica de Pernambuco",
      "Maria da Silva",
      "João Pereira",
      "A formatação de trabalhos acadêmicos",
      "Recife",
      "2026",
    ]);
  });

  it("junta o subtítulo ao título com dois-pontos, subordinado na mesma linha", () => {
    const linhas = gerarCapa(
      criarMetadados({ titulo: "A formatação", subtitulo: "um estudo de caso" })
    );

    expect(linhas.map((linha) => linha.texto)).toContain("A formatação: um estudo de caso");
  });

  it("omite o título do subtítulo quando não houver subtítulo", () => {
    const linhas = gerarCapa(criarMetadados({ titulo: "A formatação", subtitulo: undefined }));

    expect(linhas.map((linha) => linha.texto)).toContain("A formatação");
    expect(linhas.some((linha) => linha.texto.includes(":"))).toBe(false);
  });

  it("omite a instituição quando o campo está vazio — item (a) é opcional na norma", () => {
    const linhas = gerarCapa(criarMetadados({ instituicao: "" }));

    expect(linhas.map((linha) => linha.texto)).toEqual([
      "Maria da Silva",
      "A formatação de trabalhos acadêmicos",
      "Recife",
      "2026",
    ]);
  });
});
