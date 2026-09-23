"use client";

import { Textarea } from "@/components/ui/Textarea";
import type { Metadados } from "@/core/document/types";

import { CampoPalavrasChave } from "./Resumo";

interface AbstractProps {
  metadados: Metadados;
  onChange: (atualizador: (atual: Metadados) => Metadados) => void;
}

// Abstract + keywords — elemento obrigatório (NBR 14724:2024 §4.2.1.8,
// "Resumo em língua estrangeira. Elemento obrigatório"), como o `Resumo.tsx`.
// Até 23/09/2026 era tratado como opcional por uma decisão tomada com fonte
// secundária (docs/aura-decisoes-e-pendencias.md §1.3, passo 4B.1).
//
// Vazio, sai do `.docx` sem título nenhum (`paragrafosAbstract()`): um
// `ABSTRACT` sem texto embaixo teria cara de conformidade. Quem aponta a
// falta é a conferência (Fase 5), do mesmo jeito que faz com o resumo.
export function Abstract({ metadados, onChange }: AbstractProps) {
  function atualizarCampo<K extends keyof Metadados>(campo: K, valor: Metadados[K]) {
    onChange((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 font-sans">
      <Textarea
        label="Abstract"
        hint="Obrigatório (NBR 14724). Parágrafo único, entre 150 e 500 palavras (NBR 6028)."
        data-campo="abstract"
        value={metadados.abstract}
        onChange={(evento) => atualizarCampo("abstract", evento.target.value)}
        rows={8}
      />
      <CampoPalavrasChave
        label="Keywords"
        hint="Uma de cada vez — Enter ou o botão adicionam."
        valores={metadados.keywords}
        onChange={(valores) => atualizarCampo("keywords", valores)}
      />
    </div>
  );
}
