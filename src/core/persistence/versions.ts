import type { Documento } from "../document/types";
import type { AdaptadorPersistencia, ResumoVersao } from "./types";

// Histórico de versões — passo 5.3.1. Snapshot do documento inteiro, não
// diff; retenção de ~30 automáticos e de todos os nomeados
// (docs/aura-decisoes-e-pendencias.md §1.11).
//
// A política mora aqui, escrita só sobre `AdaptadorPersistencia`, e não
// dentro de cada adaptador: o IndexedDB de hoje e o Firestore de depois
// aplicam a mesma regra, e ela é testada uma vez só.

// Quantas versões automáticas ficam. As nomeadas não contam nem saem: foram
// pedidas pelo aluno, e só ele deveria apagá-las.
export const LIMITE_VERSOES_AUTOMATICAS = 30;

export function maisRecentePrimeiro(versoes: readonly ResumoVersao[]): ResumoVersao[] {
  return [...versoes].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
}

// As versões automáticas além das `limite` mais recentes. Não depende da
// ordem em que chegam.
export function versoesExcedentes(
  versoes: readonly ResumoVersao[],
  limite: number = LIMITE_VERSOES_AUTOMATICAS,
): ResumoVersao[] {
  return maisRecentePrimeiro(versoes)
    .filter((versao) => versao.automatica)
    .slice(limite);
}

// Grava uma versão e, em seguida, apaga as automáticas excedentes. Sem
// `nome`, a versão é automática.
//
// A gravação vem antes da limpeza: se a limpeza falhar no meio, sobra versão
// demais, nunca de menos. No Firestore isso não é uma transação, e a próxima
// chamada termina a limpeza.
export async function registrarVersao(
  adaptador: AdaptadorPersistencia,
  documento: Documento,
  nome?: string,
): Promise<ResumoVersao> {
  const nomeLimpo = nome?.trim();
  // Um nome em branco não pode virar versão automática em silêncio: ela
  // entraria na fila de descarte que o aluno pensou ter evitado.
  if (nomeLimpo === "") {
    throw new Error("O nome da versão está em branco.");
  }

  const salva = await adaptador.salvarVersao(documento, nomeLimpo);

  const excedentes = versoesExcedentes(await adaptador.listarVersoes(documento.id));
  for (const versao of excedentes) {
    await adaptador.excluirVersao(documento.id, versao.id);
  }

  return salva;
}
