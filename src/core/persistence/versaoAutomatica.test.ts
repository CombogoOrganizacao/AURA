import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { novoDocumento } from "../document/factory";
import type { Documento } from "../document/types";
import type { ResumoVersao } from "./types";
import {
  criarAgendadorDeVersao,
  INTERVALO_VERSAO_AUTOMATICA_MS,
  type AgendadorDeVersao,
} from "./versaoAutomatica";

// Passo 5.3.2 — "Vitest com timers falsos confere que 10 min sem edição não
// geram versão". O resto: uma versão a cada 10 min de edição, com o
// documento mais recente, e nada quando o texto volta ao da última versão.

const DEZ_MIN = INTERVALO_VERSAO_AUTOMATICA_MS;

function comTitulo(documento: Documento, titulo: string): Documento {
  return { ...documento, metadados: { ...documento.metadados, titulo } };
}

describe("criarAgendadorDeVersao", () => {
  let inicial: Documento;
  let gravadas: { titulo: string; nome?: string }[];
  let agendador: AgendadorDeVersao;
  let falhar: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    inicial = comTitulo(novoDocumento(), "Início");
    gravadas = [];
    falhar = false;
    agendador = criarAgendadorDeVersao({
      documentoInicial: inicial,
      registrar: async (documento, nome) => {
        if (falhar) throw new Error("disco cheio");
        gravadas.push({ titulo: documento.metadados.titulo, nome });
        return {
          id: String(gravadas.length),
          criadoEm: new Date(),
          nome,
          automatica: nome === undefined,
        } satisfies ResumoVersao;
      },
    });
  });

  afterEach(() => {
    agendador.encerrar();
    vi.useRealTimers();
  });

  it("10 min sem edição não geram versão", async () => {
    await vi.advanceTimersByTimeAsync(DEZ_MIN);
    await vi.advanceTimersByTimeAsync(DEZ_MIN * 3);

    expect(gravadas).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uma edição gera uma versão 10 min depois, com o texto mais recente", async () => {
    agendador.mudou(comTitulo(inicial, "Primeira"));
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    agendador.mudou(comTitulo(inicial, "Segunda"));

    await vi.advanceTimersByTimeAsync(DEZ_MIN - 3 * 60_000 - 1);
    expect(gravadas).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(gravadas).toEqual([{ titulo: "Segunda", nome: undefined }]);
  });

  it("editar sem parar gera uma versão a cada 10 min, não nenhuma", async () => {
    // Uma edição por minuto durante 30 min: um debounce nunca dispararia.
    for (let minuto = 1; minuto <= 30; minuto++) {
      agendador.mudou(comTitulo(inicial, `Minuto ${minuto}`));
      await vi.advanceTimersByTimeAsync(60_000);
    }

    expect(gravadas.map((versao) => versao.titulo)).toEqual(["Minuto 10", "Minuto 20", "Minuto 30"]);
  });

  it("depois de uma versão, 10 min parados não geram outra", async () => {
    agendador.mudou(comTitulo(inicial, "Editado"));
    await vi.advanceTimersByTimeAsync(DEZ_MIN);
    await vi.advanceTimersByTimeAsync(DEZ_MIN * 2);

    expect(gravadas).toHaveLength(1);
  });

  it("digitar e desfazer, voltando ao texto da última versão, não gera versão", async () => {
    agendador.mudou(comTitulo(inicial, "Início com erro"));
    agendador.mudou(comTitulo(inicial, "Início"));
    await vi.advanceTimersByTimeAsync(DEZ_MIN);

    expect(gravadas).toEqual([]);
  });

  it("a versão nomeada vira a base: sem mudança depois dela, a automática não sai", async () => {
    const editado = comTitulo(inicial, "Antes da banca");
    agendador.mudou(editado);
    await agendador.salvarNomeada(editado, "Versão para a banca");
    await vi.advanceTimersByTimeAsync(DEZ_MIN);

    expect(gravadas).toEqual([{ titulo: "Antes da banca", nome: "Versão para a banca" }]);
  });

  it("uma falha avisa e deixa a mudança pendente para a próxima edição", async () => {
    const falhas: unknown[] = [];
    agendador.encerrar();
    agendador = criarAgendadorDeVersao({
      documentoInicial: inicial,
      registrar: async (documento, nome) => {
        if (falhar) throw new Error("disco cheio");
        gravadas.push({ titulo: documento.metadados.titulo, nome });
        return { id: "1", criadoEm: new Date(), nome, automatica: true };
      },
      aoFalhar: (erro) => falhas.push(erro),
    });

    falhar = true;
    agendador.mudou(comTitulo(inicial, "Não gravou"));
    await vi.advanceTimersByTimeAsync(DEZ_MIN);
    expect(falhas).toHaveLength(1);

    falhar = false;
    agendador.mudou(comTitulo(inicial, "Agora grava"));
    await vi.advanceTimersByTimeAsync(DEZ_MIN);
    expect(gravadas).toEqual([{ titulo: "Agora grava", nome: undefined }]);
  });

  it("encerrar desarma a versão em espera e ignora mudanças depois", async () => {
    agendador.mudou(comTitulo(inicial, "Em espera"));
    agendador.encerrar();
    agendador.mudou(comTitulo(inicial, "Depois de fechar"));
    await vi.advanceTimersByTimeAsync(DEZ_MIN * 2);

    expect(gravadas).toEqual([]);
  });
});
