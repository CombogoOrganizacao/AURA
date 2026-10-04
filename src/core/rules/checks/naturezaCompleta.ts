import type { Verificacao } from "../compliance";

// Natureza do trabalho preenchida, mas incompleta — NBR 14724:2024
// §4.2.1.1.1 e): "natureza: tipo do trabalho (tese, dissertação, trabalho de
// conclusão de curso e outros) e objetivo (aprovação em disciplina, grau
// pretendido e outros); nome da instituição a que é submetido; área de
// concentração".
//
// Achado no TCC exportado em 02/10/2026: a folha de rosto saiu só com
// "Trabalho de Conclusão de Curso", e nenhuma regra apontou — `dados-de-
// identificacao` só confere se o campo está vazio.
//
// **Aviso, não erro**: a norma obriga, mas quem confere é uma leitura do
// texto, e o aluno pode ter escrito o objetivo com palavras que esta lista
// não prevê. Duas faltas são detectáveis sem adivinhar:
// - a instituição da capa não aparece na frase (só quando o campo
//   `instituicao` está preenchido — sem ele não há com o que comparar);
// - nenhuma palavra de objetivo ("requisito", "obtenção", "grau", "título",
//   "aprovação"...).
// A área de concentração fica de fora: não há campo com que comparar, e o
// curso nem sempre é o nome da área.

const OBJETIVO =
  /requisito|obten[çc][ãa]o|aprova[çc][ãa]o|grau|t[íi]tulo|bacharel|licenciad|tecn[óo]log|especialista|mestre|doutor/i;

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const naturezaCompleta: Verificacao = {
  regra: "natureza-completa",
  verificar: ({ documento }) => {
    const { naturezaTrabalho, instituicao } = documento.metadados;
    if (!naturezaTrabalho.trim()) return []; // o vazio é de `dados-de-identificacao`

    const faltas: string[] = [];
    if (!OBJETIVO.test(naturezaTrabalho)) {
      faltas.push("o objetivo (por exemplo, o grau pretendido)");
    }
    if (instituicao.trim() && !semAcento(naturezaTrabalho).includes(semAcento(instituicao))) {
      faltas.push(`o nome da instituição (${instituicao.trim()})`);
    }
    if (faltas.length === 0) return [];

    return [
      {
        gravidade: "aviso",
        item: "NBR 14724:2024 §4.2.1.1.1 e)",
        mensagem: `A natureza do trabalho parece não trazer ${faltas.join(" nem ")}. A norma pede tipo do trabalho, objetivo, instituição e área de concentração.`,
        local: { tipo: "metadado", campo: "naturezaTrabalho" },
      },
    ];
  },
};
