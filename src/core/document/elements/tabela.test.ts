import { describe, expect, it } from "vitest";

import { proporcoesDasColunas } from "./tabela";

const arredondar = (valores: number[]) => valores.map((valor) => Math.round(valor * 100));

describe("proporcoesDasColunas", () => {
  it("textos curtos que cabem: colunas quase iguais, como antes", () => {
    expect(arredondar(proporcoesDasColunas([["Ano", "Valor"], ["2020", "1234"]]))).toEqual([
      49, 51,
    ]);
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
    const proporcoes = proporcoesDasColunas([["Tipo de Canal", "Propósito Primário"], ["Critical Safety of Life", "Prevenção de acidentes e proteção à vida"]]);
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
