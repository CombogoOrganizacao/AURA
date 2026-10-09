"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { debounce, type Debounced } from "@/core/utils/debounce";

export type StatusAutosave = "salvo" | "pendente" | "salvando" | "erro";

interface OpcoesAutosave {
  // Padrão no meio do intervalo de 3–5s pedido pelo passo 1.3.6 do to-do.
  atrasoMs?: number;
}

const ATRASO_PADRAO_MS = 4000;

// Autosave genérico com debounce (passo 1.3.6) — a lógica de coalescer
// chamadas é a de `debounce` (src/core/utils/debounce.ts, testada lá com
// timers falsos); este hook só liga isso ao ciclo de vida do React e expõe
// um status pra UI mostrar "salvando"/"salvo".
//
// `salvar` e a instância de `debounce` só são lidos/criados dentro de
// `useEffect`, nunca durante o corpo da renderização — é o que a regra
// `react-hooks/refs` exige (ler `ref.current` fora de efeito/handler pode
// quebrar sob memoização automática).
//
// Não salva na primeira renderização — só quando `valor` muda de fato, pra
// abrir uma tela existente não disparar uma escrita sem edição nenhuma.
//
// `salvarAgora` (passo 6.1.2, correção): grava já o valor mais recente e
// descarta a escrita que esperava o debounce. É o que o botão de exportar
// usa, para o que foi exportado estar também salvo.
//
// **"Salvo" só quando o que está na tela foi gravado** (achado no 6.6.5).
// Uma gravação que termina depois de chegar uma mudança nova não pode
// declarar "salvo": ela gravou a versão de antes. Até ali era o que
// acontecia, e a tela dizia "Salvo" por até 4 s com a última tecla fora do
// IndexedDB; quem recarregasse ou fechasse a aba nesse intervalo a perdia.
// Cada mudança incrementa `versaoRef`, e a gravação só fecha o status se a
// versão que ela levou ainda é a atual.
export interface Autosave {
  status: StatusAutosave;
  salvarAgora: () => Promise<void>;
}

export function useAutosave<T>(
  valor: T,
  salvar: (valor: T) => Promise<void>,
  opcoes: OpcoesAutosave = {},
): Autosave {
  const atrasoMs = opcoes.atrasoMs ?? ATRASO_PADRAO_MS;
  const [status, setStatus] = useState<StatusAutosave>("salvo");

  // `salvar` costuma ser uma closure nova a cada render de quem chama o
  // hook; guardar numa ref (atualizada em efeito) deixa a instância do
  // debounce abaixo estável entre renders, sem chamar uma versão velha.
  const salvarRef = useRef(salvar);
  useEffect(() => {
    salvarRef.current = salvar;
  });

  const versaoRef = useRef(0);
  // As gravações rodam uma depois da outra, na ordem em que começaram. Duas
  // em paralelo poderiam terminar fora de ordem, e a mais velha gravaria o
  // conteúdo antigo por cima do novo.
  const filaRef = useRef<Promise<unknown>>(Promise.resolve());
  const gravarEmOrdem = useCallback((valorAtual: T) => {
    const gravacao = filaRef.current.then(() => salvarRef.current(valorAtual));
    filaRef.current = gravacao.catch(() => undefined);
    return gravacao;
  }, []);
  // Fecha o status de uma gravação que levou a versão `versao`. Se chegou
  // mudança depois, o status continua "pendente": a próxima gravação já está
  // marcada pelo debounce e é ela que vai dizer "salvo".
  const concluir = useCallback((versao: number, resultado: "salvo" | "erro") => {
    if (versaoRef.current === versao) setStatus(resultado);
  }, []);

  const debounceRef = useRef<Debounced<[T]> | null>(null);
  useEffect(() => {
    const executarComDebounce = debounce((valorAtual: T) => {
      const versao = versaoRef.current;
      setStatus("salvando");
      gravarEmOrdem(valorAtual).then(
        () => concluir(versao, "salvo"),
        () => concluir(versao, "erro"),
      );
    }, atrasoMs);
    debounceRef.current = executarComDebounce;

    return () => {
      // Desmontou (ou o atraso mudou) com uma escrita pendente: cancela —
      // não é papel de um componente fora da tela disparar uma escrita atrasada.
      executarComDebounce.cancelar();
      debounceRef.current = null;
    };
  }, [atrasoMs, concluir, gravarEmOrdem]);

  const valorRef = useRef(valor);
  const primeiraExecucao = useRef(true);
  useEffect(() => {
    valorRef.current = valor;
    if (primeiraExecucao.current) {
      primeiraExecucao.current = false;
      return;
    }
    versaoRef.current += 1;
    setStatus("pendente");
    debounceRef.current?.(valor);
  }, [valor]);

  const salvarAgora = useCallback(async () => {
    debounceRef.current?.cancelar();
    const versao = versaoRef.current;
    setStatus("salvando");
    try {
      await gravarEmOrdem(valorRef.current);
      concluir(versao, "salvo");
    } catch (erro) {
      concluir(versao, "erro");
      throw erro;
    }
  }, [concluir, gravarEmOrdem]);

  return { status, salvarAgora };
}
