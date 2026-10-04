import { describe, expect, it } from "vitest";

import { conferirCom } from "../__tests__/conferirCom";
import { naturezaCompleta } from "./naturezaCompleta";

describe("natureza-completa (§4.2.1.1.1 e)", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(naturezaCompleta)).toEqual([]);
  });

  it("só o tipo do trabalho (o caso do TCC exportado): um aviso, com as duas faltas", () => {
    const achados = conferirCom(naturezaCompleta, (d) => {
      d.metadados.naturezaTrabalho = "Trabalho de Conclusão de Curso";
    });
    expect(achados).toHaveLength(1);
    expect(achados[0]).toMatchObject({
      regra: "natureza-completa",
      gravidade: "aviso",
      local: { tipo: "metadado", campo: "naturezaTrabalho" },
    });
    expect(achados[0].mensagem).toContain("objetivo");
    expect(achados[0].mensagem).toContain("Universidade Católica de Pernambuco");
  });

  it("instituição escrita sem acento ou em outra caixa ainda conta", () => {
    expect(
      conferirCom(naturezaCompleta, (d) => {
        d.metadados.naturezaTrabalho =
          "Trabalho de Conclusão de Curso apresentado à UNIVERSIDADE CATOLICA DE PERNAMBUCO como requisito parcial.";
      }),
    ).toEqual([]);
  });

  it("sem instituição cadastrada, só o objetivo é conferido", () => {
    const achados = conferirCom(naturezaCompleta, (d) => {
      d.metadados.instituicao = "";
      d.metadados.naturezaTrabalho = "Trabalho de Conclusão de Curso";
    });
    expect(achados).toHaveLength(1);
    expect(achados[0].mensagem).not.toContain("instituição (");
  });

  it("natureza vazia fica com dados-de-identificacao, não aqui", () => {
    expect(
      conferirCom(naturezaCompleta, (d) => {
        d.metadados.naturezaTrabalho = "";
      }),
    ).toEqual([]);
  });
});
