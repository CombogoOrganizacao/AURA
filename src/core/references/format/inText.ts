// Chamada de citação no sistema autor-data (NBR 10520:2023) — passo 4.9.
//
// É a outra metade da marca `citacao` (4.8): a marca guarda a ligação e a
// página, e esta função sintetiza "(Silva, 2019, p. 45)" a partir dela e da
// referência. Nada disto é gravado; a chamada muda sozinha quando a referência
// é corrigida.
//
// Fonte: docs/auditoria-abnt.md, seção "Auditoria da NBR 10520:2023", lida na
// íntegra em 18/09/2026. O PDF não está no repositório; o que abaixo não está
// literal naquele resumo vai marcado `CONVENÇÃO` ou `CONFERIR`.
//
// **Maiúsculas e minúsculas, não caixa alta** (§6.1.1.1). A edição de 2002
// mandava `(SILVA, 2019)`; a de 2023 manda `(Silva, 2019)`. A caixa alta é da
// LISTA de referências (6023 §8.1.1), feita por `abnt.ts` — e é exatamente a
// armadilha que a auditoria deixou anotada para este passo.

import type { FonteOriginal } from "../../document/types";
import type { CSLDate, CSLName, Referencia } from "../types";
import { ARTIGOS_INICIAIS, temAutoria } from "./abnt";

export interface OpcoesChamada {
  // §6.1.2: com quatro ou mais autores, a chamada "pode" trazer só o primeiro
  // seguido de `et al.`, "embora na referência constem todos" — e o recurso
  // tem de ser UNIFORME em todas as citações do trabalho. Por isso é opção
  // (do documento, quando houver onde guardá-la), não decisão por citação.
  // Até três autores, todos entram sempre: abreviar três é fora da norma.
  etAl: "quatro-ou-mais" | "nunca";
}

// `CONVENÇÃO` — abreviar é o que quase todo TCC faz e o que a norma permite;
// listar todos também é conforme. O padrão escolhe o uso comum.
const PADRAO: OpcoesChamada = { etAl: "quatro-ou-mais" };

export interface DadosDaCitacao {
  // Página da fonte citada (§7.1: obrigatória na citação direta; quem cobra é
  // a conferência da Fase 5, não esta função).
  pagina?: string | null;
  // Citação de citação (§7.3): a obra original, que não está na lista.
  apud?: FonteOriginal | null;
}

// A chamada completa, entre parênteses.
export function formatarChamada(
  referencia: Referencia,
  citacao: DadosDaCitacao = {},
  opcoes: OpcoesChamada = PADRAO,
): string {
  const consultada = elementos(
    temAutoria(referencia.author) ? referencia.author : undefined,
    referencia.title,
    referencia.issued,
    citacao.pagina,
    opcoes,
  );

  if (!citacao.apud) return `(${consultada})`;

  // §7.3: "autoria, data, página, apud, autoria, data, página" — a obra
  // original primeiro, a consultada depois. Só a consultada está na lista de
  // referências, e é ela que a marca aponta por `refId`.
  const original = elementos(
    citacao.apud.author,
    undefined,
    citacao.apud.issued,
    citacao.apud.pagina,
    opcoes,
  );
  return `(${original} apud ${consultada})`;
}

// "Silva, 2019, p. 45" — sem os parênteses, para o apud juntar dois.
function elementos(
  autores: readonly CSLName[] | undefined,
  titulo: string | undefined,
  issued: CSLDate | undefined,
  pagina: string | null | undefined,
  opcoes: OpcoesChamada,
): string {
  const entrada =
    autores && temAutoria(autores) ? autoria(autores, opcoes) : entradaPeloTitulo(titulo ?? "");
  return [entrada, ano(issued), paginaDaChamada(pagina)].filter(Boolean).join(", ");
}

// --- Autoria -----------------------------------------------------------------

function autoria(autores: readonly CSLName[], opcoes: OpcoesChamada): string {
  const nomes = autores.map(nomeNaChamada).filter(Boolean);
  if (opcoes.etAl === "quatro-ou-mais" && nomes.length >= 4) return `${nomes[0]} et al.`;
  // `CONVENÇÃO` — ponto e vírgula entre os coautores dentro dos parênteses.
  // A auditoria registra o ponto e vírgula para "vários autores entre
  // parênteses" (§6.1.8); é também a forma da lista (6023 §8.1.1).
  return nomes.join("; ");
}

// §6.1.1.1: o sobrenome, em maiúsculas e minúsculas — como está no dado, sem
// transformar. "Silva Filho" (grau de parentesco, 6023 §8.1.1.3) sai inteiro.
//
// §6.1.1.2: pessoa jurídica pelo nome completo ou pela sigla. `CONVENÇÃO` —
// sai `literal` como foi digitado: a norma recomenda a sigla em maiúsculas,
// e trocar "Associação Brasileira de Normas Técnicas" por "ABNT" exigiria
// um campo de sigla que o dado não tem.
function nomeNaChamada(nome: CSLName): string {
  return (nome.literal ?? nome.family ?? nome.given ?? "").trim();
}

// §6.1.1.4: sem autoria, a entrada é pelo título, "com supressão [...]
// conforme o caso". `CONFERIR` no texto integral da norma a extensão exata: a
// leitura aqui é a primeira palavra (com o artigo inicial, a mesma regra da
// lista em `abnt.ts`, §6.7 da 6023) seguida de "[...]" quando o título
// continua. Caixa como digitada — maiúsculas e minúsculas, como a autoria.
function entradaPeloTitulo(titulo: string): string {
  const palavras = titulo.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "[...]";

  const quantas =
    palavras.length > 1 && ARTIGOS_INICIAIS.has(palavras[0].toLocaleLowerCase("pt-BR")) ? 2 : 1;
  const inicio = palavras.slice(0, quantas).join(" ");
  return palavras.length > quantas ? `${inicio} [...]` : inicio;
}

// --- Data e página -----------------------------------------------------------

// Só o ano: a chamada não leva mês nem dia, mesmo de uma página web datada.
// Data que não cabe em número ("[199-]", "no prelo") sai como está no dado —
// a mesma que a lista imprime.
//
// LIMITAÇÃO: sem data nenhuma, a chamada sai sem o ano, espelhando a lista
// (`imprenta()` também omite). A falta é assunto da conferência (Fase 5).
function ano(issued: CSLDate | undefined): string {
  if (!issued) return "";
  if (issued.raw?.trim()) return issued.raw.trim();
  const primeiro = issued["date-parts"]?.[0]?.[0];
  return Number.isFinite(primeiro) ? String(primeiro) : "";
}

// "45" → "p. 45"; "45-47" → "p. 45-47". Página já escrita com a abreviatura
// (`p.` ou `f.`, Anexo A) não ganha outra.
function paginaDaChamada(pagina: string | null | undefined): string {
  const valor = pagina?.trim();
  if (!valor) return "";
  return /^(p|f)\.\s/i.test(valor) ? valor : `p. ${valor.replace(/\s*[–—]\s*/g, "-")}`;
}
