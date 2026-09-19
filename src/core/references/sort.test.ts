import { describe, expect, it } from "vitest";

import { referenciaEmTexto } from "./format/abnt";
import { compararReferencias, elementoDeEntrada, ordenarReferencias } from "./sort";
import type { Referencia, ReferenciaLivro } from "./types";

// §9.1 da NBR 6023:2025, via docs/auditoria-abnt.md: "em ordem alfabética dos
// elementos; havendo numerais, ordem crescente".

function livro(campos: Partial<ReferenciaLivro> & { id: string; title: string }): ReferenciaLivro {
  return {
    type: "book",
    "publisher-place": "São Paulo",
    publisher: "Atlas",
    issued: { "date-parts": [[2020]] },
    ...campos,
  };
}

function idsOrdenados(referencias: Referencia[]): string[] {
  return ordenarReferencias(referencias).map((referencia) => referencia.id);
}

describe("elemento de entrada (§8.1.1, §8.1.2, §8.1.4)", () => {
  it("é o sobrenome do primeiro autor", () => {
    const referencia = livro({
      id: "a",
      title: "Qualquer",
      author: [
        { family: "Andrade", given: "Carlos" },
        { family: "Álvares", given: "Ana" },
      ],
    });

    expect(elementoDeEntrada(referencia)).toBe("Andrade");
  });

  it("é o nome inteiro da entidade, sem inverter", () => {
    const referencia = livro({
      id: "b",
      title: "Qualquer",
      author: [{ literal: "Associação Brasileira de Normas Técnicas" }],
    });

    expect(elementoDeEntrada(referencia)).toBe("Associação Brasileira de Normas Técnicas");
  });

  it("é o título quando não há autoria (§8.1.4)", () => {
    expect(elementoDeEntrada(livro({ id: "c", title: "Diagnóstico do setor editorial" }))).toBe(
      "Diagnóstico do setor editorial",
    );
  });

  it("ignora linha de autoria deixada vazia no formulário", () => {
    const referencia = livro({
      id: "d",
      title: "Qualquer",
      author: [{ family: "   " }, { family: "Borges", given: "Ana" }],
    });

    expect(elementoDeEntrada(referencia)).toBe("Borges");
  });

  // Se as duas funções discordarem sobre haver autoria, a referência sai
  // formatada por título e ordenada por autor — ou o contrário. As duas
  // perguntam a mesma coisa a `temAutoria()`, e este teste trava isso.
  it("concorda com o formatador sobre entrar por autor ou por título", () => {
    const comAutor = livro({ id: "e", title: "Obra", author: [{ family: "Silva" }] });
    const semAutor = livro({ id: "f", title: "Obra sem dono" });

    expect(referenciaEmTexto(comAutor).startsWith("SILVA.")).toBe(true);
    expect(referenciaEmTexto(semAutor).startsWith("OBRA sem dono.")).toBe(true);
    expect(elementoDeEntrada(comAutor)).toBe("Silva");
    expect(elementoDeEntrada(semAutor)).toBe("Obra sem dono");
  });
});

