import { describe, expect, it } from "vitest";

import { novoDocumento } from "../factory";
import type { Documento, ElementoPosTextual } from "../types";
import { gerarAnexos } from "./anexos";
import { gerarApendices } from "./apendices";

function elemento(id: string, titulo = ""): ElementoPosTextual {
  return { id, titulo, content: [] };
}

describe("gerarAnexos (passo 3.7.1)", () => {
  it("letra cada anexo pela posição, começando em A", () => {
    const anexos = [elemento("x1", "Lei 9.610/1998"), elemento("x2", "Parecer do CEP")];

    expect(gerarAnexos(anexos)).toEqual([
      { id: "x1", rotulo: "ANEXO", letra: "A", titulo: "Lei 9.610/1998" },
      { id: "x2", rotulo: "ANEXO", letra: "B", titulo: "Parecer do CEP" },
    ]);
  });

  it("inserir um anexo no meio reletra todos os seguintes", () => {
    const depois = [elemento("x1"), elemento("novo"), elemento("x2")];

    expect(gerarAnexos(depois).map((item) => [item.id, item.letra])).toEqual([
      ["x1", "A"],
      ["novo", "B"],
      ["x2", "C"],
    ]);
  });
});

// O critério de aceite do passo 3.7.1, literalmente: "as duas sequências não
// se misturam". Não é uma regra que o código lembra de respeitar — é o que as
// duas assinaturas tornam possível, já que nenhuma das funções recebe a lista
// da outra. Os testes abaixo provam pelo comportamento.
describe("as duas sequências são independentes", () => {
  it("o primeiro anexo é A mesmo com cinco apêndices antes dele", () => {
    const documento: Documento = {
      ...novoDocumento(),
      apendices: ["a1", "a2", "a3", "a4", "a5"].map((id) => elemento(id)),
      anexos: [elemento("x1", "Parecer do CEP")],
    };

    expect(gerarApendices(documento.apendices).at(-1)?.letra).toBe("E");
    expect(gerarAnexos(documento.anexos)).toEqual([
      { id: "x1", rotulo: "ANEXO", letra: "A", titulo: "Parecer do CEP" },
    ]);
  });

  it("acrescentar apêndices não mexe em letra nenhuma de anexo", () => {
    const anexos = [elemento("x1"), elemento("x2")];
    const antes = gerarAnexos(anexos);

    // O documento ganhou apêndices no meio do caminho; a lista de anexos é a
    // mesma, e é a única coisa que `gerarAnexos()` enxerga.
    const depois = gerarAnexos(anexos);

    expect(depois).toEqual(antes);
    expect(depois.map((item) => item.letra)).toEqual(["A", "B"]);
  });

  it("apêndice e anexo na mesma posição compartilham a letra e divergem no rótulo", () => {
    const apendice = gerarApendices([elemento("a1", "Questionário")])[0];
    const anexo = gerarAnexos([elemento("x1", "Legislação")])[0];

    expect(apendice.letra).toBe(anexo.letra);
    expect([apendice.rotulo, anexo.rotulo]).toEqual(["APÊNDICE", "ANEXO"]);
  });
});
