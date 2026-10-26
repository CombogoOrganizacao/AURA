import { describe, expect, it } from "vitest";

import { fromDocumento, toDocumento } from "./serialize";
import type { NoTabela, Secao } from "./types";

// Passo 8.5.4 — a mescla atravessa o editor e volta ao documento.

const celula = (t: string) => ({ cabecalho: false, content: [{ type: "text" as const, text: t }] });

function comTabela(linhas: NoTabela["linhas"]): Secao[] {
  return [
    {
      id: "s1",
      ordem: 0,
      nivel: 1,
      titulo: "A",
      content: [{ type: "tabela", id: "t1", legenda: "", fonte: "", linhas }],
    },
  ];
}

function linhasDe(secoes: Secao[]): NoTabela["linhas"] {
  return (secoes[0].content[0] as NoTabela).linhas;
}

describe("fromDocumento / toDocumento — células mescladas", () => {
  it("âncora e coberta fazem o round-trip", () => {
    const secoes = comTabela([
      {
        celulas: [
          { ...celula("Ano"), colspan: 2 },
          { cabecalho: false, coberta: true },
        ],
      },
      { celulas: [celula("2020"), celula("2021")] },
    ]);
    expect(toDocumento(fromDocumento(secoes))).toEqual(secoes);
  });

  it("a tabela sem mescla não ganha campo novo", () => {
    const secoes = comTabela([{ celulas: [celula("a"), celula("b")] }]);
    expect(linhasDe(toDocumento(fromDocumento(secoes)))[0].celulas[0]).toEqual(celula("a"));
  });

  it("mescla incoerente sai normalizada: o vão que não cabe encolhe, e a coberta perde o texto", () => {
    const secoes = comTabela([{ celulas: [{ ...celula("X"), colspan: 9 }, celula("sobra")] }]);
    expect(linhasDe(toDocumento(fromDocumento(secoes)))[0].celulas).toEqual([
      { cabecalho: false, colspan: 2, content: [{ type: "text", text: "X" }] },
      { cabecalho: false, coberta: true },
    ]);
  });
});
