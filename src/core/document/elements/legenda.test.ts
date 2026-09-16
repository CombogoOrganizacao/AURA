import { describe, expect, it } from "vitest";

import { ROTULO_FIGURA, ROTULO_TABELA, rotuloDe, textoFonte, textoLegenda } from "./legenda";

describe("legenda de ilustração e tabela (passo 3.6.3)", () => {
  it("monta 'Figura 3 — Título' com travessão entre número e título", () => {
    expect(textoLegenda(ROTULO_FIGURA, 3, "Fluxo do processo")).toBe(
      "Figura 3 — Fluxo do processo",
    );
  });

  // Enquanto a pessoa ainda não digitou a legenda, o travessão sozinho seria
  // ruído na tela e sairia no `.docx` do mesmo jeito.
  it("omite o travessão quando não há título ainda", () => {
    expect(textoLegenda(ROTULO_TABELA, 1, "")).toBe("Tabela 1");
  });

  it("o rótulo vem do tipo do nó, não de quem exibe", () => {
    expect(rotuloDe({ type: "figura", id: "f", legenda: "", fonte: "", imagem: null })).toBe(
      "Figura",
    );
    expect(rotuloDe({ type: "tabela", id: "t", legenda: "", fonte: "", linhas: [] })).toBe(
      "Tabela",
    );
  });

  it("'Fonte:' sai vazia quando o campo está vazio, para quem chama omitir a linha", () => {
    expect(textoFonte("IBGE (2024)")).toBe("Fonte: IBGE (2024)");
    expect(textoFonte("")).toBe("");
  });
});
