import type { IdNorma } from "../standards/types";

// Quanto pesa cada campo da norma — passo 5.1.2. Um conflito só "contraria
// a norma" quando o campo sobrescrito é obrigação no texto da NBR. Os valores
// da tabela `NORMAS` não são todos obrigação: parte é recomendação ("recomenda-
// se", "convém") e parte é convenção que o AURA adotou sem item na norma
// (docs/auditoria-abnt.md). Um preset que muda o recuo de parágrafo de 1,25
// para 1,5 cm não viola NBR nenhuma, e avisar como violação seria alarme falso.
//
// Cada item abaixo foi relido no PDF em 23/09/2026 (NBR 14724:2024 §5.1 e
// §5.2, NBR 10520:2023 §7.1.1, NBR 6028:2021 §4.1.8).
export type ForcaRegra =
  // "deve": sobrescrever torna o documento não conforme.
  | "norma"
  // "recomenda-se" / "convém": o documento continua conforme.
  | "recomendacao"
  // Valor adotado pelo AURA sem item correspondente na norma.
  | "convencao"
  // Norma cujos valores não foram auditados (todas menos a ABNT).
  | "nao-auditada";

export interface BaseDoCampo {
  rotulo: string;
  forca: ForcaRegra;
  // Onde a norma diz isso. `null` na convenção, que não tem item.
  item: string | null;
  unidade?: string;
}

const MARGEM = "NBR 14724:2024 §5.1";
const FONTE = "NBR 14724:2024 §5.1";
const ESPACAMENTO = "NBR 14724:2024 §5.2";
const CITACAO_LONGA = "NBR 10520:2023 §7.1.1";

const ABNT: Record<string, BaseDoCampo> = {
  // "As margens devem ser: a) para o anverso: esquerda e superior de 3 cm e
  // direita e inferior de 2 cm".
  "margens.top": { rotulo: "Margem superior", forca: "norma", item: MARGEM, unidade: "cm" },
  "margens.left": { rotulo: "Margem esquerda", forca: "norma", item: MARGEM, unidade: "cm" },
  "margens.bottom": { rotulo: "Margem inferior", forca: "norma", item: MARGEM, unidade: "cm" },
  "margens.right": { rotulo: "Margem direita", forca: "norma", item: MARGEM, unidade: "cm" },

  "fonte.familia": { rotulo: "Família da fonte", forca: "convencao", item: null },
  // "Recomenda-se, quando o trabalho for digitado, a fonte tamanho 12".
  "fonte.tamanho": {
    rotulo: "Tamanho da fonte do texto",
    forca: "recomendacao",
    item: FONTE,
    unidade: "pt",
  },
  // "...que devem ser em tamanho menor e uniforme": ser MENOR é obrigação,
  // e é conferido à parte (`conflitosDeTamanhoMenor()` em `resolve.ts`); o
  // número 10 é convenção.
  "fonte.tamanhoNotaRodape": {
    rotulo: "Tamanho da fonte das notas de rodapé",
    forca: "convencao",
    item: null,
    unidade: "pt",
  },
  "fonte.tamanhoCitacao": {
    rotulo: "Tamanho da fonte das citações longas",
    forca: "convencao",
    item: null,
    unidade: "pt",
  },

  // "Todo o texto deve ser digitado ou datilografado com espaçamento 1,5".
  espacamentoLinhas: { rotulo: "Espaçamento entre linhas", forca: "norma", item: ESPACAMENTO },
  recuoParagrafo: {
    rotulo: "Recuo da primeira linha do parágrafo",
    forca: "convencao",
    item: null,
    unidade: "cm",
  },
  alinhamento: { rotulo: "Alinhamento do texto", forca: "convencao", item: null },

  // "A citação direta, com mais de três linhas, deve ser destacada com recuo
  // padronizado em relação à margem esquerda, com letra menor que a utilizada
  // no texto, em espaço simples e sem aspas. Recomenda-se o recuo de 4 cm."
  "citacaoLonga.minLinhas": {
    rotulo: "Linhas a partir das quais a citação é longa",
    forca: "norma",
    item: CITACAO_LONGA,
    unidade: "linhas",
  },
  "citacaoLonga.recuo": {
    rotulo: "Recuo da citação longa",
    forca: "recomendacao",
    item: CITACAO_LONGA,
    unidade: "cm",
  },
  "citacaoLonga.espacamento": {
    rotulo: "Espaçamento da citação longa",
    forca: "norma",
    item: `${CITACAO_LONGA} e NBR 14724:2024 §5.2`,
  },
  "citacaoLonga.tamanhoFonte": {
    rotulo: "Tamanho da fonte da citação longa",
    forca: "convencao",
    item: null,
    unidade: "pt",
  },

  // "Quanto à sua extensão, convém que os resumos tenham: a) 150 a 500
  // palavras nos trabalhos acadêmicos".
  "limites.resumoPalavras.min": {
    rotulo: "Mínimo de palavras do resumo",
    forca: "recomendacao",
    item: "NBR 6028:2021 §4.1.8 a)",
    unidade: "palavras",
  },
  "limites.resumoPalavras.max": {
    rotulo: "Máximo de palavras do resumo",
    forca: "recomendacao",
    item: "NBR 6028:2021 §4.1.8 a)",
    unidade: "palavras",
  },
};

export function baseDoCampo(norma: IdNorma, campo: string): BaseDoCampo {
  const base = norma === "abnt" ? ABNT[campo] : undefined;
  return base ?? { rotulo: campo, forca: "nao-auditada", item: null };
}
