import { describe, expect, it } from "vitest";

import type { Metadados } from "../types";

import {
  gerarAgradecimentos,
  gerarDedicatoria,
  gerarEpigrafe,
  gerarOpcionaisPreTextuais,
} from "./opcionaisPreTextuais";

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
    naturezaTrabalho: "",
    resumo: "",
    palavrasChave: [],
    abstract: "",
    keywords: [],
    ...overrides,
  };
}

const ligado = (texto: string) => ({ ativo: true, texto });

describe("elementos opcionais, um a um", () => {
  it("não gera nada quando o campo nem existe (documento gravado antes do passo 3.5.3)", () => {
    const metadados = criarMetadados();

    expect(gerarDedicatoria(metadados)).toEqual([]);
    expect(gerarAgradecimentos(metadados)).toEqual([]);
    expect(gerarEpigrafe(metadados)).toEqual([]);
  });

  it("não gera nada quando o elemento está desligado, mesmo com texto guardado", () => {
    const metadados = criarMetadados({
      dedicatoria: { ativo: false, texto: "À minha família." },
    });

    expect(gerarDedicatoria(metadados)).toEqual([]);
  });

  it("não gera nada quando está ligado mas o texto é só espaço em branco", () => {
    const metadados = criarMetadados({ epigrafe: ligado("   \n  \n ") });

    expect(gerarEpigrafe(metadados)).toEqual([]);
  });

  it("dedicatória sai recuada à direita e sem título (ausente da lista do §5.4)", () => {
    const linhas = gerarDedicatoria(criarMetadados({ dedicatoria: ligado("À minha família.") }));

    expect(linhas).toEqual([{ texto: "À minha família.", alinhamento: "recuada-a-direita" }]);
    expect(linhas.some((linha) => linha.titulo)).toBe(false);
  });

  it("agradecimentos é o único dos três com título centralizado (§5.4)", () => {
    const linhas = gerarAgradecimentos(
      criarMetadados({ agradecimentos: ligado("Ao meu orientador.") })
    );

    expect(linhas[0]).toEqual({
      texto: "AGRADECIMENTOS",
      alinhamento: "centro",
      titulo: true,
    });
    expect(linhas[1]).toEqual({ texto: "Ao meu orientador.", alinhamento: "justificado" });
  });

  it("epígrafe sai recuada à direita e sem título", () => {
    const linhas = gerarEpigrafe(
      criarMetadados({ epigrafe: ligado("O saber a gente aprende com os mestres.\n(Cora Coralina)") })
    );

    expect(linhas).toEqual([
      { texto: "O saber a gente aprende com os mestres.", alinhamento: "recuada-a-direita" },
      { texto: "(Cora Coralina)", alinhamento: "recuada-a-direita" },
    ]);
  });

  it("quebra o texto em um parágrafo por linha, descartando linhas vazias", () => {
    const linhas = gerarAgradecimentos(
      criarMetadados({ agradecimentos: ligado("Primeiro parágrafo.\n\nSegundo parágrafo.\n\n\n") })
    );

    // Título + dois parágrafos, sem parágrafo vazio no meio nem no fim.
    expect(linhas).toHaveLength(3);
    expect(linhas.map((linha) => linha.texto)).toEqual([
      "AGRADECIMENTOS",
      "Primeiro parágrafo.",
      "Segundo parágrafo.",
    ]);
  });
});

describe("gerarOpcionaisPreTextuais", () => {
  it("devolve os blocos na ordem da norma: dedicatória, agradecimentos, epígrafe", () => {
    const blocos = gerarOpcionaisPreTextuais(
      criarMetadados({
        // De propósito fora de ordem na construção — a ordem é da norma, não
        // da ordem em que os campos foram preenchidos.
        epigrafe: ligado("Citação."),
        dedicatoria: ligado("Dedicatória."),
        agradecimentos: ligado("Agradecimento."),
      })
    );

    expect(blocos.map((bloco) => bloco[0].texto)).toEqual([
      "Dedicatória.",
      "AGRADECIMENTOS",
      "Citação.",
    ]);
  });

  it("omite os blocos desligados, preservando a ordem dos que sobraram", () => {
    const blocos = gerarOpcionaisPreTextuais(
      criarMetadados({
        dedicatoria: { ativo: false, texto: "Não sai." },
        epigrafe: ligado("Citação."),
      })
    );

    expect(blocos).toHaveLength(1);
    expect(blocos[0][0].texto).toBe("Citação.");
  });

  it("devolve lista vazia quando nenhum dos três está ligado", () => {
    expect(gerarOpcionaisPreTextuais(criarMetadados())).toEqual([]);
  });
});
