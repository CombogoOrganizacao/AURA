import type { Abreviatura, Metadados, NoConteudo, Secao } from "../types";
import { escaparRegex } from "./escaparRegex";

// Lista de abreviaturas e siglas (NBR 14724) — passo 3.6.4.
//
// **O que é cadastrado e o que é gerado.** A pessoa cadastra o PAR: a sigla e
// o que ela significa por extenso. Isso não dá pra derivar de lugar nenhum —
// só quem escreveu sabe que "ABNT" quer dizer "Associação Brasileira de
// Normas Técnicas", e inventar o significado seria o AURA escrevendo conteúdo
// do trabalho (CLAUDE.md, "Identidade e limite de produto"). O que é gerado,
// e é o que este arquivo faz: **quem entra na lista e em que ordem**.
//
// **Só entra a sigla que aparece no texto.** A norma pede a relação das
// abreviaturas "utilizadas no texto" — uma sigla cadastrada e depois removida
// do trabalho não deve continuar na lista. É isso que faz a lista de
// abreviaturas "acompanhar inserção e remoção" (critério deste passo) do
// mesmo jeito que as de figuras e tabelas, em vez de ser uma tabela digitada
// à mão com cara de lista automática.
//
// A busca é **determinística e sem IA** (CLAUDE.md): procura a sigla como
// palavra inteira no texto do corpo. Nada de heurística para "descobrir"
// siglas sozinho — o AURA não adivinha o que é sigla, ele confere o que foi
// cadastrado.
//
// **A NBR 14724 não foi auditada neste ponto** (a auditoria do 3.1.1 cobriu
// 14724 §5 — apresentação gráfica —, não o conteúdo de cada elemento
// pré-textual). Ordem alfabética e "utilizadas no texto" são as regras
// incontroversas repetidas por toda fonte secundária; nenhum item é citado
// por número de seção. Mesmo tratamento dado à 6027 em `sumario.ts`.

export const TITULO_LISTA_ABREVIATURAS = "LISTA DE ABREVIATURAS E SIGLAS";

// Texto de um nó de conteúdo, incluindo legenda e fonte de figura/tabela e o
// conteúdo das células: uma sigla usada só numa legenda está usada no texto.
function textoDoNo(no: NoConteudo): string[] {
  // Fórmula fica de fora (passo 3.6.5): `texto` é código LaTeX, não prosa.
  // Procurar sigla ali acharia `\\SI`, `\\AA` e nome de macro como se fossem
  // uso no texto — e uma sigla dentro de uma equação não é o que a NBR 14724
  // chama de "utilizada no texto".
  if (no.type === "formula") return [];
  if (no.type === "figura") return [no.legenda, no.fonte];
  if (no.type === "tabela") {
    return [
      no.legenda,
      no.fonte,
      ...no.linhas.flatMap((linha) =>
        linha.celulas.flatMap((celula) => (celula.content ?? []).map((texto) => texto.text)),
      ),
    ];
  }
  return (no.content ?? []).map((texto) => texto.text);
}

// Títulos de seção entram: "Metodologia da ABNT" usa a sigla tanto quanto um
// parágrafo usaria.
function textoDoCorpo(sections: Secao[]): string {
  return sections
    .flatMap((secao) => [secao.titulo, ...secao.content.flatMap(textoDoNo)])
    .join("\n");
}

// Palavra inteira, com fronteira ciente de Unicode: `\b` do JS considera
// letra acentuada uma fronteira, então "CAPES" casaria dentro de "CAPESÇ".
// As classes `\p{L}`/`\p{N}` com a flag `u` não têm esse problema.
//
// **Sensível a maiúsculas/minúsculas**, de propósito: uma sigla é definida
// pela grafia em caixa alta, e ignorar caixa faria "ELE" casar com o pronome
// "ele" em qualquer parágrafo.
const FRONTEIRA_ESQUERDA = "(?<![\\p{L}\\p{N}])";
const FRONTEIRA_DIREITA = "(?![\\p{L}\\p{N}])";

export function siglaAparece(sigla: string, sections: Secao[]): boolean {
  const alvo = sigla.trim();
  if (!alvo) return false;

  const padrao = new RegExp(`${FRONTEIRA_ESQUERDA}${escaparRegex(alvo)}${FRONTEIRA_DIREITA}`, "u");

  return padrao.test(textoDoCorpo(sections));
}

// Ordem alfabética pela sigla, com colação pt-BR: "Á" fica junto de "A", não
// no fim da tabela ASCII. Mesma escolha que `poc/docx/gerar.js` faz ao
// ordenar as referências.
//
// Cadastro incompleto (sem sigla ou sem significado) não entra: uma linha
// pela metade na lista impressa é pior que a linha ausente, e é o painel que
// deve cobrar o preenchimento, não o documento exportado.
export function gerarListaDeAbreviaturas(metadados: Metadados, sections: Secao[]): Abreviatura[] {
  return (metadados.abreviaturas ?? [])
    .filter(
      (abreviatura) =>
        abreviatura.sigla.trim() &&
        abreviatura.significado.trim() &&
        siglaAparece(abreviatura.sigla, sections),
    )
    .sort((a, b) => a.sigla.localeCompare(b.sigla, "pt-BR"));
}
