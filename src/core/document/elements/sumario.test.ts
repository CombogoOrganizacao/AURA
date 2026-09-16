import { describe, expect, it } from "vitest";

import type { NivelSecao, Secao } from "../types";

import { TITULO_SUMARIO, gerarSumario, textoItemSumario } from "./sumario";

function secao(id: string, ordem: number, nivel: NivelSecao, titulo: string): Secao {
  return { id, ordem, nivel, titulo, content: [] };
}

// Árvore de três níveis usada na maioria dos casos abaixo:
//   1     Introdução
//   1.1     Contexto
//   1.1.1     Recorte
//   2     Metodologia
//   2.1     Coleta
function arvoreDeTresNiveis(): Secao[] {
  return [
    secao("s1", 0, 1, "Introdução"),
    secao("s2", 1, 2, "Contexto"),
    secao("s3", 2, 3, "Recorte"),
    secao("s4", 3, 1, "Metodologia"),
    secao("s5", 4, 2, "Coleta"),
  ];
}

describe("gerarSumario — sumário derivado da árvore de seções (passo 3.6.1)", () => {
  it("devolve uma entrada por seção, com nível e indicativo derivados", () => {
    expect(gerarSumario(arvoreDeTresNiveis())).toEqual([
      { id: "s1", numero: "1", titulo: "Introdução", nivel: 1 },
      { id: "s2", numero: "1.1", titulo: "Contexto", nivel: 2 },
      { id: "s3", numero: "1.1.1", titulo: "Recorte", nivel: 3 },
      { id: "s4", numero: "2", titulo: "Metodologia", nivel: 1 },
      { id: "s5", numero: "2.1", titulo: "Coleta", nivel: 2 },
    ]);
  });

  it("segue `ordem`, não a posição no array", () => {
    const foraDeOrdem = arvoreDeTresNiveis().reverse();

    expect(gerarSumario(foraDeOrdem).map((item) => item.numero)).toEqual([
      "1",
      "1.1",
      "1.1.1",
      "2",
      "2.1",
    ]);
  });

  // O ponto do passo: não existe sumário guardado para ficar desatualizado.
  // Inserir uma seção no meio renumera as seguintes sem ninguém sincronizar
  // nada — o sumário é recalculado da árvore a cada chamada.
  it("renumera sozinho quando entra uma seção no meio", () => {
    const comNovaSecao = [
      secao("s1", 0, 1, "Introdução"),
      secao("nova", 1, 1, "Justificativa"),
      secao("s4", 2, 1, "Metodologia"),
    ];

    expect(gerarSumario(comNovaSecao).map((item) => `${item.numero} ${item.titulo}`)).toEqual([
      "1 Introdução",
      "2 Justificativa",
      "3 Metodologia",
    ]);
  });

  it("renumera sozinho quando uma seção muda de nível", () => {
    const rebaixada = [
      secao("s1", 0, 1, "Introdução"),
      secao("s2", 1, 2, "Contexto"), // era nível 1
      secao("s3", 2, 1, "Metodologia"),
    ];

    expect(gerarSumario(rebaixada).map((item) => item.numero)).toEqual(["1", "1.1", "2"]);
  });

  // CLAUDE.md, "Formato e dados": a numeração é derivada da ordem e do nível,
  // nunca escrita dentro do título. Se alguém digitasse "2 Metodologia" no
  // campo de título, o sumário sairia com "2 2 Metodologia" — o teste existe
  // para que o título gravado continue sendo só o texto.
  it("não escreve numeração dentro do título, e não a lê de lá", () => {
    const itens = gerarSumario([secao("s1", 0, 1, "Introdução")]);

    expect(itens[0].titulo).toBe("Introdução");
    expect(itens[0].numero).toBe("1");
  });

  it("mantém na contagem a seção ainda sem título", () => {
    const comSecaoVazia = [
      secao("s1", 0, 1, "Introdução"),
      secao("s2", 1, 1, ""), // seção recém-criada, título em branco
      secao("s3", 2, 1, "Metodologia"),
    ];

    // A seção sem título ocupa o indicativo 2 do mesmo jeito: ela existe no
    // corpo, e sumir do sumário faria "Metodologia" aparecer como 2 aqui e
    // como 3 no texto.
    expect(gerarSumario(comSecaoVazia)).toEqual([
      { id: "s1", numero: "1", titulo: "Introdução", nivel: 1 },
      { id: "s2", numero: "2", titulo: "", nivel: 1 },
      { id: "s3", numero: "3", titulo: "Metodologia", nivel: 1 },
    ]);
  });

  it("documento sem seção nenhuma devolve sumário vazio, não erro", () => {
    expect(gerarSumario([])).toEqual([]);
  });

  // O `id` é o que liga a entrada ao título no corpo — a tela rola até a
  // seção por ele, não pela posição na lista.
  it("preserva o id da seção de origem em cada entrada", () => {
    const ids = gerarSumario(arvoreDeTresNiveis()).map((item) => item.id);

    expect(ids).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });

  it("não modifica o array recebido", () => {
    const sections = arvoreDeTresNiveis().reverse();
    const antes = sections.map((secaoAtual) => secaoAtual.id);

    gerarSumario(sections);

    expect(sections.map((secaoAtual) => secaoAtual.id)).toEqual(antes);
  });
});

describe("textoItemSumario — indicativo e título na mesma grafia do corpo", () => {
  // NBR 6024: indicativo separado do título por um espaço.
  it("junta indicativo e título por um espaço", () => {
    expect(textoItemSumario({ id: "s1", numero: "3.1.2", titulo: "Coleta", nivel: 3 })).toBe(
      "3.1.2 Coleta",
    );
  });

  // Forma das entradas pós-textuais (referências, apêndices, anexos — passo
  // 3.7.2), que entram no sumário sem indicativo numérico.
  it("sai só com o título quando não há indicativo", () => {
    expect(textoItemSumario({ id: "ref", numero: null, titulo: "REFERÊNCIAS", nivel: 1 })).toBe(
      "REFERÊNCIAS",
    );
  });

  it("o título do próprio sumário é uma constante compartilhada", () => {
    expect(TITULO_SUMARIO).toBe("SUMÁRIO");
  });
});
