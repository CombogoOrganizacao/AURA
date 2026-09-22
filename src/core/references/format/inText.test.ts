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

// Exemplos tirados do texto da NBR 10520:2023, conferidos no PDF oficial.
describe("chamada — exemplos da própria norma", () => {
  it("§6.1.1.4 d): título que abre com monossílabo leva a palavra seguinte", () => {
    expect(
      formatarChamada(
        livro(undefined, {
          title: "Nos canaviais, mutilações em vez de lazer e escola",
          issued: { "date-parts": [[1995]] },
        }),
        { pagina: "12" },
      ),
    ).toBe("(Nos canaviais [...], 1995, p. 12)");
  });

  it("§6.1.1.4 c): artigo e a palavra seguinte", () => {
    expect(
      formatarChamada(
        livro(undefined, { title: "A flor prometida", issued: { "date-parts": [[1995]] } }),
        { pagina: "4" },
      ),
    ).toBe("(A flor [...], 1995, p. 4)");
  });

  it("§6.1.1.2: página em algarismo romano ganha p.", () => {
    expect(
      formatarChamada(
        livro([{ literal: "Organização Mundial da Saúde" }], {
          issued: { "date-parts": [[2010]] },
        }),
        { pagina: "xi" },
      ),
    ).toBe("(Organização Mundial da Saúde, 2010, p. xi)");
  });

  it.each([
    ["v. 1, p. 16", "(Silva, 2023, v. 1, p. 16)"], // §7.1.3
    ["cap. V, art. 49, inc. I", "(Silva, 2023, cap. V, art. 49, inc. I)"], // §7.1.4
    ["local. 264", "(Silva, 2023, local. 264)"], // §7.1.4
    ["9 min 41 s", "(Silva, 2023, 9 min 41 s)"], // §7.1.4
  ])("localização %s sai como digitada, sem p. na frente", (pagina, esperado) => {
    expect(formatarChamada(livro([SILVA]), { pagina })).toBe(esperado);
  });

  it("§7.3, exemplo 2: apud com páginas nas duas pontas", () => {
    expect(
      formatarChamada(
        livro([{ family: "Suassuna", given: "Lívia" }], { issued: { "date-parts": [[1995]] } }),
        {
          pagina: "55",
          apud: {
            author: [{ family: "Cagliari", given: "Luiz Carlos" }],
            issued: { "date-parts": [[1986]] },
            pagina: "104",
          },
        },
      ),
    ).toBe("(Cagliari, 1986, p. 104 apud Suassuna, 1995, p. 55)");
  });
});
