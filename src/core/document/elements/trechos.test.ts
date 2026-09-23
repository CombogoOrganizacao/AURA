import { describe, expect, it } from "vitest";

import { chamadaDaCitacao } from "../../references/citacoes";
import type { Referencia } from "../../references/types";
import type { AtributosCitacao, NoCitacaoLonga, NoTexto } from "../types";
import { trechosDaCitacaoLonga, trechosDoInline, type Trecho } from "./trechos";

// Passo 4B.2 — o inline como sai no documento final: marcas do aluno, aspas
// da citação direta (NBR 10520:2023 §7.1) e a chamada autor-data.

const FREIRE: Referencia = {
  id: "freire",
  type: "book",
  author: [{ family: "Freire", given: "Paulo" }],
  title: "Pedagogia do oprimido",
  publisher: "Paz e Terra",
  "publisher-place": "Rio de Janeiro",
  issued: { "date-parts": [[1987]] },
};

const REFS = [FREIRE];

function citacao(attrs: Partial<AtributosCitacao> = {}): AtributosCitacao {
  return { refId: "freire", modo: "indireta", pagina: null, apud: null, ...attrs };
}

function texto(text: string, marks: NoTexto["marks"] = undefined): NoTexto {
  return marks ? { type: "text", text, marks } : { type: "text", text };
}

// Texto corrido do que sai, para ler a sequência de uma vez.
function corrido(trechos: Trecho[]): string {
  return trechos.map((trecho) => trecho.texto).join("");
}

describe("trechosDoInline — marcas do aluno", () => {
  it("negrito e itálico ficam só no trecho marcado", () => {
    const trechos = trechosDoInline(
      [
        texto("Um "),
        texto("termo", [{ type: "italico" }]),
        texto(" e "),
        texto("outro", [{ type: "negrito" }]),
      ],
      REFS,
    );

    expect(trechos).toEqual([
      { papel: "texto", texto: "Um ", negrito: false, italico: false },
      { papel: "texto", texto: "termo", negrito: false, italico: true },
      { papel: "texto", texto: " e ", negrito: false, italico: false },
      { papel: "texto", texto: "outro", negrito: true, italico: false },
    ]);
  });

  it("negrito e itálico juntos no mesmo trecho", () => {
    const [trecho] = trechosDoInline(
      [texto("ambos", [{ type: "negrito" }, { type: "italico" }])],
      REFS,
    );
    expect(trecho).toMatchObject({ negrito: true, italico: true });
  });

  it("parágrafo vazio não gera trecho", () => {
    expect(trechosDoInline(undefined, REFS)).toEqual([]);
  });
});

