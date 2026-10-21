"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import type { Documento } from "@/core/document/types";
import { usePersistencia } from "@/lib/persistence-provider";

import { PreviaPaginada } from "./PreviaPaginada";

// Botão "Prévia", ao lado de "Exportar" (passo 8.6.1): abre o trabalho em
// folhas A4, só para ler. Mostra o documento como está na tela, sem esperar o
// autosave.
export function BotaoPrevia({ documento }: { documento: Documento }) {
  const persistencia = usePersistencia();
  const [aberta, setAberta] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setAberta(true)} disabled={!persistencia}>
        Prévia
      </Button>
      {aberta && persistencia && (
        <PreviaPaginada
          documento={documento}
          persistencia={persistencia}
          onFechar={() => setAberta(false)}
        />
      )}
    </>
  );
}
