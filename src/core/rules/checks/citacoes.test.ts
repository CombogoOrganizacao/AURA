import { describe, expect, it } from "vitest";

import type { NoParagrafo, NoTexto } from "../../document/types";
import { conferirCom } from "../__tests__/conferirCom";
import { documentoConforme } from "../__tests__/documentoConforme";
import {
  citacaoDiretaSemPagina,
  citacaoLongaSemReferencia,
  citacaoOrfa,
  referenciaNaoCitada,
} from "./citacoes";

// Passo 5.2.2 — citações pela NBR 10520:2023. No documento de referência, a
// seção "s-intro" tem, no nó 0, uma indireta e uma direta com página; no nó 3,
// uma citação longa com página. As posições saem do próprio texto do
// documento, não de números escritos à mão.

const INTRO = { tipo: "secao", id: "s-intro" } as const;

function trechoDe(citado: string): { inicio: number; fim: number } {
  const paragrafo = documentoConforme().sections[0].content[0] as NoParagrafo;
  const texto = (paragrafo.content as NoTexto[]).map((no) => no.text).join("");
  const inicio = texto.indexOf(citado);
  return { inicio, fim: inicio + citado.length };
}

const INDIRETA = trechoDe("a educação é prática da liberdade");
const DIRETA = trechoDe("ensinar exige risco");

describe("citacao-orfa (10520 §5.1, 'deve permitir sua correlação')", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(citacaoOrfa)).toEqual([]);
  });

  it("referência excluída: um erro por citação, com o nó e o trecho exato", () => {
    const achados = conferirCom(citacaoOrfa, (d) => (d.references = []));

    // As duas marcas do parágrafo e a citação longa.
    expect(achados).toHaveLength(3);
    expect(achados[0]).toMatchObject({
      regra: "citacao-orfa",
      gravidade: "erro",
      item: "NBR 10520:2023 §5.1",
      local: { tipo: "bloco", onde: INTRO, no: 0, trecho: INDIRETA },
    });
    expect(achados[0].mensagem).toContain("a educação é prática da liberdade");
    expect(achados[2].local).toEqual({ tipo: "bloco", onde: INTRO, no: 3 });
  });

  it("o trecho aponta exatamente o texto citado", () => {
    const [achado] = conferirCom(citacaoOrfa, (d) => (d.references = []));
    const paragrafo = documentoConforme().sections[0].content[0] as NoParagrafo;
    const texto = (paragrafo.content as NoTexto[]).map((no) => no.text).join("");
    const local = achado.local;
    expect(
      local.tipo === "bloco" && local.trecho && texto.slice(local.trecho.inicio, local.trecho.fim),
    ).toBe("a educação é prática da liberdade");
  });

  it("itálico no meio do trecho não parte a citação em duas", () => {
    const achados = conferirCom(citacaoOrfa, (d) => {
      d.references = [];
      const paragrafo = d.sections[0].content[0] as NoParagrafo;
      const citado = (paragrafo.content as NoTexto[])[1];
      (paragrafo.content as NoTexto[]).splice(
        1,
        1,
        { ...citado, text: "a educação " },
        { ...citado, text: "é", marks: [...citado.marks!, { type: "italico" }] },
        { ...citado, text: " prática da liberdade" },
      );
    });
    expect(achados).toHaveLength(3);
  });
});

describe("citacao-longa-sem-referencia (10520 §7.1)", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(citacaoLongaSemReferencia)).toEqual([]);
  });

  it("citação longa sem referência ligada: erro no nó", () => {
    expect(
      conferirCom(citacaoLongaSemReferencia, (d) => {
        const longa = d.sections[0].content[3];
        if (longa.type === "citacao_longa") longa.refId = null;
      }),
    ).toEqual([
      expect.objectContaining({
        gravidade: "erro",
        item: "NBR 10520:2023 §7.1",
        local: { tipo: "bloco", onde: INTRO, no: 3 },
      }),
    ]);
  });
});

describe("citacao-direta-sem-pagina (10520 §6.1.3, 'se houver')", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(citacaoDiretaSemPagina)).toEqual([]);
  });

  it("direta curta sem página: AVISO, porque a fonte pode não ser paginada", () => {
    const achados = conferirCom(citacaoDiretaSemPagina, (d) => {
      const paragrafo = d.sections[0].content[0] as NoParagrafo;
      const marca = (paragrafo.content as NoTexto[])[3].marks![0];
      if (marca.type === "citacao") marca.attrs.pagina = null;
    });
    expect(achados).toEqual([
      expect.objectContaining({
        gravidade: "aviso",
        item: "NBR 10520:2023 §6.1.3",
        local: { tipo: "bloco", onde: INTRO, no: 0, trecho: DIRETA },
      }),
    ]);
  });

  it("indireta sem página não é achado: a página é das diretas", () => {
    // A indireta do documento de referência já não tem página.
    expect(conferirCom(citacaoDiretaSemPagina)).toEqual([]);
  });

  it("longa sem página: aviso, porque também é citação direta (§7.1.1)", () => {
    expect(
      conferirCom(citacaoDiretaSemPagina, (d) => {
        const longa = d.sections[0].content[3];
        if (longa.type === "citacao_longa") longa.pagina = "";
      }),
    ).toEqual([expect.objectContaining({ local: { tipo: "bloco", onde: INTRO, no: 3 } })]);
  });
});

describe("referencia-nao-citada (convenção, sem item na norma)", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(referenciaNaoCitada)).toEqual([]);
  });

  it("referência nunca citada: aviso com item nulo, na referência", () => {
    expect(
      conferirCom(referenciaNaoCitada, (d) =>
        d.references.push({ id: "bauman", type: "book", title: "Globalização" }),
      ),
    ).toEqual([
      expect.objectContaining({
        gravidade: "aviso",
        item: null,
        local: { tipo: "referencia", refId: "bauman" },
      }),
    ]);
  });

  it("citada só por apud conta como citada: é a fonte consultada (10520 §7.3)", () => {
    expect(
      conferirCom(referenciaNaoCitada, (d) => {
        const paragrafo = d.sections[0].content[0] as NoParagrafo;
        const marca = (paragrafo.content as NoTexto[])[1].marks![0];
        if (marca.type === "citacao") {
          marca.attrs.apud = { author: [{ family: "Outro" }], pagina: null };
        }
      }),
    ).toEqual([]);
  });
});
