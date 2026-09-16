"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";

import { ROTULO_FIGURA } from "@/core/document/elements/legenda";

import { CampoFonte, CampoLegenda } from "./CamposLegenda";
import { useNumeroNumeravel } from "./useNumeroNumeravel";

// Node view do nó `figura` (passo 3.6.3) — ver docs/schema-tiptap.md §4.6.
// Mostra "Figura 3" sem gravar o número em lugar nenhum: vem de
// `numerarNumeraveisProseMirror()` (src/core/editor/numbering.ts),
// recalculada a cada transação. Inserir uma figura antes desta renumera as
// duas sozinho, sem nada para sincronizar.
//
// Fica em `src/components/` e não em `src/core/` de propósito: o nó em si
// (`src/core/editor/nodes/figure.ts`) continua livre de React — quem liga
// este node view a ele é `Editor.tsx`, mesma divisão de `SectionView.tsx`.
//
// **Legenda acima, fonte abaixo.** É a convenção corrente, não uma regra
// conferida na fonte primária — ver o cabeçalho de
// `src/core/document/elements/legenda.ts`, que registra o que a auditoria do
// passo 3.1.1 cobriu e o que ficou pendente.
//
// A moldura no lugar da imagem é honesta, não um "em breve": `imagem` é
// sempre `null` na v1 e embutir o arquivo é o passo 6.1.2 — o `.docx` sai com
// o mesmo placeholder (é o que a PoC congelada já fazia).
export function FiguraView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  const id = node.attrs.id as string | null;
  const numero = useNumeroNumeravel(editor, "figura", id);

  return (
    <NodeViewWrapper as="figure" data-id={id}>
      <CampoLegenda
        rotulo={ROTULO_FIGURA}
        numero={numero}
        valor={node.attrs.legenda as string}
        onChange={(legenda) => updateAttributes({ legenda })}
      />
      <div className="doc-figura-moldura" contentEditable={false}>
        espaço reservado para a imagem
      </div>
      <CampoFonte
        rotulo={ROTULO_FIGURA}
        numero={numero}
        valor={node.attrs.fonte as string}
        onChange={(fonte) => updateAttributes({ fonte })}
      />
    </NodeViewWrapper>
  );
}
