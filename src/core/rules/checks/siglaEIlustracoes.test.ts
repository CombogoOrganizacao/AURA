import { describe, expect, it } from "vitest";

import type { Documento, NoFigura, NoParagrafo, NoTabela, NoTexto } from "../../document/types";
import { conferirCom } from "../__tests__/conferirCom";
import { ilustracaoCitada, ilustracaoComFonte, ilustracaoComTitulo } from "./ilustracoes";
import { siglaPrimeiraMencao } from "./siglaPrimeiraMencao";

// Passo 5.2.2 — NBR 14724:2024 §5.6 (siglas), §5.8 (ilustrações) e §5.9
// (tabelas).

const INTRO = { tipo: "secao", id: "s-intro" } as const;

function paragrafoInicial(documento: Documento): NoParagrafo {
  return documento.sections[0].content[0] as NoParagrafo;
}

function trocarTexto(documento: Documento, de: string, para: string) {
  for (const texto of (paragrafoInicial(documento).content as NoTexto[])) {
    texto.text = texto.text.replace(de, para);
  }
}

describe("sigla-primeira-mencao (§5.6, 'deve')", () => {
  it("conforme: 'Associação Brasileira de Normas Técnicas (ABNT)' na primeira menção", () => {
    expect(conferirCom(siglaPrimeiraMencao)).toEqual([]);
  });

  it("primeira menção sem o nome completo: erro no trecho da sigla", () => {
    const achados = conferirCom(siglaPrimeiraMencao, (d) =>
      trocarTexto(d, "A Associação Brasileira de Normas Técnicas (ABNT) orienta", "A ABNT orienta"),
    );
    expect(achados).toEqual([
      expect.objectContaining({
        gravidade: "erro",
        item: "NBR 14724:2024 §5.6",
        local: { tipo: "bloco", onde: INTRO, no: 0, trecho: { inicio: 2, fim: 6 } },
      }),
    ]);
    expect(achados[0].mensagem).toContain('"Associação Brasileira de Normas Técnicas (ABNT)"');
  });

  it("só a PRIMEIRA menção conta: a segunda, sozinha, é o uso normal da sigla", () => {
    // A conclusão já usa "A ABNT continua..." sem o nome, e o documento é
    // conforme.
    expect(conferirCom(siglaPrimeiraMencao)).toEqual([]);
  });

  it("caixa e espaços do nome completo não contam", () => {
    expect(
      conferirCom(siglaPrimeiraMencao, (d) =>
        trocarTexto(
          d,
          "A Associação Brasileira de Normas Técnicas (ABNT)",
          "A associação brasileira de  normas técnicas ( ABNT )",
        ),
      ),
    ).toEqual([]);
  });

  it("sigla na ordem inversa, 'ABNT (Associação...)', não é a forma da norma", () => {
    expect(
      conferirCom(siglaPrimeiraMencao, (d) =>
        trocarTexto(
          d,
          "A Associação Brasileira de Normas Técnicas (ABNT)",
          "A ABNT (Associação Brasileira de Normas Técnicas)",
        ),
      ),
    ).toHaveLength(1);
  });

  it("a primeira menção num título de seção também conta, e o local é o bloco", () => {
    expect(
      conferirCom(siglaPrimeiraMencao, (d) => (d.sections[0].titulo = "Introdução à ABNT")),
    ).toEqual([expect.objectContaining({ local: { tipo: "bloco", onde: INTRO } })]);
  });

  it("sigla cadastrada que não aparece no texto não é achado daqui", () => {
    expect(
      conferirCom(siglaPrimeiraMencao, (d) =>
        d.metadados.abreviaturas!.push({ id: "ab2", sigla: "IBGE", significado: "Instituto" }),
      ),
    ).toEqual([]);
  });
});

