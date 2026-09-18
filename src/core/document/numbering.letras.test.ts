import { describe, expect, it } from "vitest";

import { ALFABETO_POSTEXTUAL, letraDeIndice } from "./numbering";

// Sequência de letras de apêndice/anexo (passo 3.7.1). Os casos interessantes
// são as bordas do alfabeto: é onde uma implementação ingênua devolve `""`,
// `undefined` ou "BA" no lugar de "AA", e onde ninguém repara até um
// documento com 27 apêndices existir.

describe("letraDeIndice (passo 3.7.1)", () => {
  it("cobre o alfabeto inteiro em ordem", () => {
    const todas = Array.from({ length: ALFABETO_POSTEXTUAL.length }, (_, i) => letraDeIndice(i));
    expect(todas.join("")).toBe(ALFABETO_POSTEXTUAL);
  });

  it("dobra a letra depois de esgotado o alfabeto, em vez de devolver vazio", () => {
    expect(letraDeIndice(26)).toBe("AA");
    expect(letraDeIndice(27)).toBe("AB");
    expect(letraDeIndice(51)).toBe("AZ");
    // A borda que uma base 26 "normal" (com dígito zero) erraria: 52 é "BA",
    // não "AAA".
    expect(letraDeIndice(52)).toBe("BA");
    expect(letraDeIndice(701)).toBe("ZZ");
    expect(letraDeIndice(702)).toBe("AAA");
  });

  it("nunca devolve string vazia", () => {
    for (let i = 0; i < 300; i++) {
      expect(letraDeIndice(i)).not.toBe("");
    }
  });

  it("recusa índice inválido em vez de produzir letra silenciosamente errada", () => {
    expect(() => letraDeIndice(-1)).toThrow(/inválido/);
    expect(() => letraDeIndice(1.5)).toThrow(/inválido/);
  });
});
