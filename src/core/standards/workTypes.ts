// Porte de `legacy/js/engine/standards.js` (`AURA_WORK_TYPES`). Ver
// docs/legado.md e docs/aura-decisoes-e-pendencias.md §2.1 para o recorte de
// porte.
//
// Ao contrário de `standards.ts` (3.1.2), esta tabela não precisou da
// auditoria do passo 3.1.1: os campos aqui são rótulo e metadado descritivo
// (nome do tipo de trabalho, norma padrão sugerida, extensão típica), não
// valor normativo da ABNT — não há NBR para conferir "TCC costuma ter 30-70
// páginas" contra. Porte 1:1 do legado.
//
// **Só `tcc` é exposto na interface da v1** (CLAUDE.md, "Escopo da v1": "Só
// TCC, só ABNT"). Os outros nove tipos ficam na tabela pela mesma razão que
// `apa`/`ieee`/`vancouver`/`chicago`/`mla` ficam em `standards.ts`: o motor
// de regras de Fase 5+ e uma v2 com mais tipos de trabalho esperam a mesma
// forma de dado pronta — não porque a v1 os ofereça a alguém.

import type { IdNorma } from "./types";

export type IdTipoTrabalho =
  | "article"
  | "paper"
  | "tcc"
  | "dissertation"
  | "thesis"
  | "research_proposal"
  | "postdoc_project"
  | "extended_abstract"
  | "academic_review"
  | "motivation_letter";

export interface TipoTrabalho {
  id: IdTipoTrabalho;
  nome: string;
  // Norma sugerida como padrão ao criar um documento deste tipo — não é
  // uma restrição: `standards.ts` continua tendo as seis, o usuário poderia
  // trocar se a v1 chegasse a oferecer troca (não oferece; ver Metadados.norma).
  normaPadrao: IdNorma;
  extensaoTipica: string;
}

// `Record<IdTipoTrabalho, TipoTrabalho>` explícito, mesmo raciocínio do
// `Record<IdNorma, Norma>` de `standards.ts`: um tipo faltando ou um `id`
// errado quebra o `typecheck` sozinho.
export const TIPOS_TRABALHO: Record<IdTipoTrabalho, TipoTrabalho> = {
  article: {
    id: "article",
    nome: "Artigo Científico",
    normaPadrao: "abnt",
    extensaoTipica: "10-25 páginas",
  },
  paper: {
    id: "paper",
    nome: "Paper para Conferência / Simpósio",
    normaPadrao: "ieee",
    extensaoTipica: "6-10 páginas",
  },
  tcc: {
    id: "tcc",
    nome: "TCC / Monografia",
    normaPadrao: "abnt",
    extensaoTipica: "30-70 páginas",
  },
  dissertation: {
    id: "dissertation",
    nome: "Dissertação de Mestrado",
    normaPadrao: "abnt",
    extensaoTipica: "80-150 páginas",
  },
  thesis: {
    id: "thesis",
    nome: "Tese de Doutorado",
    normaPadrao: "abnt",
    extensaoTipica: "120-250 páginas",
  },
  research_proposal: {
    id: "research_proposal",
    nome: "Projeto de Pesquisa (Edital/Fomento)",
    normaPadrao: "abnt",
    extensaoTipica: "10-20 páginas",
  },
  postdoc_project: {
    id: "postdoc_project",
    nome: "Projeto de Pós-Doutorado",
    normaPadrao: "abnt",
    extensaoTipica: "15-25 páginas",
  },
  extended_abstract: {
    id: "extended_abstract",
    nome: "Resumo Expandido",
    normaPadrao: "abnt",
    extensaoTipica: "3-5 páginas",
  },
  academic_review: {
    id: "academic_review",
    nome: "Resenha Crítica / Acadêmica",
    normaPadrao: "abnt",
    extensaoTipica: "3-6 páginas",
  },
  motivation_letter: {
    id: "motivation_letter",
    nome: "Carta de Motivação / Memorial",
    normaPadrao: "abnt",
    extensaoTipica: "2-4 páginas",
  },
};

// Lista separada em vez de um campo `disponivelNaV1` em cada entrada: quando
// a v1 crescer para mais tipos de trabalho, só este array muda — a tabela
// inteira (dado descritivo, não escopo de produto) fica intacta. É o que um
// seletor de tipo de trabalho deve iterar; hoje tem um item só, de propósito
// (CLAUDE.md, "Escopo da v1").
export const TIPOS_DISPONIVEIS_NA_V1: TipoTrabalho[] = [TIPOS_TRABALHO.tcc];
