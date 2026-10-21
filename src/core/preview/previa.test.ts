import { describe, expect, it } from "vitest";

import { novaFigura, novaTabela, novoDocumento } from "../document/factory";
import type { Documento, NoParagrafo } from "../document/types";
import { montarPrevia, previaSemConteudo } from "./previa";

const paragrafo = (texto: string): NoParagrafo => ({
  type: "paragraph",
  content: [{ type: "text", text: texto }],
});

function documentoDeTeste(): Documento {
  const documento = novoDocumento();
  const figura = { ...novaFigura(), legenda: "Circuito", fonte: "Dados da pesquisa" };
  const tabela = novaTabela(2, 2);
  tabela.legenda = "Resultados";
  tabela.fonte = "Elaborado pelo autor";
  tabela.linhas[0].celulas[0].content = [{ type: "text", text: "Grupo" }];
  documento.sections = [
    { id: "s1", ordem: 0, nivel: 1, titulo: "Introdução", content: [paragrafo("Texto."), figura] },
    { id: "s2", ordem: 1, nivel: 1, titulo: "Método", content: [tabela, paragrafo("Mais.")] },
    { id: "s3", ordem: 2, nivel: 2, titulo: "Amostra", content: [paragrafo("Sub.")] },
  ];
  return documento;
}

describe("montarPrevia", () => {
  it("o corpo traz os títulos numerados e só a seção primária seguinte abre página", () => {
    const { elementos } = montarPrevia(documentoDeTeste());
    expect(elementos.map((e) => e.elemento)).toEqual(["corpo"]);
    const titulos = elementos[0].blocos.flatMap((bloco) =>
      bloco.tipo === "titulo" ? [[bloco.texto, bloco.abrePagina]] : [],
    );
    expect(titulos).toEqual([
      ["1 Introdução", false],
      ["2 Método", true],
      ["2.1 Amostra", false],
    ]);
  });

  it("legenda e fonte saem com a mesma grafia do .docx, e a tabela separa o cabeçalho", () => {
    const blocos = montarPrevia(documentoDeTeste()).elementos[0].blocos;
    expect(blocos.find((b) => b.tipo === "figura")).toMatchObject({
      legenda: "Figura 1 — Circuito",
      fonte: "Fonte: Dados da pesquisa",
      imagem: null,
    });
    const tabela = blocos.find((b) => b.tipo === "tabela");
    expect(tabela).toMatchObject({
      legenda: "Tabela 1 — Resultados",
      fonte: "Fonte: Elaborado pelo autor",
    });
    if (tabela?.tipo !== "tabela") throw new Error("sem tabela");
    expect(tabela.cabecalho).toHaveLength(1);
    expect(tabela.corpo).toHaveLength(1);
    expect(tabela.proporcoes).toHaveLength(2);
    expect(tabela.cabecalho[0][0].trechos[0].texto).toBe("Grupo");
  });

  it("sem referências não há lista; com elas, título e uma entrada por obra", () => {
    const documento = documentoDeTeste();
    expect(montarPrevia(documento).elementos.map((e) => e.elemento)).not.toContain("referencias");

    documento.references = [{ id: "r1", type: "book", title: "Um livro" }];
    const referencias = montarPrevia(documento).elementos.find((e) => e.elemento === "referencias");
    expect(referencias?.parte).toBe("posTextual");
    expect(referencias?.blocos.map((b) => b.tipo)).toEqual(["tituloSemIndicativo", "referencia"]);
  });

  it("apêndices e anexos têm um elemento cada, em caixa alta, depois das referências", () => {
    const documento = documentoDeTeste();
    documento.references = [{ id: "r1", type: "book", title: "Um livro" }];
    documento.apendices = [
      { id: "a1", titulo: "Questionário", content: [paragrafo("Perguntas.")] },
    ];
    documento.anexos = [{ id: "n1", titulo: "Parecer", content: [] }];

    const { elementos } = montarPrevia(documento);
    expect(elementos.map((e) => e.elemento)).toEqual([
      "corpo",
      "referencias",
      "apendices",
      "anexos",
    ]);
    expect(elementos[2].blocos[0]).toMatchObject({
      tipo: "tituloSemIndicativo",
      texto: "APÊNDICE A — QUESTIONÁRIO",
    });
    expect(elementos[3].blocos[0]).toMatchObject({ texto: "ANEXO A — PARECER" });
  });

  it("documento sem seções não gera elemento nenhum", () => {
    expect(montarPrevia(novoDocumento()).elementos).toEqual([]);
  });
});

describe("previaSemConteudo", () => {
  it("é verdade sem seções e com só uma seção em branco; falso com texto ou título", () => {
    const documento = novoDocumento();
    documento.sections = [];
    expect(previaSemConteudo(montarPrevia(documento))).toBe(true);

    documento.sections = [
      { id: "s1", ordem: 0, nivel: 1, titulo: "", content: [{ type: "paragraph" }] },
    ];
    expect(previaSemConteudo(montarPrevia(documento))).toBe(true);

    documento.sections[0].titulo = "Introdução";
    expect(previaSemConteudo(montarPrevia(documento))).toBe(false);

    documento.sections[0].titulo = "";
    documento.sections[0].content = [paragrafo("Algo.")];
    expect(previaSemConteudo(montarPrevia(documento))).toBe(false);
  });
});
