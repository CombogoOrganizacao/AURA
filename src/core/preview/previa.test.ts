import { describe, expect, it } from "vitest";

import { novaFigura, novaTabela, novoDocumento } from "../document/factory";
import type { Documento, NoParagrafo } from "../document/types";
import { montarPrevia, previaSemConteudo, type BlocoPrevia } from "./previa";

const paragrafo = (texto: string): NoParagrafo => ({
  type: "paragraph",
  content: [{ type: "text", text: texto }],
});

function documentoDeTeste(): Documento {
  const documento = novoDocumento();
  Object.assign(documento.metadados, {
    titulo: "Robótica inclusiva",
    autores: ["Eduarda"],
    instituicao: "UNICAP",
    local: "Recife",
    ano: 2026,
    naturezaTrabalho: "Trabalho de conclusão de curso",
    orientador: "Maria",
  });
  const figura = { ...novaFigura(), id: "f1", legenda: "Circuito", fonte: "Dados da pesquisa" };
  const tabela = novaTabela(2, 2);
  tabela.id = "t1";
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

const elemento = (documento: Documento, nome: string) =>
  montarPrevia(documento).elementos.find((e) => e.elemento === nome);

describe("montarPrevia", () => {
  it("segue a ordem canônica: capa, folha de rosto, sumário, corpo", () => {
    const { elementos } = montarPrevia(documentoDeTeste());
    expect(elementos.map((e) => [e.elemento, e.parte])).toEqual([
      ["capa", "capa"],
      ["folhaDeRosto", "preTextual"],
      ["listaDeFiguras", "preTextual"],
      ["listaDeTabelas", "preTextual"],
      ["sumario", "preTextual"],
      ["corpo", "textual"],
    ]);
  });

  it("o corpo traz os títulos numerados e só a seção primária seguinte abre página", () => {
    const titulos = elemento(documentoDeTeste(), "corpo")!.blocos.flatMap((bloco) =>
      bloco.tipo === "titulo" ? [[bloco.texto, bloco.abrePagina]] : [],
    );
    expect(titulos).toEqual([
      ["1 Introdução", false],
      ["2 Método", true],
      ["2.1 Amostra", false],
    ]);
  });

  it("legenda e fonte saem com a mesma grafia do .docx, e a tabela separa o cabeçalho", () => {
    const blocos = elemento(documentoDeTeste(), "corpo")!.blocos;
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

  it("a tabela mesclada leva o vão na âncora e não repete as células cobertas (8.5.4)", () => {
    const documento = documentoDeTeste();
    const tabela = documento.sections[1].content.find((no) => no.type === "tabela")!;
    if (tabela.type !== "tabela") throw new Error("sem tabela");
    tabela.linhas = [
      {
        celulas: [
          { cabecalho: true, colspan: 2 },
          { cabecalho: true, coberta: true },
        ],
      },
      { celulas: [{ cabecalho: false, rowspan: 2 }, { cabecalho: false }] },
      { celulas: [{ cabecalho: false, coberta: true }, { cabecalho: false }] },
    ];
    const previa = elemento(documento, "corpo")!.blocos.find((b) => b.tipo === "tabela");
    if (previa?.tipo !== "tabela") throw new Error("sem tabela");
    expect(previa.cabecalho[0]).toHaveLength(1);
    expect(previa.cabecalho[0][0]).toMatchObject({ colspan: 2 });
    expect(previa.corpo[0][0]).toMatchObject({ rowspan: 2 });
    expect(previa.corpo[1]).toHaveLength(1);
    expect(previa.proporcoes).toHaveLength(2);
  });

  it("a capa e a folha de rosto levam as linhas da norma, com o espaço da distribuição", () => {
    const documento = documentoDeTeste();
    const capa = elemento(documento, "capa")!.blocos;
    expect(capa.map((b) => (b.tipo === "linha" ? b.linha.papel : b.tipo))).toEqual([
      "instituicao",
      "autor",
      "tituloDoTrabalho",
      "local",
      "ano",
    ]);
    // 3000 twips = 150 pt, mais a linha vazia de 18 pt que o .docx também põe.
    expect(capa[1]).toMatchObject({ tipo: "linha", espacoAntes: 168 });
    expect(capa[0]).toMatchObject({ espacoAntes: 0 });

    const rosto = elemento(documento, "folhaDeRosto")!.blocos;
    expect(rosto.some((b) => b.tipo === "linha" && b.linha.papel === "natureza")).toBe(true);
  });

  it("o sumário lista as seções e, depois delas, os pós-textuais em caixa alta, cada um com o alvo", () => {
    const documento = documentoDeTeste();
    documento.references = [{ id: "r1", type: "book", title: "Um livro" }];
    documento.apendices = [{ id: "a1", titulo: "Questionário", content: [] }];

    const sumario = elemento(documento, "sumario")!.blocos;
    expect(sumario[0]).toEqual({ tipo: "tituloPreTextual", texto: "SUMÁRIO" });
    const entradas = sumario.filter(
      (b): b is Extract<BlocoPrevia, { tipo: "entradaIndice" }> => b.tipo === "entradaIndice",
    );
    expect(entradas.map((e) => [e.nivel, e.texto, e.alvo])).toEqual([
      [1, "1 Introdução", "s1"],
      [1, "2 Método", "s2"],
      [2, "2.1 Amostra", "s3"],
      [1, "REFERÊNCIAS", "sumario:referencias"],
      [1, "APÊNDICE A — QUESTIONÁRIO", "a1"],
    ]);
  });

  it("as listas apontam para a figura e a tabela, e só existem quando há o que listar", () => {
    const documento = documentoDeTeste();
    expect(elemento(documento, "listaDeFiguras")!.blocos).toEqual([
      { tipo: "tituloPreTextual", texto: "LISTA DE FIGURAS" },
      { tipo: "entradaIndice", nivel: 0, texto: "Figura 1 — Circuito", alvo: "f1" },
    ]);
    expect(elemento(documento, "listaDeTabelas")!.blocos[1]).toMatchObject({ alvo: "t1" });

    documento.sections = [documento.sections[0]];
    documento.sections[0].content = [paragrafo("Só texto.")];
    expect(elemento(documento, "listaDeFiguras")).toBeUndefined();
    expect(elemento(documento, "listaDeTabelas")).toBeUndefined();
  });

  it("resumo e abstract só saem com texto, com as palavras-chave no rótulo da língua", () => {
    const documento = documentoDeTeste();
    expect(elemento(documento, "resumo")).toBeUndefined();

    documento.metadados.resumo = "Um resumo.";
    documento.metadados.palavrasChave = ["robôs", "inclusão"];
    documento.metadados.abstract = "An abstract.";
    documento.metadados.keywords = ["robots"];
    expect(elemento(documento, "resumo")!.blocos).toEqual([
      { tipo: "tituloPreTextual", texto: "RESUMO" },
      { tipo: "resumo", texto: "Um resumo." },
      { tipo: "termos", rotulo: "Palavras-chave", termos: ["robôs", "inclusão"] },
    ]);
    expect(elemento(documento, "abstract")!.blocos[2]).toMatchObject({ rotulo: "Keywords" });
  });

  it("dedicatória e epígrafe vão no pé da página; desligadas, não entram", () => {
    const documento = documentoDeTeste();
    expect(elemento(documento, "dedicatoria")).toBeUndefined();

    documento.metadados.dedicatoria = { ativo: true, texto: "Aos meus pais." };
    expect(elemento(documento, "dedicatoria")!.blocos).toMatchObject([{ tipo: "noPe" }]);
  });

  it("sem referências não há lista; com elas, título e uma entrada por obra", () => {
    const documento = documentoDeTeste();
    expect(elemento(documento, "referencias")).toBeUndefined();

    documento.references = [{ id: "r1", type: "book", title: "Um livro" }];
    const referencias = elemento(documento, "referencias");
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

    const nomes = montarPrevia(documento).elementos.map((e) => e.elemento);
    expect(nomes.slice(-4)).toEqual(["corpo", "referencias", "apendices", "anexos"]);
    expect(elemento(documento, "apendices")!.blocos[0]).toMatchObject({
      tipo: "tituloSemIndicativo",
      texto: "APÊNDICE A — QUESTIONÁRIO",
    });
    expect(elemento(documento, "anexos")!.blocos[0]).toMatchObject({ texto: "ANEXO A — PARECER" });
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
