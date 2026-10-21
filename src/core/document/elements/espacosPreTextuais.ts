import type { PapelLinhaPreTextual } from "./linhaPreTextual";

// Espaço vertical, em twips (1/20 de ponto), ANTES da primeira linha de cada
// papel na capa, na folha de rosto e na folha de aprovação. É o que distribui
// os elementos pela folha em vez de amontoá-los no topo.
//
// **Convenção do AURA, não da norma**: a NBR 14724 só enumera os elementos da
// capa e da folha de rosto. Os valores são os da PoC congelada, conferidos no
// Word. Moram aqui, e não no exportador, porque o `.docx` e a prévia paginada
// (`core/preview`) os leem: duas cópias divergiriam na primeira mudança.

type Espacos = Partial<Record<PapelLinhaPreTextual, number>>;

export const ESPACOS_CAPA: Espacos = {
  autor: 3000,
  tituloDoTrabalho: 3000,
  local: 4000,
};

export const ESPACOS_FOLHA_DE_ROSTO: Espacos = {
  tituloDoTrabalho: 2400,
  natureza: 1200,
  orientador: 600,
  local: 2400,
};

// Menores que os da folha de rosto porque a banca ocupa a metade de baixo.
export const ESPACOS_FOLHA_DE_APROVACAO: Espacos = {
  tituloDoTrabalho: 1200,
  natureza: 600,
  dataAprovacao: 600,
};

// Espaço antes de CADA assinatura (e não só da primeira): é o lugar da
// assinatura à mão, e cada membro da banca precisa do seu.
export const ESPACO_ANTES_DA_ASSINATURA = 720;
