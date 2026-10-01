"use client";

import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import katex from "katex";
import { useEffect, useMemo, useRef } from "react";

import "katex/dist/katex.min.css";

import { recursosForaDoWord } from "@/core/export/docx/formula";

// Fórmula no meio da frase (passo 6.2.11). Mesmo KaTeX e mesmas opções da
// fórmula em bloco (`FormulaView.tsx`), sem `displayMode`: desenhada na
// linha, no tamanho do texto. Selecionada, abre embaixo o campo do LaTeX,
// como a nota de rodapé abre o dela (`NotaRodapeView.tsx`); vazia ao perder a
// seleção, some — uma fórmula vazia sairia no `.docx` como nada.
const OPCOES_KATEX = {
  displayMode: false,
  throwOnError: true,
  trust: false,
  strict: false as const,
  output: "htmlAndMathml" as const,
};

function mensagemDeErro(texto: string): string | null {
  if (!texto.trim()) return null;
  try {
    katex.renderToString(texto, OPCOES_KATEX);
    return null;
  } catch (falha) {
    return falha instanceof Error ? falha.message : String(falha);
  }
}

export function FormulaInlineView({
  node,
  editor,
  getPos,
  selected,
  deleteNode,
}: ReactNodeViewProps) {
  const texto = node.attrs.texto as string;
  const destino = useRef<HTMLSpanElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const erro = useMemo(() => mensagemDeErro(texto), [texto]);
  const foraDoWord = useMemo(
    () => (erro || !texto.trim() ? [] : recursosForaDoWord(texto)),
    [texto, erro],
  );

  useEffect(() => {
    const elemento = destino.current;
    if (!elemento) return;
    if (erro || !texto.trim()) {
      elemento.textContent = texto.trim() ? texto : "fórmula";
      return;
    }
    katex.render(texto, elemento, OPCOES_KATEX);
  }, [texto, erro]);

  const estavaSelecionada = useRef(selected);
  useEffect(() => {
    const perdeuSelecao = estavaSelecionada.current && !selected;
    estavaSelecionada.current = selected;
    if (perdeuSelecao && texto.trim() === "") deleteNode();
    if (selected && texto === "") campo.current?.focus();
  }, [selected, texto, deleteNode]);

  function mudarTexto(novo: string) {
    const posicao = getPos();
    if (posicao === undefined) return;
    const { tr } = editor.state;
    tr.setNodeMarkup(posicao, undefined, { ...node.attrs, texto: novo });
    tr.setSelection(NodeSelection.create(tr.doc, posicao));
    editor.view.dispatch(tr);
  }

  // Volta ao texto logo depois da fórmula, para continuar a frase.
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

  return (
    <NodeViewWrapper as="span" className="doc-formula-inline" data-formula-inline="">
      <span
        ref={destino}
        contentEditable={false}
        data-erro={erro ? "" : undefined}
        data-vazia={texto.trim() ? undefined : ""}
        className="doc-formula-inline-render"
        title={erro ?? texto}
        aria-label={texto ? `Fórmula: ${texto}` : "Fórmula vazia"}
        onClick={() => campo.current?.focus()}
      />
      {selected && (
        <span className="doc-nota-campo" contentEditable={false}>
          <label className="doc-nota-rotulo">
            LaTeX da fórmula no texto
            <input
              ref={campo}
              type="text"
              value={texto}
              placeholder="ex.: E = mc^2"
              spellCheck={false}
              className="doc-formula-inline-campo"
              onChange={(evento) => mudarTexto(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" || evento.key === "Escape") {
                  evento.preventDefault();
                  concluir();
                }
              }}
            />
          </label>
          {erro && <span role="note">Não foi possível desenhar: confira a sintaxe LaTeX.</span>}
          {foraDoWord.length > 0 && (
            <span role="note">No Word, sai sem: {foraDoWord.join("; ")}.</span>
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
}
