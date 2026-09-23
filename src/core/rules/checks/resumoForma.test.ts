import { describe, expect, it } from "vitest";

import { conferirCom } from "../__tests__/conferirCom";
import { conferirDocumento } from "../compliance";
import { documentoConforme } from "../__tests__/documentoConforme";
import { resolveRules } from "../resolve";
import { contarPalavras } from "./percorrer";
import { palavrasChaveMinusculas, resumoExtensao, resumoParagrafoUnico } from "./resumoForma";

// Passo 5.2.2 — forma do resumo pela NBR 6028:2021 (§4.1.2, §4.1.7, §4.1.8).

function palavras(quantidade: number): string {
  return Array.from({ length: quantidade }, (_, indice) => `palavra${indice}`).join(" ");
}

describe("resumo-extensao (6028 §4.1.8 a, 'convém')", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(resumoExtensao)).toEqual([]);
  });

  it("curto demais é AVISO, não erro: a norma diz 'convém'", () => {
    expect(conferirCom(resumoExtensao, (d) => (d.metadados.resumo = palavras(149)))).toEqual([
      {
        regra: "resumo-extensao",
        gravidade: "aviso",
        item: "NBR 6028:2021 §4.1.8 a)",
        mensagem:
          "O resumo tem 149 palavras. A norma recomenda de 150 a 500 em trabalhos acadêmicos.",
        local: { tipo: "metadado", campo: "resumo" },
      },
    ]);
  });

  it("os limites são inclusivos", () => {
    expect(conferirCom(resumoExtensao, (d) => (d.metadados.resumo = palavras(150)))).toEqual([]);
    expect(conferirCom(resumoExtensao, (d) => (d.metadados.resumo = palavras(500)))).toEqual([]);
  });

  it("longo demais, no abstract: aviso no campo abstract", () => {
    expect(conferirCom(resumoExtensao, (d) => (d.metadados.abstract = palavras(501)))).toEqual([
      expect.objectContaining({
        gravidade: "aviso",
        local: { tipo: "metadado", campo: "abstract" },
      }),
    ]);
  });

  it("resumo vazio não é assunto desta regra (é de resumo-vernaculo)", () => {
    expect(conferirCom(resumoExtensao, (d) => (d.metadados.resumo = ""))).toEqual([]);
  });

  it("o limite vem das regras resolvidas: um edital de até 300 palavras muda o achado", () => {
    const documento = documentoConforme();
    documento.metadados.resumo = palavras(320);
    const regras = resolveRules("abnt", null, {
      titulo: "Edital",
      regras: { limites: { resumoPalavras: { max: 300 } } },
    }).regras;

    const [achado] = conferirDocumento(documento, regras, [resumoExtensao]);
    expect(achado.mensagem).toContain("de 150 a 300");
  });

  it("conta palavras, não marcas soltas: o travessão sozinho não conta", () => {
    // Um, texto, com, travessão, e, 3, números, 1, 2.
    expect(contarPalavras("Um texto — com travessão, e 3 números: 1, 2.")).toBe(9);
  });
});

describe("resumo-paragrafo-unico (6028 §4.1.2, 'deve')", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(resumoParagrafoUnico)).toEqual([]);
  });

  it("dois parágrafos: erro", () => {
    expect(
      conferirCom(resumoParagrafoUnico, (d) => (d.metadados.resumo = "Primeiro.\n\nSegundo.")),
    ).toEqual([
      expect.objectContaining({
        gravidade: "erro",
        item: "NBR 6028:2021 §4.1.2",
        local: { tipo: "metadado", campo: "resumo" },
      }),
    ]);
  });

  it("enumeração de tópicos, uma por linha: erro", () => {
    expect(
      conferirCom(resumoParagrafoUnico, (d) => (d.metadados.abstract = "- one\n- two")),
    ).toEqual([expect.objectContaining({ local: { tipo: "metadado", campo: "abstract" } })]);
  });

  it("quebra de linha só no fim não conta", () => {
    expect(
      conferirCom(resumoParagrafoUnico, (d) => (d.metadados.resumo = "Um parágrafo só.\n\n")),
    ).toEqual([]);
  });
});

describe("palavras-chave-minusculas (6028 §4.1.7)", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(palavrasChaveMinusculas)).toEqual([]);
  });

  it("inicial maiúscula é AVISO, porque pode ser nome próprio", () => {
    expect(
      conferirCom(palavrasChaveMinusculas, (d) => (d.metadados.palavrasChave = ["Formatação"])),
    ).toEqual([
      expect.objectContaining({
        gravidade: "aviso",
        item: "NBR 6028:2021 §4.1.7",
        local: { tipo: "metadado", campo: "palavrasChave" },
      }),
    ]);
  });

  it("um achado por termo, também nas keywords", () => {
    const achados = conferirCom(palavrasChaveMinusculas, (d) => {
      d.metadados.keywords = ["Formatting", "Standards", "paper"];
    });
    expect(achados).toHaveLength(2);
    expect(achados[0].local).toEqual({ tipo: "metadado", campo: "keywords" });
  });

  it("sigla toda em maiúsculas não é avisada (IBGE, no exemplo da própria norma)", () => {
    expect(
      conferirCom(
        palavrasChaveMinusculas,
        (d) => (d.metadados.palavrasChave = ["IBGE", "gestação"]),
      ),
    ).toEqual([]);
  });
});
