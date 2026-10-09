"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import type { Achado } from "@/core/rules/compliance";
import type { EstadoConferencia } from "@/lib/useConferencia";
import type { EstadoHistorico } from "@/lib/useVersaoAutomatica";

import { EspacoIA } from "./EspacoIA";
import { PainelConferencia } from "./PainelConferencia";
import { PainelHistorico } from "./PainelHistorico";

interface PainelInspetorProps {
  // O mesmo botão da barra superior, montado por quem tem o documento.
  botaoExportar: ReactNode;
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
// lógica: a aba é o espaço reservado do 6.5.4 (`EspacoIA`).
// A chave do rodapé liga e desliga a conferência na pausa da digitação
// (passo 5.2.4).
export function PainelInspetor({
  botaoExportar,
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
        {aba === "ia" && <EspacoIA />}
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
        {botaoExportar}
      </div>
    </div>
  );
}
