// Chamada de citação no sistema autor-data (NBR 10520:2023) — passo 4.9.
//
// É a outra metade da marca `citacao` (4.8): a marca guarda a ligação e a
// página, e esta função sintetiza "(Silva, 2019, p. 45)" a partir dela e da
// referência. Nada disto é gravado; a chamada muda sozinha quando a referência
// é corrigida.
//
// Fonte: o texto integral da NBR 10520:2023 (docs/auditoria-abnt.md, seção
// própria), conferido item a item neste arquivo. O que a norma não fixa vai
// marcado `CONVENÇÃO`.
//
// **Maiúsculas e minúsculas, não caixa alta** (§6.1.1.1). A edição de 2002
// mandava `(SILVA, 2019)`; a de 2023 manda `(Silva, 2019)`. A caixa alta é da
// LISTA de referências (6023 §8.1.1), feita por `abnt.ts` — e é exatamente a
// armadilha que a auditoria deixou anotada para este passo.

import type { FonteOriginal } from "../../document/types";
import type { CSLDate, CSLName, Referencia } from "../types";
import { temAutoria } from "./abnt";
import { palavrasIniciais } from "./primeiraPalavra";

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
  // Página ou localização da fonte citada (§6.1.3: "o número da página ou
  // localização, se houver, após a data"). Número puro ganha `p.`; qualquer
  // outra forma sai como digitada — `v. 1, p. 16` (§7.1.3), `cap. V, art. 49`,
  // `local. 264`, `9 min 41 s` (§7.1.4). Obrigatória na direta; quem cobra é
  // a conferência da Fase 5, não esta função.
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
  // Ponto e vírgula entre os coautores dentro dos parênteses: §6.1.3, exemplo
  // 1, "(Clarac; Bonnin, 1985, p. 72)"; §6.1.7, "(Cruz; Correa; Costa, ...)".
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

// §6.1.1.4, alíneas a) a d): a única palavra; a primeira seguida de `[...]`;
// o artigo ou o monossílabo com a palavra seguinte e `[...]` — "(Inglês,
// 2012)", "(Anteprojeto [...], 1987)", "(A flor [...], 1995)", "(Nos
// canaviais [...], 1995)". Caixa como digitada: a norma escreve os exemplos
// em maiúsculas e minúsculas, como a autoria (§6.1.1.1).
function entradaPeloTitulo(titulo: string): string {
  const palavras = titulo.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "[...]";

  const quantas = palavrasIniciais(palavras);
  // A pontuação que seguia a palavra no título ("Nos canaviais, mutilações")
  // é do título, não da chamada: "(Nos canaviais [...], 1995)".
  const inicio = palavras
    .slice(0, quantas)
    .join(" ")
    .replace(/[,.;:]+$/, "");
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

// "45" → "p. 45"; "45-47" → "p. 45-47"; "xi" → "p. xi" (§6.1.1.2, exemplo 1,
// "(Organização Mundial da Saúde, 2010, p. xi)"). Qualquer outra forma é
// localização que a pessoa escreveu com o termo dela (§7.1.3, §7.1.4) e sai
// como está — pôr `p.` na frente de "cap. V" daria "p. cap. V".
const SO_PAGINA = /^[0-9ivxlcdm]+(\s*[-–—]\s*[0-9ivxlcdm]+)?$/i;

function paginaDaChamada(pagina: string | null | undefined): string {
  const valor = pagina?.trim();
  if (!valor) return "";
  return SO_PAGINA.test(valor) ? `p. ${valor.replace(/\s*[–—-]\s*/g, "-")}` : valor;
}
