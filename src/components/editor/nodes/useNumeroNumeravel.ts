"use client";

import type { Editor } from "@tiptap/core";
import { useCallback, useSyncExternalStore } from "react";

import { numerarNumeraveisProseMirror } from "@/core/editor/numbering";

// Mesmo padrão de `useNumeroSecao` em `SectionView.tsx` (passo 3.2.2):
// assina as transações do editor via `useSyncExternalStore`, não
// `useEffect`+`setState` — o `EditorState` do ProseMirror é imutável, então
// uma transação nova já é o sinal de "recalcular". `getSnapshot` devolve um
// número (ou `null`); `useSyncExternalStore` compara por `Object.is`, então
// uma figura distante não força esta a re-renderizar quando o número dela
// não mudou.
//
// Extraído para um arquivo próprio, e não copiado dentro de cada view, porque
// figura e tabela precisam do mesmo hook — a única diferença é o `tipo`.
export function useNumeroNumeravel(
  editor: Editor,
  tipo: "figura" | "tabela",
  id: string | null,
): number | null {
  const inscrever = useCallback(
    (notificar: () => void) => {
      editor.on("transaction", notificar);
      return () => {
        editor.off("transaction", notificar);
      };
    },
    [editor],
  );
  const obterInstantaneo = useCallback(() => {
    if (!id) return null;
    return numerarNumeraveisProseMirror(editor.state.doc, tipo).get(id) ?? null;
  }, [editor, tipo, id]);
  const obterInstantaneoServidor = useCallback(() => null, []);

  return useSyncExternalStore(inscrever, obterInstantaneo, obterInstantaneoServidor);
}
