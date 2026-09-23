"use client";

import { useState } from "react";

import { BotaoExportar } from "@/components/editor/BotaoExportar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EstadoVazio } from "@/components/ui/Estados";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import type { Achado } from "@/core/rules/compliance";

import { PainelConferencia } from "./PainelConferencia";

interface PainelInspetorProps {
  documentoId: string;
  achados: readonly Achado[];
  onIrPara: (achado: Achado) => void;
}

type Aba = "ia" | "historico" | "conformidade";

// Coluna direita do editor (passo 2B.11). A aba Conformidade tem conteúdo
// desde o passo 5.2.3, e o `count` dela é a contagem real de achados da
// conferência: só agora existe um número que não seria fabricado (mesma regra
// do 2B.8/2B.10). IA e histórico seguem sem lógica (histórico é o 5.3).
export function PainelInspetor({ documentoId, achados, onIrPara }: PainelInspetorProps) {
  const [aba, setAba] = useState<Aba>("conformidade");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-4">
        <Tabs
          value={aba}
          onChange={(id) => setAba(id as Aba)}
          items={[
            { id: "ia", label: "IA", icon: <Icon name="sparkles" size={15} /> },
            { id: "historico", label: "Histórico", icon: <Icon name="history" size={15} /> },
            {
              id: "conformidade",
              label: "Conformidade",
              count: achados.length > 0 ? achados.length : undefined,
            },
          ]}
        />
      </div>

      <div className="flex-1 overflow-auto p-4">
        {aba === "ia" && <PainelIA />}
        {aba === "historico" && (
          <EstadoVazio
            titulo="Sem histórico ainda"
            descricao="O histórico de versões chega na Fase 5."
          />
        )}
        {aba === "conformidade" && <PainelConferencia achados={achados} onIrPara={onIrPara} />}
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 border-t border-[var(--border-subtle)] bg-sunken px-4 py-3">
        <Switch
          disabled
          label="Verificar enquanto escrevo"
          description="Chega com o motor de conformidade (Fase 5)."
        />
        <BotaoExportar documentoId={documentoId} />
      </div>
    </div>
  );
}

// Estado desativado — sem integração de API ainda (CLAUDE.md, "Escopo da
// v1"). As três sugestões esmaecidas sob o véu são exemplo do que a Fase 6
// vai oferecer, não algo que se possa clicar hoje (`pointerEvents: none`
// coberto pelo véu por cima, não um estado real de "carregando").
function PainelIA() {
  const sugestoes = [
    "Resuma esta seção em um parágrafo",
    "Sugira uma transição entre as seções",
    "Reescreva o trecho selecionado em tom formal",
  ];

  return (
    <div className="relative flex flex-col gap-4">
      <div aria-hidden="true" className="flex flex-col gap-3 opacity-35 grayscale">
        {sugestoes.map((sugestao) => (
          <div
            key={sugestao}
            className="flex items-center gap-2.5 rounded-md border border-[var(--border-subtle)] px-3 py-2.5 font-sans text-xs text-body"
          >
            <Icon name="sparkles" size={15} />
            {sugestao}
          </div>
        ))}
        <div className="min-h-16 rounded-md border border-[var(--border-subtle)] px-3 py-2.5 font-sans text-xs text-subtle">
          Pergunte algo sobre o documento…
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[rgba(250,247,242,0.72)] to-card px-1 text-center">
        <span className="flex size-10.5 items-center justify-center rounded-lg bg-sunken text-subtle">
          <Icon name="sparkles" size={20} />
        </span>
        <Badge>Desativado</Badge>
        <p className="max-w-[30ch] font-sans text-xs leading-relaxed text-muted">
          O assistente de escrita será ativado quando a integração de API estiver disponível. Você
          também poderá usar sua própria chave.
        </p>
        <Button size="sm" variant="outline" disabled>
          Conectar chave de API
        </Button>
      </div>
    </div>
  );
}
