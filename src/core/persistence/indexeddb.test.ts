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
