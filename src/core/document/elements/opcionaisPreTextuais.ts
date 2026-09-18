import type { ElementoOpcional, Metadados } from "../types";

import { type LinhaPreTextual, linhaTitulo } from "./linhaPreTextual";

// Dedicatória (NBR 14724:2024 §4.2.1.4), agradecimentos (§4.2.1.5) e epígrafe
// (§4.2.1.6) — passo 3.5.3.
// Os três são opcionais, ficam entre a folha de rosto e o resumo, e cada um
// ocupa uma folha própria ("folha onde o autor...", é como a norma define os
// três).
//
// **O que a norma prescreve, e o que não prescreve** — conferido na fonte
// primária em 18/09/2026, quando a 4ª edição foi lida na íntegra. A NBR 14724
// descreve o CONTEÚDO de cada um (homenagem; agradecimento a quem contribuiu;
// citação seguida de indicação de autoria) e dois itens de forma:
//
// - **§5.2.3** lista os títulos "sem indicativo numérico... centralizados" e
//   inclui **agradecimentos**, sem incluir dedicatória nem epígrafe. É daí, e
//   só daí, que sai a diferença de estrutura abaixo: agradecimentos tem
//   título, os outros dois não. (O passo 3.5.3 citava "§5.4" por fonte
//   secundária; §5.4 é "Numeração progressiva".)
// - **§5.2.4** as nomeia como "elementos sem título e sem indicativo
//   numérico", junto da folha de aprovação, e recomenda que dedicatória e
//   epígrafe sejam digitadas "com alinhamento do meio da mancha gráfica até a
//   margem direita, **na parte inferior da página**".
//
// O recuo à direita, então, **tem base normativa** — deixou de ser convenção
// com a leitura. **A posição vertical não está implementada**: o AURA não
// empurra as duas para o rodapé da folha. É "recomenda-se", não "deve", e fica
// registrado em docs/auditoria-abnt.md (achado 4) em vez de silenciado aqui.
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

// Sem título (ausente da lista do §5.2.3, e nomeada no §5.2.4) e recuada à
// direita — o recuo é o que o §5.2.4 recomenda.
export function gerarDedicatoria(metadados: Metadados): LinhaPreTextual[] {
  if (!ativo(metadados.dedicatoria)) return [];
  return paragrafos(metadados.dedicatoria.texto, "recuada-a-direita");
}

// O único dos três com título, porque é o único que o §5.2.3 lista.
export function gerarAgradecimentos(metadados: Metadados): LinhaPreTextual[] {
  if (!ativo(metadados.agradecimentos)) return [];
  return [
    linhaTitulo("AGRADECIMENTOS"),
    ...paragrafos(metadados.agradecimentos.texto, "justificado"),
  ];
}

// Sem título, como a dedicatória.
//
// **Correção depois da leitura da 4ª edição**: este comentário dizia que a
// epígrafe segue a NBR 10520. O §4.2.1.6 diz o contrário, com todas as letras
// — "a epígrafe pré-textual **não precisa** ser conforme 5.5" (5.5 =
// Citações). A exigência de citação vale para as epígrafes que abrem seção
// primária, que a v1 não tem. Ligar a epígrafe a uma referência de verdade
// segue possível na Fase 4, quando `refId` deixar de ser sempre nulo, mas
// como recurso, não como conformidade.
export function gerarEpigrafe(metadados: Metadados): LinhaPreTextual[] {
  if (!ativo(metadados.epigrafe)) return [];
  return paragrafos(metadados.epigrafe.texto, "recuada-a-direita");
}

// Na ordem da NBR 14724:2024 §4.2.1.4 a §4.2.1.6 (e da ordem canônica em
// `../order.ts`): dedicatória, agradecimentos, epígrafe — entre a folha de
// aprovação (fora da v1) e o resumo.
// Cada elemento é um bloco à parte; quem exporta é que decide a quebra de
// página entre eles.
export function gerarOpcionaisPreTextuais(metadados: Metadados): LinhaPreTextual[][] {
  return [
    gerarDedicatoria(metadados),
    gerarAgradecimentos(metadados),
    gerarEpigrafe(metadados),
  ].filter((bloco) => bloco.length > 0);
}
