// Palavras repetidas — passo 5.4.1, portado de `detectRepeatedWords()` em
// `legacy/js/engine/languageAndStats.js`.
//
// **O que mudou do legado, e por quê.** O legado contava a frequência no
// texto inteiro e acusava toda palavra que aparecesse duas vezes. Num TCC,
// isso é quase toda palavra de conteúdo, e a lista não aponta nada. Aqui a
// repetição é contada **dentro do mesmo parágrafo**: é onde o leitor sente a
// palavra voltar, e o parágrafo é uma unidade que o aluno reconhece, sem um
// tamanho de janela inventado.
//
// Também saíram os sinônimos (`getSynonymsForWord`). Sugerir a palavra que
// entra no lugar é escrever pelo aluno (CLAUDE.md, "Identidade e limite de
// produto"). A detecção aponta; a troca é do aluno.
//
// Cada ocorrência vem com a posição no parágrafo, para a interface poder
// realçá-la sem procurar de novo.

// Palavras funcionais do português, que se repetem por necessidade. A lista
// do legado, só a parte em português (a v1 é só pt-BR), com as que faltavam
// e aparecem em todo texto acadêmico: "sobre", "pode", "ainda", "assim"...
// Palavras com menos de quatro letras já ficam de fora pelo tamanho, então a
// lista só precisa das mais longas.
const PALAVRAS_FUNCIONAIS = new Set([
  "para",
  "quando",
  "muito",
  "muitos",
  "muita",
  "muitas",
  "também",
  "pelo",
  "pela",
  "pelos",
  "pelas",
  "isso",
  "isto",
  "aquilo",
  "entre",
  "depois",
  "antes",
  "mesmo",
  "mesma",
  "mesmos",
  "mesmas",
  "como",
  "mais",
  "menos",
  "seus",
  "suas",
  "quem",
  "qual",
  "quais",
  "esse",
  "essa",
  "esses",
  "essas",
  "este",
  "esta",
  "estes",
  "estas",
  "aquele",
  "aquela",
  "aqueles",
  "aquelas",
  "eles",
  "elas",
  "dele",
  "dela",
  "deles",
  "delas",
  "está",
  "estão",
  "estava",
  "foram",
  "sido",
  "seja",
  "sejam",
  "será",
  "serão",
  "fosse",
  "havia",
  "tinha",
  "tenho",
  "numa",
  "minha",
  "minhas",
  "meus",
  "nosso",
  "nossa",
  "nossos",
  "nossas",
  "você",
  "vocês",
  "lhes",
  "sobre",
  "pode",
  "podem",
  "cada",
  "outro",
  "outra",
  "outros",
  "outras",
  "ainda",
  "assim",
  "onde",
  "porque",
  "pois",
  "tanto",
  "todo",
  "toda",
  "todos",
  "todas",
  "desta",
  "deste",
  "dessa",
  "desse",
  "nesta",
  "neste",
  "nessa",
  "nesse",
]);

const TAMANHO_MINIMO = 4;

// Uma palavra: letras (com acento, inclusive decomposto) e algarismos, com
// hífen ou apóstrofo só entre eles ("sócio-econômico", "d'água").
const PALAVRA = /[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*/gu;

export interface Ocorrencia {
  // Posição no parágrafo, em unidades de `String` (as mesmas de `slice`).
  inicio: number;
  fim: number;
}

export interface Repeticao {
  // A palavra normalizada (minúscula, NFC).
  palavra: string;
  // Índice do parágrafo na lista recebida.
  paragrafo: number;
  ocorrencias: Ocorrencia[];
}

function normalizar(palavra: string): string {
  return palavra.normalize("NFC").toLocaleLowerCase("pt-BR");
}

function contaComoPalavra(normalizada: string): boolean {
  return (
    Array.from(normalizada).length >= TAMANHO_MINIMO &&
    !PALAVRAS_FUNCIONAIS.has(normalizada) &&
    // Número não é repetição de estilo: um ano ou uma medida volta porque
    // o dado é o mesmo.
    !/^[\p{N}.,-]+$/u.test(normalizada)
  );
}

// As palavras que aparecem `minimo` vezes ou mais num mesmo parágrafo, na
// ordem dos parágrafos; dentro de um parágrafo, a mais repetida primeiro e,
// no empate, a que aparece antes.
export function palavrasRepetidas(paragrafos: readonly string[], minimo = 2): Repeticao[] {
  const saida: Repeticao[] = [];

  paragrafos.forEach((texto, paragrafo) => {
    const porPalavra = new Map<string, Ocorrencia[]>();
    for (const encontrada of texto.matchAll(PALAVRA)) {
      const palavra = normalizar(encontrada[0]);
      if (!contaComoPalavra(palavra)) continue;
      const inicio = encontrada.index;
      const lista = porPalavra.get(palavra) ?? [];
      lista.push({ inicio, fim: inicio + encontrada[0].length });
      porPalavra.set(palavra, lista);
    }

    const doParagrafo = [...porPalavra]
      .filter(([, ocorrencias]) => ocorrencias.length >= minimo)
      .map(([palavra, ocorrencias]) => ({ palavra, paragrafo, ocorrencias }))
      .sort(
        (a, b) =>
          b.ocorrencias.length - a.ocorrencias.length ||
          a.ocorrencias[0].inicio - b.ocorrencias[0].inicio,
      );
    saida.push(...doParagrafo);
  });

  return saida;
}
