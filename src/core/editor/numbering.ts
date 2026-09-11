import type { Node as NoProseMirror } from "@tiptap/pm/model";

import { numerarSecoes } from "../document/numbering";
import type { NivelSecao, Secao } from "../document/types";

// Ponte entre o documento ProseMirror (nó `secao`, src/core/editor/nodes/
// section.ts) e `numerarSecoes()` (src/core/document/numbering.ts, que opera
// sobre `Secao[]` canônico) — usada pelo node view do passo 3.2.2
// (src/components/editor/nodes/SectionView.tsx) pra saber que número mostrar
// enquanto a pessoa ainda está digitando, antes de qualquer `onUpdate`
// converter o editor inteiro pro formato canônico.
//
// Não passa por `toDocumento()`/`editor.getJSON()`: numeração só depende de
// `id`/`nivel`/`ordem`, não do conteúdo (parágrafos) de cada seção — não há
// motivo pra materializar isso a cada tecla digitada, numa função chamada uma
// vez por seção visível. `doc.descendants()` visita em pré-ordem, a mesma
// convenção de achatamento que `toDocumento()` usa para subseção aninhada
// (src/core/document/serialize.ts).
export function numerarDocumentoProseMirror(doc: NoProseMirror): Map<string, string> {
  const secoesMinimas: Secao[] = [];
  let ordem = 0;

  doc.descendants((no) => {
    if (no.type.name !== "secao") {
      return;
    }
    const id = no.attrs.id as string | null;
    // Seção sem id não deveria existir no editor — `documento.ts` recusa a
    // transação que criaria uma —, mas não é papel desta função validar
    // isso; só ignora o que não tem como numerar.
    if (!id) {
      return;
    }
    secoesMinimas.push({
      id,
      ordem: ordem++,
      nivel: no.attrs.nivel as NivelSecao,
      titulo: "",
      content: [],
    });
  });

  return numerarSecoes(secoesMinimas);
}
