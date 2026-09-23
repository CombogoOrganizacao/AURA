import { describe, expect, it } from "vitest";

import type { Documento } from "../../document/types";
import { conferirCom } from "../__tests__/conferirCom";
import { corpoPresente, referenciasPresentes } from "./corpoEReferencias";
import { dadosDeIdentificacao } from "./dadosDeIdentificacao";
import { folhaDeAprovacao } from "./folhaDeAprovacao";
import { posTextualComTitulo } from "./posTextualComTitulo";
import { resumoEstrangeiro, resumoVernaculo } from "./resumos";

// Passo 5.2.2 — elementos obrigatórios da NBR 14724:2024. Para cada regra: o
// caso conforme (o documento de referência não gera achado) e cada falha
// isolada gerando o achado esperado.

describe("dados-de-identificacao (§4.1.1, §4.2.1.1.1)", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(dadosDeIdentificacao)).toEqual([]);
  });

  it.each([
    [
      "autores",
      (d: Documento) => {
        d.metadados.autores = [" "];
      },
      "§4.1.1 b)",
    ],
    [
      "titulo",
      (d: Documento) => {
        d.metadados.titulo = "";
      },
      "§4.1.1 c)",
    ],
    [
      "naturezaTrabalho",
      (d: Documento) => {
        d.metadados.naturezaTrabalho = "";
      },
      "§4.2.1.1.1 e)",
    ],
    [
      "orientador",
      (d: Documento) => {
        d.metadados.orientador = "";
      },
      "§4.2.1.1.1 f)",
    ],
    [
      "local",
      (d: Documento) => {
        d.metadados.local = "";
      },
      "§4.1.1 f)",
    ],
    [
      "ano",
      (d: Documento) => {
        d.metadados.ano = 0;
      },
      "§4.1.1 g)",
    ],
  ] as const)("sem %s: um erro, no campo, citando o item", (campo, alterar, item) => {
    const achados = conferirCom(dadosDeIdentificacao, alterar);
    expect(achados).toHaveLength(1);
    expect(achados[0]).toMatchObject({
      regra: "dados-de-identificacao",
      gravidade: "erro",
      local: { tipo: "metadado", campo },
    });
    expect(achados[0].item).toContain(item);
  });

  it("instituição e subtítulo não são exigidos (opcional na capa; 'se houver')", () => {
    expect(
      conferirCom(dadosDeIdentificacao, (d) => {
        d.metadados.instituicao = "";
        d.metadados.subtitulo = "";
      }),
    ).toEqual([]);
  });
});

describe("folha-de-aprovacao (§4.2.1.3)", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(folhaDeAprovacao)).toEqual([]);
  });

  it("sem banca: um erro dizendo que a folha não sai", () => {
    const achados = conferirCom(folhaDeAprovacao, (d) => (d.metadados.bancaExaminadora = []));
    expect(achados).toEqual([
      expect.objectContaining({
        gravidade: "erro",
        item: "NBR 14724:2024 §4.2.1.3",
        local: { tipo: "metadado", campo: "bancaExaminadora" },
      }),
    ]);
  });

  it("membro sem titulação e sem instituição: um erro, nomeando o membro e as duas faltas", () => {
    const achados = conferirCom(folhaDeAprovacao, (d) => {
      d.metadados.bancaExaminadora![1] = {
        id: "b2",
        nome: "Ana Lima",
        titulacao: "",
        instituicao: " ",
      };
    });
    expect(achados).toHaveLength(1);
    expect(achados[0].mensagem).toBe(
      "Falta a titulação e a instituição de Ana Lima, na banca examinadora.",
    );
  });
});

describe("resumo-vernaculo (§4.2.1.7) e resumo-estrangeiro (§4.2.1.8)", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(resumoVernaculo)).toEqual([]);
    expect(conferirCom(resumoEstrangeiro)).toEqual([]);
  });

  it("resumo vazio: erro no campo resumo", () => {
    expect(conferirCom(resumoVernaculo, (d) => (d.metadados.resumo = "  "))).toEqual([
      expect.objectContaining({
        regra: "resumo-vernaculo",
        gravidade: "erro",
        item: "NBR 14724:2024 §4.2.1.7",
        local: { tipo: "metadado", campo: "resumo" },
      }),
    ]);
  });

  it("sem palavras-chave: erro pela NBR 6028 §4.1.7", () => {
    expect(conferirCom(resumoVernaculo, (d) => (d.metadados.palavrasChave = []))).toEqual([
      expect.objectContaining({
        item: "NBR 6028:2021 §4.1.7",
        local: { tipo: "metadado", campo: "palavrasChave" },
      }),
    ]);
  });

  it("abstract vazio é erro: é obrigatório desde o passo 4B.1", () => {
    expect(conferirCom(resumoEstrangeiro, (d) => (d.metadados.abstract = ""))).toEqual([
      expect.objectContaining({
        regra: "resumo-estrangeiro",
        gravidade: "erro",
        item: "NBR 14724:2024 §4.2.1.8",
        local: { tipo: "metadado", campo: "abstract" },
      }),
    ]);
  });

  it("sem keywords: erro no campo keywords", () => {
    expect(conferirCom(resumoEstrangeiro, (d) => (d.metadados.keywords = [""]))).toEqual([
      expect.objectContaining({ local: { tipo: "metadado", campo: "keywords" } }),
    ]);
  });
});

describe("corpo-presente e referencias-presentes", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(corpoPresente)).toEqual([]);
    expect(conferirCom(referenciasPresentes)).toEqual([]);
  });

  it("sem seção nenhuma: erro no documento", () => {
    expect(conferirCom(corpoPresente, (d) => (d.sections = []))).toEqual([
      expect.objectContaining({ gravidade: "erro", local: { tipo: "documento" } }),
    ]);
  });

  it("sem referência nenhuma: erro pelo §4.2.3.1", () => {
    expect(conferirCom(referenciasPresentes, (d) => (d.references = []))).toEqual([
      expect.objectContaining({ gravidade: "erro", item: "NBR 14724:2024 §4.2.3.1" }),
    ]);
  });

  it("seção com qualquer nome serve: a nomenclatura é do autor (nota 1 do Esquema 1)", () => {
    expect(
      conferirCom(corpoPresente, (d) => {
        d.sections.forEach((secao) => (secao.titulo = "Capítulo sem nome de manual"));
      }),
    ).toEqual([]);
  });
});

describe("pos-textual-com-titulo (§4.2.3.3, §4.2.3.4)", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(posTextualComTitulo)).toEqual([]);
  });

  it("apêndice sem título: erro no bloco do apêndice", () => {
    expect(conferirCom(posTextualComTitulo, (d) => (d.apendices[0].titulo = ""))).toEqual([
      expect.objectContaining({
        gravidade: "erro",
        item: "NBR 14724:2024 §4.2.3.3",
        local: { tipo: "bloco", onde: { tipo: "apendice", id: "ap1" } },
      }),
    ]);
  });

  it("anexo sem título: erro pelo §4.2.3.4", () => {
    expect(
      conferirCom(
        posTextualComTitulo,
        (d) => (d.anexos = [{ id: "an1", titulo: "", content: [] }]),
      ),
    ).toEqual([expect.objectContaining({ item: "NBR 14724:2024 §4.2.3.4" })]);
  });
});
