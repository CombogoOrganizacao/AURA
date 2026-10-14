"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";

import { chamadaDaCitacaoNarrativa } from "@/core/references/citacoes";

import { useReferenciasDoEditor } from "../ReferenciasDoEditor";

// Citação com o autor dentro da frase (NBR 10520:2023 §6.1.4). O nó guarda a
// ligação; o que aparece, "Oliveira e Leonardos (1943, p. 146)", é
// sintetizado da referência a cada render, pela mesma função que os dois
// exportadores usam (`chamadaDaCitacaoNarrativa()`). Corrigir a referência
// corrige a frase; excluí-la deixa o aviso no lugar, como na chamada entre
// parênteses.
//
// Não se edita aqui dentro: selecionado (clique ou setas), o botão "Citar"
// da barra abre o menu em modo de edição.
export function CitacaoNarrativaView({ node }: ReactNodeViewProps) {
  const referencias = useReferenciasDoEditor();
  const { refId, pagina, grifoNosso, traducaoNossa } = node.attrs as {
    refId: string;
    pagina: string | null;
    grifoNosso: boolean;
    traducaoNossa: boolean;
  };
  const chamada = chamadaDaCitacaoNarrativa(
    {
      refId,
      pagina,
      ...(grifoNosso ? { grifoNosso: true } : {}),
      ...(traducaoNossa ? { traducaoNossa: true } : {}),
    },
    referencias,
  );

  return (
    <NodeViewWrapper
      as="span"
      className={
        chamada.orfa ? "doc-citacao-narrativa doc-citacao-narrativa-orfa" : "doc-citacao-narrativa"
      }
      data-citacao-narrativa=""
      contentEditable={false}
      title={
        chamada.orfa
          ? "A referência desta citação foi excluída. Selecione e use Citar para ligá-la a outra."
          : "Citação com o autor na frase. Para mudar a página ou a obra, selecione e use Citar."
      }
    >
      {chamada.texto}
    </NodeViewWrapper>
  );
}
