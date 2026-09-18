import { numerarSecoes } from "../numbering";
import type { NivelSecao, Secao } from "../types";

import {
  TITULO_REFERENCIAS,
  textoTituloPosTextual,
  type ItemPosTextual,
} from "./posTextual";

// Sumário (NBR 6027:2012, lida na íntegra em 18/09/2026) — passo 3.6.1.
// Derivado da árvore de seções a cada
// chamada, como capa e folha de rosto são derivadas de `Metadados` (3.5.1):
// não existe sumário gravado em lugar nenhum, então não existe sumário
// desatualizado. Inserir, remover, reordenar ou mudar o nível de uma seção
// aparece aqui sozinho, sem nada para sincronizar à mão.
//
// **Recebe `Secao[]`, não `Documento`, e isso é a regra virando assinatura.**
// A NBR 6027 §6.3 é literal: "os elementos pré-textuais não podem constar no
// sumário" — resumo, dedicatória, agradecimentos e epígrafe não entram. Como esses elementos são
// campos de `Metadados` e `Metadados` não chega aqui, eles não têm por onde
// entrar nem por engano. A garantia é o tipo, não um teste que alguém pode
// apagar depois (é o mesmo raciocínio de docs/schema-tiptap.md §1: mantê-los
// fora do documento editável é o que os mantém fora do sumário "sem regra
// especial").
//
// **Sem número de página**, que a NBR 6027 §5.4 pede ("à margem direita") e
// este módulo não tem como saber: paginação não existe em `src/core/` — a folha A4 da tela não quebra
// em página 2 (é o que `AvisoPaginacao.tsx` avisa), e onde cada título cai
// depende da renderização real. No `.docx` quem preenche é o campo `TOC` do
// Word (passo 3.6.2); na tela, o sumário serve para navegar, não para imitar
// a página impressa.
//
// Confirma a ressalva de custo de docs/aura-decisoes-e-pendencias.md §127: o
// sumário automático do TipTap é extensão Pro (paga) e não foi preciso — este
// arquivo não importa nada do TipTap nem do navegador, só a árvore de seções
// que o formato canônico já tem.
//
// **Auditado contra a fonte primária em 18/09/2026.** As três regras usadas
// aqui têm item: pré-textual fora do sumário (§6.3), sumário como último
// pré-textual (§4.1-a) e mesma ordem e grafia do corpo (§3.4, na definição do
// próprio termo "sumário"). Ver docs/auditoria-abnt.md.
//
// **E uma quarta, que esta leitura mostrou faltando**: o §5.2 manda alinhar os
// títulos "inclusive os elementos pós-textuais", e o EXEMPLO da norma lista
// `REFERÊNCIAS`, `APÊNDICE A` e `ANEXO A` dentro do sumário. `gerarSumario()`
// recebe só `Secao[]` e não os enxerga — é a lacuna que o passo 3.6.1 já
// previa ("pós-textuais ficam para 3.7.2") e que o 3.7.2 não fechou. A
// correção está em `gerarSumarioCompleto()`, mais abaixo.

export interface ItemSumario {
  // Mesmo `id` da `Secao` de origem: é por ele que a tela liga a entrada ao
  // título no corpo (rolar até, destacar) sem depender da posição na lista.
  id: string;
  // Indicativo numérico derivado ("1", "2.1", "3.1.2"), ou `null` para
  // entrada sem numeração progressiva. Nenhuma seção produz `null` hoje —
  // o campo existe porque referências, apêndices e anexos entram no sumário
  // pela norma **sem** indicativo, e isso é o passo 3.7.2. Já estar no tipo
  // é o que faz acrescentá-los depois não mexer no `ItemSumario`.
  numero: string | null;
  titulo: string;
  nivel: NivelSecao;
}

// O título do próprio sumário, num lugar só: a tela e o exportador (3.6.2)
// precisam da mesma string, e duas cópias divergem na primeira vez que
// alguém mexer numa delas.
export const TITULO_SUMARIO = "SUMÁRIO";

// Indicativo separado do título por um espaço — NBR 6024. Um espaço, não
// ponto nem travessão: o ponto do "3.1.2" separa os níveis entre si, não o
// número do texto. Existe aqui, e não em quem exibe, para o corpo do `.docx`
// e a entrada do sumário saírem com a MESMA grafia — a 6027 pede que o
// sumário reproduza os títulos como aparecem no texto, e a única forma de
// garantir isso é os dois chamarem a mesma função.
//
// `Pick` em vez de `ItemSumario` inteiro (passo 3.6.2): quem monta o título
// da seção no `.docx` (`export/docx/fromDocumento.ts`) tem `numero` e
// `titulo` em mãos, e não uma entrada de sumário — obrigá-lo a fabricar um
// `ItemSumario` só para chamar esta função seria inventar um objeto para
// satisfazer uma assinatura. `ItemSumario` continua satisfazendo o tipo.
export function textoItemSumario(item: Pick<ItemSumario, "numero" | "titulo">): string {
  return item.numero ? `${item.numero} ${item.titulo}` : item.titulo;
}

