import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { novoDocumento } from "../document/factory";
import { executarSuiteDeContrato } from "./__tests__/contract";
import { criarAdaptadorIndexedDB } from "./indexeddb";

// Cada chamada usa um nome de banco novo — a suíte de contrato roda vários
// `it()` no mesmo processo, e um nome fixo faria um teste ver o que o
// anterior gravou.
executarSuiteDeContrato("adaptador IndexedDB (fake-indexeddb)", () =>
  criarAdaptadorIndexedDB(`teste-contrato-${crypto.randomUUID()}`),
);

describe("adaptador IndexedDB — sobrevive a uma nova conexão", () => {
  it("uma segunda conexão ao mesmo banco enxerga o que a primeira salvou", async () => {
    // Aproxima, em nível de unidade, o que "recarregar a página" significa:
    // uma conexão nova, sem nada em memória compartilhado com a anterior,
    // lendo o mesmo banco. A conferência de verdade — recarregar o
    // navegador de fato — só existe a partir da tela do editor (1.3.x).
    const nomeBanco = `teste-reconexao-${crypto.randomUUID()}`;
    const documento = novoDocumento();
    documento.metadados.titulo = "Sobrevive à reconexão";

    const primeiraConexao = await criarAdaptadorIndexedDB(nomeBanco);
    await primeiraConexao.salvarDocumento(documento);

    const segundaConexao = await criarAdaptadorIndexedDB(nomeBanco);
    expect(await segundaConexao.carregarDocumento(documento.id)).toEqual(documento);
  });
});

describe("adaptador IndexedDB — migração da versão 2 para a 3 (passo 6.1.2)", () => {
  // O banco de quem já usava o AURA antes das imagens: documentos, versões e
  // presets, sem a loja `imagens`.
  it("cria a loja de imagens e mantém os documentos gravados na versão 2", async () => {
    const nomeBanco = `teste-migracao-v3-${crypto.randomUUID()}`;
    const documento = novoDocumento();
    documento.metadados.titulo = "Gravado na versão 2";

    await new Promise<void>((resolve, reject) => {
      const requisicao = indexedDB.open(nomeBanco, 2);
      requisicao.onupgradeneeded = () => {
        const banco = requisicao.result;
        banco.createObjectStore("documentos", { keyPath: "id" });
        banco
          .createObjectStore("versoes", { keyPath: "id" })
          .createIndex("documentoId", "documentoId");
        banco.createObjectStore("presets", { keyPath: "id" });
      };
      requisicao.onsuccess = () => {
        const banco = requisicao.result;
        const transacao = banco.transaction("documentos", "readwrite");
        transacao
          .objectStore("documentos")
          .put({ id: documento.id, documento, atualizadoEm: new Date() });
        transacao.oncomplete = () => {
          banco.close();
          resolve();
        };
        transacao.onerror = () => reject(transacao.error as Error);
      };
      requisicao.onerror = () => reject(requisicao.error as Error);
    });

    const adaptador = await criarAdaptadorIndexedDB(nomeBanco);

    expect(await adaptador.carregarDocumento(documento.id)).toEqual(documento);
    await adaptador.salvarImagem({
      id: "i1",
      documentoId: documento.id,
      formato: "png",
      largura: 1,
      altura: 1,
      bytes: new Uint8Array([1]),
    });
    expect(await adaptador.carregarImagem(documento.id, "i1")).not.toBeNull();
  });
});

describe("adaptador IndexedDB — migração da versão 1 para a 2 (passo 5.1.3)", () => {
  // Um banco criado antes do passo 5.1.3 tem só `documentos` e `versoes`. O
  // navegador de quem já usava o AURA está nesse estado: abrir na versão 2
  // tem de criar `presets` sem perder nada do que já estava gravado.
  it("cria a loja de presets e mantém os documentos gravados na versão 1", async () => {
    const nomeBanco = `teste-migracao-${crypto.randomUUID()}`;
    const documento = novoDocumento();
    documento.metadados.titulo = "Gravado na versão 1";

    await new Promise<void>((resolve, reject) => {
      const requisicao = indexedDB.open(nomeBanco, 1);
      requisicao.onupgradeneeded = () => {
        const banco = requisicao.result;
        banco.createObjectStore("documentos", { keyPath: "id" });
        banco
          .createObjectStore("versoes", { keyPath: "id" })
          .createIndex("documentoId", "documentoId");
      };
      requisicao.onsuccess = () => {
        const banco = requisicao.result;
        const transacao = banco.transaction("documentos", "readwrite");
        transacao
          .objectStore("documentos")
          .put({ id: documento.id, documento, atualizadoEm: new Date() });
        transacao.oncomplete = () => {
          banco.close();
          resolve();
        };
        transacao.onerror = () => reject(transacao.error as Error);
      };
      requisicao.onerror = () => reject(requisicao.error as Error);
    });

    const adaptador = await criarAdaptadorIndexedDB(nomeBanco);

    expect(await adaptador.carregarDocumento(documento.id)).toEqual(documento);
    expect(await adaptador.listarPresets()).toEqual([]);
    await adaptador.salvarPreset({ id: "p1", nome: "Universidade X", regras: {} });
    expect(await adaptador.listarPresets()).toHaveLength(1);
  });
});
