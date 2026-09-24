"use client";

import { useCallback, useEffect, useState } from "react";

import type { Documento } from "@/core/document/types";
import { conferirDocumento, type Achado } from "@/core/rules/compliance";
import type { RegrasResolvidas } from "@/core/rules/types";

interface OpcoesConferencia {
  // "Verificar enquanto escrevo". Desligado, a conferência só roda quando o
  // aluno pede (`conferirAgora`).
  ativa: boolean;
  atrasoMs?: number;
}

export interface EstadoConferencia {
  achados: readonly Achado[];
  // O documento mudou depois da última conferência. Os achados apontam para
  // trechos que podem ter mudado de lugar.
  desatualizada: boolean;
  conferirAgora: () => void;
}

// Uma pausa curta: a conferência deve responder a quem parou de digitar para
// olhar o painel, e não esperar o autosave (4 s).
const ATRASO_PADRAO_MS = 1000;

// Conferência sob debounce (passo 5.2.4). Até o 5.2.3 o `useMemo` rodava
// `conferirDocumento` a cada tecla. Medida em 24/09/2026: ~4 ms num corpo de
// 126 mil palavras, então não é o cálculo que pesa, e um Web Worker seria
// custo sem ganho. O que o debounce evita é refazer os achados, e com eles o
// painel inteiro, a cada tecla.
//
// O debounce é o do próprio efeito: cada mudança de `documento` limpa o
// temporizador da anterior, e só a última pausa confere.
//
// A primeira conferência é síncrona, no estado inicial: abrir um documento
// mostra os achados já na primeira pintura, sem uma espera vazia.
export function useConferencia(
  documento: Documento,
  regras: RegrasResolvidas,
  { ativa, atrasoMs = ATRASO_PADRAO_MS }: OpcoesConferencia,
): EstadoConferencia {
  const [resultado, setResultado] = useState(() => ({
    documento,
    achados: conferirDocumento(documento, regras),
  }));

  const conferirAgora = useCallback(() => {
    setResultado({ documento, achados: conferirDocumento(documento, regras) });
  }, [documento, regras]);

  const desatualizada = resultado.documento !== documento;

  useEffect(() => {
    if (!ativa || !desatualizada) return;
    const temporizador = setTimeout(conferirAgora, atrasoMs);
    return () => clearTimeout(temporizador);
  }, [ativa, desatualizada, conferirAgora, atrasoMs]);

  return { achados: resultado.achados, desatualizada, conferirAgora };
}
