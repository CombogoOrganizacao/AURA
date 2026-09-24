import { describe, expect, it } from "vitest";

import { novaFigura, novaFormula, novaTabela, novoDocumento } from "../document/factory";
import type { Documento, NoParagrafo } from "../document/types";
import { calcularEstatisticas, contarPalavras, paragrafosDoCorpo } from "./stats";

// Passo 5.4.1 — "Vitest com texto conhecido; a contagem de seleção funciona".

// 38 caracteres, 8 espaços, 7 palavras: os dois travessões soltos não contam.
const PRIMEIRO = "A pesquisa — de campo — durou 3 meses.";
// 18 caracteres, 1 espaço, 2 palavras.
const SEGUNDO = "Segundo parágrafo.";

function paragrafo(texto: string): NoParagrafo {
  return { type: "paragraph", content: [{ type: "text", text: texto }] };
}

describe("calcularEstatisticas", () => {
  it("conta palavras, caracteres com e sem espaço e parágrafos de um texto conhecido", () => {
    expect(calcularEstatisticas([PRIMEIRO, "", "   ", SEGUNDO])).toEqual({
      palavras: 9,
      caracteresComEspacos: 56,
      caracteresSemEspacos: 47,
      paragrafos: 2,
    });
  });

  it("não tem páginas nem tempo de leitura: só medidas, nenhuma estimativa", () => {
    expect(Object.keys(calcularEstatisticas([PRIMEIRO])).sort()).toEqual([
      "caracteresComEspacos",
      "caracteresSemEspacos",
      "palavras",
      "paragrafos",
    ]);
  });

  it("texto vazio dá zero em tudo", () => {
    expect(calcularEstatisticas([])).toEqual({
      palavras: 0,
      caracteresComEspacos: 0,
      caracteresSemEspacos: 0,
      paragrafos: 0,
    });
  });

  it("conta a seleção: um trecho no meio de um parágrafo", () => {
    // O editor entrega a seleção como texto; um pedaço de palavra conta
    // como palavra, como no Word.
    const selecao = PRIMEIRO.slice(PRIMEIRO.indexOf("quisa"), PRIMEIRO.indexOf("po —") + 2);
    expect(selecao).toBe("quisa — de campo");

    expect(calcularEstatisticas([selecao])).toEqual({
      palavras: 3,
      caracteresComEspacos: 16,
      caracteresSemEspacos: 13,
      paragrafos: 1,
    });
  });

  it("conta a seleção que atravessa parágrafos, separados por quebra de linha", () => {
    const selecao = "durou 3 meses.\nSegundo";

    expect(calcularEstatisticas(selecao.split("\n"))).toMatchObject({
      palavras: 4,
      paragrafos: 2,
    });
  });

  it("um caractere fora do plano básico conta um, não dois", () => {
    expect(calcularEstatisticas(["𝛼 e 𝛽"])).toMatchObject({
      caracteresComEspacos: 5,
      caracteresSemEspacos: 3,
    });
  });
});

describe("contarPalavras", () => {
  it("a mesma conta da regra do resumo: hífen e travessão soltos não são palavra", () => {
    expect(contarPalavras("Estudo - de caso – com travessão — e sócio-econômico.")).toBe(7);
  });
});

describe("paragrafosDoCorpo", () => {
  function documento(): Documento {
    const doc = novoDocumento();
    const tabela = novaTabela(2, 1);
    tabela.legenda = "Legenda da tabela";
    tabela.fonte = "Fonte da tabela";
    tabela.linhas[0].celulas[0].content = [{ type: "text", text: "Célula A" }];
    tabela.linhas[0].celulas[1].content = [{ type: "text", text: "Célula B" }];
    const figura = { ...novaFigura(), legenda: "Legenda da figura", fonte: "Fonte da figura" };

    // Fora de ordem no array: a ordem de leitura é por `ordem`.
    doc.sections = [
      {
        id: "s2",
        ordem: 1,
        nivel: 1,
        titulo: "Desenvolvimento",
        content: [tabela, novaFormula("E = mc^2"), figura],
      },
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "Introdução",
        content: [
          paragrafo("Primeiro parágrafo."),
          { type: "paragraph" },
          {
            type: "citacao_longa",
            refId: null,
            pagina: "",
            content: [{ type: "text", text: "Citação longa." }],
          },
        ],
      },
    ];
    doc.apendices = [{ id: "a1", titulo: "Questionário", content: [paragrafo("Pergunta um.")] }];
    return doc;
  }

  it("junta títulos, parágrafos, citação longa, tabela e legendas, na ordem de leitura", () => {
    expect(paragrafosDoCorpo(documento())).toEqual([
      "Introdução",
      "Primeiro parágrafo.",
      "Citação longa.",
      "Desenvolvimento",
      "Legenda da tabela",
      "Célula A",
      "Célula B",
      "Fonte da tabela",
      "Legenda da figura",
      "Fonte da figura",
      "Questionário",
      "Pergunta um.",
    ]);
  });

  it("fórmula e pré-textuais não entram", () => {
    const doc = documento();
    doc.metadados.resumo = "Um resumo que não é corpo.";
    const texto = paragrafosDoCorpo(doc).join(" ");

    expect(texto).not.toContain("mc^2");
    expect(texto).not.toContain("resumo");
  });

  it("documento novo, sem nada escrito, dá zero", () => {
    expect(calcularEstatisticas(paragrafosDoCorpo(novoDocumento()))).toMatchObject({
      palavras: 0,
      paragrafos: 0,
    });
  });
});
