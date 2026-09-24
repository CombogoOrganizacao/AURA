import type { Documento } from "../document/types";
import type { ResumoVersao } from "./types";

// Versão automática — passo 5.3.2. "Automático a cada ~10 min se houve
// mudança" (docs/aura-decisoes-e-pendencias.md §1.11).
//
// A primeira mudança depois de uma versão arma um temporizador de 10 min, e
// as mudanças seguintes não o reiniciam: é um teto de uma versão a cada
// 10 min de edição, não um debounce. Com debounce, quem escreve sem parar
// por uma hora não ganharia versão nenhuma. Sem mudança, nada fica armado,
// e 10 min parado não gera versão.
//
// "Houve mudança" é conferido no conteúdo, e não só no aviso de que algo
// mudou: digitar e desfazer volta ao texto da última versão, e uma versão
// idêntica à anterior seria ruído no histórico.
//
// Só `setTimeout`/`clearTimeout`, como `utils/debounce.ts`: por isso fica em
// `src/core` e é testado com timers falsos. O hook que liga isto ao React é
// `src/lib/useVersaoAutomatica.ts`.

export const INTERVALO_VERSAO_AUTOMATICA_MS = 10 * 60 * 1000;

interface OpcoesAgendador {
  // O documento como foi aberto: a base contra a qual "houve mudança" é
  // medido até a primeira versão.
  documentoInicial: Documento;
  // Grava a versão. Sem `nome`, automática. É `registrarVersao()` com o
  // adaptador de persistência, na tela.
  registrar: (documento: Documento, nome?: string) => Promise<ResumoVersao>;
  // Avisado a cada versão gravada, automática ou nomeada.
  aoRegistrar?: (versao: ResumoVersao) => void;
  // Avisado quando a versão automática falha. A mudança continua pendente,
  // e a próxima edição arma o temporizador de novo.
  aoFalhar?: (erro: unknown) => void;
  intervaloMs?: number;
}

export interface AgendadorDeVersao {
  // O documento mudou. Guarda o mais recente e arma o temporizador, se
  // ainda não estiver armado.
  mudou(documento: Documento): void;
  // Versão nomeada, na hora. Passa a ser a base: a automática seguinte só
  // sai se o texto mudar depois dela.
  salvarNomeada(documento: Documento, nome: string): Promise<ResumoVersao>;
  // O documento foi trocado por inteiro (uma versão restaurada, 5.3.3): ele
  // passa a ser a base e o mais recente, e a automática em espera é
  // desarmada. Sem isso, a automática seguinte gravaria uma cópia da versão
  // que acabou de ser restaurada.
  definirBase(documento: Documento): void;
  // Desarma o temporizador, sem gravar. O documento em si já está salvo
  // pelo autosave; o que se perde é só a versão automática em espera.
  encerrar(): void;
}

export function criarAgendadorDeVersao({
  documentoInicial,
  registrar,
  aoRegistrar,
  aoFalhar,
  intervaloMs = INTERVALO_VERSAO_AUTOMATICA_MS,
}: OpcoesAgendador): AgendadorDeVersao {
  let base = JSON.stringify(documentoInicial);
  let atual = documentoInicial;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let encerrado = false;

  function desarmar() {
    if (temporizador !== undefined) {
      clearTimeout(temporizador);
      temporizador = undefined;
    }
  }

  async function gravarAutomatica() {
    temporizador = undefined;
    const documento = atual;
    const conteudo = JSON.stringify(documento);
    if (conteudo === base) return;

    try {
      const versao = await registrar(documento);
      base = conteudo;
      aoRegistrar?.(versao);
    } catch (erro) {
      aoFalhar?.(erro);
    }
  }

  return {
    mudou(documento) {
      if (encerrado) return;
      atual = documento;
      if (temporizador === undefined) {
        temporizador = setTimeout(() => void gravarAutomatica(), intervaloMs);
      }
    },

    async salvarNomeada(documento, nome) {
      const versao = await registrar(documento, nome);
      base = JSON.stringify(documento);
      aoRegistrar?.(versao);
      return versao;
    },

    definirBase(documento) {
      base = JSON.stringify(documento);
      atual = documento;
      desarmar();
    },

    encerrar() {
      encerrado = true;
      desarmar();
    },
  };
}
