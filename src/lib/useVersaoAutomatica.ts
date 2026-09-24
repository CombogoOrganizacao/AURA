"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Documento } from "@/core/document/types";
import type { AdaptadorPersistencia, ResumoVersao } from "@/core/persistence/types";
import { criarAgendadorDeVersao, type AgendadorDeVersao } from "@/core/persistence/versaoAutomatica";
import { registrarVersao } from "@/core/persistence/versions";

export interface EstadoHistorico {
  // Da mais recente para a mais antiga; `null` enquanto carrega.
  versoes: ResumoVersao[] | null;
  // A última versão automática não foi gravada.
  falhouAutomatica: boolean;
  salvarNomeada: (nome: string) => Promise<void>;
}

// Histórico de versões do documento aberto (passo 5.3.2). A regra de quando
// gravar é `criarAgendadorDeVersao` (src/core/persistence/versaoAutomatica.ts,
// testada com timers falsos); a retenção é `registrarVersao`. Este hook só
// liga os dois ao ciclo de vida do React e mantém a lista que o painel mostra.
//
// O agendador nasce com o documento como foi aberto. As mudanças chegam por
// efeito, e a primeira execução é pulada, como no `useAutosave`: abrir o
// documento não é uma edição.
export function useVersaoAutomatica(
  documento: Documento,
  persistencia: AdaptadorPersistencia,
): EstadoHistorico {
  const [versoes, setVersoes] = useState<ResumoVersao[] | null>(null);
  const [falhouAutomatica, setFalhouAutomatica] = useState(false);

  const documentoRef = useRef(documento);
  useEffect(() => {
    documentoRef.current = documento;
  });

  const agendadorRef = useRef<AgendadorDeVersao | null>(null);
  const documentoId = documento.id;
  useEffect(() => {
    let ativo = true;
    // Relista depois de cada versão: a retenção pode ter tirado as antigas.
    const recarregar = () =>
      persistencia.listarVersoes(documentoId).then((lista) => {
        if (ativo) setVersoes(lista);
      });

    const agendador = criarAgendadorDeVersao({
      documentoInicial: documentoRef.current,
      registrar: (atual, nome) => registrarVersao(persistencia, atual, nome),
      aoRegistrar: (versao) => {
        if (!ativo) return;
        if (versao.automatica) setFalhouAutomatica(false);
        void recarregar();
      },
      aoFalhar: () => {
        if (ativo) setFalhouAutomatica(true);
      },
    });
    agendadorRef.current = agendador;
    void recarregar();

    return () => {
      ativo = false;
      agendador.encerrar();
      agendadorRef.current = null;
    };
  }, [persistencia, documentoId]);

  const primeiraExecucao = useRef(true);
  useEffect(() => {
    if (primeiraExecucao.current) {
      primeiraExecucao.current = false;
      return;
    }
    agendadorRef.current?.mudou(documento);
  }, [documento]);

  const salvarNomeada = useCallback(async (nome: string) => {
    await agendadorRef.current?.salvarNomeada(documentoRef.current, nome);
  }, []);

  return { versoes, falhouAutomatica, salvarNomeada };
}
