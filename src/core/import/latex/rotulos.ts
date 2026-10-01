import { numerarSecoes } from "../../document/numbering";
import type { Aviso } from "./fonte";
import type { BlocoLido, Item, ItensLidos } from "./blocos";
import type { SecaoLida, TexLido } from "./lerTex";

// Referência cruzada (`\ref`, `\autoref`, `\cref`) de um `.tex` de fora
// (passo 6.2.9). O AURA não tem nó de referência cruzada: o número é derivado
// da posição (`numerarFiguras()`, `numerarSecoes()`) e não fica gravado. Na
// importação, `\ref{fig:x}` vira o número que a figura recebe no AURA — texto
// fixo, com aviso de que não acompanha uma reordenação.
//
// O número só existe depois que o documento inteiro foi lido. Por isso o
// leitor inline escreve um marcador no lugar do `\ref` (`marcadorDeReferencia`)
// e guarda o comando em `ContextoInline.referencias`; ao fim, `resolverReferencias`
// troca cada marcador pelo número, ou pelo comando original quando o rótulo
// não aponta para nada numerado no AURA (fórmula, apêndice, rótulo ausente).

export interface ReferenciaCruzadaLida {
  comando: string;
  rotulo: string;
  // O comando como estava, para quando não há número.
  bruto: string;
  arquivo: string;
  linha: number;
}

// Os comandos que viram número. `\pageref` (página), `\eqref` (fórmula, que a
// v1 não numera) e `\nameref` (título) ficam como texto.
export const REFERENCIAS_RESOLUVEIS = new Set(["ref", "autoref", "cref", "Cref"]);

// Caracteres da área de uso privado: não aparecem num `.tex` de verdade, e
// nenhuma etapa do leitor os trata como espaço ou pontuação.
const ABRE = "";
const FECHA = "";
const MARCADOR = new RegExp(`${ABRE}(\\d+)${FECHA}`, "g");

export function marcadorDeReferencia(indice: number): string {
  return `${ABRE}${indice}${FECHA}`;
}

type Tipo = "figura" | "tabela" | "secao";

const NOME_DO_TIPO: Record<Tipo, string> = {
  figura: "Figura",
  tabela: "Tabela",
  secao: "Seção",
};

export interface Alvo {
  tipo: Tipo;
  numero: string;
}

// O que cada `\label` do corpo de um `.tex` de fora numera, pela posição: o
// rótulo pertence ao último item que começa antes dele. Dentro de figura ou
// tabela, é ela; num título ou no texto de uma seção, é a seção (o mesmo que o
// LaTeX faz). Fórmula não é numerada na v1, e apêndice e anexo não entram na
// contagem de figuras e seções do texto: ficam sem alvo.
export function alvosDosRotulos(
  { fonte, itens }: ItensLidos,
  secoes: readonly SecaoLida[],
  secaoDoTitulo: ReadonlyMap<Item, SecaoLida>,
): Map<string, Alvo> {
  const numeroDoBloco = new Map<BlocoLido, Alvo>();
  let figuras = 0;
  let tabelas = 0;
  for (const secao of secoes) {
    for (const bloco of secao.content) {
      if (bloco.type === "figura")
        numeroDoBloco.set(bloco, { tipo: "figura", numero: `${++figuras}` });
      if (bloco.type === "tabela")
        numeroDoBloco.set(bloco, { tipo: "tabela", numero: `${++tabelas}` });
    }
  }
  // Mesma conta da tela e do `.docx`: `numerarSecoes()` sobre a lista plana.
  const numeracao = numerarSecoes(
    secoes.map((secao, indice) => ({
      id: String(indice),
      ordem: indice,
      nivel: secao.nivel,
      titulo: "",
      content: [],
    })),
  );
  const numeroDaSecao = new Map(
    secoes.map((secao, indice) => [secao, numeracao.get(String(indice))!]),
  );

  const alvos = new Map<string, Alvo>();
  for (const { nome, pos } of rotulosNoTexto(fonte.texto)) {
    if (alvos.has(nome)) continue;
    const indice = ultimoItemAte(itens, pos);
    if (indice < 0) continue;
    const alvo = alvoDoItem(itens, indice, numeroDoBloco, numeroDaSecao, secaoDoTitulo);
    if (alvo) alvos.set(nome, alvo);
  }
  return alvos;
}