describe("trechosDoInline — citações (NBR 10520:2023)", () => {
  it("direta curta sai entre aspas duplas e seguida da chamada com página (§7.1, §6.1.3)", () => {
    const marca = {
      type: "citacao" as const,
      attrs: citacao({ modo: "direta_curta", pagina: "45" }),
    };
    const trechos = trechosDoInline(
      [texto("Ele disse "), texto("ensinar exige", [marca]), texto(".")],
      REFS,
    );

    expect(corrido(trechos)).toBe("Ele disse “ensinar exige” (Freire, 1987, p. 45).");
    expect(trechos.map((trecho) => trecho.papel)).toEqual([
      "texto",
      "aspas",
      "texto",
      "aspas",
      "chamada",
      "texto",
    ]);
  });

  it("indireta sai sem aspas, só com a chamada", () => {
    const trechos = trechosDoInline(
      [texto("a educação liberta", [{ type: "citacao", attrs: citacao() }])],
      REFS,
    );
    expect(corrido(trechos)).toBe("a educação liberta (Freire, 1987)");
  });

  it("a chamada é a mesma string que a tela desenha (chamadaDaCitacao)", () => {
    const attrs = citacao({ modo: "direta_curta", pagina: "12-14" });
    const trechos = trechosDoInline([texto("x", [{ type: "citacao", attrs }])], REFS);
    const chamada = trechos.find((trecho) => trecho.papel === "chamada");
    expect(chamada?.texto).toBe(` ${chamadaDaCitacao(attrs, REFS).texto}`);
  });

  it("itálico no meio do excerto não parte a citação em duas", () => {
    const attrs = citacao({ modo: "direta_curta" });
    const trechos = trechosDoInline(
      [
        texto("a ", [{ type: "citacao", attrs }]),
        texto("práxis", [{ type: "citacao", attrs }, { type: "italico" }]),
        texto(" transforma", [{ type: "citacao", attrs }]),
      ],
      REFS,
    );

    expect(corrido(trechos)).toBe("“a práxis transforma” (Freire, 1987)");
    expect(trechos.filter((trecho) => trecho.papel === "chamada")).toHaveLength(1);
    expect(trechos.find((trecho) => trecho.texto === "práxis")?.italico).toBe(true);
  });

  it("duas citações seguidas de páginas diferentes saem com duas chamadas", () => {
    const a = citacao({ modo: "direta_curta", pagina: "1" });
    const b = citacao({ modo: "direta_curta", pagina: "2" });
    const trechos = trechosDoInline(
      [
        texto("um", [{ type: "citacao", attrs: a }]),
        texto("dois", [{ type: "citacao", attrs: b }]),
      ],
      REFS,
    );
    expect(corrido(trechos)).toBe("“um” (Freire, 1987, p. 1)“dois” (Freire, 1987, p. 2)");
  });

  it("aspas e chamada não herdam o negrito do trecho citado", () => {
    const trechos = trechosDoInline(
      [
        texto("forte", [
          { type: "citacao", attrs: citacao({ modo: "direta_curta" }) },
          { type: "negrito" },
        ]),
      ],
      REFS,
    );
    for (const trecho of trechos.filter((item) => item.papel !== "texto")) {
      expect(trecho).toMatchObject({ negrito: false, italico: false });
    }
  });

  it("órfã: o texto do aluno fica e a chamada vira o aviso da tela", () => {
    const trechos = trechosDoInline(
      [texto("sem fonte", [{ type: "citacao", attrs: citacao({ refId: "sumiu" }) }])],
      REFS,
    );
    expect(corrido(trechos)).toBe("sem fonte (referência excluída)");
    expect(trechos.at(-1)).toMatchObject({ papel: "chamada", orfa: true });
  });

  it("apud sai na ordem da §7.3", () => {
    const attrs = citacao({
      apud: {
        author: [{ family: "Paulo", given: "Ana" }],
        issued: { "date-parts": [[1950]] },
        pagina: null,
      },
    });
    const trechos = trechosDoInline([texto("x", [{ type: "citacao", attrs }])], REFS);
    expect(corrido(trechos)).toBe("x (Paulo, 1950 apud Freire, 1987)");
  });
});

describe("trechosDaCitacaoLonga (NBR 10520:2023 §7.1.1)", () => {
  function longa(attrs: Partial<NoCitacaoLonga>): NoCitacaoLonga {
    return {
      type: "citacao_longa",
      refId: "freire",
      pagina: "181",
      content: [texto("Trecho longo citado.")],
      ...attrs,
    };
  }

  it("termina com a chamada, sem aspas", () => {
    const trechos = trechosDaCitacaoLonga(longa({}), REFS);
    expect(corrido(trechos)).toBe("Trecho longo citado. (Freire, 1987, p. 181)");
    expect(trechos.some((trecho) => trecho.papel === "aspas")).toBe(false);
  });

  it("página vazia sai sem página", () => {
    expect(corrido(trechosDaCitacaoLonga(longa({ pagina: "" }), REFS))).toBe(
      "Trecho longo citado. (Freire, 1987)",
    );
  });

  it("sem referência ligada, nada é acrescentado (é achado da conferência)", () => {
    expect(corrido(trechosDaCitacaoLonga(longa({ refId: null }), REFS))).toBe(
      "Trecho longo citado.",
    );
  });

  it("órfã termina com o aviso", () => {
    const trechos = trechosDaCitacaoLonga(longa({ refId: "sumiu" }), REFS);
    expect(trechos.at(-1)).toMatchObject({ texto: " (referência excluída)", orfa: true });
  });
});
