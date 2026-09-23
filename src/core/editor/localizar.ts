import type { Node as NoPM } from "@tiptap/pm/model";

import type { LocalAchado } from "../rules/compliance";

// Do local de um achado da conferência para uma posição na árvore do editor —
// passo 5.2.3. É o que leva o cursor até o problema quando o aluno clica no
// achado. Fica em `src/core/` porque é só leitura da árvore, sem DOM; quem
// move a seleção e rola a tela é `Editor.tsx`.
//
// A emenda com o formato canônico: `LocalAchado` fala em "seção X, nó N,
// caracteres A a B", com N contado em `Secao.content`. Na árvore do editor a
// seção é um nó `secao` cujos filhos misturam blocos e SUBSEÇÕES (uma
// subseção é um `secao` aninhado, ver `document/serialize.ts`). Por isso N
// conta só os filhos que não são `secao`, exatamente como `toDocumento()`
// monta `content`.

export type AlvoNoEditor =
  // Um trecho de texto dentro de um parágrafo ou citação longa.
  | { alvo: "trecho"; de: number; ate: number }
  // Um nó inteiro: figura, tabela, fórmula, ou um parágrafo sem trecho.
  | { alvo: "no"; posicao: number }
  // A seção em si (um achado do título dela).
  | { alvo: "secao"; posicao: number };

// `null` quando o local não está no editor: metadado, referência, o documento
// inteiro, ou apêndice e anexo (ainda sem tela de edição, passo 3.7.1). Também
// quando a seção ou o nó não existem mais: o achado veio de uma conferência
// anterior à última edição.
export function alvoNoEditor(doc: NoPM, local: LocalAchado): AlvoNoEditor | null {
  if (local.tipo !== "bloco" || local.onde.tipo !== "secao") return null;

  const posicaoSecao = acharSecao(doc, local.onde.id);
  if (posicaoSecao === null) return null;
  if (local.no === undefined) return { alvo: "secao", posicao: posicaoSecao };

  const secao = doc.nodeAt(posicaoSecao);
  if (!secao) return null;

  let indice = 0;
  let encontrado: { no: NoPM; posicao: number } | null = null;
  secao.forEach((filho, deslocamento) => {
    if (encontrado || filho.type.name === "secao") return;
    if (indice === local.no) encontrado = { no: filho, posicao: posicaoSecao + 1 + deslocamento };
    indice += 1;
  });
  if (!encontrado) return null;
  const { no, posicao } = encontrado as { no: NoPM; posicao: number };

  if (!local.trecho || !no.isTextblock) return { alvo: "no", posicao };

  // Dentro de parágrafo e citação longa o conteúdo é só texto (a chamada e as
  // aspas são decoração, não nó), então o caractere N está em posicao + 1 + N.
  // O trecho é limitado ao tamanho do nó: texto encurtado depois da
  // conferência não pode levar a seleção para fora dele.
  const limite = no.content.size;
  const inicio = Math.min(local.trecho.inicio, limite);
  const fim = Math.min(Math.max(local.trecho.fim, inicio), limite);
  return { alvo: "trecho", de: posicao + 1 + inicio, ate: posicao + 1 + fim };
}

function acharSecao(doc: NoPM, id: string): number | null {
  let posicao: number | null = null;
  doc.descendants((no, pos) => {
    if (posicao !== null) return false;
    if (no.type.name === "secao" && no.attrs.id === id) {
      posicao = pos;
      return false;
    }
    return true;
  });
  return posicao;
}
