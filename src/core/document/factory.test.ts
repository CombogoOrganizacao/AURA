import { describe, expect, it } from "vitest";

import { novaSecao, novoDocumento } from "./factory";
import { validarDocumento } from "./validate";

describe("novoDocumento", () => {
  it("produz um documento estruturalmente válido", () => {
    expect(validarDocumento(novoDocumento())).toEqual([]);
  });

  it("não escreve nenhum texto nos metadados — o formulário 1.3.4 preenche depois", () => {
    const documento = novoDocumento();
    expect(documento.metadados.titulo).toBe("");
    expect(documento.metadados.autores).toEqual([]);
    expect(documento.sections).toEqual([]);
    expect(documento.references).toEqual([]);
  });

  it("gera um id novo a cada chamada", () => {
    const a = novoDocumento();
    const b = novoDocumento();
    expect(a.id).not.toBe(b.id);
  });
});

describe("novaSecao", () => {
  it("produz uma seção estruturalmente válida como primeira e única seção", () => {
    const documento = novoDocumento();
    documento.sections = [novaSecao(0)];
    expect(validarDocumento(documento)).toEqual([]);
  });

  it("tem um parágrafo vazio, não conteúdo nenhum — precisa de lugar pro cursor", () => {
    const secao = novaSecao(0);
    expect(secao.content).toEqual([{ type: "paragraph" }]);
  });

  it("nível 1 por padrão; aceita outro nível explícito", () => {
    expect(novaSecao(0).nivel).toBe(1);
    expect(novaSecao(1, 2).nivel).toBe(2);
  });

  it("gera um id novo a cada chamada", () => {
    expect(novaSecao(0).id).not.toBe(novaSecao(0).id);
  });
});
