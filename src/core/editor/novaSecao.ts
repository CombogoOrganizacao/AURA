import type { Node as NoProseMirror } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";

import type { NivelSecao } from "../document/types";

// Cria uma seção pela interface (passo 6.2.7) — "Nova seção" e "Nova
// subseção", no painel de seções e na barra. Antes disto não havia comando
// nenhum que inserisse um nó `secao`: os botões de nível só mudavam o `nivel`
// da seção do cursor, e o documento nunca passava de "1".
//
// As seções do editor são filhos diretos do `doc`, uma lista plana com
// `nivel` (`fromDocumento()`, src/core/document/serialize.ts) — a hierarquia
// "2.1 dentro de 2" é derivada do nível, como a numeração. Por isso a nova
// seção entra depois da seção do cursor E das que vêm depois dela num nível
// mais fundo: "Nova seção" com o cursor em "2" cai depois de 2.1 e 2.2, e
// não entre 2 e 2.1 — o que roubaria as subseções de 2 para a seção nova.
//
// - `subsecao: false`: mesmo nível da seção do cursor (a irmã seguinte);
// - `subsecao: true`: um nível abaixo, até o 3 (o último que a v1 tem).
//
// O id vem de quem chama (`crypto.randomUUID()`), pelo mesmo motivo de
// `novaSecao()` (src/core/document/factory.ts): o schema não pode ter id
// default. Deixa o cursor no parágrafo da seção nova e devolve a posição dela,
// ou `null` se o documento não tiver seção (não acontece com `secao+`).
export interface OpcoesNovaSecao {
  id: string;
  subsecao: boolean;
}

export function inserirSecao(tr: Transaction, opcoes: OpcoesNovaSecao): number | null {
  const doc = tr.doc;
  if (doc.childCount === 0) return null;

  const indiceAtual = Math.min(tr.selection.$from.index(0), doc.childCount - 1);
  const atual = doc.child(indiceAtual);
  const nivelAtual = (atual.attrs.nivel as NivelSecao | undefined) ?? 1;
  const nivel = (opcoes.subsecao ? Math.min(nivelAtual + 1, 3) : nivelAtual) as NivelSecao;

  let indice = indiceAtual + 1;
  while (indice < doc.childCount && nivelDe(doc.child(indice)) > nivelAtual) indice++;

  let pos = 0;
  for (let i = 0; i < indice; i++) pos += doc.child(i).nodeSize;

  const { secao, paragraph } = doc.type.schema.nodes;
  tr.insert(pos, secao.create({ id: opcoes.id, nivel, titulo: "" }, paragraph.create()));
  // `pos + 2`: dentro do parágrafo vazio (pos+1 é o início do conteúdo da
  // seção, pos+2 o do parágrafo).
  tr.setSelection(TextSelection.create(tr.doc, pos + 2));
  return pos;
}

function nivelDe(no: NoProseMirror): number {
  return (no.attrs.nivel as number | undefined) ?? 1;
}
