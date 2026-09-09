import { describe, expect, it } from "vitest";

import { NORMAS } from "./standards";

// Confere `NORMAS.abnt` contra docs/auditoria-abnt.md (passo 3.1.1) — os
// valores que a auditoria marcou "Conforme" ou "Convenção, mantida por
// decisão do usuário" viram asserção aqui; se alguém editar `standards.ts`
// sem reconferir a auditoria, o teste quebra antes do valor errado se
// espalhar para o exportador (Fase 3.1.2 em diante).
describe("NORMAS.abnt", () => {
  it("margens batem com NBR 14724:2011 §5.1/§5.2", () => {
    expect(NORMAS.abnt.margens).toEqual({ top: 3, left: 3, bottom: 2, right: 2, unidade: "cm" });
  });

  it("fonte tamanho 12 bate com NBR 14724:2011 §5.1", () => {
    expect(NORMAS.abnt.fonte.tamanho).toBe(12);
    expect(NORMAS.abnt.fonte.tamanhoNotaRodape).toBe(10);
    expect(NORMAS.abnt.fonte.tamanhoCitacao).toBe(10);
  });

  it("espaçamento de 1,5 bate com NBR 14724:2011 §5.2", () => {
    expect(NORMAS.abnt.espacamentoLinhas).toBe(1.5);
  });

  it("recuo de parágrafo e alinhamento são os valores auditados, sem citação de norma", () => {
    expect(NORMAS.abnt.recuoParagrafo).toBe(1.25);
    expect(NORMAS.abnt.alinhamento).toBe("justify");
  });

  it("paginação bate com NBR 14724:2011 §5.3", () => {
    expect(NORMAS.abnt.paginacao).toEqual({
      posicao: "top-right",
      contarDoTextual: true,
      formato: "arabic",
    });
  });

  it("citação longa bate com o valor auditado (recuo de 4cm, hoje recomendação da NBR 10520:2023)", () => {
    expect(NORMAS.abnt.citacaoLonga).toEqual({
      minLinhas: 4,
      recuo: 4,
      espacamento: 1,
      tamanhoFonte: 10,
    });
  });

  it("estilo de citação e de referência batem com NBR 10520/6023", () => {
    expect(NORMAS.abnt.estiloCitacao).toBe("AUTOR_DATA");
    expect(NORMAS.abnt.estiloReferencia).toBe("ALFABETICA_MAIUSCULA");
  });

  it("títulos têm gradação entre os três níveis (NBR 6024 exige gradação, não uma combinação fixa)", () => {
    const { h1, h2, h3 } = NORMAS.abnt.titulos ?? {};
    expect(h1).toBeDefined();
    expect(h2).toBeDefined();
    expect(h3).toBeDefined();
    // Nenhum dos três é idêntico aos outros dois — é a gradação que a norma exige.
    expect(h1).not.toEqual(h2);
    expect(h2).not.toEqual(h3);
    expect(h1).not.toEqual(h3);
  });
});

describe("NORMAS", () => {
  it("tem as seis normas do legado, cada uma com o `id` correspondente à chave", () => {
    const chaves = Object.keys(NORMAS).sort();
    expect(chaves).toEqual(["abnt", "apa", "chicago", "ieee", "mla", "vancouver"]);
    for (const [chave, norma] of Object.entries(NORMAS)) {
      expect(norma.id).toBe(chave);
    }
  });
});
