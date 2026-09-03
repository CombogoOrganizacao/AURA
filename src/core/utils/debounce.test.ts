import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debounce } from "./debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dez chamadas em 1 s geram uma escrita só, com o valor da última", () => {
    const fn = vi.fn();
    const chamar = debounce(fn, 4000);

    for (let tecla = 1; tecla <= 10; tecla++) {
      chamar(`digitando ${tecla}`);
      vi.advanceTimersByTime(100); // 10 × 100ms = 1s inteiro
    }

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(4000);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("digitando 10");
  });

  it("duas rajadas separadas pelo atraso geram duas escritas", () => {
    const fn = vi.fn();
    const chamar = debounce(fn, 4000);

    chamar("primeira rajada");
    vi.advanceTimersByTime(4000);
    expect(fn).toHaveBeenCalledTimes(1);

    chamar("segunda rajada");
    vi.advanceTimersByTime(4000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(2, "segunda rajada");
  });

  it("cancelar() descarta a chamada pendente", () => {
    const fn = vi.fn();
    const chamar = debounce(fn, 4000);

    chamar("nunca deveria salvar");
    chamar.cancelar();
    vi.advanceTimersByTime(10_000);

    expect(fn).not.toHaveBeenCalled();
  });
});