describe("ordem alfabética com colação pt-BR", () => {
  // O critério de aceite do passo: em comparação por código de caractere, "Á"
  // (U+00C1) vem depois de todo o alfabeto e Álvares cairia no fim da lista.
  it("Álvares vem antes de Andrade", () => {
    const referencias = [
      livro({ id: "andrade", title: "B", author: [{ family: "Andrade", given: "Carlos" }] }),
      livro({ id: "alvares", title: "A", author: [{ family: "Álvares", given: "Ana" }] }),
    ];

    expect(idsOrdenados(referencias)).toEqual(["alvares", "andrade"]);
  });

  it("o cedilha ordena como c, não no fim", () => {
    const referencias = [
      livro({ id: "adao", title: "A", author: [{ family: "Adão" }] }),
      livro({ id: "acores", title: "B", author: [{ family: "Açores" }] }),
      livro({ id: "afonso", title: "C", author: [{ family: "Afonso" }] }),
    ];

    expect(idsOrdenados(referencias)).toEqual(["acores", "adao", "afonso"]);
  });

  it("acento só desempata quando as letras de base são iguais", () => {
    const referencias = [
      livro({ id: "avila-acento", title: "A", author: [{ family: "Ávila" }] }),
      livro({ id: "avila-sem", title: "A", author: [{ family: "Avila" }] }),
    ];

    expect(idsOrdenados(referencias)).toEqual(["avila-sem", "avila-acento"]);
  });

  it("autor corporativo entra na mesma ordem que os autores pessoais", () => {
    const referencias = [
      livro({ id: "silva", title: "C", author: [{ family: "Silva", given: "Maria" }] }),
      livro({
        id: "abnt",
        title: "A",
        author: [{ literal: "Associação Brasileira de Normas Técnicas" }],
      }),
      livro({ id: "moura", title: "B", author: [{ family: "Moura", given: "Rui" }] }),
    ];

    expect(idsOrdenados(referencias)).toEqual(["abnt", "moura", "silva"]);
  });

  it("obra sem autoria se intercala pelo título, não vai para o fim", () => {
    const referencias = [
      livro({ id: "zanetti", title: "Z", author: [{ family: "Zanetti" }] }),
      livro({ id: "diagnostico", title: "Diagnóstico do setor editorial" }),
      livro({ id: "aguiar", title: "A", author: [{ family: "Aguiar" }] }),
    ];

    expect(idsOrdenados(referencias)).toEqual(["aguiar", "diagnostico", "zanetti"]);
  });
});

describe("numerais em ordem crescente (§9.1)", () => {
  it("2 vem antes de 10, e não na ordem do caractere", () => {
    const referencias = [
      livro({ id: "dez", title: "10 anos de pesquisa" }),
      livro({ id: "dois", title: "2 décadas de política" }),
    ];

    expect(idsOrdenados(referencias)).toEqual(["dois", "dez"]);
  });
});

describe("desempate pelos demais elementos (§9.1, 'dos elementos')", () => {
  it("mesmo autor: ordena pelo que vem depois na referência", () => {
    const referencias = [
      livro({ id: "z", title: "Zoologia", author: [{ family: "Silva", given: "Maria" }] }),
      livro({ id: "a", title: "Antropologia", author: [{ family: "Silva", given: "Maria" }] }),
    ];

    expect(idsOrdenados(referencias)).toEqual(["a", "z"]);
  });

  it("mesmo sobrenome, prenomes diferentes: desempata pelo prenome", () => {
    const referencias = [
      livro({ id: "bruno", title: "Obra", author: [{ family: "Silva", given: "Bruno" }] }),
      livro({ id: "ana", title: "Obra", author: [{ family: "Silva", given: "Ana" }] }),
    ];

    expect(idsOrdenados(referencias)).toEqual(["ana", "bruno"]);
  });

  it("referências idênticas no conteúdo comparam como iguais", () => {
    const uma = livro({ id: "1", title: "Obra", author: [{ family: "Silva" }] });
    const outra = livro({ id: "2", title: "Obra", author: [{ family: "Silva" }] });

    expect(compararReferencias(uma, outra)).toBe(0);
  });
});

describe("contrato da função", () => {
  it("não reordena a lista de quem chamou", () => {
    const original = [
      livro({ id: "z", title: "Z", author: [{ family: "Zanetti" }] }),
      livro({ id: "a", title: "A", author: [{ family: "Aguiar" }] }),
    ];
    const antes = original.map((referencia) => referencia.id);

    ordenarReferencias(original);

    expect(original.map((referencia) => referencia.id)).toEqual(antes);
  });

  it("lista vazia não quebra", () => {
    expect(ordenarReferencias([])).toEqual([]);
  });

  it("ordena tipos diferentes na mesma lista", () => {
    const referencias: Referencia[] = [
      {
        id: "site",
        type: "webpage",
        title: "Página",
        author: [{ family: "Teixeira", given: "Rui" }],
        URL: "https://exemplo.org",
      },
      {
        id: "tese",
        type: "thesis",
        title: "Estudo",
        author: [{ family: "Barbosa", given: "Ana" }],
        tipoTrabalho: "Dissertação",
      },
      livro({ id: "livro", title: "Manual", author: [{ family: "Moreira", given: "Ana" }] }),
    ];

    expect(idsOrdenados(referencias)).toEqual(["tese", "livro", "site"]);
  });
});
