"use client";

import { useSyncExternalStore } from "react";

import { Alert } from "@/components/ui/Alert";

// Aviso de que o editor não simula quebra de página (passo 3.3.3) — a folha
// A4 (`PaperSheet.tsx`) recorta o que passa da altura (`overflow: hidden`),
// mas não quebra em página 2 nem numera: a paginação de verdade só existe no
// `.docx` exportado (conferida no Word, não aqui). Ver o comentário em
// `Editor.tsx` que reserva este lugar pra este componente.
//
// Dispensável e permanente depois de dispensado — ao contrário de
// `AvisoAmbienteInterno` (nunca se esconde, ver o comentário lá). Preferência
// de UI, não dado de `Documento` — por isso `localStorage` direto, sem
// `AdaptadorPersistencia` (CLAUDE.md), mesmo padrão de
// `criarPreferenciaBooleana()` em `LayoutEdicao.tsx`: `useSyncExternalStore`
// evita o mismatch de hidratação (servidor não tem `window`) sem precisar de
// `setState` dentro de efeito.
const CHAVE_DISPENSADO = "aura:aviso:paginacao-dispensada";
const EVENTO = `aura:pref:${CHAVE_DISPENSADO}`;

function obterInstantaneo(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CHAVE_DISPENSADO) === "1";
}

function obterInstantaneoServidor(): boolean {
  return false;
}

function inscrever(notificar: () => void): () => void {
  window.addEventListener(EVENTO, notificar);
  return () => window.removeEventListener(EVENTO, notificar);
}

function dispensar(): void {
  window.localStorage.setItem(CHAVE_DISPENSADO, "1");
  window.dispatchEvent(new Event(EVENTO));
}

export function AvisoPaginacao() {
  const dispensado = useSyncExternalStore(inscrever, obterInstantaneo, obterInstantaneoServidor);

  if (dispensado) return null;

  return (
    <Alert
      tone="info"
      title="Esta tela não mostra quebra de página"
      onDismiss={dispensar}
      className="mx-4 mt-3 shrink-0"
    >
      É assim de propósito: a paginação real — quebras e numeração — sai só no arquivo .docx
      exportado.
    </Alert>
  );
}
