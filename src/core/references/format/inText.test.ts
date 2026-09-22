import { describe, expect, it } from "vitest";

import type { CSLName, ReferenciaLivro } from "../types";
import { formatarChamada } from "./inText";

function livro(
  author: CSLName[] | undefined,
  extra: Partial<ReferenciaLivro> = {},
): ReferenciaLivro {
  return {
    id: "r",
    type: "book",
    title: "Pedagogia do oprimido",
    issued: { "date-parts": [[2023]] },
    ...(author ? { author } : {}),
    ...extra,
  };
}

const SILVA = { family: "Silva", given: "Ana" };
const SOUZA = { family: "Souza", given: "Bruno" };
const LIMA = { family: "Lima", given: "Carla" };
const COSTA = { family: "Costa", given: "Davi" };

describe("chamada autor-data (NBR 10520:2023)", () => {
  it("um autor, em maiúsculas e minúsculas (§6.1.1.1), não em caixa alta", () => {
    expect(formatarChamada(livro([SILVA]))).toBe("(Silva, 2023)");
  });

  it("dois autores, separados por ponto e vírgula", () => {
    expect(formatarChamada(livro([SILVA, SOUZA]))).toBe("(Silva; Souza, 2023)");
  });

  it("três autores: todos entram — abreviar três é fora da norma (§6.1.2)", () => {
    expect(formatarChamada(livro([SILVA, SOUZA, LIMA]))).toBe("(Silva; Souza; Lima, 2023)");
  });

  it("quatro ou mais: o primeiro seguido de et al.", () => {
    expect(formatarChamada(livro([SILVA, SOUZA, LIMA, COSTA]))).toBe("(Silva et al., 2023)");
  });

  it("quatro ou mais, com a opção de listar todos (também conforme)", () => {
    expect(formatarChamada(livro([SILVA, SOUZA, LIMA, COSTA]), {}, { etAl: "nunca" })).toBe(
      "(Silva; Souza; Lima; Costa, 2023)",
    );
  });

  it("com página", () => {
    expect(formatarChamada(livro([SILVA]), { pagina: "45" })).toBe("(Silva, 2023, p. 45)");
  });

  it("com intervalo de páginas, e sem duplicar a abreviatura já digitada", () => {
    expect(formatarChamada(livro([SILVA]), { pagina: "45–47" })).toBe("(Silva, 2023, p. 45-47)");
    expect(formatarChamada(livro([SILVA]), { pagina: "p. 45" })).toBe("(Silva, 2023, p. 45)");
  });

  it("sobrenome com grau de parentesco sai inteiro", () => {
    expect(formatarChamada(livro([{ family: "Silva Filho", given: "João" }]))).toBe(
      "(Silva Filho, 2023)",
    );
  });

  it("pessoa jurídica pelo nome, como foi cadastrado (§6.1.1.2)", () => {
    expect(formatarChamada(livro([{ literal: "Associação Brasileira de Normas Técnicas" }]))).toBe(
      "(Associação Brasileira de Normas Técnicas, 2023)",
    );
  });
});

describe("chamada sem autoria: entrada pelo título (§6.1.1.4)", () => {
  it("primeira palavra seguida de [...]", () => {
    expect(formatarChamada(livro(undefined, { title: "Anteprojeto de lei" }))).toBe(
      "(Anteprojeto [...], 2023)",
    );
  });

  it("título que abre com artigo leva o artigo e a palavra seguinte", () => {
    expect(formatarChamada(livro(undefined, { title: "A educação no Brasil" }))).toBe(
      "(A educação [...], 2023)",
    );
  });

  it("título de uma palavra não ganha [...]", () => {
    expect(formatarChamada(livro(undefined, { title: "Globalização" }))).toBe(
      "(Globalização, 2023)",
    );
  });

  it("autoria vazia conta como sem autoria", () => {
    expect(formatarChamada(livro([{ family: "  " }], { title: "Relatório anual" }))).toBe(
      "(Relatório [...], 2023)",
    );
  });

  it("com página", () => {
    expect(
      formatarChamada(livro(undefined, { title: "Anteprojeto de lei" }), { pagina: "12" }),
    ).toBe("(Anteprojeto [...], 2023, p. 12)");
  });
});

describe("chamada — data", () => {
  it("só o ano, mesmo de uma data completa", () => {
    expect(formatarChamada(livro([SILVA], { issued: { "date-parts": [[2026, 9, 20]] } }))).toBe(
      "(Silva, 2026)",
    );
  });

  it("data incerta sai como está no dado", () => {
    expect(formatarChamada(livro([SILVA], { issued: { raw: "[199-]" } }))).toBe("(Silva, [199-])");
  });

  it("sem data, a chamada sai sem ano — a mesma omissão da lista", () => {
    expect(formatarChamada(livro([SILVA], { issued: undefined }))).toBe("(Silva)");
  });
});

describe("citação de citação (§7.3)", () => {
  it("autoria, data, página, apud, autoria, data, página", () => {
    const consultada = livro([SILVA], { issued: { "date-parts": [[2019]] } });

    expect(
      formatarChamada(consultada, {
        pagina: "12",
        apud: {
          author: [{ family: "Freire", given: "Paulo" }],
          issued: { "date-parts": [[1987]] },
          pagina: "68",
        },
      }),
    ).toBe("(Freire, 1987, p. 68 apud Silva, 2019, p. 12)");
  });

  it("sem páginas: (AUTOR, ANO apud FONTE, ANO)", () => {
    const consultada = livro([SILVA], { issued: { "date-parts": [[2019]] } });

    expect(
      formatarChamada(consultada, {
        apud: { author: [{ family: "Freire" }], issued: { "date-parts": [[1987]] }, pagina: null },
      }),
    ).toBe("(Freire, 1987 apud Silva, 2019)");
  });
});
