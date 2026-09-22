import { describe, expect, it } from "vitest";

import type { Referencia } from "../../references/types";
import { gerarListaReferencias } from "./referencias";

const BAUMAN: Referencia = {
  id: "bauman",
  type: "book",
  author: [{ family: "Bauman", given: "Zygmunt" }],
  title: "Globalização",
  subtitle: "as consequências humanas",
  publisher: "Jorge Zahar",
  "publisher-place": "Rio de Janeiro",
  issued: { "date-parts": [[1999]] },
};

const ALVARES: Referencia = {
  id: "alvares",
  type: "book",
  author: [{ family: "Álvares", given: "Ana" }],
  title: "Pesquisa",
  publisher: "Atlas",
  "publisher-place": "São Paulo",
  issued: { "date-parts": [[2020]] },
};

const SEM_AUTOR: Referencia = {
  id: "anteprojeto",
  type: "book",
  title: "Anteprojeto de lei",
  issued: { "date-parts": [[1987]] },
};

describe("gerarListaReferencias (NBR 14724 §4.2.3.1, NBR 6023 §6.7 e §9.1)", () => {
  it("sem referência nenhuma, não há lista — nada de REFERÊNCIAS vazio", () => {
    expect(gerarListaReferencias([])).toBeNull();
  });

  it("uma lista só, com o título da 14724", () => {
    expect(gerarListaReferencias([BAUMAN])?.titulo).toBe("REFERÊNCIAS");
  });

  it("em ordem alfabética, não na ordem de cadastro (§9.1)", () => {
    const lista = gerarListaReferencias([BAUMAN, SEM_AUTOR, ALVARES]);

    // Álvares antes de Anteprojeto antes de Bauman: colação pt-BR (4.4).
    expect(lista?.entradas.map((entrada) => entrada.id)).toEqual([
      "alvares",
      "anteprojeto",
      "bauman",
    ]);
  });

  it("cada entrada é a referência formatada pela 6023, com o título marcado", () => {
    const [entrada] = gerarListaReferencias([BAUMAN])!.entradas;

    expect(entrada.trechos.map((trecho) => trecho.texto).join("")).toBe(
      "BAUMAN, Zygmunt. Globalização: as consequências humanas. Rio de Janeiro: Jorge Zahar, 1999.",
    );
    expect(entrada.trechos.filter((trecho) => trecho.papel === "titulo")).toEqual([
      { texto: "Globalização", papel: "titulo" },
    ]);
  });

  it("não reordena a lista de quem chamou", () => {
    const cadastro = [BAUMAN, ALVARES];
    gerarListaReferencias(cadastro);

    expect(cadastro.map((referencia) => referencia.id)).toEqual(["bauman", "alvares"]);
  });
});
