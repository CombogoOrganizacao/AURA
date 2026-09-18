import { letraDeIndice } from "../numbering";
import type { ElementoPosTextual } from "../types";

// Forma comum de apêndice e anexo — passo 3.7.1. A norma trata os dois do
// mesmo jeito (letra maiúscula, travessão, título) e os separa por uma coisa
// só: de quem é o texto. Apêndice é material elaborado pelo próprio autor;
// anexo é material de terceiro. Isso não muda a montagem, muda o rótulo e a
// lista de origem — por isso a máquina fica aqui, num lugar só, e
// `apendices.ts`/`anexos.ts` são os dois pontos de entrada nomeados.
//
// **As duas sequências são independentes por construção, não por regra.**
// Cada chamada recebe UMA lista e conta do zero dentro dela; não existe
// contador compartilhado que possa vazar de uma para a outra. O primeiro
// anexo é "ANEXO A" mesmo que existam cinco apêndices antes dele, porque
// `gerarApendices()` nunca vê a lista de anexos e vice-versa.
//
// **Auditado contra a fonte primária em 18/09/2026** (NBR 14724:2024
// §4.2.3.3 e §4.2.3.4, lidos na íntegra). A norma trata apêndice e anexo com
// a mesma frase, trocando só a palavra: o texto "deve ser precedido da palavra
// APÊNDICE, identificado por letras maiúsculas consecutivas, travessão e pelo
// respectivo título". Confirma os três elementos montados aqui — rótulo, letra
// derivada da posição e travessão.
//
// A norma acrescenta uma regra de tipografia que **não** é deste arquivo: "o
// destaque tipográfico (negrito, itálico ou sublinhado) deve ser o mesmo da
// seção primária". Quem a cumpre é o estilo do exportador — este módulo só
// monta a string, como `textoLegenda()` e `textoItemSumario()`.

// Título do elemento "referências" (NBR 14724:2024 §4.2.3.1). Mora aqui, e
// não no exportador, pelo mesmo motivo de `TITULO_SUMARIO` e
// `TITULO_LISTA_FIGURAS`: é grafia de documento, não detalhe de OOXML, e três
// consumidores precisam dela idêntica — o `.docx`, o sumário (§5.2 da 6027) e
// a tela, quando existir.
export const TITULO_REFERENCIAS = "REFERÊNCIAS";

export interface ItemPosTextual {
  // Mesmo `id` do `ElementoPosTextual` de origem, como em `ItemSumario`: é
  // por ele que a tela liga a entrada ao elemento sem depender da posição.
  id: string;
  // "APÊNDICE" ou "ANEXO" — viaja junto porque o 3.7.2 vai concatenar as
  // duas listas numa sequência só de blocos exportados, e lá a entrada
  // precisa saber dizer o que é sem que quem a recebeu se lembre de onde ela
  // veio.
  rotulo: string;
  // Derivada da posição ("A", "B", ... "AA"), nunca lida de um campo.
  letra: string;
  titulo: string;
}

// Travessão entre a identificação e o título. Tem o mesmo valor de
// `SEPARADOR_LEGENDA` (./legenda.ts) e **de propósito não é o mesmo
// símbolo**: são duas regras diferentes da norma que hoje coincidem, e
// amarrá-las faria uma mudança numa arrastar a outra sem querer.
export const SEPARADOR_POSTEXTUAL = " — ";

// "APÊNDICE A — Questionário aplicado". Um lugar só para montar a string,
// pelo mesmo motivo de `textoItemSumario()` e `textoLegenda()`: a tela, o
// `.docx` e o sumário (3.7.2) precisam dela idêntica.
//
// O travessão só aparece quando há título: elemento ainda sem título sai como
// "APÊNDICE A", não "APÊNDICE A — ", que é o que a pessoa veria enquanto
// digita — mesma decisão de `textoLegenda()`.
export function textoTituloPosTextual(item: Pick<ItemPosTextual, "rotulo" | "letra" | "titulo">) {
  const identificacao = `${item.rotulo} ${item.letra}`;
  return item.titulo ? `${identificacao}${SEPARADOR_POSTEXTUAL}${item.titulo}` : identificacao;
}

// Deriva a lista inteira a cada chamada, como `gerarSumario()` e
// `numerarFiguras()`: não existe letra gravada em lugar nenhum, então não
// existe letra desatualizada.
//
// A letra vem do ÍNDICE, direto — sem `Map` por `id` intermediário como em
// `numerarFiguras()`. Lá o `Map` existe porque quem consome (o node view)
// tem o nó em mãos e precisa perguntar "qual é o meu número?"; aqui a lista
// inteira sai pronta e em ordem, e um `id` repetido num `Map` colapsaria
// duas entradas numa letra só.
export function gerarPosTextuais(
  elementos: readonly ElementoPosTextual[],
  rotulo: string,
): ItemPosTextual[] {
  return elementos.map((elemento, indice) => ({
    id: elemento.id,
    rotulo,
    letra: letraDeIndice(indice),
    titulo: elemento.titulo,
  }));
}
