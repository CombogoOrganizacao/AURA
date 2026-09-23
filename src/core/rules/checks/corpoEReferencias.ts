import type { Verificacao } from "../compliance";

// Corpo e referências presentes — NBR 14724:2024. O Esquema 1 lista os
// elementos textuais (introdução, desenvolvimento, conclusão) sem os quais
// não há trabalho, e o §4.2.3.1 faz das referências "elemento obrigatório",
// "elaboradas conforme a ABNT NBR 6023". O exportador não gera um título
// "REFERÊNCIAS" sem nada embaixo (passo 4.11): é esta regra que aponta a
// falta.
//
// A nomenclatura das seções não é conferida: a nota 1 do Esquema 1 diz que
// "a nomenclatura dos títulos dos elementos textuais fica a critério do
// autor". O legado exigia seções chamadas "metodologia" e "resultados", sem
// base na norma.

export const corpoPresente: Verificacao = {
  regra: "corpo-presente",
  verificar: ({ documento }) =>
    documento.sections.length > 0
      ? []
      : [
          {
            gravidade: "erro",
            item: "NBR 14724:2024 Esquema 1 e §4.2.2",
            // "Está vazio", e não "não tem seção": num documento novo o editor mostra
            // uma seção-semente em branco, que só entra no documento quando o aluno
            // escreve nela (`novaSecao()`, passo 1.3.7).
            mensagem: "O corpo do texto está vazio: nada foi escrito ainda.",
            local: { tipo: "documento" },
          },
        ],
};

export const referenciasPresentes: Verificacao = {
  regra: "referencias-presentes",
  verificar: ({ documento }) =>
    documento.references.length > 0
      ? []
      : [
          {
            gravidade: "erro",
            item: "NBR 14724:2024 §4.2.3.1",
            mensagem:
              "As referências são elemento obrigatório, e nenhuma está cadastrada. Sem elas, o .docx sai sem a seção REFERÊNCIAS.",
            local: { tipo: "documento" },
          },
        ],
};
