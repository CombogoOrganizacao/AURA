"use client";

import { Textarea } from "@/components/ui/Textarea";
import type { Metadados } from "@/core/document/types";

import { CampoPalavrasChave } from "./Resumo";

interface AbstractProps {
  metadados: Metadados;
  onChange: (atualizador: (atual: Metadados) => Metadados) => void;
}

// Abstract + keywords — opcional na v1 (docs/aura-decisoes-e-pendencias.md
// §1.3), ao contrário do `Resumo.tsx`: sem asterisco de obrigatório, e sai
// do `.docx` sozinho quando fica vazio (`docx/preTextuais.ts`,
// `paragrafosAbstract()`) — não precisa de painel liga/desliga como
// dedicatória/agradecimentos/epígrafe (isso é 3.5.3, elementos que não têm
// "vazio" como estado natural).
export function Abstract({ metadados, onChange }: AbstractProps) {
  function atualizarCampo<K extends keyof Metadados>(campo: K, valor: Metadados[K]) {
    onChange((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 font-sans">
      <Textarea
        label="Abstract"
        hint="Opcional — some do .docx enquanto este campo ficar vazio."
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
