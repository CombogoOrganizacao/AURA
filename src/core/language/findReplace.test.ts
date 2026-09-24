import { describe, expect, it } from "vitest";

import { novaFigura, novaFormula, novaTabela, novoDocumento } from "../document/factory";
import type { Documento, Marca, NoConteudo, NoParagrafo, NoTexto, Secao } from "../document/types";
import {
  acharNoTexto,
  buscarNoDocumento,
  substituirOcorrencia,
  substituirTodas,
} from "./findReplace";

// Passo 5.4.2 — "a substituição global troca todas as ocorrências, incluindo
// seções ainda não visitadas". A busca é sobre o documento canônico, então
// "não visitada" é qualquer seção: nenhuma depende de ter passado pela tela.

function paragrafo(...trechos: (string | NoTexto)[]): NoParagrafo {
  return {
    type: "paragraph",
    content: trechos.map((t) => (typeof t === "string" ? { type: "text", text: t } : t)),
  };
}

function secao(id: string, ordem: number, titulo: string, content: NoConteudo[]): Secao {
  return { id, ordem, nivel: 1, titulo, content };
}

// Texto de todo o documento, para conferir o que sobrou.
function todoTexto(documento: Documento): string {
  return JSON.stringify([documento.sections, documento.apendices, documento.anexos]);
}

describe("acharNoTexto", () => {
  it("sem diferenciar maiúsculas por padrão; com `matchCase`, só a forma exata", () => {
    const texto = "Método e método e MÉTODO";

    expect(acharNoTexto(texto, "método")).toHaveLength(3);
    expect(acharNoTexto(texto, "método", { matchCase: true })).toEqual([{ inicio: 9, fim: 15 }]);
  });

  it("palavra inteira reconhece letra acentuada, onde o `\\b` do legado falhava", () => {
    const texto = "A ação e a reação; a ação-reação.";

    expect(acharNoTexto(texto, "ação")).toHaveLength(4);
    // "reação" fica de fora; o hífen separa palavras, como no Word.
    expect(acharNoTexto(texto, "ação", { wholeWord: true }).map((f) => f.inicio)).toEqual([2, 21]);
  });

  it("caracteres especiais do termo são literais", () => {
    expect(acharNoTexto("custa R$ 5 (cinco).", "R$ 5 (")).toEqual([{ inicio: 6, fim: 12 }]);
    expect(acharNoTexto("a.b axb", "a.b")).toHaveLength(1);
  });

  it("termo digitado com acento decomposto acha o texto gravado em NFC", () => {
    expect(acharNoTexto("análise", "análise".normalize("NFD"))).toHaveLength(1);
  });

  it("termo vazio não acha nada", () => {
    expect(acharNoTexto("qualquer texto", "")).toEqual([]);
  });
});

describe("substituirTodas", () => {
  function documentoGrande(): Documento {
    const doc = novoDocumento();
    const tabela = novaTabela(2, 2);
    tabela.legenda = "Dados do questionario";
    tabela.fonte = "Questionario aplicado";
    tabela.linhas[1].celulas[0].content = [{ type: "text", text: "questionario 1" }];
    const figura = { ...novaFigura(), legenda: "Capa do questionario", fonte: "Autoria própria" };

    doc.sections = [
      secao("s1", 0, "Introdução", [paragrafo("O questionario foi aplicado.")]),
      secao("s2", 1, "Método do questionario", [
        paragrafo("Primeiro questionario, segundo Questionario."),
        tabela,
        novaFormula("questionario = x"),
      ]),
      // Uma terceira seção, longe de qualquer cursor.
      secao("s3", 2, "Resultados", [
        figura,
        {
          type: "citacao_longa",
          refId: null,
          pagina: "",
          content: [{ type: "text", text: "Um questionario citado." }],
        },
      ]),
    ];
    doc.apendices = [{ id: "a1", titulo: "Questionario", content: [paragrafo("questionario")] }];
    doc.anexos = [{ id: "x1", titulo: "Anexo", content: [paragrafo("O questionario original.")] }];
    return doc;
  }

  it("troca todas as ocorrências em todas as seções, apêndices e anexos", () => {
    const original = documentoGrande();
    const antes = buscarNoDocumento(original, "questionario").length;

    const { documento, substituidas } = substituirTodas(original, "questionario", "questionário");

    // 12 fora da fórmula: títulos, parágrafos, célula, legendas, fonte,
    // citação longa, apêndice e anexo.
    expect(antes).toBe(12);
    expect(substituidas).toBe(12);
    expect(buscarNoDocumento(documento, "questionario")).toEqual([]);
    expect(buscarNoDocumento(documento, "questionário")).toHaveLength(12);

    // Uma de cada lugar, conferida no dado.
    expect(documento.sections[1].titulo).toBe("Método do questionário");
    expect(documento.sections[2].content[0]).toMatchObject({ legenda: "Capa do questionário" });
    expect(documento.apendices[0].titulo).toBe("questionário");
    expect(todoTexto(documento)).toContain("O questionário original.");
  });

  it("fórmula não é tocada: é LaTeX", () => {
    const { documento } = substituirTodas(documentoGrande(), "questionario", "questionário");

    expect(documento.sections[1].content[2]).toEqual(novaFormula("questionario = x"));
  });

  it("não muda o documento recebido", () => {
    const original = documentoGrande();
    const copia = structuredClone(original);

    substituirTodas(original, "questionario", "questionário");

    expect(original).toEqual(copia);
  });

  it("sem ocorrência, devolve o mesmo documento e zero", () => {
    const original = documentoGrande();

    expect(substituirTodas(original, "inexistente", "x")).toEqual({
      documento: original,
      substituidas: 0,
    });
  });

  it("o substituto é literal: `$&` e `$1` não são comandos", () => {
    const doc = novoDocumento();
    doc.sections = [secao("s1", 0, "", [paragrafo("preço: X")])];

    const { documento } = substituirTodas(doc, "X", "R$& $1");

    expect(documento.sections[0].content[0]).toEqual(paragrafo("preço: R$& $1"));
  });

  it("um substituto que contém o termo não é procurado de novo", () => {
    const doc = novoDocumento();
    doc.sections = [secao("s1", 0, "", [paragrafo("a a a")])];

    const { documento, substituidas } = substituirTodas(doc, "a", "aa");

    expect(substituidas).toBe(3);
    expect(documento.sections[0].content[0]).toEqual(paragrafo("aa aa aa"));
  });

  it("respeita `matchCase` e `wholeWord`", () => {
    const doc = novoDocumento();
    doc.sections = [secao("s1", 0, "", [paragrafo("Ação, ação e reação.")])];

    const soMinuscula = substituirTodas(doc, "ação", "X", { matchCase: true, wholeWord: true });

    expect(soMinuscula.substituidas).toBe(1);
    expect(soMinuscula.documento.sections[0].content[0]).toEqual(paragrafo("Ação, X e reação."));
  });

  it("substituir por nada apaga; um parágrafo esvaziado fica sem `content`", () => {
    const doc = novoDocumento();
    doc.sections = [secao("s1", 0, "", [paragrafo("rascunho"), paragrafo("rascunho fica")])];

    const { documento } = substituirTodas(doc, "rascunho", "");

    expect(documento.sections[0].content).toEqual([{ type: "paragraph" }, paragrafo(" fica")]);
  });
});

