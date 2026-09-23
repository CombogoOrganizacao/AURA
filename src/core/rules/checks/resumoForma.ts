import type { Verificacao } from "../compliance";
import { contarPalavras } from "./percorrer";
import { resumosPreenchidos } from "./resumos";

// Forma do resumo — NBR 6028:2021, lida no PDF em 23/09/2026. Valem para o
// resumo vernáculo e para o estrangeiro (a 14724 §4.2.1.8 manda os dois
// "conforme a ABNT NBR 6028"). Resumo vazio é assunto de `resumos.ts`.

// §4.1.8: "Quanto à sua extensão, CONVÉM que os resumos tenham: a) 150 a 500
// palavras nos trabalhos acadêmicos". "Convém" é recomendação: aviso. O limite
// vem das regras resolvidas (`limites.resumoPalavras`), que um edital pode
// mudar.
export const resumoExtensao: Verificacao = {
  regra: "resumo-extensao",
  verificar: ({ documento, regras }) => {
    const faixa = regras.limites?.resumoPalavras;
    if (!faixa) return [];

    return resumosPreenchidos(documento.metadados).flatMap((resumo) => {
      const palavras = contarPalavras(resumo.texto);
      if (palavras >= faixa.min && palavras <= faixa.max) return [];
      return [
        {
          gravidade: "aviso" as const,
          item: "NBR 6028:2021 §4.1.8 a)",
          mensagem: `${resumo.nome} tem ${palavras} palavras. A norma recomenda de ${faixa.min} a ${faixa.max} em trabalhos acadêmicos.`,
          local: { tipo: "metadado" as const, campo: resumo.campo },
        },
      ];
    });
  },
};

// §4.1.2: "O resumo DEVE ser composto por uma sequência de frases concisas em
// parágrafo único, sem enumeração de tópicos." Uma quebra de linha seguida de
// texto já são dois parágrafos, e é também como uma lista de tópicos chega do
// campo de texto.
export const resumoParagrafoUnico: Verificacao = {
  regra: "resumo-paragrafo-unico",
  verificar: ({ documento }) =>
    resumosPreenchidos(documento.metadados)
      .filter((resumo) => /\n\s*\S/u.test(resumo.texto.trim()))
      .map((resumo) => ({
        gravidade: "erro" as const,
        item: "NBR 6028:2021 §4.1.2",
        mensagem: `${resumo.nome} está em mais de um parágrafo. A norma pede parágrafo único, sem enumeração de tópicos.`,
        local: { tipo: "metadado" as const, campo: resumo.campo },
      })),
};

// §4.1.7: as palavras-chave "Devem ser grafadas com as iniciais em letra
// minúscula, com exceção dos substantivos próprios e nomes científicos."
// Nome próprio não se decide sem o aluno, então é AVISO: "confira", não
// "está errado". Sigla toda em maiúsculas (IBGE, no exemplo da própria norma)
// não é avisada: não é inicial maiúscula, é a grafia da sigla.
const TERMOS = [
  { campo: "palavrasChave" as const, nome: "Palavra-chave" },
  { campo: "keywords" as const, nome: "Keyword" },
];

function comecaComMaiuscula(termo: string): boolean {
  const limpo = termo.trim();
  const primeira = limpo.charAt(0);
  const ehSigla = limpo.length > 1 && limpo === limpo.toLocaleUpperCase("pt-BR");
  return primeira !== primeira.toLocaleLowerCase("pt-BR") && !ehSigla;
}

export const palavrasChaveMinusculas: Verificacao = {
  regra: "palavras-chave-minusculas",
  verificar: ({ documento }) =>
    TERMOS.flatMap(({ campo, nome }) =>
      documento.metadados[campo].filter(comecaComMaiuscula).map((termo) => ({
        gravidade: "aviso" as const,
        item: "NBR 6028:2021 §4.1.7",
        mensagem: `${nome} "${termo.trim()}" começa com maiúscula. A norma pede inicial minúscula, exceto em nomes próprios e científicos: confira se é o caso.`,
        local: { tipo: "metadado" as const, campo },
      })),
    ),
};
