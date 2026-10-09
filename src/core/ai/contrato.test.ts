import { describe, expect, it } from "vitest";

import {
  atenderComIADesativada,
  LIMITE_CORPO,
  LIMITE_TRECHO,
  STATUS_DO_ERRO,
  validarRequisicao,
  type CodigoErro,
} from "./contrato";

// Contrato da rota /api/ai (docs/contrato-api-ai.md), passo 6.5.3.

const VALIDA = {
  versao: 1,
  operacao: "revisar",
  trecho: {
    texto: "Os dados mostra que o método foi eficaz￼ nos dois grupos.",
    protegidos: [{ inicio: 39, fim: 40 }],
  },
};

function atender(corpo: unknown, contentType: string | null = "application/json") {
  return atenderComIADesativada({
    contentType,
    corpo: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

function comTrecho(trecho: Record<string, unknown>) {
  return { ...VALIDA, trecho: { ...VALIDA.trecho, ...trecho } };
}

describe("rota /api/ai com a IA desativada (6.5.3)", () => {
  it("requisição válida recebe 501 ia_desativada, no formato do contrato", () => {
    expect(atender(VALIDA)).toEqual({
      status: 501,
      corpo: {
        erro: {
          codigo: "ia_desativada",
          mensagem: "A revisão com IA ainda não está disponível no AURA.",
        },
      },
    });
  });

  it("aceita parâmetros no Content-Type", () => {
    expect(atender(VALIDA, "application/json; charset=utf-8").status).toBe(501);
    expect(atender(VALIDA, "Application/JSON").status).toBe(501);
  });

  it.each([
    ["sem Content-Type", null],
    ["formulário", "application/x-www-form-urlencoded"],
    ["texto", "text/plain"],
    ["parecido, mas não JSON", "application/jsonp"],
  ])("415 tipo_invalido: %s", (_, contentType) => {
    const resposta = atender(VALIDA, contentType);
    expect(resposta.status).toBe(415);
    expect(resposta.corpo.erro.codigo).toBe("tipo_invalido");
  });

  it("o tipo é conferido antes do corpo (ordem do contrato §5.1)", () => {
    expect(atender("isto não é JSON", "text/plain").corpo.erro.codigo).toBe("tipo_invalido");
  });

  it("JSON malformado é 400 apontando o corpo", () => {
    expect(atender("{ versao: 1").corpo.erro).toMatchObject({
      codigo: "requisicao_invalida",
      campo: "corpo",
    });
  });

  it("corpo enorme é 413 sem passar pelo parse", () => {
    const resposta = atender("x".repeat(LIMITE_CORPO + 1));
    expect(resposta.status).toBe(413);
    expect(resposta.corpo.erro.codigo).toBe("trecho_longo");
  });

  it("a mensagem nunca repete o trecho enviado", () => {
    const resposta = atender(comTrecho({ texto: "segredo ".repeat(600) }));
    expect(JSON.stringify(resposta)).not.toMatch(/segredo/);
  });
});

describe("validação da requisição (contrato §2.2)", () => {
  it("normaliza: protegidos ausente vira [] e campos desconhecidos ficam de fora", () => {
    const resultado = validarRequisicao({
      ...VALIDA,
      trecho: { texto: VALIDA.trecho.texto },
      extra: true,
    });

    expect(resultado).toEqual({
      ok: true,
      requisicao: { versao: 1, operacao: "revisar", trecho: { texto: VALIDA.trecho.texto, protegidos: [] } },
    });
  });

  it.each<[string, unknown, string]>([
    ["corpo que não é objeto", [VALIDA], "corpo"],
    ["versão desconhecida", { ...VALIDA, versao: 2 }, "versao"],
    ["versão como texto", { ...VALIDA, versao: "1" }, "versao"],
    ["operação fora da lista", { ...VALIDA, operacao: "parafrasear" }, "operacao"],
    ["sem operação", { ...VALIDA, operacao: undefined }, "operacao"],
    ["sem trecho", { ...VALIDA, trecho: undefined }, "trecho"],
    ["texto ausente", comTrecho({ texto: undefined }), "trecho.texto"],
    ["texto só com espaços", comTrecho({ texto: "  \n " }), "trecho.texto"],
    ["protegidos que não é lista", comTrecho({ protegidos: {} }), "trecho.protegidos"],
    ["faixa vazia", comTrecho({ protegidos: [{ inicio: 3, fim: 3 }] }), "trecho.protegidos[0]"],
    ["faixa invertida", comTrecho({ protegidos: [{ inicio: 5, fim: 3 }] }), "trecho.protegidos[0]"],
    ["faixa negativa", comTrecho({ protegidos: [{ inicio: -1, fim: 3 }] }), "trecho.protegidos[0]"],
    [
      "faixa além do texto",
      comTrecho({ protegidos: [{ inicio: 0, fim: 1 }, { inicio: 50, fim: 999 }] }),
      "trecho.protegidos[1]",
    ],
    ["faixa fracionária", comTrecho({ protegidos: [{ inicio: 0.5, fim: 2 }] }), "trecho.protegidos[0]"],
  ])("400 requisicao_invalida: %s", (_, corpo, campo) => {
    const resultado = validarRequisicao(corpo);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.resposta.status).toBe(400);
    expect(resultado.resposta.corpo.erro).toMatchObject({ codigo: "requisicao_invalida", campo });
  });

  it("não há campo de instrução livre: um pedido escrito não passa adiante", () => {
    const resultado = validarRequisicao({ ...VALIDA, instrucao: "Escreva minha introdução." });
    expect(resultado.ok && JSON.stringify(resultado.requisicao)).not.toMatch(/introdução/);
  });

  it("o limite do trecho é em unidades UTF-16, e o texto no limite passa", () => {
    expect(validarRequisicao(comTrecho({ texto: "a".repeat(LIMITE_TRECHO), protegidos: [] })).ok).toBe(true);

    const acima = validarRequisicao(comTrecho({ texto: "a".repeat(LIMITE_TRECHO + 1), protegidos: [] }));
    expect(!acima.ok && acima.resposta.status).toBe(413);
  });

  it("a forma é conferida antes do tamanho (400 antes de 413)", () => {
    const resultado = validarRequisicao({
      ...comTrecho({ texto: "a".repeat(LIMITE_TRECHO + 1) }),
      versao: 9,
    });
    expect(!resultado.ok && resultado.resposta.status).toBe(400);
  });
});

describe("tabela de status (contrato §5.1)", () => {
  it.each<[CodigoErro, number]>([
    ["tipo_invalido", 415],
    ["requisicao_invalida", 400],
    ["trecho_longo", 413],
    ["ia_desativada", 501],
    ["sem_sessao", 401],
    ["limite_excedido", 429],
    ["cota_esgotada", 429],
    ["chave_recusada", 403],
    ["falha_provedor", 502],
    ["tempo_esgotado", 504],
    ["erro_interno", 500],
  ])("%s → %i", (codigo, status) => {
    expect(STATUS_DO_ERRO[codigo]).toBe(status);
  });
});
