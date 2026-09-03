"use client";

import { useEffect, useRef, useState } from "react";

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
export function useAutosave<T>(
  valor: T,
  salvar: (valor: T) => Promise<void>,
  opcoes: OpcoesAutosave = {},
): StatusAutosave {
  const atrasoMs = opcoes.atrasoMs ?? ATRASO_PADRAO_MS;
  const [status, setStatus] = useState<StatusAutosave>("salvo");

  // `salvar` costuma ser uma closure nova a cada render de quem chama o
  // hook; guardar numa ref (atualizada em efeito) deixa a instância do
  // debounce abaixo estável entre renders, sem chamar uma versão velha.
  const salvarRef = useRef(salvar);
  useEffect(() => {
    salvarRef.current = salvar;
  });

  const debounceRef = useRef<Debounced<[T]> | null>(null);
  useEffect(() => {
    const executarComDebounce = debounce((valorAtual: T) => {
      setStatus("salvando");
      salvarRef.current(valorAtual).then(
        () => setStatus("salvo"),
        () => setStatus("erro"),
      );
    }, atrasoMs);
    debounceRef.current = executarComDebounce;

    return () => {
      // Desmontou (ou o atraso mudou) com uma escrita pendente: cancela —
      // não é papel de um componente fora da tela disparar uma escrita atrasada.
      executarComDebounce.cancelar();
      debounceRef.current = null;
    };
  }, [atrasoMs]);

  const primeiraExecucao = useRef(true);
  useEffect(() => {
    if (primeiraExecucao.current) {
      primeiraExecucao.current = false;
      return;
    }
    setStatus("pendente");
    debounceRef.current?.(valor);
  }, [valor]);

  return status;
}