describe("substituição preserva a formatação", () => {
  const negrito = { type: "negrito" } as const;
  const citacao: Marca = {
    type: "citacao",
    attrs: { refId: "r1", modo: "indireta", pagina: null },
  } as Marca;

  function documentoCom(...trechos: NoTexto[]): Documento {
    const doc = novoDocumento();
    doc.sections = [secao("s1", 0, "", [{ type: "paragraph", content: trechos }])];
    return doc;
  }

  it("palavra em negrito continua em negrito, e o resto do trecho fica como estava", () => {
    const doc = documentoCom(
      { type: "text", text: "Um " },
      { type: "text", text: "conceito central", marks: [negrito] },
      { type: "text", text: " aqui." },
    );

    const { documento } = substituirTodas(doc, "conceito", "termo");

    expect(documento.sections[0].content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Um " },
        { type: "text", text: "termo central", marks: [negrito] },
        { type: "text", text: " aqui." },
      ],
    });
  });

  it("ocorrência que atravessa dois trechos leva as marcas do primeiro caractere", () => {
    // "palavra", com "pal" em negrito.
    const doc = documentoCom(
      { type: "text", text: "pal", marks: [negrito] },
      { type: "text", text: "avra final" },
    );

    const { documento } = substituirTodas(doc, "palavra", "termo");

    expect(documento.sections[0].content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "termo", marks: [negrito] },
        { type: "text", text: " final" },
      ],
    });
  });

  it("trecho com marca de citação mantém a citação", () => {
    const doc = documentoCom(
      { type: "text", text: "Segundo o autor, " },
      { type: "text", text: "o mundo se globaliza", marks: [citacao] },
    );

    const { documento } = substituirTodas(doc, "mundo", "planeta");

    expect(documento.sections[0].content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Segundo o autor, " },
        { type: "text", text: "o planeta se globaliza", marks: [citacao] },
      ],
    });
  });
});

describe("buscarNoDocumento e substituirOcorrencia", () => {
  function documento(): Documento {
    const doc = novoDocumento();
    // Fora de ordem no array: a ordem de leitura é por `ordem`.
    doc.sections = [
      secao("s2", 1, "", [paragrafo("termo no fim")]),
      secao("s1", 0, "termo", [paragrafo("um termo e outro termo")]),
    ];
    return doc;
  }

  it("devolve as ocorrências na ordem de leitura, com seção, campo e posição", () => {
    expect(buscarNoDocumento(documento(), "termo")).toEqual([
      { onde: { tipo: "secao", id: "s1" }, campo: { tipo: "titulo" }, inicio: 0, fim: 5 },
      { onde: { tipo: "secao", id: "s1" }, campo: { tipo: "no", no: 0 }, inicio: 3, fim: 8 },
      { onde: { tipo: "secao", id: "s1" }, campo: { tipo: "no", no: 0 }, inicio: 17, fim: 22 },
      { onde: { tipo: "secao", id: "s2" }, campo: { tipo: "no", no: 0 }, inicio: 0, fim: 5 },
    ]);
  });

  it("substituirOcorrencia troca só a ocorrência dada", () => {
    const doc = documento();
    const segundaDoParagrafo = buscarNoDocumento(doc, "termo")[2];

    const trocado = substituirOcorrencia(doc, segundaDoParagrafo, "conceito");

    expect(trocado.sections[1].titulo).toBe("termo");
    expect(trocado.sections[1].content[0]).toEqual(paragrafo("um termo e outro conceito"));
    expect(trocado.sections[0].content[0]).toEqual(paragrafo("termo no fim"));
  });
});
