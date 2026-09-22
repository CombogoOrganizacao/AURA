import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { referenciaEmTexto } from "../format/abnt";
import type { ReferenciaLivro } from "../types";
import { importarBibtex, type ResultadoImportacao } from "./bibtexToCsl";

function contador(): () => string {
  let n = 0;
  return () => `ref-${++n}`;
}

function importar(fonte: string): ResultadoImportacao {
  return importarBibtex(fonte, contador());
}

// Uma entrada, convertida — para os testes de detalhe.
function unica(fonte: string) {
  const { importadas, descartadas, erros } = importar(fonte);
  expect(descartadas).toEqual([]);
  expect(erros).toEqual([]);
  expect(importadas).toHaveLength(1);
  return importadas[0];
}

describe("importarBibtex — um .bib real (fixtures/exemplo.bib)", () => {
  const fonte = readFileSync(join(__dirname, "fixtures", "exemplo.bib"), "utf-8");
  const resultado = importar(fonte);
  const porChave = new Map(resultado.importadas.map((item) => [item.chave, item]));

  it("cada entrada termina em exatamente um lugar", () => {
    expect(resultado.importadas.map((item) => item.chave)).toEqual([
      "freire1987",
      "bauman1999",
      "knuth1984",
      "vaswani2017",
      "nash1950",
      "silva2021",
      "costa2019",
      "abnt",
    ]);
    expect(resultado.descartadas.map((item) => [item.chave, item.tipo])).toEqual([
      ["relatorio2020", "techreport"],
      ["semendereco", "misc"],
    ]);
    // `quebrada` não fecha a chave do título: erro de sintaxe, apontando a
    // entrada e a linha em que ela começa. A chave "fecha" no "}" que era da
    // entrada, e a leitura para no que vem depois — a `@misc` seguinte, que
    // mesmo assim é lida no recomeço.
    expect(resultado.erros).toHaveLength(1);
    const [erro] = resultado.erros;
    const linhas = fonte.split(/\r?\n/);
    expect(erro.chave).toBe("quebrada");
    expect(linhas[erro.linha - 1]).toBe("@article{quebrada,");
    expect(linhas[erro.linhaDaParada - 1]).toBe("@misc{abnt,");
  });

  it("@book, com @string, edição e campos em maiúsculas", () => {
    expect(porChave.get("freire1987")?.referencia).toEqual({
      id: expect.stringMatching(/^ref-\d+$/),
      type: "book",
      author: [{ family: "Freire", given: "Paulo" }],
      title: "Pedagogia do oprimido",
      edicao: { numero: 17 },
      publisher: "Paz e Terra",
      "publisher-place": "Rio de Janeiro",
      issued: { "date-parts": [[1987]] },
    });

    expect(porChave.get("bauman1999")?.referencia).toMatchObject({
      type: "book",
      author: [{ family: "Bauman", given: "Zygmunt" }],
      title: "Globalização",
      subtitle: "as consequências humanas",
      translator: [{ family: "Penchel", given: "Marcus" }],
      publisher: "Jorge Zahar",
      "publisher-place": "Rio de Janeiro",
    });
  });

  it("@article, com título protegido por chaves e mês por macro", () => {
    expect(porChave.get("knuth1984")?.referencia).toEqual({
      id: expect.any(String),
      type: "article-journal",
      author: [{ family: "Knuth", given: "Donald E." }],
      title: "Literate Programming",
      "container-title": "The Computer Journal",
      volume: "27",
      issue: "2",
      page: "97-111",
      issued: { "date-parts": [[1984, 2]] },
    });
  });

  it("@inproceedings: nome do evento vem do booktitle, com aviso; 'and others' avisa", () => {
    const item = porChave.get("vaswani2017")!;

    expect(item.referencia).toMatchObject({
      type: "paper-conference",
      title: "Attention is All you Need",
      "event-title": "Advances in Neural Information Processing Systems",
      page: "5998-6008",
    });
    expect(item.referencia.author).toHaveLength(3);
    expect(item.avisos).toHaveLength(2);
    expect(item.avisos.join(" ")).toContain("and others");
    expect(item.avisos.join(" ")).toContain("booktitle");
  });

  it("@phdthesis vira tese de doutorado", () => {
    expect(porChave.get("nash1950")?.referencia).toMatchObject({
      type: "thesis",
      author: [{ family: "Nash", given: "John F." }],
      tipoTrabalho: "Tese",
      grau: "Doutorado",
      publisher: "Princeton University",
    });
  });

  it("acentuação em LaTeX, chaves aninhadas e grau de parentesco no sobrenome", () => {
    expect(porChave.get("silva2021")?.referencia).toEqual({
      id: expect.any(String),
      type: "thesis",
      // §8.1.1.3: SILVA FILHO; a partícula "da" vai para o prenome.
      author: [{ family: "Silva Filho", given: "João da" }],
      title: "Avaliação de índices de Ética",
      subtitle: "um estudo de caso em São Paulo",
      tipoTrabalho: "Dissertação",
      grau: "Mestrado",
      publisher: "Universidade de São Paulo",
      "publisher-place": "São Paulo",
      issued: { "date-parts": [[2021]] },
      extensao: { quantidade: 82, unidade: "folha" },
    });
  });

  it("@incollection vira capítulo, com o livro separado em título e subtítulo", () => {
    const item = porChave.get("costa2019")!;

    expect(item.referencia).toMatchObject({
      type: "chapter",
      title: "Métodos qualitativos em educação",
      "container-title": "Pesquisa em educação",
      "container-subtitle": "caminhos e práticas",
      responsabilidade: {
        nomes: [
          { family: "Souza", given: "Ana" },
          { family: "Lima", given: "Pedro" },
        ],
        tipo: "editor",
      },
      edicao: { numero: 2 },
      page: "45-67",
    });
    expect(item.avisos.join(" ")).toContain("organizador");
  });

  it("@misc com \\url em howpublished vira site; entidade entre chaves não é invertida", () => {
    expect(porChave.get("abnt")?.referencia).toEqual({
      id: expect.any(String),
      type: "webpage",
      author: [{ literal: "Associação Brasileira de Normas Técnicas" }],
      title: "Normas ABNT",
      URL: "https://www.abnt.org.br/normalizacao",
      accessed: { "date-parts": [[2026, 9, 20]] },
      issued: { "date-parts": [[2026]] },
    });
  });

  it("o que foi importado passa pelo formatador da NBR 6023 sem erro", () => {
    for (const item of resultado.importadas) {
      expect(referenciaEmTexto(item.referencia)).not.toBe("");
    }
    expect(referenciaEmTexto(porChave.get("freire1987")!.referencia)).toBe(
      "FREIRE, Paulo. Pedagogia do oprimido. 17. ed. Rio de Janeiro: Paz e Terra, 1987.",
    );
  });

  it("nenhum campo sai vazio nem undefined", () => {
    for (const { referencia } of resultado.importadas) {
      for (const valor of Object.values(referencia)) {
        expect(valor).not.toBeUndefined();
        expect(valor).not.toBe("");
      }
    }
  });
});

