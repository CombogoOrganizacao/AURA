import { describe, expect, it } from "vitest";

import { validarDocumento } from "../document/validate";
import { congelado, documentoConforme } from "./__tests__/documentoConforme";
import { VERIFICACOES } from "./checks";
import {
  conferirDocumento,
  contarPorGravidade,
  type ContextoConferencia,
  type Verificacao,
} from "./compliance";
import { resolveRules } from "./resolve";

// Passo 5.2.1 — "Vitest cobre documento conforme (lista de achados vazia) e
// cada falha isolada gerando exatamente um achado". As regras de verdade são o
// 5.2.2; aqui o motor, com verificações de teste, e o documento de referência
// contra o registro inteiro.

const REGRAS = resolveRules("abnt", null, null).regras;

// Duas regras de teste, cada uma acusando uma coisa só.
const SEM_TITULO: Verificacao = {
  regra: "teste-sem-titulo",
  verificar: ({ documento }) =>
    documento.metadados.titulo.trim()
      ? []
      : [
          {
            gravidade: "erro",
            item: "NBR 14724:2024 §4.1.1",
            mensagem: "O trabalho está sem título.",
            local: { tipo: "metadado", campo: "titulo" },
          },
        ],
};

const SEM_REFERENCIA: Verificacao = {
  regra: "teste-sem-referencia",
  verificar: ({ documento }) =>
    documento.references.length > 0
      ? []
      : [
          {
            gravidade: "erro",
            item: "NBR 14724:2024 §4.2.3.1",
            mensagem: "Não há referência cadastrada.",
            local: { tipo: "documento" },
          },
        ],
};

const DE_TESTE = [SEM_TITULO, SEM_REFERENCIA];

describe("documento conforme", () => {
  it("é um documento estruturalmente válido", () => {
    expect(validarDocumento(documentoConforme())).toEqual([]);
  });

  // Guarda cada regra que o 5.2.2 registrar: se uma delas acusar algo no
  // documento conforme, ou escrever nele (está congelado), este teste cai.
  it("não gera achado nenhum com o registro inteiro, e não é alterado", () => {
    expect(conferirDocumento(congelado(documentoConforme()), REGRAS, VERIFICACOES)).toEqual([]);
  });

  it("não gera achado com as regras de teste", () => {
    expect(conferirDocumento(documentoConforme(), REGRAS, DE_TESTE)).toEqual([]);
  });
});

describe("conferirDocumento — o motor", () => {
  it("cada falha isolada gera exatamente um achado, carimbado com a regra que o emitiu", () => {
    const semTitulo = documentoConforme();
    semTitulo.metadados.titulo = "";
    expect(conferirDocumento(semTitulo, REGRAS, DE_TESTE)).toEqual([
      {
        regra: "teste-sem-titulo",
        gravidade: "erro",
        item: "NBR 14724:2024 §4.1.1",
        mensagem: "O trabalho está sem título.",
        local: { tipo: "metadado", campo: "titulo" },
      },
    ]);

    const semReferencia = documentoConforme();
    semReferencia.references = [];
    const achados = conferirDocumento(semReferencia, REGRAS, DE_TESTE);
    expect(achados).toHaveLength(1);
    expect(achados[0].regra).toBe("teste-sem-referencia");
  });

  it("duas falhas geram dois achados, na ordem do registro", () => {
    const documento = documentoConforme();
    documento.metadados.titulo = "";
    documento.references = [];

    expect(conferirDocumento(documento, REGRAS, DE_TESTE).map((achado) => achado.regra)).toEqual([
      "teste-sem-titulo",
      "teste-sem-referencia",
    ]);
  });

  it("uma regra não emite achado em nome de outra: o id vem do registro", () => {
    const impostora: Verificacao = {
      regra: "impostora",
      verificar: () => [
        {
          regra: "outra-regra",
          gravidade: "aviso",
          item: null,
          mensagem: "x",
          local: { tipo: "documento" },
        } as never,
      ],
    };
    expect(conferirDocumento(documentoConforme(), REGRAS, [impostora])[0].regra).toBe("impostora");
  });

  it("entrega o documento e as regras resolvidas a cada verificação", () => {
    let recebido: ContextoConferencia | null = null;
    const espia: Verificacao = {
      regra: "espia",
      verificar: (contexto) => {
        recebido = contexto;
        return [];
      },
    };
    const documento = documentoConforme();
    conferirDocumento(documento, REGRAS, [espia]);

    expect(recebido).toEqual({ documento, regras: REGRAS });
  });
});

describe("contarPorGravidade", () => {
  it("conta erros e avisos, sem nota nenhuma", () => {
    const documento = documentoConforme();
    documento.metadados.titulo = "";
    documento.references = [];
    const avisoQualquer: Verificacao = {
      regra: "aviso",
      verificar: () => [
        { gravidade: "aviso", item: null, mensagem: "x", local: { tipo: "documento" } },
      ],
    };

    expect(
      contarPorGravidade(conferirDocumento(documento, REGRAS, [...DE_TESTE, avisoQualquer])),
    ).toEqual({ erro: 2, aviso: 1 });
  });
});
