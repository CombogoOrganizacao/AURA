// Vocabulário comum dos elementos pré-textuais gerados a partir de
// `Metadados` — capa e folha de rosto (3.5.1), dedicatória/agradecimentos/
// epígrafe (3.5.3). Cada um devolve uma lista ordenada de linhas com o que a
// NBR 14724 manda sobre ORDEM e ALINHAMENTO; a tipografia real (tamanho,
// negrito, caixa alta) e as unidades de página (cm, twips) são decisão de
// quem consome — `src/core/export/docx/` ou a tela.
//
// Extraído de `capa.ts` no passo 3.5.3, exatamente na condição que o 3.5.1
// registrou pra isso acontecer: um terceiro consumidor do mesmo tipo. Antes
// disso seriam duas linhas de tipo num arquivo só pra si.

// A norma centraliza a capa e a folha de rosto inteiras, com uma exceção: a
// nota de natureza do trabalho, "recuada a partir do meio da mancha gráfica
// para a margem direita" (NBR 14724 §5.2). Dedicatória e epígrafe usam o
// mesmo recuo por CONVENÇÃO, não por texto normativo — ver
// `opcionaisPreTextuais.ts`.
export type AlinhamentoLinhaPreTextual = "centro" | "recuada-a-direita" | "justificado";

// O que a linha É, segundo a enumeração da norma (§5.1 e §5.2 listam os
// elementos da capa e da folha de rosto um a um: instituição, autor, título,
// natureza, orientador, local, ano). Guardar o papel é guardar o que a norma
// diz — jogá-lo fora deixaria só uma pilha de strings anônimas, e quem
// exporta teria que adivinhar pela posição qual linha é o título.
//
// **Não é tipografia.** Negrito, caixa alta e a distribuição vertical da capa
// continuam sendo decisão de quem consome (`export/docx/preTextuais.ts`) — o
// papel é o que permite tomá-la sem chutar. Opcional porque dedicatória,
// agradecimentos e epígrafe são texto livre, sem papel definido pela norma.
//
// `tituloDoTrabalho` e não `titulo`: `titulo` já é o campo booleano abaixo, e
// quer dizer outra coisa — "esta linha é um TÍTULO DE ELEMENTO", como
// "AGRADECIMENTOS". Aqui é o título do trabalho em si.
export type PapelLinhaPreTextual =
  | "instituicao"
  | "autor"
  | "tituloDoTrabalho"
  | "natureza"
  | "orientador"
  | "local"
  | "ano";

export interface LinhaPreTextual {
  texto: string;
  alinhamento: AlinhamentoLinhaPreTextual;
  papel?: PapelLinhaPreTextual;
  // Título de elemento pré-textual (NBR 14724 §5.4) — centralizado, sem
  // indicativo numérico, e fora do sumário (NBR 6027). Quem exporta usa isso
  // pra escolher o estilo nomeado `TituloPreTextual` em vez de texto comum.
  titulo?: boolean;
}

export function linhaCentro(texto: string, papel?: PapelLinhaPreTextual): LinhaPreTextual {
  return papel ? { texto, alinhamento: "centro", papel } : { texto, alinhamento: "centro" };
}

export function linhaTitulo(texto: string): LinhaPreTextual {
  return { texto, alinhamento: "centro", titulo: true };
}
