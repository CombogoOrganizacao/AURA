import { describe, expect, it } from "vitest";

import { NORMAS } from "../standards/standards";
import { resolveRules } from "./resolve";
import type { ConflitoRegra, PresetInstituicao } from "./types";

// Passo 5.1.2 — "um override ou preset que contraria a norma gera conflito com
// origem, valor da norma e valor escolhido, em qualquer campo; um override
// que repete o valor da norma não gera conflito". E a força da regra
// divergida, relida no PDF: margem e entrelinha são "devem" (NBR 14724 §5.1,
// §5.2), fonte 12 é "recomenda-se" (§5.1), recuo de 1,25 cm é convenção.

function preset(regras: PresetInstituicao["regras"]): PresetInstituicao {
  return { id: "p1", nome: "Universidade X", regras };
}

function conflito(conflitos: ConflitoRegra[], campo: string): ConflitoRegra | undefined {
  return conflitos.find((item) => item.campo === campo);
}

describe("conflitos — quando existem", () => {
  it("norma pura não tem conflito", () => {
    expect(resolveRules("abnt", null, null).conflitos).toEqual([]);
  });

  it("preset que muda a margem: conflito com origem, valores e força de norma", () => {
    const { conflitos } = resolveRules("abnt", preset({ margens: { left: 2.5 } }), null);

    expect(conflitos).toHaveLength(1);
    expect(conflitos[0]).toMatchObject({
      campo: "margens.left",
      rotulo: "Margem esquerda",
      origem: "preset",
      nomeOrigem: "Universidade X",
      valorNorma: 3,
      valorAnterior: 3,
      valorEscolhido: 2.5,
      forca: "norma",
      item: "NBR 14724:2024 §5.1",
    });
    expect(conflitos[0].justificativa).toContain("deixa de estar conforme");
  });

  it("vale para qualquer campo sobrescrevível, não só os três que o legado conferia", () => {
    const { conflitos } = resolveRules("abnt", null, null, {
      citacaoLonga: { espacamento: 1.5 },
      limites: { resumoPalavras: { max: 250 } },
    });
    expect(conflitos.map((item) => item.campo).sort()).toEqual([
      "citacaoLonga.espacamento",
      "limites.resumoPalavras.max",
    ]);
    expect(conflito(conflitos, "limites.resumoPalavras.max")?.origem).toBe("override");
  });

  it("override que repete o valor da norma não gera conflito", () => {
    expect(
      resolveRules("abnt", null, null, { espacamentoLinhas: 1.5, margens: { top: 3 } }).conflitos,
    ).toEqual([]);
  });

  it("preset muda, override devolve ao valor da norma: sem conflito", () => {
    const { conflitos } = resolveRules("abnt", preset({ espacamentoLinhas: 2 }), null, {
      espacamentoLinhas: 1.5,
    });
    expect(conflitos).toEqual([]);
  });

  it("a camada que decide é a última; valorAnterior mostra o que ela substituiu", () => {
    const { conflitos } = resolveRules("abnt", preset({ citacaoLonga: { recuo: 3 } }), {
      titulo: "Edital 01/2026",
      regras: { citacaoLonga: { recuo: 2 } },
    });
    expect(conflito(conflitos, "citacaoLonga.recuo")).toMatchObject({
      origem: "edital",
      nomeOrigem: "Edital 01/2026",
      valorNorma: 4,
      valorAnterior: 3,
      valorEscolhido: 2,
    });
  });
});

describe("conflitos — força da regra divergida", () => {
  it("recomendação: fonte 12 (§5.1, 'recomenda-se') e recuo de 4 cm (10520 §7.1.1)", () => {
    const { conflitos } = resolveRules("abnt", preset({ citacaoLonga: { recuo: 3 } }), null);
    const recuo = conflito(conflitos, "citacaoLonga.recuo");
    expect(recuo?.forca).toBe("recomendacao");
    expect(recuo?.justificativa).toContain("continua conforme");
  });

  it("recomendação: faixa de palavras do resumo (6028 §4.1.8, 'convém')", () => {
    const { conflitos } = resolveRules("abnt", null, null, {
      limites: { resumoPalavras: { min: 100 } },
    });
    expect(conflito(conflitos, "limites.resumoPalavras.min")?.forca).toBe("recomendacao");
  });

  it("convenção: recuo de parágrafo, alinhamento e família da fonte, sem item na norma", () => {
    const { conflitos } = resolveRules("abnt", null, null, {
      recuoParagrafo: 1.5,
      alinhamento: "left",
      fonte: { familia: "Calibri" },
    });
    for (const campo of ["recuoParagrafo", "alinhamento", "fonte.familia"]) {
      expect(conflito(conflitos, campo)).toMatchObject({ forca: "convencao", item: null });
    }
    expect(conflito(conflitos, "alinhamento")?.justificativa).toContain("à esquerda");
  });

  it("norma sem auditoria: a força diz isso, e não 'norma'", () => {
    const { conflitos } = resolveRules("apa", null, null, { margens: { top: 3 } });
    expect(conflito(conflitos, "margens.top")?.forca).toBe("nao-auditada");
  });
});

describe("conflitos — tamanho menor e uniforme (NBR 14724:2024 §5.1)", () => {
  it("texto baixado para o tamanho das citações: conflito de norma, sem tocar nas citações", () => {
    const { conflitos } = resolveRules("abnt", preset({ fonte: { tamanho: 10 } }), null);

    // A fonte do texto em si é recomendação...
    expect(conflito(conflitos, "fonte.tamanho")?.forca).toBe("recomendacao");
    // ...mas as citações deixam de ser menores, e isso é obrigação.
    const citacao = conflito(conflitos, "fonte.tamanhoCitacao");
    expect(citacao).toMatchObject({ forca: "norma", origem: "preset", valorEscolhido: 10 });
    expect(citacao?.justificativa).toContain("tamanho menor");
  });

  it("mudar só a citação para outro tamanho menor quebra a uniformidade", () => {
    const { conflitos } = resolveRules("abnt", null, null, { citacaoLonga: { tamanhoFonte: 9 } });
    expect(conflito(conflitos, "citacaoLonga.tamanhoFonte")).toMatchObject({
      forca: "norma",
      valorEscolhido: 9,
    });
    expect(conflito(conflitos, "citacaoLonga.tamanhoFonte")?.justificativa).toContain("uniforme");
  });

  it("baixar todos os tamanhos menores juntos continua conforme: só convenção", () => {
    const { conflitos } = resolveRules("abnt", null, null, {
      fonte: { tamanhoCitacao: 9, tamanhoNotaRodape: 9 },
      citacaoLonga: { tamanhoFonte: 9 },
    });
    expect(conflitos.every((item) => item.forca === "convencao")).toBe(true);
    expect(conflitos).toHaveLength(3);
  });

  it("a norma pura satisfaz a relação", () => {
    const { fonte, citacaoLonga } = NORMAS.abnt;
    expect(fonte.tamanhoCitacao).toBeLessThan(fonte.tamanho);
    expect(citacaoLonga?.tamanhoFonte).toBe(fonte.tamanhoCitacao);
  });
});
