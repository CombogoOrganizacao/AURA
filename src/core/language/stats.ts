import type { Documento, NoConteudo } from "../document/types";
import { blocosEmOrdem, textoCorrido, textoInline } from "../rules/checks/percorrer";

// Estatísticas de texto — passo 5.4.1, portado de `calculateStats()` em
// `legacy/js/engine/languageAndStats.js`.
//
// Do legado saíram "páginas estimadas" (350 palavras por página) e "tempo de
// leitura" (200 palavras por minuto). São estimativas com cara de medida, e
// a de páginas é a pior: a paginação real só existe no `.docx` exportado, e
// um aluno perto do limite de páginas do curso confiaria num número inventado.
// Ficam as contagens, que são medida de verdade.
//
// A função recebe parágrafos, não o documento: a mesma conta serve ao
// documento inteiro (`paragrafosDoCorpo`) e à seleção no editor, que chega
// como texto (passo 5.4.3).

export interface Estatisticas {
  palavras: number;
  caracteresComEspacos: number;
  caracteresSemEspacos: number;
  paragrafos: number;
}

// Palavras de um texto: sequências separadas por espaço que têm ao menos uma
// letra ou algarismo. A NBR 6028 conta "palavras" sem definir; um travessão
// solto não é palavra.
//
// É a mesma conta da regra do resumo (150 a 500 palavras, 6028 §4.1.8 a),
// para a barra de estatísticas e a conferência nunca discordarem sobre o
// mesmo texto. O legado usava `[\p{L}\p{N}_\-]+`, que contava um hífen solto
// como palavra.
export function contarPalavras(texto: string): number {
  return texto.split(/\s+/u).filter((parte) => /[\p{L}\p{N}]/u.test(parte)).length;
}

// Caracteres contados por ponto de código, não por unidade UTF-16: um
// caractere fora do plano básico não conta dois.
function contarCaracteres(texto: string): number {
  return Array.from(texto).length;
}

export function calcularEstatisticas(paragrafos: readonly string[]): Estatisticas {
  let palavras = 0;
  let caracteresComEspacos = 0;
  let caracteresSemEspacos = 0;
  let naoVazios = 0;

  for (const paragrafo of paragrafos) {
    const texto = paragrafo.trim();
    if (!texto) continue;
    naoVazios++;
    palavras += contarPalavras(texto);
    caracteresComEspacos += contarCaracteres(texto);
    caracteresSemEspacos += contarCaracteres(texto.replace(/\s+/gu, ""));
  }

  return { palavras, caracteresComEspacos, caracteresSemEspacos, paragrafos: naoVazios };
}

// O texto que o aluno escreveu no corpo, apêndices e anexos, na ordem de
// leitura, um item por parágrafo: título de cada seção, parágrafos, citações
// longas, células de tabela, e legenda e fonte de figura e tabela. Fórmula
// fica de fora, porque é LaTeX, não prosa (mesma escolha de `textoCorrido`).
//
// Os pré-textuais (resumo, dedicatória...) não entram: são campos de
// metadado, fora do editor, e a barra conta o que está na folha.
export function paragrafosDoCorpo(
  documento: Pick<Documento, "sections" | "apendices" | "anexos">,
): string[] {
  const saida: string[] = [];
  for (const bloco of blocosEmOrdem(documento)) {
    saida.push(bloco.titulo);
    for (const no of bloco.content) saida.push(...paragrafosDoNo(no));
  }
  return saida.filter((paragrafo) => paragrafo.trim() !== "");
}

function paragrafosDoNo(no: NoConteudo): string[] {
  switch (no.type) {
    case "paragraph":
    case "citacao_longa":
      return [textoCorrido(no)];
    case "tabela":
      return [
        no.legenda,
        ...no.linhas.flatMap((linha) => linha.celulas.map((celula) => textoInline(celula.content))),
        no.fonte,
      ];
    case "figura":
      return [no.legenda, no.fonte];
    case "formula":
      return [];
  }
}
