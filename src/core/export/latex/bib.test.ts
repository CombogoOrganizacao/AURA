import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { importarBibtex } from "../../references/import/bibtexToCsl";
import type { Referencia } from "../../references/types";
import { escaparBib, gerarBib } from "./bib";

// Passo 6.2.3 — `referencias.bib`. O critério é o round-trip: importar um
// `.bib`, exportar e importar de novo dá as mesmas referências.

function contador(): () => string {
  let n = 0;
  return () => `ref-${++n}`;
}

function reimportar(referencias: readonly Referencia[]) {
  const resultado = importarBibtex(gerarBib(referencias), contador());
  expect(resultado.erros).toEqual([]);
  expect(resultado.descartadas).toEqual([]);
  return resultado.importadas;
}

describe("gerarBib — round-trip com o importador", () => {
  it("o .bib de exemplo do importador: importar, exportar e reimportar preserva os campos", () => {
    const fonte = readFileSync(
      join(__dirname, "..", "..", "references", "import", "fixtures", "exemplo.bib"),
      "utf-8",
    );
    const originais = importarBibtex(fonte, contador()).importadas.map((item) => item.referencia);
    expect(originais.length).toBeGreaterThan(5);

    const devolvidas = reimportar(originais);

    expect(devolvidas.map((item) => item.referencia)).toEqual(originais);
    // A chave é o id da referência, o `refId` do `\auracite`.
    expect(devolvidas.map((item) => item.chave)).toEqual(originais.map((ref) => ref.id));
  });

  it("caracteres especiais, entidade, partícula e dois-pontos no título voltam iguais", () => {
    const referencias: Referencia[] = [
      {
        id: "r1",
        type: "book",
        author: [
          { literal: "Associação Brasileira de Normas Técnicas" },
          { family: "de Souza", given: "Ana" },
          { family: "Silva", given: "João da" },
        ],
        title: "ABNT: guia & 100% prático_ #1 {x} ~ ^ \\ $5",
        issued: { "date-parts": [[2020, 3]] },
        edicao: { numero: 3, idioma: "pt" },
        publisher: "Editora & Cia",
        "publisher-place": "São Paulo",
        URL: "https://exemplo.org/a_b%20c#d",
        accessed: { "date-parts": [[2026, 9, 29]] },
      },
      {
        id: "r2",
        type: "thesis",
        author: [{ family: "Costa", given: "Maria" }],
        title: "Formatação",
        subtitle: "um estudo: parte 1",
        issued: { raw: "[2019?]" },
        tipoTrabalho: "Dissertação",
        grau: "Mestrado",
        publisher: "UFES",
        orientador: [{ family: "Lima", given: "Paulo" }],
        extensao: { quantidade: 120, unidade: "folha" },
      },
      {
        id: "r3",
        type: "chapter",
        author: [{ family: "Rocha", given: "Ana" }],
        title: "Capítulo",
        "container-title": "Livro: com dois-pontos",
        responsabilidade: { nomes: [{ family: "Alves", given: "Rui" }], tipo: "organizador" },
        page: "45-67",
        issued: { "date-parts": [[2018]] },
      },
      {
        id: "r4",
        type: "paper-conference",
        title: "Trabalho",
        "event-title": "Congresso Brasileiro",
        "container-title": "Anais",
        "event-place": "Vitória",
        "event-date": { "date-parts": [[2024, 10, 2]] },
        page: "1-10",
      },
      {
        id: "r5",
        type: "webpage",
        title: "Página",
        "container-title": "Portal",
        URL: "https://exemplo.org/~pagina",
      },
      {
        id: "r6",
        type: "article-journal",
        author: [{ family: "Nunes", given: "Lia" }],
        title: "Artigo",
        "container-title": "Revista",
        volume: "12",
        issue: "3",
        page: "7-9",
        issued: { "date-parts": [[2021]] },
      },
    ];

    const devolvidas = reimportar(referencias).map((item, indice) => ({
      ...item.referencia,
      id: referencias[indice].id,
    }));

    // Título e livro com dois-pontos e sem subtítulo só voltam inteiros
    // porque saem entre chaves: o importador separa no dois-pontos.
    expect(devolvidas).toEqual(referencias);
  });

  it("campo que o importador não lê não sai (vale a versão do AURA, §1.5)", () => {
    const bib = gerarBib([
      {
        id: "t1",
        type: "thesis",
        title: "Tese",
        tipoTrabalho: "Tese",
        grau: "Doutorado",
        curso: "Letras",
        defesa: { "date-parts": [[2020]] },
      },
    ]);
    expect(bib).toContain("@phdthesis{t1,");
    expect(bib).not.toContain("Letras");
  });
});

describe("escaparBib", () => {
  it("escapa os especiais com a forma que decodificarLatex desfaz", () => {
    expect(escaparBib("a & b % c $ d # e _ f { } ~ ^ \\")).toBe(
      "a \\& b \\% c \\$ d \\# e \\_ f \\{ \\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}",
    );
  });
});

describe("gerarBib — forma do arquivo", () => {
  it("url sai crua (verbatim no biblatex), só com chave codificada", () => {
    const bib = gerarBib([
      { id: "s", type: "webpage", title: "Página", URL: "https://a.org/b?q=1&c=2#x{y}" },
    ]);
    expect(bib).toContain("url = {https://a.org/b?q=1&c=2#x%7By%7D}");
  });

  it("cabeçalho diz que o main.tex não o usa; lista vazia sai só com ele", () => {
    const bib = gerarBib([]);
    expect(bib).toContain("O main.tex não usa este arquivo");
    expect(bib).not.toContain("@");
  });
});
