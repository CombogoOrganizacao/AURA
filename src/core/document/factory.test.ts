import { describe, expect, it } from "vitest";

import { novoDocumento } from "./factory";
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
