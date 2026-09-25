"use client";

import type { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/Button";
import { posicoesDasNotas } from "@/core/editor/numbering";

// Node view de `nota_rodape` (passo 6.1.3c) — docs/schema-tiptap.md §4.9.
//
// No texto, só o expoente, como na página impressa: o número é derivado da
// ordem das notas a cada transação (`posicoesDasNotas()`), nunca gravado. O
// conteúdo da nota aparece num campo logo abaixo do expoente enquanto a nota
// está selecionada; clicar no expoente seleciona, e inserir pela barra já
// deixa selecionada.
//
// **Nota vazia não fica.** Quem insere e sai sem escrever nada deixa uma nota
// que sairia no `.docx` como um número sem texto no pé da página. Ao perder a
// seleção vazia, ela se apaga (e o Ctrl+Z a traz de volta, se foi engano).
export function NotaRodapeView({
  node,
  editor,
  getPos,
  selected,
  deleteNode,
}: ReactNodeViewProps) {
  const texto = node.attrs.texto as string;
  const numero = useNumeroNota(editor, getPos);
  const campo = useRef<HTMLTextAreaElement>(null);
  const caixa = useRef<HTMLSpanElement>(null);
  const [deslocamento, setDeslocamento] = useState(0);

  // O campo abre sob o expoente, mas não pode passar da borda da folha: uma
  // nota perto da margem direita o empurraria para fora, onde ele fica
  // cortado. Mede a folha e o campo ao abrir e o puxa para dentro.
  useLayoutEffect(() => {
    if (!selected || !caixa.current) return;
    const folha = caixa.current.closest(".ProseMirror")?.getBoundingClientRect();
    const ancora = caixa.current.parentElement?.getBoundingClientRect();
    if (!folha || !ancora) return;
    const largura = caixa.current.offsetWidth;
    const sobraDireita = folha.right - (ancora.left + largura);
    const ajuste = Math.min(0, sobraDireita);
    // Nunca além da margem esquerda da folha, mesmo que falte espaço.
    setDeslocamento(Math.max(ajuste, folha.left - ancora.left));
  }, [selected]);
  const estavaSelecionada = useRef(selected);

  useEffect(() => {
    const perdeuSelecao = estavaSelecionada.current && !selected;
    estavaSelecionada.current = selected;
    if (perdeuSelecao && texto.trim() === "") deleteNode();
    // Nota recém-inserida (vazia e selecionada): o cursor vai direto para o
    // campo, para digitar sem outro clique.
    if (selected && texto === "") campo.current?.focus();
  }, [selected, texto, deleteNode]);

  // Grava o texto da nota e mantém a nota selecionada. `updateAttributes()`
  // não serve aqui: num nó atômico, trocar o atributo troca o nó inteiro, a
  // seleção dele se perde, o campo fecha a cada tecla e o foco cai fora do
  // editor. Achado no Playwright, digitando no campo.
  function mudarTexto(novo: string) {
    const posicao = getPos();
    if (posicao === undefined) return;
    const { tr } = editor.state;
    tr.setNodeMarkup(posicao, undefined, { ...node.attrs, texto: novo });
    tr.setSelection(NodeSelection.create(tr.doc, posicao));
    editor.view.dispatch(tr);
  }

  // Volta ao texto, logo depois do expoente, que é onde se continua
  // escrevendo depois de uma nota.
  function concluir() {
    const posicao = getPos();
    if (posicao === undefined) return;
    if (texto.trim() === "") {
      deleteNode();
      editor.commands.focus();
      return;
    }
    const { tr } = editor.state;
    editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, posicao + 1)));
    editor.view.focus();
  }

  const rotulo = numero === null ? "Nota de rodapé" : `Nota de rodapé ${numero}`;

  return (
    <NodeViewWrapper as="span" className="doc-nota" data-nota-rodape="">
      <sup
        className={texto.trim() === "" ? "doc-nota-numero doc-nota-vazia" : "doc-nota-numero"}
        title={texto || "Nota vazia"}
        aria-label={texto ? `${rotulo}: ${texto}` : `${rotulo}, vazia`}
        onClick={() => campo.current?.focus()}
      >
        {numero ?? "?"}
      </sup>
      {selected && (
        <span
          ref={caixa}
          className="doc-nota-campo"
          contentEditable={false}
          style={{ left: deslocamento }}
        >
          <label className="doc-nota-rotulo">
            {rotulo}
            <textarea
              ref={campo}
              aria-label={`Texto da ${rotulo.toLowerCase()}`}
              value={texto}
              rows={3}
              onChange={(evento) => mudarTexto(evento.target.value)}
              onKeyDown={(evento) => {
                // Enter conclui: a nota é um parágrafo só, texto simples
                // (docs/schema-tiptap.md §4.9), e o Enter do editor também é
                // "acabei esta linha".
                if ((evento.key === "Enter" && !evento.shiftKey) || evento.key === "Escape") {
                  evento.preventDefault();
                  concluir();
                }
              }}
            />
          </label>
          <span className="doc-nota-acoes">
            <Button size="sm" variant="outline" onClick={concluir}>
              Concluir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                deleteNode();
                editor.commands.focus();
              }}
            >
              Remover nota
            </Button>
          </span>
        </span>
      )}
    </NodeViewWrapper>
  );
}

// O número desta nota, derivado da posição dela entre as notas do documento.
// Mesmo padrão de `useNumeroNumeravel`: assina as transações, e o
// instantâneo é um número, então só re-renderiza a nota cujo número mudou.
function useNumeroNota(editor: Editor, getPos: () => number | undefined): number | null {
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
    const posicao = getPos();
    if (posicao === undefined) return null;
    const indice = posicoesDasNotas(editor.state.doc).indexOf(posicao);
    return indice === -1 ? null : indice + 1;
  }, [editor, getPos]);
  const obterInstantaneoServidor = useCallback(() => null, []);

  return useSyncExternalStore(inscrever, obterInstantaneo, obterInstantaneoServidor);
}
