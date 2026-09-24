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

export interface Restauracao {
  // O documento como estava na versão restaurada.
  documento: Documento;
  // A versão nomeada com o texto de antes da restauração.
  anterior: ResumoVersao;
}

// Restaura uma versão (passo 5.3.3). O texto de agora não some: vira uma
// versão nomeada antes de ser substituído. Nomeada, e não automática, porque
// uma automática poderia sair pela retenção, e o aluno que restaurou por
// engano perderia o caminho de volta.
//
// A ordem protege o texto de agora:
// 1. carrega a versão, e para se ela não existe, antes de gravar qualquer
//    coisa;
// 2. grava o texto de agora como versão;
// 3. só então grava o documento restaurado por cima.
// Uma falha no passo 2 deixa o documento como estava. Uma falha no passo 3
// deixa uma versão a mais, e o texto de agora continua no documento.
//
// `nomeDoAnterior` vem de quem chama, porque o rótulo da versão (nome ou
// data formatada) é texto de interface.
export async function restaurarVersao(
  adaptador: AdaptadorPersistencia,
  atual: Documento,
  versaoId: string,
  nomeDoAnterior: string,
): Promise<Restauracao> {
  const documento = await adaptador.carregarVersao(atual.id, versaoId);
  if (!documento) {
    throw new Error("A versão não existe mais.");
  }

  const anterior = await registrarVersao(adaptador, atual, nomeDoAnterior);
  await adaptador.salvarDocumento(documento);

  return { documento, anterior };
}
