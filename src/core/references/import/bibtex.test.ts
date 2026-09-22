import { describe, expect, it } from "vitest";

import { decodificarLatex, dividirNoNivelZero, lerBibtex } from "./bibtex";

describe("lerBibtex — sintaxe", () => {
  it("lê tipo, chave e campos, com nome de campo e tipo em minúsculas", () => {
    const { entradas, erros } = lerBibtex(`@Book{chave1, Title = {Um}, YEAR = 2020}`);

    expect(erros).toEqual([]);
    expect(entradas).toEqual([
      { tipo: "book", chave: "chave1", campos: { title: "Um", year: "2020" }, linha: 1 },
    ]);
  });

  it("aceita valor entre aspas, entre chaves, número e vírgula sobrando", () => {
    const { entradas } = lerBibtex(
      `@misc{a, title = "Com aspas", note = {Com chaves}, year = 1999,}`,
    );

    expect(entradas[0].campos).toEqual({ title: "Com aspas", note: "Com chaves", year: "1999" });
  });

  it("aceita entrada delimitada por parênteses", () => {
    const { entradas } = lerBibtex(`@book(a, title = {Com (parênteses) dentro})`);

    expect(entradas[0].campos.title).toBe("Com (parênteses) dentro");
  });

  it("preserva as chaves internas, que ainda carregam informação", () => {
    const { entradas } = lerBibtex(`@book{a, title = {{ABNT}: {a norma {\\'e} {a} lei}}}`);

    expect(entradas[0].campos.title).toBe("{ABNT}: {a norma {\\'e} {a} lei}");
  });

  it("aspas dentro de chaves não fecham o valor", () => {
    const { entradas } = lerBibtex(`@book{a, title = "Um {"entre"} aspas"}`);

    expect(entradas[0].campos.title).toBe('Um {"entre"} aspas');
  });

  it("resolve @string e concatenação com #", () => {
    const { entradas } = lerBibtex(`
      @string{ed = "Editora"}
      @STRING(cidade = {Recife})
      @book{a, publisher = ed # { } # "Universitária", address = cidade}
    `);

    expect(entradas[0].campos).toEqual({ publisher: "Editora Universitária", address: "Recife" });
  });

  it("resolve as macros de mês sem @string", () => {
    const { entradas } = lerBibtex(`@article{a, month = sep}`);

    expect(entradas[0].campos.month).toBe("9");
  });

  it("ignora @comment, @preamble e texto fora de entrada", () => {
    const { entradas, erros } = lerBibtex(`
      Texto solto é comentário, até com e-mail: pessoa@exemplo.
      @comment{jabref-meta: {grupos}}
      @preamble{"\\newcommand{\\x}{y}"}
      @book{a, title = {Único}}
    `);

    expect(erros).toEqual([]);
    expect(entradas.map((entrada) => entrada.chave)).toEqual(["a"]);
  });

  it("no campo repetido, vale o primeiro", () => {
    const { entradas } = lerBibtex(`@book{a, title = {Primeiro}, title = {Segundo}}`);

    expect(entradas[0].campos.title).toBe("Primeiro");
  });

  it("campo chamado __proto__ vira campo comum", () => {
    const { entradas } = lerBibtex(`@book{a, __proto__ = {x}, constructor = {y}}`);

    expect(Object.hasOwn(entradas[0].campos, "__proto__")).toBe(true);
    expect(entradas[0].campos.constructor).toBe("y");
    expect(Object.getPrototypeOf(entradas[0].campos)).toBeNull();
  });

  it("guarda a linha em que cada entrada começa", () => {
    const { entradas } = lerBibtex(`% cabeçalho\n\n@book{a, title={X}}\n@book{b,\n title={Y}}`);

    expect(entradas.map((entrada) => entrada.linha)).toEqual([3, 4]);
  });
});

