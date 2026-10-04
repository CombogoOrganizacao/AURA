import { describe, expect, it } from "vitest";

import type { Metadados } from "../types";

import { gerarFolhaDeRosto } from "./folhaDeRosto";

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

describe("gerarFolhaDeRosto", () => {
  it("segue a ordem da NBR 14724 §5.2: autor, título, natureza, orientador, local, ano", () => {
    const metadados = criarMetadados();
    const linhas = gerarFolhaDeRosto(metadados);

    expect(linhas.map((linha) => linha.texto)).toEqual([
      "Maria da Silva",
      "A formatação de trabalhos acadêmicos",
      metadados.naturezaTrabalho,
      "Orientador: João Souza",
      "Recife",
      "2026",
    ]);
  });

  it("não repete o nome da instituição como linha própria — ela já está na nota de natureza", () => {
    const linhas = gerarFolhaDeRosto(criarMetadados());

    expect(linhas.map((linha) => linha.texto)).not.toContain(
      "Universidade Católica de Pernambuco"
    );
  });

  it("recua a natureza e o orientador para a direita, num bloco só; o resto fica centralizado", () => {
    const linhas = gerarFolhaDeRosto(criarMetadados());

    const recuadas = linhas.filter((linha) => linha.alinhamento === "recuada-a-direita");
    expect(recuadas.map((linha) => linha.papel)).toEqual(["natureza", "orientador"]);

    const demais = linhas.filter((linha) => linha.alinhamento !== "recuada-a-direita");
    expect(demais.every((linha) => linha.alinhamento === "centro")).toBe(true);
  });

  it("sem natureza, o orientador continua recuado", () => {
    const linhas = gerarFolhaDeRosto(criarMetadados({ naturezaTrabalho: "" }));

    expect(linhas.some((linha) => linha.papel === "natureza")).toBe(false);
    expect(linhas.find((linha) => linha.papel === "orientador")?.alinhamento).toBe(
      "recuada-a-direita",
    );
  });

  it("põe um autor por linha, na ordem em que aparecem nos metadados", () => {
    const linhas = gerarFolhaDeRosto(
      criarMetadados({ autores: ["Maria da Silva", "João Pereira"] })
    );

    expect(linhas.slice(0, 2).map((linha) => linha.texto)).toEqual([
      "Maria da Silva",
      "João Pereira",
    ]);
  });

  it("junta o subtítulo ao título com dois-pontos, subordinado na mesma linha", () => {
    const linhas = gerarFolhaDeRosto(
      criarMetadados({ titulo: "A formatação", subtitulo: "um estudo de caso" })
    );

    expect(linhas.map((linha) => linha.texto)).toContain("A formatação: um estudo de caso");
  });
});
