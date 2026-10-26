import { describe, expect, it } from "vitest";

import { proporcoesDasColunas } from "./tabela";

const arredondar = (valores: number[]) => valores.map((valor) => Math.round(valor * 100));

describe("proporcoesDasColunas", () => {
  it("textos curtos que cabem: colunas quase iguais, como antes", () => {
    expect(
      arredondar(
        proporcoesDasColunas([
          ["Ano", "Valor"],
          ["2020", "1234"],
        ]),
      ),
    ).toEqual([49, 51]);
  });

  it("cronograma (o caso do TCC): atividades largas, meses estreitos sem quebrar 'Mês 1'", () => {
    const meses = ["Mês 1", "Mês 2", "Mês 3", "Mês 4", "Mês 5", "Mês 6"];
    const proporcoes = proporcoesDasColunas([
      ["Atividades", ...meses],
      ["Revisão bibliográfica e mapeamento do estado da arte", "X", "X", "", "", "", ""],
      ["Análise estatística dos dados e redação final da monografia", "", "", "", "", "X", "X"],
    ]);
    const [atividades, ...colunasDosMeses] = proporcoes;
    // Os meses ficam todos iguais, e com espaço para "Mês 1" inteiro.
    expect(new Set(colunasDosMeses.map((p) => p.toFixed(6))).size).toBe(1);
    expect(colunasDosMeses[0] * 58).toBeGreaterThanOrEqual(5); // 58 caracteres úteis
    expect(atividades).toBeGreaterThan(0.45);
  });

  it("a soma é sempre 1", () => {
    const proporcoes = proporcoesDasColunas([
      ["Tipo de Canal", "Propósito Primário"],
      ["Critical Safety of Life", "Prevenção de acidentes e proteção à vida"],
    ]);
    expect(proporcoes.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it("coluna vazia não some", () => {
    const [, vazia] = proporcoesDasColunas([["Um texto qualquer de tamanho médio", ""]]);
    expect(vazia).toBeGreaterThan(0);
  });

  it("tabela sem linha nenhuma: uma coluna inteira", () => {
    expect(proporcoesDasColunas([])).toEqual([1]);
  });
});

import { mapaDeMesclas, mesclaEm, normalizarMesclas } from "./tabela";
import type { CelulaTabela, LinhaTabela } from "../types";

// Passo 8.5.4: a regra única das mesclas.
const c = (extra: Partial<CelulaTabela> = {}): CelulaTabela => ({ cabecalho: false, ...extra });
const grade = (...linhas: CelulaTabela[][]): LinhaTabela[] =>
  linhas.map((celulas) => ({ celulas }));

describe("mapaDeMesclas", () => {
  it("acha as âncoras e o que elas cobrem", () => {
    const { mesclas, cobertas } = mapaDeMesclas([
      [c({ colspan: 2 }), c(), c()],
      [c({ rowspan: 2 }), c(), c()],
      [c(), c(), c()],
    ]);
    expect(mesclas).toEqual([
      { linha: 0, coluna: 0, linhas: 1, colunas: 2 },
      { linha: 1, coluna: 0, linhas: 2, colunas: 1 },
    ]);
    expect(cobertas).toEqual([
      [false, true, false],
      [false, false, false],
      [true, false, false],
    ]);
  });

  it("mescla que passa da borda, ou bate noutra, encolhe até caber", () => {
    const { mesclas } = mapaDeMesclas([
      [c({ colspan: 5 }), c(), c()],
      [c({ colspan: 2, rowspan: 9 }), c(), c()],
    ]);
    expect(mesclas).toEqual([
      { linha: 0, coluna: 0, linhas: 1, colunas: 3 },
      { linha: 1, coluna: 0, linhas: 1, colunas: 2 },
    ]);
  });

  it("vão absurdo ou inválido vale 1", () => {
    const { mesclas } = mapaDeMesclas([[c({ colspan: -3 }), c({ colspan: 1.5 }), c()]]);
    expect(mesclas).toEqual([]);
  });

  it("mesclaEm acha a mescla de qualquer célula dela", () => {
    const { mesclas } = mapaDeMesclas([
      [c({ colspan: 2, rowspan: 2 }), c(), c()],
      [c(), c(), c()],
    ]);
    expect(mesclaEm(mesclas, 1, 1)).toEqual(mesclas[0]);
    expect(mesclaEm(mesclas, 1, 2)).toBeNull();
  });
});

describe("normalizarMesclas", () => {
  it("marca as cobertas, esvazia-as e limpa o que não é mescla", () => {
    const texto = [{ type: "text" as const, text: "x" }];
    const saida = normalizarMesclas(
      grade(
        [
          c({ colspan: 2, content: texto }),
          c({ content: texto, coberta: true }),
          c({ rowspan: 1 }),
        ],
        [c({ coberta: true }), c(), c()],
      ),
    );
    expect(saida).toEqual([
      {
        celulas: [
          { cabecalho: false, content: texto, colspan: 2 },
          { cabecalho: false, coberta: true },
          { cabecalho: false },
        ],
      },
      { celulas: [{ cabecalho: false }, { cabecalho: false }, { cabecalho: false }] },
    ]);
  });
});
