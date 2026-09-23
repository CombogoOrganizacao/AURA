import { describe, expect, it } from "vitest";

import { NORMAS } from "../standards/standards";
import { resolveRules } from "./resolve";
import type { ConfigEdital, PresetInstituicao, SobrescritaRegras } from "./types";

// Passo 5.1.1 — "Vitest cobre norma pura, com preset, com edital e com
// override; na v1, `noticeConfig` é vazio e o resultado iguala norma + preset".

const PRESET: PresetInstituicao = {
  id: "p1",
  nome: "Instituição X",
  regras: { fonte: { familia: "Arial" }, citacaoLonga: { recuo: 3 } },
};

const EDITAL: ConfigEdital = {
  titulo: "Edital 01/2026",
  regras: { fonte: { familia: "Times New Roman" }, limites: { resumoPalavras: { max: 300 } } },
};

describe("resolveRules — quatro camadas", () => {
  it("norma pura: igual à norma auditada", () => {
    expect(resolveRules("abnt", null, null).regras).toEqual(NORMAS.abnt);
  });

  it("a ABNT traz o limite de 150 a 500 palavras do resumo (NBR 6028 §4.1.8 a)", () => {
    expect(resolveRules("abnt", null, null).regras.limites?.resumoPalavras).toEqual({
      min: 150,
      max: 500,
    });
  });

  it("preset sobrescreve só o que traz, em qualquer profundidade", () => {
    const { regras } = resolveRules("abnt", PRESET, null);
    expect(regras.fonte).toEqual({ ...NORMAS.abnt.fonte, familia: "Arial" });
    expect(regras.citacaoLonga).toEqual({ ...NORMAS.abnt.citacaoLonga, recuo: 3 });
    expect(regras.margens).toEqual(NORMAS.abnt.margens);
  });

  it("na v1, sem edital, o resultado é norma + preset", () => {
    const { regras } = resolveRules("abnt", PRESET, null, {});
    expect(regras).toEqual({
      ...NORMAS.abnt,
      fonte: { ...NORMAS.abnt.fonte, familia: "Arial" },
      citacaoLonga: { ...NORMAS.abnt.citacaoLonga, recuo: 3 },
    });
  });

  it("edital sobrescreve o preset, e um limite parcial preserva o outro extremo", () => {
    const { regras } = resolveRules("abnt", PRESET, EDITAL);
    expect(regras.fonte.familia).toBe("Times New Roman");
    expect(regras.citacaoLonga?.recuo).toBe(3);
    expect(regras.limites?.resumoPalavras).toEqual({ min: 150, max: 300 });
  });

  it("override do usuário vence as três camadas", () => {
    const override: SobrescritaRegras = { fonte: { familia: "Calibri", tamanho: 11 } };
    const { regras } = resolveRules("abnt", PRESET, EDITAL, override);
    expect(regras.fonte.familia).toBe("Calibri");
    expect(regras.fonte.tamanho).toBe(11);
    expect(regras.fonte.tamanhoCitacao).toBe(NORMAS.abnt.fonte.tamanhoCitacao);
  });

  it("campo ausente ou `undefined` numa camada não apaga o valor de baixo", () => {
    const { regras } = resolveRules("abnt", null, null, { fonte: { familia: undefined } });
    expect(regras.fonte.familia).toBe(NORMAS.abnt.fonte.familia);
  });

  it("não altera a tabela NORMAS, compartilhada pelo app inteiro", () => {
    const antes = structuredClone(NORMAS.abnt);
    resolveRules("abnt", PRESET, EDITAL, { margens: { top: 5 } });
    expect(NORMAS.abnt).toEqual(antes);
  });
});

describe("resolveRules — o que uma camada não pode tocar", () => {
  // Preset e override vão vir da persistência (5.1.3): o tipo não protege
  // em tempo de execução.
  it("ignora campo fora da lista (identidade, sistema de chamada)", () => {
    const vindoDoBanco = {
      id: "apa",
      estiloCitacao: "COLCHETE_NUMERICO",
      espacamentoLinhas: 2,
    } as unknown as SobrescritaRegras;

    const { regras } = resolveRules("abnt", null, null, vindoDoBanco);
    expect(regras.id).toBe("abnt");
    expect(regras.estiloCitacao).toBe("AUTOR_DATA");
    expect(regras.espacamentoLinhas).toBe(2);
  });

  it("ignora `__proto__` vindo de JSON", () => {
    const vindoDoBanco = JSON.parse(
      '{"margens": {"__proto__": {"poluido": true}, "top": 4}}',
    ) as SobrescritaRegras;

    const { regras } = resolveRules("abnt", null, null, vindoDoBanco);
    expect(regras.margens.top).toBe(4);
    expect((regras.margens as unknown as Record<string, unknown>).poluido).toBeUndefined();
    expect(({} as Record<string, unknown>).poluido).toBeUndefined();
  });
});
