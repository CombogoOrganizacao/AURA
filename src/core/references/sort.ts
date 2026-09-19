// Ordenação da lista de referências — passo 4.4.
//
// §9.1 da NBR 6023:2025, como registrado em docs/auditoria-abnt.md: as
// referências são "reunidas ao final, em ordem alfabética dos elementos;
// havendo numerais, ordem crescente".
//
// Duas coisas saem dessa frase, e as duas estão implementadas aqui:
//
// 1. **"dos elementos", no plural.** A ordem não se decide só pelo primeiro
//    elemento: dois trabalhos do mesmo autor se desempatam pelo que vem
//    depois. Por isso o critério primário é o elemento de entrada e o desempate
//    é a referência formatada inteira — que já sai na ordem da norma pelo 4.3.
// 2. **"havendo numerais, ordem crescente"** é o `numeric: true` da colação:
//    sem ele "10" viria antes de "2", porque "1" < "2" caractere a caractere.
//
// **Colação pt-BR, não comparação de código de caractere.** É o caso do
// critério de aceite: `Álvares` tem de vir antes de `Andrade`, e em ASCII "Á"
// (U+00C1) vem depois de todo o alfabeto — a lista sairia com os acentuados
// jogados no fim. Mesma escolha de `document/elements/abreviaturas.ts` e da
// PoC.

import { referenciaEmTexto, temAutoria } from "./format/abnt";
import type { Referencia } from "./types";

// Uma instância só, reaproveitada: criar um `Intl.Collator` por comparação é
// caro, e uma lista de cinquenta referências faz centenas de comparações.
const COLACAO = new Intl.Collator("pt-BR", { numeric: true });

// O elemento pelo qual a referência entra na lista (§8.1.1 e §8.1.4): o
// sobrenome do primeiro autor, o nome da entidade quando a autoria é
// corporativa, ou o título quando não há autoria conhecida.
//
// **Sem caixa alta e sem inversão**, ao contrário do que sai impresso: a caixa
// alta é do texto da referência (§8.1.1) e não muda a ordem, e a colação
// pt-BR já trata maiúscula e minúscula como diferença terciária. Ordenar pelo
// texto formatado funcionaria por acidente; ordenar pelo dado é o que a norma
// descreve.
export function elementoDeEntrada(referencia: Referencia): string {
  if (temAutoria(referencia.author)) {
    // O primeiro nome COM CONTEÚDO, e não `author[0]` cru: uma linha vazia
    // deixada no formulário não pode decidir a posição da referência na lista.
    const primeiro = (referencia.author ?? []).find(
      (nome) => (nome.literal ?? nome.family ?? nome.given ?? "").trim() !== "",
    );
    // §8.1.2: a autoria corporativa não se inverte, então o elemento de
    // entrada dela é o nome inteiro.
    const chave = primeiro?.literal ?? primeiro?.family ?? primeiro?.given ?? "";
    if (chave.trim() !== "") return chave.trim();
  }

  // §8.1.4: sem autoria conhecida, a entrada é pelo título.
  return referencia.title.trim();
}

// Comparador público: o painel (4.5) e a exportação (4.11) ordenam a mesma
// lista do mesmo jeito, e a Fase 5 pode usá-lo para conferir a ordem.
export function compararReferencias(a: Referencia, b: Referencia): number {
  const porEntrada = COLACAO.compare(elementoDeEntrada(a), elementoDeEntrada(b));
  if (porEntrada !== 0) return porEntrada;

  // Mesmo elemento de entrada: desempata pelo resto da referência, que é o
  // "dos elementos" no plural do §9.1. Usa o texto do 4.3 porque ele já põe os
  // elementos na ordem da norma — reimplementar a sequência aqui daria uma
  // segunda ordem para divergir da primeira.
  return COLACAO.compare(referenciaEmTexto(a), referenciaEmTexto(b));
}

// **Devolve uma lista nova.** `Array.prototype.sort` ordena no lugar, e uma
// função de `src/core/` que reordena o array de quem a chamou faz o editor
// piscar por um motivo que ninguém encontra depois.
export function ordenarReferencias(referencias: readonly Referencia[]): Referencia[] {
  return [...referencias].sort(compararReferencias);
}
