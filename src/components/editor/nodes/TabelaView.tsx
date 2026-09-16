"use client";

import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";

import { ROTULO_TABELA } from "@/core/document/elements/legenda";

import { CampoFonte, CampoLegenda } from "./CamposLegenda";
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
export function TabelaView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  const id = node.attrs.id as string | null;
  const numero = useNumeroNumeravel(editor, "tabela", id);

  return (
    <NodeViewWrapper as="div" data-id={id} className="doc-tabela">
      <CampoLegenda
        rotulo={ROTULO_TABELA}
        numero={numero}
        valor={node.attrs.legenda as string}
        onChange={(legenda) => updateAttributes({ legenda })}
      />
      <table>
        {/*
          Argumento de tipo explícito: `as` é `NoInfer<T>` na assinatura do
          `NodeViewContent`, então TS não deduz "tbody" do próprio valor.
        */}
        <NodeViewContent<"tbody"> as="tbody" />
      </table>
      <CampoFonte
        rotulo={ROTULO_TABELA}
        numero={numero}
        valor={node.attrs.fonte as string}
        onChange={(fonte) => updateAttributes({ fonte })}
      />
    </NodeViewWrapper>
  );
}