describe("importarBibtex — o que não tem lugar é descartado com motivo", () => {
  it("tipo desconhecido", () => {
    const { importadas, descartadas } = importar(`@patent{p, title = {Invenção}}`);

    expect(importadas).toEqual([]);
    expect(descartadas).toEqual([
      {
        chave: "p",
        tipo: "patent",
        linha: 1,
        motivo: "O tipo @patent não tem correspondente entre os seis tipos do AURA.",
      },
    ]);
  });

  it("sem título", () => {
    const { descartadas } = importar(`@book{a, author = {Ana Souza}}`);
    expect(descartadas[0].motivo).toContain("título");
  });

  it("artigo sem periódico, capítulo sem livro, evento sem nome", () => {
    const { importadas, descartadas } = importar(`
      @article{a, title = {A}}
      @incollection{b, title = {B}}
      @inproceedings{c, title = {C}}
    `);

    expect(importadas).toEqual([]);
    expect(descartadas.map((item) => item.chave)).toEqual(["a", "b", "c"]);
  });

  it("@misc sem endereço", () => {
    const { descartadas } = importar(`@misc{a, title = {A}}`);
    expect(descartadas[0].motivo).toContain("url");
  });
});

describe("importarBibtex — nomes", () => {
  function autores(campo: string) {
    return unica(`@book{a, title = {T}, author = {${campo}}}`).referencia.author;
  }

  it("'Sobrenome, Prenome' e 'Prenome Sobrenome'", () => {
    expect(autores("Freire, Paulo and Maria Costa")).toEqual([
      { family: "Freire", given: "Paulo" },
      { family: "Costa", given: "Maria" },
    ]);
  });

  it("'Sobrenome, Jr, Prenome' junta o grau ao sobrenome", () => {
    expect(autores("Assaf, Neto, Alexandre")).toEqual([
      { family: "Assaf Neto", given: "Alexandre" },
    ]);
  });

  it("sobrenome composto protegido por chaves fica inteiro", () => {
    expect(autores("Gabriel {García Márquez}")).toEqual([
      { family: "García Márquez", given: "Gabriel" },
    ]);
  });

  it("'and' dentro de chaves não separa autores", () => {
    expect(autores("{Ministério da Ciência and Tecnologia}")).toEqual([
      { literal: "Ministério da Ciência and Tecnologia" },
    ]);
  });

  it("nome de uma palavra só vira sobrenome", () => {
    expect(autores("Platão")).toEqual([{ family: "Platão" }]);
  });
});

