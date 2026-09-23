import { membrosPreenchidos } from "../../document/elements/folhaDeAprovacao";
import type { Achado, Verificacao } from "../compliance";

// Folha de aprovação — NBR 14724:2024 §4.2.1.3, lido no PDF em 23/09/2026:
// "Elemento obrigatório. [...] constituída pelo nome do autor do trabalho,
// título [...], natureza [...], data de aprovação, nome, titulação e
// assinatura dos componentes da banca examinadora e instituições a que
// pertencem. A data de aprovação e as assinaturas [...] devem ser colocadas
// após a aprovação do trabalho."
//
// Autor, título e natureza são conferidos em `dadosDeIdentificacao.ts`. Data
// e assinatura são preenchidas à mão depois da defesa, e o AURA não as guarda
// (passo 4B.3). Aqui fica o que é só da folha: a banca, com nome, titulação e
// instituição de cada membro. Sem membro, o exportador não gera a folha, e é
// esta regra que diz por quê.

const ITEM = "NBR 14724:2024 §4.2.1.3";

export const folhaDeAprovacao: Verificacao = {
  regra: "folha-de-aprovacao",
  verificar: ({ documento }) => {
    const membros = membrosPreenchidos(documento.metadados);
    if (membros.length === 0) {
      return [
        {
          gravidade: "erro",
          item: ITEM,
          mensagem:
            "A folha de aprovação é obrigatória e não sai sem a banca examinadora. Cadastre os membros da banca.",
          local: { tipo: "metadado", campo: "bancaExaminadora" },
        },
      ];
    }

    const achados: Omit<Achado, "regra">[] = [];
    for (const membro of membros) {
      const faltam = [
        !membro.titulacao.trim() && "a titulação",
        !membro.instituicao.trim() && "a instituição",
      ].filter((falta): falta is string => Boolean(falta));
      if (faltam.length === 0) continue;

      achados.push({
        gravidade: "erro",
        item: ITEM,
        mensagem: `Falta ${faltam.join(" e ")} de ${membro.nome.trim()}, na banca examinadora.`,
        local: { tipo: "metadado", campo: "bancaExaminadora" },
      });
    }
    return achados;
  },
};