describe("ilustracao-citada (§5.8 e §5.9, 'deve ser citada no texto')", () => {
  it("conforme: 'A Figura 1 e a Tabela 1' no texto", () => {
    expect(conferirCom(ilustracaoCitada)).toEqual([]);
  });

  it("figura não citada: erro no nó da figura", () => {
    expect(conferirCom(ilustracaoCitada, (d) => trocarTexto(d, "A Figura 1 e a", "A"))).toEqual([
      expect.objectContaining({
        gravidade: "erro",
        item: "NBR 14724:2024 §5.8",
        mensagem: expect.stringContaining("Figura 1"),
        local: { tipo: "bloco", onde: INTRO, no: 1 },
      }),
    ]);
  });

  it("tabela não citada: erro pelo §5.9", () => {
    expect(conferirCom(ilustracaoCitada, (d) => trocarTexto(d, " e a Tabela 1", ""))).toEqual([
      expect.objectContaining({
        item: "NBR 14724:2024 §5.9",
        local: { tipo: "bloco", onde: INTRO, no: 2 },
      }),
    ]);
  });

  it("citação depois da ilustração também vale: a norma não exige que venha antes", () => {
    expect(
      conferirCom(ilustracaoCitada, (d) => {
        trocarTexto(d, "A Figura 1 e a Tabela 1 resumem o processo.", "");
        d.sections[1].content.push({
          type: "paragraph",
          content: [{ type: "text", text: "Como mostraram a figura 1 e a tabela 1." }],
        });
      }),
    ).toEqual([]);
  });

  it("plural, lista e intervalo citam cada número", () => {
    const tresFiguras = (d: Documento) => {
      const figura = d.sections[0].content[1] as NoFigura;
      d.sections[0].content.splice(2, 0, { ...figura, id: "f2" }, { ...figura, id: "f3" });
    };
    expect(
      conferirCom(ilustracaoCitada, (d) => {
        tresFiguras(d);
        trocarTexto(d, "A Figura 1 e", "As Figuras 1 a 3 e");
      }),
    ).toEqual([]);
    expect(
      conferirCom(ilustracaoCitada, (d) => {
        tresFiguras(d);
        trocarTexto(d, "A Figura 1 e", "As Figuras 1, 2 e 3 e");
      }),
    ).toEqual([]);
  });

  it("'Figura 12' não cita a figura 1", () => {
    expect(
      conferirCom(ilustracaoCitada, (d) => trocarTexto(d, "A Figura 1 e", "A Figura 12 e")),
    ).toHaveLength(1);
  });

  it("a legenda da própria figura não conta como citação no texto", () => {
    expect(
      conferirCom(ilustracaoCitada, (d) => {
        trocarTexto(d, "A Figura 1 e a", "A");
        (d.sections[0].content[1] as NoFigura).legenda = "Figura 1";
      }),
    ).toHaveLength(1);
  });
});

describe("ilustracao-com-fonte (§5.8 e §5.9)", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(ilustracaoComFonte)).toEqual([]);
  });

  it("figura e tabela sem fonte: um erro cada", () => {
    const achados = conferirCom(ilustracaoComFonte, (d) => {
      (d.sections[0].content[1] as NoFigura).fonte = "";
      (d.sections[0].content[2] as NoTabela).fonte = " ";
    });
    expect(achados.map((achado) => [achado.gravidade, achado.item])).toEqual([
      ["erro", "NBR 14724:2024 §5.8"],
      ["erro", "NBR 14724:2024 §5.9"],
    ]);
    expect(achados[0].mensagem).toContain("elaborada pelo próprio autor");
  });
});

describe("ilustracao-com-titulo (§5.8; tabela pelo IBGE §4.2)", () => {
  it("conforme: nenhum achado", () => {
    expect(conferirCom(ilustracaoComTitulo)).toEqual([]);
  });

  it("figura sem título: erro pelo §5.8", () => {
    expect(
      conferirCom(
        ilustracaoComTitulo,
        (d) => ((d.sections[0].content[1] as NoFigura).legenda = ""),
      ),
    ).toEqual([expect.objectContaining({ gravidade: "erro", item: "NBR 14724:2024 §5.8" })]);
  });

  // A 14724 §5.9 remete ao IBGE, e o §4.2 dele: "Toda tabela deve ter título".
  it("tabela sem título: erro pelo IBGE §4.2", () => {
    expect(
      conferirCom(
        ilustracaoComTitulo,
        (d) => ((d.sections[0].content[2] as NoTabela).legenda = ""),
      ),
    ).toEqual([
      expect.objectContaining({
        gravidade: "erro",
        item: "IBGE, Normas de apresentação tabular (1993) §4.2",
      }),
    ]);
  });
});
