"use client";

import type { Editor } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { useCallback, useRef, useSyncExternalStore } from "react";

import { ROTULO_TABELA } from "@/core/document/elements/legenda";
import { proporcoesDasColunas } from "@/core/document/elements/tabela";
import { celulaDaSelecao, linhaEhCabecalho } from "@/core/editor/tabela";

import { CampoFonte, CampoLegenda } from "./CamposLegenda";
import { ControlesDaTabela, type EstadoGrade } from "./ControlesDaTabela";
import { useNumeroNumeravel } from "./useNumeroNumeravel";

// Node view do nó `tabela` (passo 3.6.3) — ver docs/schema-tiptap.md §4.7.
// Mesmo desenho de `FiguraView`: legenda acima, objeto no meio, fonte abaixo,
// número derivado a cada transação.
//
// A diferença é o meio: aqui o objeto é conteúdo editável de verdade
// (`linha_tabela`/`celula_tabela`), então entra um `NodeViewContent as="tbody"`
// em vez de uma moldura. `<table>` de verdade, não `<div>` com grade CSS: é o
// que dá navegação por célula e leitura correta em leitor de tela, e é o que
// `parseHTML()` do nó reconhece ao colar.
//
// O padrão IBGE adotado pela ABNT (laterais abertas, sem traço vertical, fio
// em cima e embaixo e outro sob o cabeçalho) fica no CSS do editor
// (`app/globals.css`), não aqui e não no nó — mesma divisão da citação longa.
export function TabelaView({ node, editor, getPos, updateAttributes }: ReactNodeViewProps) {
  const id = node.attrs.id as string | null;
  const numero = useNumeroNumeravel(editor, "tabela", id);
  const grade = useGradeAtiva(editor, getPos);
  const area = useRef<HTMLDivElement>(null);

  return (
    <NodeViewWrapper as="div" data-id={id} className="doc-tabela">
      <CampoLegenda
        rotulo={ROTULO_TABELA}
        numero={numero}
        valor={node.attrs.legenda as string}
        onChange={(legenda) => updateAttributes({ legenda })}
      />
      {/* A área é o ponto de referência dos controles (`ControlesDaTabela`). */}
      <div ref={area} className="doc-tabela-area">
        <table>
          {/*
          Largura das colunas pelo texto das células, a mesma conta do `.docx`
          e do `.tex` (`proporcoesDasColunas`). Recalculada a cada render, que
          o node view já recebe a cada mudança na tabela.
        */}
          <colgroup>
            {proporcoesDasColunas(textosDoNo(node)).map((proporcao, coluna) => (
              <col key={coluna} style={{ width: `${proporcao * 100}%` }} />
            ))}
          </colgroup>
          {/*
          Argumento de tipo explícito: `as` é `NoInfer<T>` na assinatura do
          `NodeViewContent`, então TS não deduz "tbody" do próprio valor.
        */}
          <NodeViewContent<"tbody"> as="tbody" />
        </table>
        {grade && <ControlesDaTabela editor={editor} grade={grade} area={area} />}
      </div>
      <CampoFonte
        rotulo={ROTULO_TABELA}
        numero={numero}
        valor={node.attrs.fonte as string}
        onChange={(fonte) => updateAttributes({ fonte })}
      />
    </NodeViewWrapper>
  );
}

// O texto de cada célula, linha a linha — o equivalente, no nó do
// ProseMirror, de `textosDasCelulas()` sobre a tabela canônica.
function textosDoNo(tabela: ReactNodeViewProps["node"]): string[][] {
  const linhas: string[][] = [];
  tabela.forEach((linha) => {
    const celulas: string[] = [];
    linha.forEach((celula) => celulas.push(celula.textContent));
    linhas.push(celulas);
  });
  return linhas;
}

// Se o cursor está numa célula DESTA tabela, e como está a grade. A barra só
// aparece nesse caso: com várias tabelas no documento, os botões agem na do
// cursor, e mostrá-los em todas faria parecer que agem em qualquer uma.
//
// O instantâneo é uma string, não um objeto: `useSyncExternalStore` compara
// por `Object.is`, e um objeto novo a cada transação re-renderizaria todas as
// tabelas a cada tecla.
function useGradeAtiva(editor: Editor, getPos: () => number | undefined): EstadoGrade | null {
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
    const alvo = celulaDaSelecao(editor.state.selection);
    if (!alvo || alvo.posTabela !== getPos()) return "";
    const colunas = alvo.tabela.child(alvo.linha).childCount;
    return `${alvo.tabela.childCount}|${colunas}|${alvo.linha}|${alvo.coluna}|${linhaEhCabecalho(alvo) ? 1 : 0}`;
  }, [editor, getPos]);
  const obterInstantaneoServidor = useCallback(() => "", []);

  const instantaneo = useSyncExternalStore(inscrever, obterInstantaneo, obterInstantaneoServidor);
  if (!instantaneo) return null;
  const [linhas, colunas, linha, coluna, cabecalho] = instantaneo.split("|");
  return {
    linhas: Number(linhas),
    colunas: Number(colunas),
    linha: Number(linha),
    coluna: Number(coluna),
    cabecalho: cabecalho === "1",
  };
}
