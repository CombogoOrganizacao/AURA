import type { IdNorma, Norma } from "../standards/types";

// Forma de dado do motor de regras — passo 5.1.1. Porte do desenho de
// `legacy/js/engine/rulesEngine.js`, corrigido: o legado tinha três camadas
// (norma, edital, override) e só gravava o preset em `localStorage`, sem
// aplicá-lo. Aqui são as quatro de docs/aura-decisoes-e-pendencias.md §1.14:
// norma → preset de instituição → edital → override do usuário, cada uma
// sobrescrevendo a anterior.

// O que uma camada pode sobrescrever: só formatação e limites de extensão.
// Identidade da norma (`id`, `nome`), sistema de chamada e estilo de
// referência ficam de fora. Trocar o sistema de chamada por preset daria ao
// aluno uma regra que o AURA não sabe formatar (a v1 só tem autor-data), e o
// legado aceitava isso em silêncio com `Object.assign`.
export const CAMPOS_SOBRESCREVIVEIS = [
  "margens",
  "fonte",
  "espacamentoLinhas",
  "recuoParagrafo",
  "alinhamento",
  "citacaoLonga",
  "limites",
] as const satisfies readonly (keyof Norma)[];

export type CampoSobrescrevivel = (typeof CAMPOS_SOBRESCREVIVEIS)[number];

type Parcial<T> = T extends object ? { [K in keyof T]?: Parcial<T[K]> } : T;

// Uma sobrescrita traz só o que muda, em qualquer profundidade: um preset que
// pede fonte 11 não precisa repetir a família.
export type SobrescritaRegras = Parcial<Pick<Norma, CampoSobrescrevivel>>;

// Preset de instituição (5.1.3 os persiste). Nenhum vem de fábrica: o legado
// trazia presets padrão sem fonte nenhuma.
export interface PresetInstituicao {
  id: string;
  nome: string;
  regras: SobrescritaRegras;
}

// O `noticeConfig` do legado. Fica na assinatura mesmo com a Central de
// Editais fora da v1 (decisão §1.14): na v1 é sempre `null`. Mesma forma de
// sobrescrita das outras camadas, em vez dos cinco campos soltos do legado
// (`fontFamily`, `fontSize`...): quem ligar o `noticeParser` converte a saída
// dele para esta forma.
export interface ConfigEdital {
  titulo: string;
  regras: SobrescritaRegras;
}

export interface EntradaResolucao {
  norma: IdNorma;
  preset: PresetInstituicao | null;
  edital: ConfigEdital | null;
  overrides: SobrescritaRegras;
}

export type RegrasResolvidas = Norma;

export interface ResultadoResolucao {
  regras: RegrasResolvidas;
}
