import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { novoDocumento } from "../document/factory";
import { criarAdaptadorIndexedDB } from "./indexeddb";
import { criarAdaptadorMemoria } from "./memory";
import type { AdaptadorPersistencia, ResumoVersao } from "./types";
import {
  LIMITE_VERSOES_AUTOMATICAS,
  maisRecentePrimeiro,
  registrarVersao,
  restaurarVersao,
  versoesExcedentes,
} from "./versions";

// Passo 5.3.1 — "Vitest cria 40 automáticos e 5 nomeados e confere que
// sobram 30 + 5". A política é a mesma para qualquer adaptador, e roda aqui
// contra os dois que existem.

function versao(id: string, minuto: number, nome?: string): ResumoVersao {
  return {
    id,
    criadoEm: new Date(Date.UTC(2026, 8, 24, 10, minuto)),
    nome,
    automatica: nome === undefined,
  };
}

describe("versoesExcedentes", () => {
  it("devolve só as automáticas além das mais recentes, em qualquer ordem de entrada", () => {
    const versoes = [
      versao("a1", 1),
      versao("n1", 2, "Nomeada antiga"),
      versao("a3", 3),
      versao("a2", 2),
      versao("a4", 4),
    ];

    expect(versoesExcedentes(versoes, 2).map((v) => v.id)).toEqual(["a2", "a1"]);
  });

  it("nunca devolve uma nomeada, por mais antiga que seja", () => {
    const versoes = [versao("n1", 0, "Primeira entrega"), versao("a1", 1), versao("a2", 2)];

    expect(versoesExcedentes(versoes, 0).map((v) => v.id)).toEqual(["a2", "a1"]);
  });

  it("dentro do limite, não há excedente", () => {
    const versoes = Array.from({ length: LIMITE_VERSOES_AUTOMATICAS }, (_, i) =>
      versao(`a${i}`, i),
    );

    expect(versoesExcedentes(versoes)).toEqual([]);
  });
});

describe("maisRecentePrimeiro", () => {
  it("ordena pela data, sem mudar a lista recebida", () => {
    const versoes = [versao("a1", 1), versao("a3", 3), versao("a2", 2)];

    expect(maisRecentePrimeiro(versoes).map((v) => v.id)).toEqual(["a3", "a2", "a1"]);
    expect(versoes.map((v) => v.id)).toEqual(["a1", "a3", "a2"]);
  });
});

const ADAPTADORES: [string, () => Promise<AdaptadorPersistencia> | AdaptadorPersistencia][] = [
  ["memória", criarAdaptadorMemoria],
  ["IndexedDB", () => criarAdaptadorIndexedDB(`teste-versoes-${crypto.randomUUID()}`)],
];

