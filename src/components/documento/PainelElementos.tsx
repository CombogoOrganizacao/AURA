"use client";

import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import type { ElementoOpcional, Metadados } from "@/core/document/types";

interface PainelElementosProps {
  metadados: Metadados;
  onChange: (atualizador: (atual: Metadados) => Metadados) => void;
}

// Só os três elementos cujo estado é "existe ou não existe" — dedicatória,
// agradecimentos, epígrafe (NBR 14724 §4.2.1, passo 3.5.3). Resumo e
// abstract NÃO entram aqui: lá, campo vazio já significa desligado
// (`Resumo.tsx`/`Abstract.tsx`, 3.5.2), e um interruptor a mais seria um
// segundo jeito de dizer a mesma coisa.
type CampoOpcional = "dedicatoria" | "agradecimentos" | "epigrafe";

const ELEMENTOS: { campo: CampoOpcional; label: string; descricao: string; dica: string }[] = [
  {
    campo: "dedicatoria",
    label: "Dedicatória",
    descricao: "Folha de homenagem, sem título.",
    dica: "Vai recuada à direita, na parte de baixo da folha.",
  },
  {
    campo: "agradecimentos",
    label: "Agradecimentos",
    descricao: "Única das três com título centralizado.",
    dica: "Uma linha em branco separa parágrafos.",
  },
  {
    campo: "epigrafe",
    label: "Epígrafe",
    descricao: "Citação com indicação de autoria, sem título.",
    dica: "Escreva a autoria na última linha — ela sai como um parágrafo próprio.",
  },
];

// Painel de composição: liga e desliga cada elemento opcional. Desligar
// **preserva** o texto (ver `ElementoOpcional` em core/document/types.ts) —
// é o motivo de existir um interruptor em vez de "apague para remover".
export function PainelElementos({ metadados, onChange }: PainelElementosProps) {
  function atualizar(campo: CampoOpcional, valor: Partial<ElementoOpcional>) {
    onChange((atual) => ({
      ...atual,
      [campo]: { ativo: false, texto: "", ...atual[campo], ...valor },
    }));
  }

  return (
    <div className="flex flex-col gap-5 font-sans">
      {ELEMENTOS.map(({ campo, label, descricao, dica }) => {
        const elemento = metadados[campo];
        const ligado = Boolean(elemento?.ativo);

        return (
          <div key={campo} className="flex flex-col gap-2">
            <Switch
              label={label}
              description={descricao}
              checked={ligado}
              onChange={(evento) => atualizar(campo, { ativo: evento.target.checked })}
            />
            {ligado && (
              <Textarea
                label={`Texto — ${label.toLowerCase()}`}
                hint={dica}
                value={elemento?.texto ?? ""}
                onChange={(evento) => atualizar(campo, { texto: evento.target.value })}
                rows={5}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
