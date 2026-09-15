import type { ElementoOpcional, Metadados } from "../types";

import { type LinhaPreTextual, linhaTitulo } from "./linhaPreTextual";

// Dedicatória, agradecimentos e epígrafe (NBR 14724 §4.2.1) — passo 3.5.3.
// Os três são opcionais, ficam entre a folha de rosto e o resumo, e cada um
// ocupa uma folha própria ("folha onde o autor...", é como a norma define os
// três).
//
// **O que a norma prescreve, e o que não prescreve.** A NBR 14724 descreve o
// CONTEÚDO de cada um (homenagem; agradecimento a quem contribuiu; citação
// seguida de indicação de autoria) e praticamente nada da forma. O único
// gancho literal de formatação é o §5.4: a lista de títulos "sem indicativo
// numérico... centralizados" inclui **agradecimentos** e **não** inclui
// dedicatória nem epígrafe. É daí, e só daí, que sai a diferença de estrutura
// abaixo: agradecimentos tem título, os outros dois não.
//
// O recuo à direita da dedicatória e da epígrafe é **convenção, não norma** —
// mesma disciplina de docs/auditoria-abnt.md, que separa "conforme" de
// "convenção sem base normativa literal". Está aqui porque é o que toda banca
// espera ver, não porque a NBR mande.
//
// A epígrafe não ganhou campo separado de autoria: a norma pede "citação,
// seguida de indicação de autoria", sem dizer como dispor uma coisa e outra.
// Como o texto quebra em parágrafos por linha em branco (abaixo), escrever a
// atribuição na última linha já resolve — sem inventar estrutura que o passo
// não pediu.

// Desligado no painel **ou** sem texto: não sai. Texto só com espaço em
// branco conta como vazio — uma folha de dedicatória em branco no meio do
// pré-textual é pior que nenhuma.
function ativo(elemento: ElementoOpcional | undefined): elemento is ElementoOpcional {
  return Boolean(elemento?.ativo && elemento.texto.trim());
}

// Uma linha por parágrafo: linha em branco separa parágrafos, como em
// qualquer campo de texto multilinha. Serve para os agradecimentos (que
// costumam ter vários) e para a atribuição da epígrafe (que vai sozinha na
// última).
function paragrafos(texto: string, alinhamento: LinhaPreTextual["alinhamento"]): LinhaPreTextual[] {
  return texto
    .split(/\n\s*\n|\n/)
    .map((paragrafo) => paragrafo.trim())
    .filter((paragrafo) => paragrafo.length > 0)
    .map((paragrafo) => ({ texto: paragrafo, alinhamento }));
}

// Sem título (ausente da lista do §5.4) e recuada à direita por convenção.
export function gerarDedicatoria(metadados: Metadados): LinhaPreTextual[] {
  if (!ativo(metadados.dedicatoria)) return [];
  return paragrafos(metadados.dedicatoria.texto, "recuada-a-direita");
}

// O único dos três com título, porque é o único que o §5.4 lista.
export function gerarAgradecimentos(metadados: Metadados): LinhaPreTextual[] {
  if (!ativo(metadados.agradecimentos)) return [];
  return [
    linhaTitulo("AGRADECIMENTOS"),
    ...paragrafos(metadados.agradecimentos.texto, "justificado"),
  ];
}

// Sem título, como a dedicatória. "Elaborada conforme a ABNT NBR 10520"
// (§4.2.1.5) vale para a citação em si — ligar a epígrafe a uma referência
// de verdade é assunto da Fase 4, quando `refId` deixar de ser sempre nulo.
export function gerarEpigrafe(metadados: Metadados): LinhaPreTextual[] {
  if (!ativo(metadados.epigrafe)) return [];
  return paragrafos(metadados.epigrafe.texto, "recuada-a-direita");
}

// Na ordem da NBR 14724 (e da ordem canônica de docs/to-do.md 3.7.2):
// dedicatória, agradecimentos, epígrafe — entre a folha de rosto e o resumo.
// Cada elemento é um bloco à parte; quem exporta é que decide a quebra de
// página entre eles.
export function gerarOpcionaisPreTextuais(metadados: Metadados): LinhaPreTextual[][] {
  return [
    gerarDedicatoria(metadados),
    gerarAgradecimentos(metadados),
    gerarEpigrafe(metadados),
  ].filter((bloco) => bloco.length > 0);
}