// Ordenado por `ordem`, não pela posição no array — mesma convenção de
// `numerarSecoes()` e de `fromDocumento()`. O array é só armazenamento; a
// ordem do documento é o campo `ordem`.
export function gerarSumario(sections: Secao[]): ItemSumario[] {
  const numeracao = numerarSecoes(sections);

  return [...sections]
    .sort((a, b) => a.ordem - b.ordem)
    .map((secao) => ({
      id: secao.id,
      // `numerarSecoes()` é a MESMA função que o painel de seções
      // (`PainelSecoes.tsx`) e o corpo usam — não há uma segunda contagem
      // aqui que possa divergir da primeira. `?? null` porque o `Map` é
      // indexado por `id`: uma seção ausente dele significaria árvore
      // inconsistente, e a entrada sai sem indicativo em vez de com
      // `undefined` no meio do texto.
      numero: numeracao.get(secao.id) ?? null,
      titulo: secao.titulo,
      nivel: secao.nivel,
    }));
}

// Os pós-textuais que entram no sumário, e só eles. **Não é `Documento`, pelo
// mesmo motivo de `gerarSumario()` receber `Secao[]`**: o que mantém os
// pré-textuais fora do sumário (§6.3) é eles não terem por onde entrar, e um
// `Documento` aqui devolveria `Metadados` a este módulo, desfazendo a
// garantia de tipo em troca de um argumento a menos.
//
// `temReferencias` é booleano, e não a lista: as referências entram no sumário
// como UMA linha ("REFERÊNCIAS"), nunca uma por obra. A lista de referências
// em si é assunto do elemento, não do sumário.
export interface PosTextuaisDoSumario {
  readonly temReferencias: boolean;
  readonly apendices: readonly ItemPosTextual[];
  readonly anexos: readonly ItemPosTextual[];
}

// `id` das entradas que não vêm de uma `Secao`. Seções têm `id` de
// `crypto.randomUUID()` (`document/factory.ts`), então não há como colidir com
// um destes — e a entrada precisa de `id` pela mesma razão das outras: é por
// ele que a tela liga a linha do sumário ao elemento, sem depender da posição.
export const ID_SUMARIO_REFERENCIAS = "sumario:referencias";

function itemPosTextual(id: string, titulo: string): ItemSumario {
  // `numero: null` e `nivel: 1`: são títulos **sem indicativo numérico**
  // (NBR 14724:2024 §5.2.3) que a 6027 §5.2 manda alinhar "pela margem do
  // título do indicativo mais extenso", ou seja, no primeiro nível do sumário,
  // ao lado das seções primárias. O campo `numero` já nascia anulável no 3.6.1
  // esperando exatamente por isto.
  return { id, numero: null, titulo, nivel: 1 };
}

// **Sumário completo — passo 3.6.1, fechado em 18/09/2026.** A NBR 6027 §5.2
// manda alinhar os títulos "inclusive os elementos pós-textuais", e o EXEMPLO
// da norma lista `REFERÊNCIAS`, `APÊNDICE A` e `ANEXO A` dentro do sumário. O
// 3.6.1 registrou a lacuna por escrito ("pós-textuais ficam para 3.7.2") e o
// 3.7.2 entregou a ordem canônica sem voltar a ela; a leitura da fonte
// primária (docs/auditoria-abnt.md, achado 1) a trouxe de volta.
//
// A ordem entre os três é a de `../order.ts`, não uma segunda sequência escrita
// aqui: referências, apêndices, anexos. Cada um só aparece se existir — um
// "REFERÊNCIAS" no sumário de um trabalho sem referência nenhuma seria a mesma
// linha fabricada que `blocosDeReferencias()` recusa a escrever.
//
// A grafia vem de `textoTituloPosTextual()`, a mesma função que monta o título
// no corpo do `.docx`. É o que a 6027 §3.4 exige ao definir sumário como
// enumeração "na mesma ordem e grafia em que a matéria nele se sucede" — e o
// mesmo motivo pelo qual `textoItemSumario()` existe para as seções.
export function gerarSumarioCompleto(
  sections: Secao[],
  posTextuais: PosTextuaisDoSumario,
): ItemSumario[] {
  return [
    ...gerarSumario(sections),
    ...(posTextuais.temReferencias
      ? [itemPosTextual(ID_SUMARIO_REFERENCIAS, TITULO_REFERENCIAS)]
      : []),
    ...[...posTextuais.apendices, ...posTextuais.anexos].map((item) =>
      itemPosTextual(item.id, textoTituloPosTextual(item)),
    ),
  ];
}
