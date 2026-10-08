import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

// O ProseMirror só lê a seleção do navegador no evento `selectionchange`,
// que é uma tarefa comum. Numa máquina ocupada, o Chrome processa antes o
// clique (evento de entrada tem prioridade): quem seleciona pelo teclado e
// clica logo num botão da barra age sobre a seleção ANTIGA do editor. Foi o
// que fazia o "Citar" dizer "Selecione no texto o trecho citado" com o
// trecho visivelmente selecionado (e2e de citações instável, 08/10/2026).
//
// Antes da ação da barra, o editor lê a seleção do navegador. Só no caso do
// defeito: o navegador tem um trecho selecionado dentro do editor e o editor
// acha que há só um cursor. Seleção de figura (nó inteiro) e cursor entre
// blocos não passam por aqui.
export function lerSelecaoDoNavegador(editor: Editor): void {
  const { view } = editor;
  const atual = view.state.selection;
  if (!(atual instanceof TextSelection) || !atual.empty) return;

  const selecao = view.dom.ownerDocument.getSelection();
  if (!selecao || selecao.isCollapsed || !selecao.anchorNode || !selecao.focusNode) return;
  if (!view.dom.contains(selecao.anchorNode) || !view.dom.contains(selecao.focusNode)) return;

  let ancora: number;
  let cabeca: number;
  try {
    ancora = view.posAtDOM(selecao.anchorNode, selecao.anchorOffset);
    cabeca = view.posAtDOM(selecao.focusNode, selecao.focusOffset);
  } catch {
    return;
  }
  if (ancora === cabeca) return;

  const { doc } = view.state;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.between(doc.resolve(ancora), doc.resolve(cabeca))),
  );
}
