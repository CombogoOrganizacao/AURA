import type { Documento, Metadados } from "../document/types";
import type { LocalCitacao } from "../references/citacoes";
import { VERIFICACOES } from "./checks";
import type { RegrasResolvidas } from "./types";

// Conferência determinística — passo 5.2.1. Código novo, não porte: o
// `evaluateCompliance` do legado procurava seções pelo título, exigia
// "metodologia" e dava notas sem base (docs/aura-decisoes-e-pendencias.md
// §1.14). Aqui cada verificação é uma regra da norma, com o item citado, e
// o resultado é uma lista de achados.
//
// **Duas gravidades e nenhuma nota.** `erro` quando a norma diz "deve" ou
// "elemento obrigatório"; `aviso` quando diz "recomenda-se", "convém", "se
// houver", ou quando a regra depende de julgamento do aluno (uma palavra-chave
// com maiúscula pode ser nome próprio). Uma nota de 0 a 100 exigiria pesos que
// nenhuma norma dá.
//
// **A conferência aponta, nunca corrige** nem escreve texto (CLAUDE.md,
// "Identidade e limite de produto"). E não confere o que o AURA gera (margem,
// fonte, paginação, ordem dos elementos): isso sai do exportador com os
// valores auditados, e o aluno não o controla.

export type Gravidade = "erro" | "aviso";

// Onde está o problema. É o que o painel (5.2.3) usa para levar o cursor até
// ele ou abrir o campo certo.
export type LocalAchado =
  // Um campo de metadado: resumo, palavras-chave, banca... O painel abre a
  // seção da coluna esquerda que edita o campo.
  | { tipo: "metadado"; campo: keyof Metadados }
  // Dentro de uma seção, apêndice ou anexo. `no` é o índice em `content`;
  // ausente, o problema é do bloco em si (um apêndice sem título). `trecho`
  // são as posições, em caracteres, no texto corrido do nó (a concatenação
  // dos `NoTexto`), para marcar a passagem exata.
  | { tipo: "bloco"; onde: LocalCitacao; no?: number; trecho?: { inicio: number; fim: number } }
  | { tipo: "referencia"; refId: string }
  // O documento como um todo: nenhuma seção, nenhuma referência.
  | { tipo: "documento" };

export interface Achado {
  // Id da regra, estável: `checks/` tem um arquivo por regra com este nome.
  regra: string;
  gravidade: Gravidade;
  // Onde a norma diz isso, ex.: "NBR 6028:2021 §4.1.2". `null` só numa regra
  // que não tem item na norma e está marcada como convenção; o painel a
  // mostra como tal, nunca como exigência da NBR.
  item: string | null;
  // Em pt-BR, dizendo o que falta ou o que diverge. Nunca propõe texto.
  mensagem: string;
  local: LocalAchado;
}

export interface ContextoConferencia {
  documento: Documento;
  regras: RegrasResolvidas;
}

// Uma regra de verificação. Devolve os achados SEM o id da regra: quem o
// carimba é `conferirDocumento()`, para uma regra não poder emitir achado em
// nome de outra.
export interface Verificacao {
  regra: string;
  verificar(contexto: ContextoConferencia): Omit<Achado, "regra">[];
}

// Roda as verificações na ordem do registro (`checks/index.ts`). O documento
// é só lido. `verificacoes` é parâmetro para os testes do próprio motor; o app
// usa o registro.
export function conferirDocumento(
  documento: Documento,
  regras: RegrasResolvidas,
  verificacoes: readonly Verificacao[] = VERIFICACOES,
): Achado[] {
  const contexto: ContextoConferencia = { documento, regras };
  return verificacoes.flatMap((verificacao) =>
    // `regra` depois do spread: um `regra` vindo da verificação (o tipo não
    // deixa, mas um cast deixaria) não sobrescreve o do registro.
    verificacao.verificar(contexto).map((achado) => ({ ...achado, regra: verificacao.regra })),
  );
}

export function contarPorGravidade(achados: readonly Achado[]): Record<Gravidade, number> {
  return {
    erro: achados.filter((achado) => achado.gravidade === "erro").length,
    aviso: achados.filter((achado) => achado.gravidade === "aviso").length,
  };
}
