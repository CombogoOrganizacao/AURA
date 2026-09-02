import { describe, expect, it } from "vitest";

// Teste de fumaça: confirma que o Vitest está configurado e roda sobre
// src/core/. Remover quando o primeiro módulo real de src/core/ chegar
// com seus próprios testes.
describe("vitest smoke test", () => {
  it("roda um teste simples sobre src/core/", () => {
    expect(1 + 1).toBe(2);
  });
});
