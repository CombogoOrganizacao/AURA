import { describe, expect, it } from "vitest";

import { TIPOS_DISPONIVEIS_NA_V1, TIPOS_TRABALHO } from "./workTypes";

describe("TIPOS_TRABALHO", () => {
  it("tem os dez tipos portados do legado", () => {
    expect(Object.keys(TIPOS_TRABALHO).sort()).toEqual(
      [
        "academic_review",
        "article",
        "dissertation",
        "extended_abstract",
        "motivation_letter",
        "paper",
        "postdoc_project",
        "research_proposal",
        "tcc",
        "thesis",
      ].sort(),
    );
  });

  it("cada entrada tem o próprio id como chave", () => {
    for (const [chave, tipo] of Object.entries(TIPOS_TRABALHO)) {
      expect(tipo.id).toBe(chave);
    }
  });

  it("tcc tem norma padrão abnt, batendo com Metadados.norma da v1", () => {
    expect(TIPOS_TRABALHO.tcc.normaPadrao).toBe("abnt");
  });
});

describe("TIPOS_DISPONIVEIS_NA_V1", () => {
  it("expõe só o tcc — CLAUDE.md, Escopo da v1", () => {
    expect(TIPOS_DISPONIVEIS_NA_V1).toEqual([TIPOS_TRABALHO.tcc]);
  });
});
