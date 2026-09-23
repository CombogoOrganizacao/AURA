import { describe, expect, it } from "vitest";

import {
  ORDEM_CANONICA,
  elementosDaParte,
  parteDe,
  type ElementoDocumento,
  type ParteDocumento,
} from "./order";

// A ordem em si é conferida onde ela produz efeito — no `.docx`, em
// `src/core/export/docx/ordem.test.ts`. Aqui ficam as propriedades da lista
// que um teste de saída não pega: que ela cobre todo elemento uma vez só, e
// que a divisão em partes é coerente com a paginação que `sections.ts`
// aplica. Uma lista com elemento repetido, ou com um pré-textual depois do
// corpo, produziria `.docx` errado sem erro de tipo nenhum.

describe("ORDEM_CANONICA (passo 3.7.2)", () => {
  it("segue a sequência da NBR 14724, do primeiro ao último elemento", () => {
    expect([...ORDEM_CANONICA]).toEqual([
      "capa",
      "folhaDeRosto",
      "folhaDeAprovacao",
      "dedicatoria",
      "agradecimentos",
      "epigrafe",
      "resumo",
      "abstract",
      "listaDeFiguras",
      "listaDeTabelas",
      "listaDeAbreviaturas",
      "sumario",
      "corpo",
      "referencias",
      "apendices",
      "anexos",
    ]);
  });

  it("não repete elemento nenhum", () => {
    expect(new Set(ORDEM_CANONICA).size).toBe(ORDEM_CANONICA.length);
  });

  // Se alguém acrescentar um membro a `ElementoDocumento` e esquecer de
  // colocá-lo na ordem, o elemento existiria no tipo e nunca sairia no
  // `.docx` — some em silêncio, que é o desfecho que este projeto recusa.
  // `parteDe()` é `Record` completo, então o compilador cobre o outro lado.
  it("todo elemento com parte definida está na ordem", () => {
    for (const elemento of ORDEM_CANONICA) {
      expect(parteDe(elemento)).toBeDefined();
    }
    const naOrdem = new Set<ElementoDocumento>(ORDEM_CANONICA);
    expect(naOrdem.size).toBe(ORDEM_CANONICA.length);
  });

  // As quatro partes são contíguas e nesta sequência — é o que permite
  // `sections.ts` mapear cada uma para uma regra de paginação sem verificar
  // elemento a elemento.
  it("as partes aparecem em blocos contíguos: capa, pré-textual, textual, pós-textual", () => {
    const sequencia: ParteDocumento[] = [];
    for (const elemento of ORDEM_CANONICA) {
      const parte = parteDe(elemento);
      if (sequencia.at(-1) !== parte) sequencia.push(parte);
    }

    expect(sequencia).toEqual(["capa", "preTextual", "textual", "posTextual"]);
  });

  it("o sumário é o último pré-textual (NBR 6027)", () => {
    expect(elementosDaParte("preTextual").at(-1)).toBe("sumario");
  });

  it("a folha de rosto abre os pré-textuais, e a capa fica fora deles", () => {
    // A contagem de páginas começa na folha de rosto, não na capa — é o que
    // a divisão em partes precisa refletir para `sections.ts` acertar.
    expect(elementosDaParte("preTextual")[0]).toBe("folhaDeRosto");
    expect(elementosDaParte("capa")).toEqual(["capa"]);
  });

  it("referências vêm antes de apêndices, e apêndices antes de anexos", () => {
    expect(elementosDaParte("posTextual")).toEqual(["referencias", "apendices", "anexos"]);
  });
});
