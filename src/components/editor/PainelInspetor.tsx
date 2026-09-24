"use client";

import { useState } from "react";

import { BotaoExportar } from "@/components/editor/BotaoExportar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import type { Achado } from "@/core/rules/compliance";
import type { EstadoConferencia } from "@/lib/useConferencia";
import type { EstadoHistorico } from "@/lib/useVersaoAutomatica";

import { PainelConferencia } from "./PainelConferencia";
import { PainelHistorico } from "./PainelHistorico";

interface PainelInspetorProps {
  documentoId: string;
  conferencia: EstadoConferencia;
  historico: EstadoHistorico;
  verificarEnquantoEscrevo: boolean;
  onVerificarEnquantoEscrevoChange: (ligar: boolean) => void;
  onIrPara: (achado: Achado) => void;
}

type Aba = "ia" | "historico" | "conformidade";

// Coluna direita do editor (passo 2B.11). A aba Conformidade tem conteúdo
// desde o passo 5.2.3, e o `count` dela é a contagem real de achados da
// conferência: só agora existe um número que não seria fabricado (mesma regra
// do 2B.8/2B.10). O histórico tem conteúdo desde o 5.3.2; a IA segue sem
// lógica.
// A chave do rodapé liga e desliga a conferência na pausa da digitação
// (passo 5.2.4).
export function PainelInspetor({
  documentoId,
  conferencia,
  historico,
  verificarEnquantoEscrevo,
  onVerificarEnquantoEscrevoChange,
  onIrPara,
}: PainelInspetorProps) {
  const [aba, setAba] = useState<Aba>("conformidade");
  const { achados } = conferencia;

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
        {aba === "historico" && <PainelHistorico historico={historico} />}
        {aba === "conformidade" && (
          <PainelConferencia
            achados={achados}
            // Com a chave ligada, o atraso é só a pausa da digitação, e
            // avisar a cada tecla faria o painel piscar.
            desatualizada={conferencia.desatualizada && !verificarEnquantoEscrevo}
            onConferirAgora={conferencia.conferirAgora}
            onIrPara={onIrPara}
          />
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 border-t border-[var(--border-subtle)] bg-sunken px-4 py-3">
        <Switch
          checked={verificarEnquantoEscrevo}
          onChange={(evento) => onVerificarEnquantoEscrevoChange(evento.target.checked)}
          label="Verificar enquanto escrevo"
          description={
            verificarEnquantoEscrevo
              ? "Confere a cada pausa na digitação."
              : "Confere só quando você pedir."
          }
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
