"use client";

import { useId, useState } from "react";
import type { KeyboardEvent } from "react";

import { CampoShell } from "@/components/ui/CampoShell";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import { Textarea } from "@/components/ui/Textarea";
import type { Metadados } from "@/core/document/types";

interface ResumoProps {
  metadados: Metadados;
  onChange: (atualizador: (atual: Metadados) => Metadados) => void;
}

// Resumo + palavras-chave (NBR 6028, passo 3.5.2) — obrigatório na v1
// (docs/aura-decisoes-e-pendencias.md §1.3), ao contrário de `Abstract.tsx`.
// Mesmo padrão controlado de `FormMetadados.tsx`: recebe `metadados` e
// `onChange`, não é dono da persistência — quem monta os dois decide onde
// (`DocumentoEditor.tsx`), com o mesmo `atualizarMetadados` que já existe lá.
//
// Ao contrário de `FormMetadados` (passo 1.3.4, anterior ao design system em
// `src/components/ui/`), este componente usa o kit de verdade — `Textarea`
// já documenta "resumo" como seu caso de uso (ver o próprio arquivo), e
// `Tag`/`onRemove` documenta "palavras-chave" do mesmo jeito.
export function Resumo({ metadados, onChange }: ResumoProps) {
  function atualizarCampo<K extends keyof Metadados>(campo: K, valor: Metadados[K]) {
    onChange((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 font-sans">
      <Textarea
        label="Resumo"
        hint="Parágrafo único, entre 150 e 500 palavras (NBR 6028)."
        value={metadados.resumo}
        onChange={(evento) => atualizarCampo("resumo", evento.target.value)}
        rows={8}
      />
      <CampoPalavrasChave
        label="Palavras-chave"
        hint="Uma de cada vez — Enter ou o botão adicionam."
        valores={metadados.palavrasChave}
        onChange={(valores) => atualizarCampo("palavrasChave", valores)}
      />
    </div>
  );
}

interface CampoPalavrasChaveProps {
  label: string;
  hint?: string;
  valores: string[];
  onChange: (valores: string[]) => void;
}

// Compartilhado com `Abstract.tsx` (keywords é o mesmo widget, rótulo
// diferente) — exportado daqui em vez de um terceiro arquivo só pra um tipo
// e uma função, mesma decisão de `capa.ts`/`folhaDeRosto.ts` no passo 3.5.1.
export function CampoPalavrasChave({ label, hint, valores, onChange }: CampoPalavrasChaveProps) {
  const [rascunho, setRascunho] = useState("");
  const idCampo = useId();

  function adicionar() {
    const termo = rascunho.trim();
    if (termo && !valores.includes(termo)) onChange([...valores, termo]);
    setRascunho("");
  }

  function remover(indice: number) {
    onChange(valores.filter((_, i) => i !== indice));
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    adicionar();
  }

  return (
    <CampoShell label={label} hint={hint} htmlFor={idCampo}>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            id={idCampo}
            value={rascunho}
            onChange={(evento) => setRascunho(evento.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Novo termo"
          />
          <IconButton
            name="plus"
            label="Adicionar termo"
            variant="outline"
            onClick={adicionar}
            disabled={!rascunho.trim()}
          />
        </div>
        {valores.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {valores.map((termo, indice) => (
              <Tag key={`${termo}-${indice}`} onRemove={() => remover(indice)}>
                {termo}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </CampoShell>
  );
}
