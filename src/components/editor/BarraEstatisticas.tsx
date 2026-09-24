"use client";

import { useMemo } from "react";

import { useEditorState, type Editor } from "@tiptap/react";

import type { Secao } from "@/core/document/types";
import { calcularEstatisticas, paragrafosDoCorpo, type Estatisticas } from "@/core/language/stats";

interface BarraEstatisticasProps {
  editor: Editor;
  secoes: readonly Secao[];
}

const NUMERO = new Intl.NumberFormat("pt-BR");

function contar(quantidade: number, singular: string, plural: string): string {
  return `${NUMERO.format(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

// O texto selecionado no editor, ou `null` sem seleção de texto. Uma figura
// selecionada inteira não tem texto: a barra volta a contar o documento.
function textoSelecionado(editor: Editor): string | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  const texto = editor.state.doc.textBetween(from, to, "\n");
  return texto.trim() ? texto : null;
}

// Barra de estatísticas no pé do editor (passo 5.4.3). As contas são as de
// `src/core/language/stats.ts` (5.4.1): a mesma palavra da regra do resumo, e
// nenhuma estimativa (sem páginas nem tempo de leitura).
//
// Sem seleção, conta o corpo inteiro: títulos de seção, parágrafos, citações,
// tabelas e legendas (`paragrafosDoCorpo`). Com seleção, conta só o texto
// selecionado, que chega do editor com os parágrafos separados por quebra de
// linha. Os títulos de seção, as legendas e as fontes são campos à parte e
// não entram numa seleção: selecionar tudo pode dar um pouco menos que o
// total do documento.
export function BarraEstatisticas({ editor, secoes }: BarraEstatisticasProps) {
  const selecao = useEditorState({
    editor,
    selector: ({ editor: atual }) => textoSelecionado(atual),
  });

  const doDocumento = useMemo(
    () =>
      calcularEstatisticas(paragrafosDoCorpo({ sections: [...secoes], apendices: [], anexos: [] })),
    [secoes],
  );
  const daSelecao = useMemo(
    () => (selecao === null ? null : calcularEstatisticas(selecao.split("\n"))),
    [selecao],
  );

  const numeros: Estatisticas = daSelecao ?? doDocumento;

  return (
    // Região com rótulo, e não `role="status"`: um status é anunciado a cada
    // mudança, e o leitor de tela leria a contagem a cada tecla.
    <section
      aria-label="Estatísticas do texto"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] bg-card px-4 py-1.5 font-sans text-xs text-muted"
    >
      <span className={daSelecao ? "font-semibold text-bordo-700" : "font-semibold text-body"}>
        {daSelecao ? "Seleção" : "Documento"}
      </span>
      <span>{contar(numeros.palavras, "palavra", "palavras")}</span>
      <span aria-hidden="true">·</span>
      <span>
        {contar(numeros.caracteresComEspacos, "caractere", "caracteres")} (
        {NUMERO.format(numeros.caracteresSemEspacos)} sem espaços)
      </span>
      <span aria-hidden="true">·</span>
      <span>{contar(numeros.paragrafos, "parágrafo", "parágrafos")}</span>
    </section>
  );
}