describe.each(ADAPTADORES)("registrarVersao — adaptador %s", (_, criarAdaptador) => {
  let adaptador: AdaptadorPersistencia;

  beforeEach(async () => {
    adaptador = await criarAdaptador();
    // Só o relógio: o `fake-indexeddb` usa `setTimeout` de verdade.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T08:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function passarDezMinutos() {
    vi.setSystemTime(new Date(Date.now() + 10 * 60_000));
  }

  it("40 automáticos e 5 nomeados: sobram os 30 automáticos mais recentes e os 5 nomeados", async () => {
    const documento = novoDocumento();
    const automaticas: ResumoVersao[] = [];
    const nomeadas: ResumoVersao[] = [];

    // Os nomeados no meio da sequência, entre automáticos que vão sair: a
    // retenção não pode levá-los junto.
    for (let i = 0; i < 40; i++) {
      documento.metadados.titulo = `Rascunho ${i}`;
      automaticas.push(await registrarVersao(adaptador, documento));
      passarDezMinutos();
      if (i % 8 === 0) {
        nomeadas.push(await registrarVersao(adaptador, documento, `Marco ${i}`));
        passarDezMinutos();
      }
    }

    const restantes = await adaptador.listarVersoes(documento.id);
    expect(nomeadas).toHaveLength(5);
    expect(restantes).toHaveLength(35);
    expect(restantes.filter((v) => v.automatica)).toHaveLength(30);
    expect(restantes.filter((v) => !v.automatica).map((v) => v.nome)).toEqual([
      "Marco 32",
      "Marco 24",
      "Marco 16",
      "Marco 8",
      "Marco 0",
    ]);

    // Ficam as 30 mais recentes; as 10 primeiras saem, e o conteúdo delas
    // some junto.
    const idsRestantes = new Set(restantes.map((v) => v.id));
    expect(automaticas.slice(10).every((v) => idsRestantes.has(v.id))).toBe(true);
    expect(automaticas.slice(0, 10).some((v) => idsRestantes.has(v.id))).toBe(false);
    expect(await adaptador.carregarVersao(documento.id, automaticas[0].id)).toBeNull();

    // A versão mais recente guarda o documento daquele momento.
    const ultima = await adaptador.carregarVersao(documento.id, automaticas[39].id);
    expect(ultima?.metadados.titulo).toBe("Rascunho 39");
  });

  it("a retenção de um documento não toca nas versões de outro", async () => {
    const cheio = novoDocumento();
    const vizinho = novoDocumento();
    const doVizinho = await registrarVersao(adaptador, vizinho);

    for (let i = 0; i < LIMITE_VERSOES_AUTOMATICAS + 3; i++) {
      passarDezMinutos();
      await registrarVersao(adaptador, cheio);
    }

    expect(await adaptador.listarVersoes(cheio.id)).toHaveLength(LIMITE_VERSOES_AUTOMATICAS);
    expect(await adaptador.listarVersoes(vizinho.id)).toEqual([doVizinho]);
  });

  // Passo 5.3.3.
  it("restaurar devolve o texto antigo, grava-o no documento e guarda o de agora como versão", async () => {
    const documento = novoDocumento();
    documento.metadados.titulo = "Texto antigo";
    await adaptador.salvarDocumento(documento);
    const antiga = await registrarVersao(adaptador, documento);
    passarDezMinutos();

    const atual = { ...documento, metadados: { ...documento.metadados, titulo: "Texto de agora" } };
    await adaptador.salvarDocumento(atual);

    const { documento: restaurado, anterior } = await restaurarVersao(
      adaptador,
      atual,
      antiga.id,
      "Antes de restaurar",
    );

    expect(restaurado.metadados.titulo).toBe("Texto antigo");
    expect((await adaptador.carregarDocumento(documento.id))?.metadados.titulo).toBe(
      "Texto antigo",
    );
    // O estado anterior não some: é uma versão nomeada, a mais recente.
    expect(anterior).toMatchObject({ nome: "Antes de restaurar", automatica: false });
    expect((await adaptador.listarVersoes(documento.id))[0].id).toBe(anterior.id);
    expect((await adaptador.carregarVersao(documento.id, anterior.id))?.metadados.titulo).toBe(
      "Texto de agora",
    );
  });

  it("restaurar uma versão que não existe não grava nada", async () => {
    const documento = novoDocumento();
    documento.metadados.titulo = "Intacto";
    await adaptador.salvarDocumento(documento);

    await expect(
      restaurarVersao(adaptador, documento, "inexistente", "Antes de restaurar"),
    ).rejects.toThrow(/não existe/);

    expect(await adaptador.listarVersoes(documento.id)).toEqual([]);
    expect((await adaptador.carregarDocumento(documento.id))?.metadados.titulo).toBe("Intacto");
  });

  it("apara os espaços do nome, e nome em branco não vira versão automática", async () => {
    const documento = novoDocumento();

    const salva = await registrarVersao(adaptador, documento, "  Antes da banca  ");
    expect(salva).toMatchObject({ nome: "Antes da banca", automatica: false });

    await expect(registrarVersao(adaptador, documento, "   ")).rejects.toThrow(/em branco/);
    expect(await adaptador.listarVersoes(documento.id)).toEqual([salva]);
  });
});