describe("importarBibtex — datas e edição", () => {
  function referencia(campos: string): ReferenciaLivro {
    const { referencia } = unica(`@book{a, title = {T}, ${campos}}`);
    if (referencia.type !== "book") throw new Error("esperava um livro");
    return referencia;
  }

  it("mês por extenso, em inglês ou português", () => {
    expect(referencia("year = 2020, month = {March}").issued).toEqual({
      "date-parts": [[2020, 3]],
    });
    expect(referencia("year = 2020, month = {set.}").issued).toEqual({ "date-parts": [[2020, 9]] });
  });

  it("ano que não é número vai para raw, sem inventar precisão", () => {
    expect(referencia("year = {no prelo}").issued).toEqual({ raw: "no prelo" });
  });

  it("date do biblatex vence year", () => {
    expect(referencia("date = {2019-05-10}, year = 2000").issued).toEqual({
      "date-parts": [[2019, 5, 10]],
    });
  });

  it("edição ordinal em inglês, com idioma do documento", () => {
    expect(referencia("edition = {Second}, langid = {english}").edicao).toEqual({
      numero: 2,
      idioma: "en",
    });
  });

  it("primeira edição não se declara (§8.3)", () => {
    expect(referencia("edition = {1}").edicao).toBeUndefined();
  });

  it("edição que não se reconhece fica de fora, com aviso", () => {
    const item = unica(`@book{a, title = {T}, edition = {Edição especial}}`);
    expect(item.referencia).not.toHaveProperty("edicao");
    expect(item.avisos[0]).toContain("Edição especial");
  });
});

describe("importarBibtex — trabalho acadêmico", () => {
  it("type em texto livre vence o padrão do tipo de entrada", () => {
    const { referencia } = unica(
      `@mastersthesis{a, title = {T}, type = {Trabalho de Conclusão de Curso}}`,
    );
    expect(referencia).toMatchObject({
      tipoTrabalho: "Trabalho de Conclusão de Curso",
      grau: "Mestrado",
    });
  });

  it("type que já traz o grau entre parênteses não o repete", () => {
    const { referencia } = unica(
      `@phdthesis{a, title = {T}, type = {Tese (Doutorado em Educação)}}`,
    );
    expect(referencia).toMatchObject({ tipoTrabalho: "Tese (Doutorado em Educação)" });
    expect(referencia).not.toHaveProperty("grau");
  });

  it("@thesis do biblatex lê o grau pela palavra-chave do type", () => {
    const { referencia } = unica(`@thesis{a, title = {T}, type = {phdthesis}}`);
    expect(referencia).toMatchObject({ tipoTrabalho: "Tese", grau: "Doutorado" });
  });

  it("@thesis sem type entra com aviso", () => {
    const item = unica(`@thesis{a, title = {T}}`);
    expect(item.referencia).toMatchObject({ tipoTrabalho: "Trabalho acadêmico" });
    expect(item.avisos).toHaveLength(1);
  });
});

describe("importarBibtex — endereço", () => {
  it("url não é decodificada como LaTeX: ~ e -- continuam no endereço", () => {
    const { referencia } = unica(`@misc{a, title = {T}, url = {https://x.org/~ana/a--b\\_c}}`);
    expect(referencia.URL).toBe("https://x.org/~ana/a--b_c");
  });
});
