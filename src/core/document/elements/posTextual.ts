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
// **A NBR 14724 não passou pela auditoria do passo 3.1.1 nesta parte.** O que
// a auditoria cobriu foi a presença dos elementos pós-textuais
// (`elements.postTextual`, docs/auditoria-abnt.md), não a regra da letra.
// As regras usadas aqui — letra maiúscula consecutiva, travessão entre a
// letra e o título, título em caixa alta — são as incontroversas repetidas
// por toda fonte secundária, e por isso **nenhum item desta norma é citado
// por número de seção aqui**, mesmo tratamento dado à NBR 6027 em `sumario.ts`
// e às ilustrações em `legenda.ts`. O alfabeto de 23 vs. 26 letras está
// registrado como pendência em docs/auditoria-abnt.md. Auditar antes de a
// Fase 5 transformar qualquer coisa daqui em regra de conformidade.

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
