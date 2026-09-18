import { describe, expect, it } from "vitest";

import type { NivelSecao, Secao } from "../types";

import { gerarAnexos } from "./anexos";
import { gerarApendices } from "./apendices";
import { TITULO_REFERENCIAS, textoTituloPosTextual } from "./posTextual";
import {
  ID_SUMARIO_REFERENCIAS,
  TITULO_SUMARIO,
  type ItemSumario,
  gerarSumario,
  gerarSumarioCompleto,
  textoItemSumario,
} from "./sumario";

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
  // NBR 6024: indicativo separado do título por um espaço. Uma entrada de
  // sumário inteira continua servindo de argumento — a assinatura só pede
  // `numero`/`titulo` (passo 3.6.2) para que o título do corpo no `.docx`
  // possa chamar a mesma função sem fabricar um `ItemSumario`.
  it("junta indicativo e título por um espaço", () => {
    const item: ItemSumario = { id: "s1", numero: "3.1.2", titulo: "Coleta", nivel: 3 };

    expect(textoItemSumario(item)).toBe("3.1.2 Coleta");
    expect(textoItemSumario({ numero: "3.1.2", titulo: "Coleta" })).toBe("3.1.2 Coleta");
  });

  // Forma das entradas pós-textuais (referências, apêndices, anexos — passo
  // 3.7.2), que entram no sumário sem indicativo numérico.
  it("sai só com o título quando não há indicativo", () => {
    expect(textoItemSumario({ numero: null, titulo: "REFERÊNCIAS" })).toBe("REFERÊNCIAS");
  });

  it("o título do próprio sumário é uma constante compartilhada", () => {
    expect(TITULO_SUMARIO).toBe("SUMÁRIO");
  });
});

// NBR 6027:2012 §5.2 — "recomenda-se que sejam alinhados pela margem do título
// do indicativo mais extenso, **inclusive os elementos pós-textuais**", e o
// EXEMPLO da norma lista REFERÊNCIAS, APÊNDICE A e ANEXO A dentro do sumário.
// O 3.6.1 registrou a lacuna e a leitura da fonte primária (18/09/2026) a
// fechou — docs/auditoria-abnt.md, achado 1.
describe("gerarSumarioCompleto — pós-textuais no sumário (NBR 6027 §5.2)", () => {
  const VAZIO = { temReferencias: false, apendices: [], anexos: [] } as const;

  const doisApendices = () =>
    gerarApendices([
      { id: "ap1", titulo: "Questionário aplicado", content: [] },
      { id: "ap2", titulo: "Roteiro de entrevista", content: [] },
    ]);

  const umAnexo = () => gerarAnexos([{ id: "an1", titulo: "Parecer do comitê", content: [] }]);

  it("acrescenta referências, apêndices e anexos DEPOIS das seções, nessa ordem", () => {
    const itens = gerarSumarioCompleto(arvoreDeTresNiveis(), {
      temReferencias: true,
      apendices: doisApendices(),
      anexos: umAnexo(),
    });

    expect(itens.map((item) => item.titulo)).toEqual([
      "Introdução",
      "Contexto",
      "Recorte",
      "Metodologia",
      "Coleta",
      "REFERÊNCIAS",
      "APÊNDICE A — Questionário aplicado",
      "APÊNDICE B — Roteiro de entrevista",
      "ANEXO A — Parecer do comitê",
    ]);
  });

  // São títulos sem indicativo numérico (NBR 14724:2024 §5.2.3) que a 6027
  // alinha ao lado das seções primárias — nível 1, `numero` nulo.
  it("entram sem indicativo numérico e no primeiro nível", () => {
    const itens = gerarSumarioCompleto([], {
      temReferencias: true,
      apendices: doisApendices(),
      anexos: umAnexo(),
    });

    expect(itens.every((item) => item.numero === null)).toBe(true);
    expect(itens.every((item) => item.nivel === 1)).toBe(true);
  });

  // Mesma regra de `blocosDeReferencias()`: o exportador não fabrica um
  // elemento vazio só para ter aparência de conformidade.
  it("não fabrica entrada para elemento que não existe", () => {
    expect(gerarSumarioCompleto(arvoreDeTresNiveis(), VAZIO)).toEqual(
      gerarSumario(arvoreDeTresNiveis()),
    );
  });

  it("um documento sem nada devolve lista vazia, não uma linha de REFERÊNCIAS solta", () => {
    expect(gerarSumarioCompleto([], VAZIO)).toEqual([]);
  });

  // A 6027 §3.4 define sumário como enumeração "na mesma ordem e GRAFIA em que
  // a matéria nele se sucede": a entrada tem de sair da mesma função que monta
  // o título no corpo, não de uma segunda concatenação.
  it("a grafia vem de textoTituloPosTextual, a mesma do título no corpo", () => {
    const apendices = doisApendices();
    const itens = gerarSumarioCompleto([], { temReferencias: false, apendices, anexos: [] });

    expect(itens.map((item) => item.titulo)).toEqual(
      apendices.map((item) => textoTituloPosTextual(item)),
    );
  });

  // `id` é por onde a tela liga a linha ao elemento. O das seções vem de
  // `crypto.randomUUID()`; os pós-textuais trazem o próprio, e as referências
  // usam uma constante — que não pode colidir com um UUID.
  it("cada entrada carrega o id do elemento de origem", () => {
    const itens = gerarSumarioCompleto([], {
      temReferencias: true,
      apendices: doisApendices(),
      anexos: umAnexo(),
    });

    expect(itens.map((item) => item.id)).toEqual([ID_SUMARIO_REFERENCIAS, "ap1", "ap2", "an1"]);
  });

  // O que mantém os pré-textuais fora (§6.3) é a assinatura: não há `Metadados`
  // aqui, e `PosTextuaisDoSumario` só aceita os três elementos que entram.
  it("o título do próprio sumário não entra no sumário", () => {
    const itens = gerarSumarioCompleto(arvoreDeTresNiveis(), {
      temReferencias: true,
      apendices: [],
      anexos: [],
    });

    expect(itens.map((item) => item.titulo)).not.toContain(TITULO_SUMARIO);
    expect(itens.map((item) => item.titulo)).toContain(TITULO_REFERENCIAS);
  });
});