function alvoDoItem(
  itens: readonly Item[],
  indice: number,
  numeroDoBloco: ReadonlyMap<BlocoLido, Alvo>,
  numeroDaSecao: ReadonlyMap<SecaoLida, string>,
  secaoDoTitulo: ReadonlyMap<Item, SecaoLida>,
): Alvo | null {
  // Figura e o parágrafo do que sobrou dentro dela têm a mesma posição: o
  // rótulo é da figura, a primeira.
  let i = indice;
  while (i > 0 && itens[i - 1].pos === itens[i].pos) i--;
  const item = itens[i];
  if (item.tipo === "bloco") {
    const doBloco = numeroDoBloco.get(item.bloco);
    if (doBloco) return doBloco;
    if (item.bloco.type === "formula") return null;
  }
  // A seção em que o rótulo está.
  for (let j = i; j >= 0; j--) {
    const anterior = itens[j];
    if (anterior.tipo === "titulo") {
      const secao = secaoDoTitulo.get(anterior);
      const numero = secao && numeroDaSecao.get(secao);
      return numero ? { tipo: "secao", numero } : null;
    }
    if (anterior.tipo !== "bloco" && anterior.tipo !== "marcador") return null;
  }
  return null;
}

function ultimoItemAte(itens: readonly Item[], pos: number): number {
  let achado = -1;
  for (let i = 0; i < itens.length && itens[i].pos <= pos; i++) achado = i;
  return achado;
}

function rotulosNoTexto(texto: string): { nome: string; pos: number }[] {
  const saida: { nome: string; pos: number }[] = [];
  for (const achado of texto.matchAll(/\\label\s*\{([^{}]*)\}/g)) {
    saida.push({ nome: achado[1].trim(), pos: achado.index });
  }
  return saida;
}

// Troca cada marcador pelo número do alvo, em todo texto do resultado
// (parágrafo, legenda, célula, metadado). `\ref` escreve só o número — o
// "Figura" já vem escrito antes dele; `\autoref` e `\cref` escrevem o nome.
// Um aviso só para as resolvidas, e um por ocorrência para as que ficaram
// como texto, com a linha.
export function resolverReferencias(
  tex: TexLido,
  referencias: readonly ReferenciaCruzadaLida[],
  alvos: ReadonlyMap<string, Alvo>,
  avisos: Aviso[],
): void {
  if (referencias.length === 0) return;
  const texto = referencias.map((referencia) => {
    const alvo = alvos.get(referencia.rotulo);
    if (!alvo) return referencia.bruto;
    return referencia.comando === "ref" ? alvo.numero : `${NOME_DO_TIPO[alvo.tipo]} ${alvo.numero}`;
  });

  const trocar = (valor: string) =>
    valor.replace(MARCADOR, (_, indice: string) => texto[Number(indice)] ?? "");
  substituirTextos(tex.metadados, trocar);
  substituirTextos(tex.secoes, trocar);
  substituirTextos(tex.apendices, trocar);
  substituirTextos(tex.anexos, trocar);
  substituirTextos(tex.chamadas, trocar);

  const resolvidas = referencias.filter((referencia) => alvos.has(referencia.rotulo));
  if (resolvidas.length > 0) {
    const primeira = resolvidas[0];
    avisos.push({
      arquivo: primeira.arquivo,
      linha: primeira.linha,
      mensagem:
        resolvidas.length === 1
          ? `Uma referência cruzada (\\ref) virou o número fixo: se mudar a ordem das figuras, tabelas ou seções, confira.`
          : `${resolvidas.length} referências cruzadas (\\ref) viraram o número fixo: se mudar a ordem das figuras, tabelas ou seções, confira.`,
    });
  }
  for (const referencia of referencias) {
    if (alvos.has(referencia.rotulo)) continue;
    avisos.push({
      arquivo: referencia.arquivo,
      linha: referencia.linha,
      mensagem: `Referência cruzada (\\${referencia.comando}) sem figura, tabela ou seção numerada correspondente: entrou como texto. Escreva o número (por exemplo, “Figura 2”).`,
    });
  }
}

// Percorre o objeto e troca o valor de toda string que tenha marcador. Os
// resultados do leitor são árvores de objetos e listas, sem ciclos.
function substituirTextos(valor: unknown, trocar: (texto: string) => string): void {
  if (Array.isArray(valor)) {
    valor.forEach((item, indice) => {
      if (typeof item === "string") {
        if (item.includes(ABRE)) valor[indice] = trocar(item);
      } else substituirTextos(item, trocar);
    });
    return;
  }
  if (valor === null || typeof valor !== "object") return;
  const objeto = valor as Record<string, unknown>;
  for (const chave of Object.keys(objeto)) {
    const item = objeto[chave];
    if (typeof item === "string") {
      if (item.includes(ABRE)) objeto[chave] = trocar(item);
    } else substituirTextos(item, trocar);
  }
}
