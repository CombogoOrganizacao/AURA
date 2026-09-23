import type { MembroBanca, Metadados } from "../types";

import { tituloComSubtitulo } from "./capa";
import { type LinhaPreTextual, linhaCentro } from "./linhaPreTextual";

// Folha de aprovação — passo 4B.3. NBR 14724:2024 §4.2.1.3, lido no PDF em
// 23/09/2026:
//
//   "Elemento obrigatório. Deve ser inserida após a folha de rosto,
//   constituída pelo nome do autor do trabalho, título do trabalho e
//   subtítulo, se houver, natureza (tipo do trabalho, objetivo, nome da
//   instituição a que é submetido, área de concentração), data de aprovação,
//   nome, titulação e assinatura dos componentes da banca examinadora e
//   instituições a que pertencem. A data de aprovação e as assinaturas dos
//   componentes da banca examinadora devem ser colocadas após a aprovação do
//   trabalho."
//
// A ordem das linhas é a da enumeração. A data e as assinaturas saem como
// campos EM BRANCO, para preencher à mão depois da defesa, como a norma
// manda. Por isso o AURA não guarda nenhuma das duas.
//
// **Sem título** (§5.2.4: "Elementos sem título e sem indicativo numérico.
// Fazem parte desses elementos a folha de aprovação, a dedicatória e a
// epígrafe"). Não há "FOLHA DE APROVAÇÃO" nem "BANCA EXAMINADORA" no topo.
//
// A natureza é a mesma frase da folha de rosto, recuada do meio da mancha à
// margem direita: o §5.2 cita as duas folhas juntas ("na folha de rosto e na
// folha de aprovação, a natureza do trabalho deve ser alinhada do meio da
// mancha gráfica até a margem direita").
//
// Sem membro da banca cadastrado, a folha não sai. Sem banca, ela repetiria a
// folha de rosto com duas linhas em branco e teria cara de conformidade. A
// falta de um elemento obrigatório é achado da conferência (Fase 5), como no
// resumo e nas referências.

// Espaço para a data escrita à mão. Os rótulos são convenção: a norma diz o
// que a folha contém, não como o campo em branco se apresenta.
export const LINHA_DATA_APROVACAO = "Data de aprovação: ____/____/________";
export const LINHA_ASSINATURA = "_______________________________________";

// Membro sem nome é linha recém-criada na tela, ainda não preenchida.
export function membrosPreenchidos(metadados: Metadados): MembroBanca[] {
  return (metadados.bancaExaminadora ?? []).filter((membro) => membro.nome.trim());
}

export function gerarFolhaDeAprovacao(metadados: Metadados): LinhaPreTextual[] {
  const membros = membrosPreenchidos(metadados);
  if (membros.length === 0) return [];

  const linhas: LinhaPreTextual[] = [];
  for (const autor of metadados.autores) linhas.push(linhaCentro(autor, "autor"));
  linhas.push(linhaCentro(tituloComSubtitulo(metadados), "tituloDoTrabalho"));
  if (metadados.naturezaTrabalho) {
    linhas.push({
      texto: metadados.naturezaTrabalho,
      alinhamento: "recuada-a-direita",
      papel: "natureza",
    });
  }
  linhas.push(linhaCentro(LINHA_DATA_APROVACAO, "dataAprovacao"));

  for (const membro of membros) {
    linhas.push(linhaCentro(LINHA_ASSINATURA, "assinatura"));
    // Nome, titulação e instituição, cada um em linha própria e só quando
    // preenchido: uma linha vazia no meio do bloco seria um buraco sem
    // explicação na folha impressa.
    for (const campo of [membro.nome, membro.titulacao, membro.instituicao]) {
      if (campo.trim()) linhas.push(linhaCentro(campo.trim(), "membroBanca"));
    }
  }

  return linhas;
}
