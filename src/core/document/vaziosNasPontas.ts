import type { NoConteudo } from "./types";

// Parágrafos vazios no começo e no fim de uma seção (ou de um apêndice/anexo)
// não vão para a exportação.
//
// O editor precisa de um parágrafo em toda seção, para o cursor ter onde
// entrar: uma seção criada só para abrir subseções ("4 OBJETIVOS", logo
// seguida de "4.1") fica com um parágrafo vazio. Exportado, ele virava uma
// linha em branco entre os dois títulos, somada ao espaço de 18 pt que cada
// título já tem — o espaço dobrado da NBR 14724:2024 §5.2.2, que pede um
// espaço de 1,5 só (achado no TCC exportado, 02/10/2026).
//
// Os vazios do MEIO ficam: entre dois parágrafos, é a pessoa que pôs a linha.
export function semVaziosNasPontas(conteudo: readonly NoConteudo[]): NoConteudo[] {
  let inicio = 0;
  let fim = conteudo.length;
  while (inicio < fim && paragrafoVazio(conteudo[inicio])) inicio++;
  while (fim > inicio && paragrafoVazio(conteudo[fim - 1])) fim--;
  return conteudo.slice(inicio, fim);
}

// Sem nada, ou só com texto em branco. Nota de rodapé e fórmula no meio da
// frase não são texto, mas fazem o parágrafo existir.
function paragrafoVazio(no: NoConteudo): boolean {
  if (no.type !== "paragraph") return false;
  return (no.content ?? []).every((inline) => inline.type === "text" && inline.text.trim() === "");
}
