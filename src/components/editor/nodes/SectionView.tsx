"use client";

import type { Editor } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { useCallback, useSyncExternalStore } from "react";

import { numerarDocumentoProseMirror } from "@/core/editor/numbering";
import type { NivelSecao } from "@/core/document/types";

// Mesmo padrão de `Toolbar.tsx` (`useEstadoEditor`): assina as transações do
// editor via `useSyncExternalStore`, não `useEffect`+`setState` — o
// `EditorState` do ProseMirror é imutável, então uma transação nova já é o
// sinal de "recalcular". `getSnapshot` devolve uma string primitiva (ou
// `null`); `useSyncExternalStore` compara por `Object.is`, então uma seção
// distante não força esta em particular a re-renderizar quando o número
// dela não mudou.
function useNumeroSecao(editor: Editor, id: string | null): string | null {
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
    return numerarDocumentoProseMirror(editor.state.doc).get(id) ?? null;
  }, [editor, id]);
  const obterInstantaneoServidor = useCallback(() => null, []);

  return useSyncExternalStore(inscrever, obterInstantaneo, obterInstantaneoServidor);
}

// Node view do nó `secao` (passo 3.2.2) — ver docs/schema-tiptap.md §4.1 e
// §2. Mostra "2.1" antes do título na tela sem gravar a numeração em lugar
// nenhum: vem de `numerarDocumentoProseMirror()`
// (src/core/editor/numbering.ts), recalculada a cada transação a partir de
// `id`/`nivel`/`ordem` de toda seção do documento — nunca lida de um
// atributo. `Secao.titulo` continua só o texto puro (CLAUDE.md proíbe a
// numeração entrar na string do título; conferido no round-trip de
// `serialize.ts`, que não muda aqui).
//
// Fica em `src/components/` e não em `src/core/` de propósito: o nó em si
// (`src/core/editor/nodes/section.ts`) continua livre de React — quem liga
// este node view a ele é `Editor.tsx` (`.extend({ addNodeView })`), o
// primeiro lugar de cima pra baixo onde React já está em escopo.
//
// O título é um `<input>`, não texto do ProseMirror: `titulo` é atributo do
// nó, fora do schema de conteúdo (`content: "block*"`) — um `<input>`
// nativo dentro do node view edita a própria caixa de texto sem o
// ProseMirror tentar gerenciar cursor ali dentro, e `contentEditable={false}`
// na linha do título impede o ProseMirror de tratá-la como parte do
// documento editável (mesma técnica recomendada pelo TipTap para atributo
// editável dentro de um node view React).
//
// Gradação h1/h2/h3 na tela (passo 3.2.5) — mesma escolha de estilo do
// `.docx` (`heading1`/`heading2`/`heading3` em
// `src/core/export/docx/styles.ts`, decidida no passo 3.1.1): nível 1 caixa
// alta + negrito, nível 2 negrito, nível 3 itálico. Duplicado ali e aqui de
// propósito, não derivado em runtime de `NORMAS.abnt.titulos`
// (`src/core/standards/standards.ts`) — mesmo padrão já em uso entre
// `docx/constants.ts` e `PaperSheet.tsx` (`NORMAS` ainda serve só o motor de
// regras de Fase 5+, ver passo 3.1.2). NBR 6024 exige gradação visível e
// consistência sumário↔texto, não esta combinação específica. Tamanho fica
// igual nos três níveis (`--doc-h1/h2/h3` em app/globals.css não entram
// aqui): a ABNT auditada (`NORMAS.abnt.titulos`, docs/auditoria-abnt.md) usa
// 12pt nos três, e o `.docx` segue o mesmo.
const ESTILO_TITULO_POR_NIVEL: Record<NivelSecao, string> = {
  1: "font-bold uppercase",
  2: "font-bold",
  3: "italic",
};

export function SectionView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  const id = node.attrs.id as string | null;
  const nivel = node.attrs.nivel as NivelSecao;
  const titulo = node.attrs.titulo as string;

  const numero = useNumeroSecao(editor, id);
  const rotulo = numero ? `${numero} Título da seção` : "Título da seção";
  const estiloNivel = ESTILO_TITULO_POR_NIVEL[nivel];

  return (
    // `data-id` (não `id`): mesma convenção que `renderHTML()` já usava em
    // `section.ts` antes deste node view existir — evita lidar com escape de
    // seletor CSS pra um `id` que é um UUID, e é o que `PainelSecoes.tsx`
    // (passo 3.2.3) procura pra rolar até a seção ao clicar.
    <NodeViewWrapper as="section" data-id={id} data-nivel={nivel}>
      <div className="flex items-baseline gap-2" contentEditable={false}>
        {numero && (
          <span aria-hidden="true" className={["shrink-0", estiloNivel].join(" ")}>
            {numero}
          </span>
        )}
        <input
          type="text"
          value={titulo}
          onChange={(evento) => updateAttributes({ titulo: evento.target.value })}
          placeholder="Título da seção"
          aria-label={rotulo}
          className={[
            "w-full min-w-0 border-none bg-transparent outline-none",
            estiloNivel,
            "placeholder:font-normal placeholder:normal-case placeholder:text-subtle",
            "focus-visible:shadow-focus-ring focus-visible:rounded-xs",
          ].join(" ")}
        />
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
