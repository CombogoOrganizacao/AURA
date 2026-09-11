"use client";

import { useMemo } from "react";

import { PanelHeading } from "@/components/app/PanelHeading";
import { numerarSecoes } from "@/core/document/numbering";
import type { Secao } from "@/core/document/types";

interface PainelSecoesProps {
  sections: Secao[];
}

// Rola até a seção clicada — busca no DOM, não no editor: `PainelSecoes` não
// tem (nem precisa d)a instância do TipTap, só o `Secao[]` canônico.
// `data-id` (não `id`) é o que `SectionView.tsx` (passo 3.2.2) grava no
// `<section>` do node view; `CSS.escape` evita qualquer problema de
// caractere especial no seletor, mesmo o id sendo sempre um UUID hoje.
function irParaSecao(id: string) {
  const elemento = document.querySelector<HTMLElement>(`section[data-id="${CSS.escape(id)}"]`);
  elemento?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Coluna esquerda do editor (passo 2B.10) — lista as seções que existem de
// verdade. Numeração progressiva (3.2.1/3.2.2) e navegação por âncora
// (3.2.3) já têm código por trás agora; reordenar arrastando (3.2.4) ainda
// não — o item continua sem alça de arraste até lá.
//
// Hoje isso normalmente mostra **uma linha**: a UI ainda não tem "nova
// seção" (só a seção-semente de `novaSecao()` existe). Refletir com
// honestidade o que existe é melhor que fabricar uma árvore que a v1 não
// tem ainda.
export function PainelSecoes({ sections }: PainelSecoesProps) {
  const numeracao = useMemo(() => numerarSecoes(sections), [sections]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-4">
        <PanelHeading>Seções</PanelHeading>
      </div>
      <nav aria-label="Seções do documento" className="flex-1 overflow-auto px-2 pb-4">
        {sections.length === 0 ? (
          <p className="px-2 py-1.5 font-sans text-xs text-subtle">Nenhuma seção ainda.</p>
        ) : (
          sections.map((secao) => {
            const numero = numeracao.get(secao.id);
            return (
              <button
                key={secao.id}
                type="button"
                onClick={() => irParaSecao(secao.id)}
                style={{ paddingLeft: 8 + (secao.nivel - 1) * 14 }}
                className={[
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left font-serif text-sm text-body",
                  "transition-colors hover:bg-sunken",
                  "focus-visible:outline-none focus-visible:shadow-focus-ring",
                ].join(" ")}
              >
                {numero && (
                  <span aria-hidden="true" className="shrink-0 text-xs text-subtle">
                    {numero}
                  </span>
                )}
                <span className="truncate">{secao.titulo || "Seção sem título"}</span>
              </button>
            );
          })
        )}
      </nav>
    </div>
  );
}
