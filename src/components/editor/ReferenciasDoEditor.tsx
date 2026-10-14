"use client";

import { createContext, useContext } from "react";

import type { Referencia } from "@/core/references/types";

// As referências do documento, para os node views que desenham texto
// sintetizado delas: hoje, a citação com o autor na frase
// (`CitacaoNarrativaView.tsx`). Mesmo padrão de `ImagensDoDocumento.tsx`: o
// nó guarda só o `refId`, e quem desenha recebe daqui o resto.
//
// As chamadas entre parênteses não precisam disto: são decoração do plugin
// `chamadas.ts`, que recebe as referências por transação. Um node view é
// componente React, e o contexto é o caminho dele.
const Contexto = createContext<readonly Referencia[]>([]);

export const ProvedorReferencias = Contexto.Provider;

export function useReferenciasDoEditor(): readonly Referencia[] {
  return useContext(Contexto);
}
