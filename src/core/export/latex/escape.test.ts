import { describe, expect, it } from "vitest";

import { escaparLatex } from "./escape";

// Passo 6.2.1 — texto do aluno dentro do `.tex`. Critério do passo: os dez
// caracteres especiais e a acentuação UTF-8.

describe("escaparLatex — caracteres especiais do LaTeX", () => {
  it.each([
    ["&", "\\&"],
    ["%", "\\%"],
    ["$", "\\$"],
    ["#", "\\#"],
    ["_", "\\_"],
    ["{", "\\{"],
    ["}", "\\}"],
    ["~", "\\textasciitilde{}"],
    ["^", "\\textasciicircum{}"],
    ["\\", "\\textbackslash{}"],
  ])("%s vira %s", (entrada, saida) => {
    expect(escaparLatex(entrada)).toBe(saida);
  });

  it("a barra invertida do escape não é escapada de novo", () => {
    expect(escaparLatex("\\&")).toBe("\\textbackslash{}\\&");
  });

  it("texto com vários especiais juntos", () => {
    expect(escaparLatex("R$ 10 & 20% de {x}_1")).toBe("R\\$ 10 \\& 20\\% de \\{x\\}\\_1");
  });

  it("comando LaTeX digitado pelo aluno não é interpretado", () => {
    expect(escaparLatex("\\input{senha}")).toBe("\\textbackslash{}input\\{senha\\}");
  });
});

describe("escaparLatex — acentuação e UTF-8", () => {
  it("acentos do português passam como estão", () => {
    const texto = "Ação, coração, pé, à, você, Ãé, Ç, ü, Ñ";
    expect(escaparLatex(texto)).toBe(texto);
  });

  it("aspas curvas, travessão e reticências passam como estão", () => {
    expect(escaparLatex("“ensinar” — ‘exige’ risco…")).toBe("“ensinar” — ‘exige’ risco…");
  });

  it("grego e símbolos matemáticos viram o comando equivalente", () => {
    expect(escaparLatex("α ≤ β")).toBe("\\ensuremath{\\alpha} \\ensuremath{\\leq} \\ensuremath{\\beta}");
  });

  it("caractere que a fonte não desenha sai como o código, visível, e não some", () => {
    expect(escaparLatex("ok 😀")).toBe("ok \\texttt{[U+1F600]}");
  });
});

describe("escaparLatex — ligaduras que o LaTeX formaria sozinho", () => {
  it("dois e três hífens continuam hífens", () => {
    expect(escaparLatex("a--b")).toBe("a-{}-b");
    expect(escaparLatex("a---b")).toBe("a-{}-{}-b");
  });

  it("<< >> ,, '' não viram aspas", () => {
    expect(escaparLatex("<<x>>")).toBe("<{}<x>{}>");
    expect(escaparLatex(",,")).toBe(",{},");
    expect(escaparLatex("''")).toBe("'{}'");
  });

  it("acento grave é acento grave, não aspa", () => {
    expect(escaparLatex("`")).toBe("\\textasciigrave{}");
  });

  it("hífen simples fica como está", () => {
    expect(escaparLatex("bem-vindo")).toBe("bem-vindo");
  });
});

describe("escaparLatex — espaços", () => {
  it("quebra de linha e tabulação viram espaço: não abrem parágrafo", () => {
    expect(escaparLatex("um\n\ndois\tfim")).toBe("um  dois fim");
  });
});
