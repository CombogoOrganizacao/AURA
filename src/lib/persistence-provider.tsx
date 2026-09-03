"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { criarAdaptadorIndexedDB } from "@/core/persistence/indexeddb";
import type { AdaptadorPersistencia } from "@/core/persistence/types";

// Única linha que decide qual adaptador está ativo. Trocar para o adaptador
// Firestore (quando entrar, ver docs/aura-decisoes-e-pendencias.md §1.11) é
// mudar esta linha — nenhum componente importa `indexeddb.ts` nem, depois,
// `firestore.ts` direto; todos passam por `usePersistencia()`.
const criarAdaptadorAtivo = criarAdaptadorIndexedDB;

// `undefined` = usado fora do provider (erro de uso). `null` = provider
// montado, adaptador ainda abrindo (IndexedDB é assíncrono). Distinguir os
// dois é o que permite `usePersistencia` reclamar alto de um provider
// esquecido sem confundir isso com o estado normal de carregamento.
const PersistenciaContext = createContext<AdaptadorPersistencia | null | undefined>(undefined);

export function PersistenciaProvider({ children }: { children: ReactNode }) {
  const [adaptador, setAdaptador] = useState<AdaptadorPersistencia | null>(null);

  useEffect(() => {
    let cancelado = false;

    criarAdaptadorAtivo().then((instancia) => {
      if (!cancelado) setAdaptador(instancia);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  return <PersistenciaContext.Provider value={adaptador}>{children}</PersistenciaContext.Provider>;
}

// Devolve `null` enquanto o adaptador ainda não abriu — quem consome decide
// como tratar a espera (nenhuma UI de carregamento é imposta aqui).
export function usePersistencia(): AdaptadorPersistencia | null {
  const valor = useContext(PersistenciaContext);
  if (valor === undefined) {
    throw new Error("usePersistencia precisa ser usado dentro de <PersistenciaProvider>");
  }
  return valor;
}