describe("lerBibtex — uma entrada ruim não derruba o arquivo", () => {
  it("chave sem fechar vira erro, e a entrada seguinte é lida", () => {
    const { entradas, erros } = lerBibtex(
      [
        "@book{antes, title = {Antes}}",
        "@book{quebrada,",
        "  title = {Nunca fecha,",
        "  year = 2020",
        "}",
        "@book{depois, title = {Depois}}",
      ].join("\n"),
    );

    expect(entradas.map((entrada) => entrada.chave)).toEqual(["antes", "depois"]);
    // O erro aponta a entrada quebrada e a linha em que ela começa — não a
    // linha em que a leitura parou, que já é a entrada seguinte.
    expect(erros).toEqual([
      {
        linha: 2,
        chave: "quebrada",
        mensagem: 'faltou uma vírgula entre dois campos — ou uma chave "}" ficou sem fechar antes',
        linhaDaParada: 6,
      },
    ]);
  });

  it("grupo que nunca fecha até o fim do arquivo não engole as entradas seguintes", () => {
    const { entradas, erros } = lerBibtex(
      ["@book{quebrada, title = {Sem fim", "@book{depois, title = {Depois}}"].join("\n"),
    );

    expect(entradas.map((entrada) => entrada.chave)).toEqual(["depois"]);
    expect(erros).toEqual([
      {
        linha: 1,
        chave: "quebrada",
        mensagem: 'uma chave "{" ou aspas abertas aqui nunca foram fechadas',
        linhaDaParada: 1,
      },
    ]);
  });

  it("macro não definida é erro da entrada, não do arquivo", () => {
    const { entradas, erros } = lerBibtex(
      ["@book{a, publisher = inexistente}", "@book{b, title = {B}}"].join("\n"),
    );

    expect(entradas.map((entrada) => entrada.chave)).toEqual(["b"]);
    expect(erros[0].mensagem).toContain("inexistente");
  });

  it("entrada sem chave vira erro", () => {
    const { entradas, erros } = lerBibtex(`@book{, title = {X}}\n@book{b, title={B}}`);

    expect(entradas.map((entrada) => entrada.chave)).toEqual(["b"]);
    expect(erros).toHaveLength(1);
    expect(erros[0]).not.toHaveProperty("chave");
  });

  it("erro num @string não leva a chave da entrada anterior", () => {
    const { erros } = lerBibtex(`@book{a, title = {A}}
@string{x "sem igual"}`);

    expect(erros).toHaveLength(1);
    expect(erros[0]).not.toHaveProperty("chave");
    expect(erros[0].linha).toBe(2);
  });

  it("arquivo vazio não é erro", () => {
    expect(lerBibtex("")).toEqual({ entradas: [], erros: [] });
  });
});

describe("decodificarLatex", () => {
  it.each([
    ["Jo{\\~a}o", "João"],
    ["Jo\\~ao", "João"],
    ["Concei{\\c{c}}{\\~a}o", "Conceição"],
    ["Avalia{\\c c}{\\~a}o", "Avaliação"],
    ["{\\'\\i}ndice", "índice"],
    ["\\'{\\i}ndice", "índice"],
    ["{\\'E}tica", "Ética"],
    ['M{\\"u}ller', "Müller"],
    ["{\\^e}", "ê"],
    ["{\\`a}", "à"],
    ["Stra{\\ss}e", "Straße"],
    ["{\\o}re", "øre"],
    ["Ciência \\& Tecnologia", "Ciência & Tecnologia"],
    ["100\\%", "100%"],
  ])("%s → %s", (entrada, saida) => {
    expect(decodificarLatex(entrada)).toBe(saida);
  });

  it("UTF-8 passa intacto", () => {
    expect(decodificarLatex("Pesquisa em educação: práticas")).toBe(
      "Pesquisa em educação: práticas",
    );
  });

  it("tira as chaves de proteção e o comando de formatação, mantendo o texto", () => {
    expect(decodificarLatex("{O {Método} \\textit{Científico}}")).toBe("O Método Científico");
  });

  it("de \\href fica o texto, não o endereço", () => {
    expect(decodificarLatex("\\href{https://x.org}{o site}")).toBe("o site");
  });

  it("-- e --- viram travessões; ~ e quebras de linha viram espaço simples", () => {
    expect(decodificarLatex("1990--2000 --- p.~45\n   fim")).toBe("1990–2000 — p. 45 fim");
  });

  it("devolve o texto em NFC, para a ordenação comparar igual ao digitado", () => {
    expect(decodificarLatex("{\\'a}")).toBe("\u00e1");
  });
});

describe("dividirNoNivelZero", () => {
  it("não divide dentro de chaves", () => {
    expect(dividirNoNivelZero("Ana and {Ciência and Tecnologia} and Bia", /\s+and\s+/i)).toEqual([
      "Ana",
      "{Ciência and Tecnologia}",
      "Bia",
    ]);
  });

  it("chave escapada não abre grupo", () => {
    expect(dividirNoNivelZero("a\\{b:c", /:/)).toEqual(["a\\{b", "c"]);
  });
});

describe("lerBibtex — comentários", () => {
  it("entrada comentada com % não é lida", () => {
    const { entradas, erros } = lerBibtex(
      [
        "% @book{desligada, title = {X}}",
        "  %@book{tambem, title = {Y}}",
        "@book{a, title={A}}",
      ].join("\n"),
    );

    expect(erros).toEqual([]);
    expect(entradas.map((entrada) => entrada.chave)).toEqual(["a"]);
  });

  it("% dentro de um valor não é comentário", () => {
    const { entradas } = lerBibtex(`@book{a, title = {100% de acerto},\n note = {@ e %}}`);

    expect(entradas[0].campos).toEqual({ title: "100% de acerto", note: "@ e %" });
  });
});
