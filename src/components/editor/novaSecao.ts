import type { Editor } from "@tiptap/core";

import { inserirSecao } from "@/core/editor/novaSecao";

// Cola entre o comando puro (`inserirSecao`, src/core/editor/novaSecao.ts) e
// a tela: gera o id, despacha, rola até a seção nova e põe o foco no campo de
// título dela — quem cria uma seção quer dar nome a ela em seguida. Usada pela
// barra (`Toolbar.tsx`) e pelo painel de seções (via `Editor.tsx`).
export function criarSecaoNoEditor(editor: Editor, subsecao: boolean): void {
  const id = crypto.randomUUID();
  const tr = editor.state.tr;
  if (inserirSecao(tr, { id, subsecao }) === null) return;
  editor.view.dispatch(tr.scrollIntoView());

  // O node view (`SectionView.tsx`) monta o `<input>` do título depois do
  // render do React; um quadro de espera basta.
  requestAnimationFrame(() => {
    const campo = editor.view.dom.querySelector<HTMLInputElement>(
      `section[data-id="${CSS.escape(id)}"] input`,
    );
    if (!campo) return;
    campo.scrollIntoView({ block: "center" });
    campo.focus();
  });
}
