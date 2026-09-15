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

export interface LinhaPreTextual {
  texto: string;
  alinhamento: AlinhamentoLinhaPreTextual;
  // Título de elemento pré-textual (NBR 14724 §5.4) — centralizado, sem
  // indicativo numérico, e fora do sumário (NBR 6027). Quem exporta usa isso
  // pra escolher o estilo nomeado `TituloPreTextual` em vez de texto comum.
  titulo?: boolean;
}

export function linhaCentro(texto: string): LinhaPreTextual {
  return { texto, alinhamento: "centro" };
}

export function linhaTitulo(texto: string): LinhaPreTextual {
  return { texto, alinhamento: "centro", titulo: true };
}
