import { describe, expect, it } from "vitest";

import { PresetInvalido, novoPreset } from "./presets";
import { resolveRules } from "./resolve";
import type { SobrescritaRegras } from "./types";

// Passo 5.1.3 — a persistência dos presets é coberta pela suíte de contrato
// (`persistence/__tests__/contract.ts`), nos dois adaptadores. Aqui, a criação.

describe("novoPreset", () => {
  it("gera id novo e guarda nome e regras", () => {
    const a = novoPreset("Universidade X", { citacaoLonga: { recuo: 3 } });
    const b = novoPreset("Universidade X", {});

    expect(a).toMatchObject({ nome: "Universidade X", regras: { citacaoLonga: { recuo: 3 } } });
    expect(a.id).not.toBe(b.id);
  });

  it("recusa nome vazio: é o nome que o painel de conflitos mostra como origem", () => {
    expect(() => novoPreset("   ", {})).toThrow(PresetInvalido);
  });

  it("apara o nome", () => {
    expect(novoPreset("  Faculdade Y ", {}).nome).toBe("Faculdade Y");
  });

  it("descarta campos que nenhuma camada pode sobrescrever antes de gravar", () => {
    const regras = {
      estiloCitacao: "COLCHETE_NUMERICO",
      recuoParagrafo: 1.5,
    } as unknown as SobrescritaRegras;
    expect(novoPreset("Universidade X", regras).regras).toEqual({ recuoParagrafo: 1.5 });
  });

  it("o preset criado entra como segunda camada de resolveRules", () => {
    const preset = novoPreset("Universidade X", { citacaoLonga: { recuo: 3 } });
    const { regras, conflitos } = resolveRules("abnt", preset, null);

    expect(regras.citacaoLonga?.recuo).toBe(3);
    expect(conflitos[0]).toMatchObject({ origem: "preset", nomeOrigem: "Universidade X" });
  });
});
