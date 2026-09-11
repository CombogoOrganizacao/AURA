import type { Node as NoProseMirror } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

// Move o nó `secao` de topo com `idOrigem` pra logo antes ou depois do nó
// `secao` de topo com `idDestino` — passo 3.2.4 (`PainelSecoes.tsx`, arrastar
// pra reordenar). Só filhos diretos do `doc`: nenhum comando do editor hoje
// aninha um `secao` dentro de outro de verdade (`Toolbar.tsx`/2.5 só muda o
// atributo `nivel`, não reestrutura a árvore), então mover um item da lista
// plana de `PainelSecoes` corresponde 1:1 a mover um filho direto do `doc`.
//
// Recebe `tr` (mutável, como toda API de `Transform` do ProseMirror — a
// mesma instância volta modificada) em vez de devolver um novo `Documento`:
// quem chama (o glue code em `Editor.tsx`, que já tem um `tr` de
// `editor.state`) despacha o resultado direto, sem outra emenda pelo meio.
// Testável com só `EditorState` (sem `EditorView`/DOM) — mesma convenção de
// `section.test.ts`/`numbering.test.ts`.
//
// Devolve `false` sem tocar `tr` se algum dos dois ids não existir entre os
// filhos diretos do documento, ou se origem e destino forem o mesmo nó —
// nada a mover.
interface SecaoDeTopo {
  pos: number;
  node: NoProseMirror;
}

function encontrarSecaoDeTopo(doc: NoProseMirror, id: string): SecaoDeTopo | null {
  let encontrado: SecaoDeTopo | null = null;
  doc.forEach((no, offset) => {
    if (no.attrs.id === id) encontrado = { pos: offset, node: no };
  });
  return encontrado;
}

export function moverSecaoDeTopo(
  tr: Transaction,
  idOrigem: string,
  idDestino: string,
  inserirDepois: boolean,
): boolean {
  const origem = encontrarSecaoDeTopo(tr.doc, idOrigem);
  const destino = encontrarSecaoDeTopo(tr.doc, idDestino);

  if (!origem || !destino || origem.node === destino.node) {
    return false;
  }

  tr.delete(origem.pos, origem.pos + origem.node.nodeSize);

  // `mapping.map` traduz a posição de `destino`, capturada antes da
  // deleção, pra depois dela — a deleção pode ter deslocado tudo que vinha
  // depois. Bias -1: se `origem` vinha logo antes de `destino`, ancora no
  // início de `destino` (não no ponto de junção ambíguo entre os dois).
  let posDestino = tr.mapping.map(destino.pos, -1);
  if (inserirDepois) {
    posDestino += destino.node.nodeSize;
  }
  tr.insert(posDestino, origem.node);

  return true;
}
