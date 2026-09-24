import type { Documento, Marca, NoConteudo, NoTexto } from "../document/types";
import type { LocalCitacao } from "../references/citacoes";

// Localizar e substituir — passo 5.4.2, portado de `findAndReplace()` em
// `legacy/js/engine/languageAndStats.js`.
//
// **Sobre o documento, não sobre a tela.** A busca percorre o formato
// canônico inteiro (seções, apêndices e anexos), e "substituir todas" troca
// até nas seções que o aluno nunca abriu.
//
// **O que o legado errava, e não foi portado:**
// - `\b` do JavaScript não conhece letra acentuada: "palavra inteira" com
//   "ação" nunca achava nada, e "ação" achava dentro de "reação". A fronteira
//   aqui é "nem letra nem algarismo antes e depois", em Unicode;
// - o substituto passava por `String.replace`, que lê `$&` e `$1` como
//   comandos: "R$&" virava outra coisa. Aqui o substituto entra literal;
// - operava sobre texto corrido, sem formatação. Aqui o texto é dividido em
//   trechos com marcas (negrito, itálico, citação), e a troca as preserva.
//
// `replaceAll` virou a escolha entre duas funções: `substituirTodas`, e
// `substituirOcorrencia` para a que o aluno está vendo (passo 5.4.3).

export interface OpcoesBusca {
  // Diferencia maiúsculas de minúsculas.
  matchCase?: boolean;
  // Só a palavra inteira: "ação" não acha "reação".
  wholeWord?: boolean;
}

// Onde, dentro de um bloco, o texto está. Fórmula fica de fora: é LaTeX, e
// trocar texto dentro dela quebraria a fórmula sem o aluno ver.
export type CampoTexto =
  | { tipo: "titulo" }
  // Parágrafo ou citação longa: `no` é o índice em `content`.
  | { tipo: "no"; no: number }
  | { tipo: "celula"; no: number; linha: number; celula: number }
  | { tipo: "legenda"; no: number }
  | { tipo: "fonte"; no: number };

export interface OcorrenciaBusca {
  onde: LocalCitacao;
  campo: CampoTexto;
  // Posição no texto do campo (a concatenação dos trechos, no caso de um
  // parágrafo), em unidades de `String`.
  inicio: number;
  fim: number;
}

// O que a busca lê do documento: o corpo, os apêndices e os anexos. O
// editor, que só tem as seções, passa listas vazias no resto.
export type CorpoDoDocumento = Pick<Documento, "sections" | "apendices" | "anexos">;

export interface ResultadoSubstituicao<D extends CorpoDoDocumento = Documento> {
  documento: D;
  substituidas: number;
}

// --- Achar num texto ---------------------------------------------------------

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LETRA_OU_ALGARISMO = "[\\p{L}\\p{M}\\p{N}_]";

// As ocorrências de `termo` em `texto`, sem sobreposição, da esquerda para a
// direita. O termo é normalizado em NFC, a forma que o editor grava.
export function acharNoTexto(
  texto: string,
  termo: string,
  opcoes: OpcoesBusca = {},
): { inicio: number; fim: number }[] {
  if (!termo) return [];
  let padrao = escaparRegex(termo.normalize("NFC"));
  if (opcoes.wholeWord) {
    padrao = `(?<!${LETRA_OU_ALGARISMO})${padrao}(?!${LETRA_OU_ALGARISMO})`;
  }
  const regex = new RegExp(padrao, opcoes.matchCase ? "gu" : "giu");
  return Array.from(texto.matchAll(regex), (achado) => ({
    inicio: achado.index,
    fim: achado.index + achado[0].length,
  }));
}

// --- Percorrer o documento ---------------------------------------------------

interface CampoDoDocumento {
  onde: LocalCitacao;
  campo: CampoTexto;
  texto: string;
}

// Os campos de texto na ordem de leitura. A ordem das seções é por `ordem`,
// como em `blocosEmOrdem()` (rules/checks/percorrer.ts), para "próxima
// ocorrência" seguir o que o aluno lê.
function camposDoDocumento(documento: CorpoDoDocumento): CampoDoDocumento[] {
  const blocos = [
    ...[...documento.sections]
      .sort((a, b) => a.ordem - b.ordem)
      .map((secao) => ({ onde: { tipo: "secao", id: secao.id } as const, bloco: secao })),
    ...documento.apendices.map((bloco) => ({
      onde: { tipo: "apendice", id: bloco.id } as const,
      bloco,
    })),
    ...documento.anexos.map((bloco) => ({ onde: { tipo: "anexo", id: bloco.id } as const, bloco })),
  ];

  const saida: CampoDoDocumento[] = [];
  for (const { onde, bloco } of blocos) {
    saida.push({ onde, campo: { tipo: "titulo" }, texto: bloco.titulo });
    bloco.content.forEach((no, indice) => saida.push(...camposDoNo(onde, no, indice)));
  }
  return saida;
}

function camposDoNo(onde: LocalCitacao, no: NoConteudo, indice: number): CampoDoDocumento[] {
  switch (no.type) {
    case "paragraph":
    case "citacao_longa":
      return [{ onde, campo: { tipo: "no", no: indice }, texto: juntar(no.content) }];
    case "tabela":
      return [
        { onde, campo: { tipo: "legenda", no: indice }, texto: no.legenda },
        ...no.linhas.flatMap((linha, l) =>
          linha.celulas.map((celula, c) => ({
            onde,
            campo: { tipo: "celula", no: indice, linha: l, celula: c } as const,
            texto: juntar(celula.content),
          })),
        ),
        { onde, campo: { tipo: "fonte", no: indice }, texto: no.fonte },
      ];
    case "figura":
      return [
        { onde, campo: { tipo: "legenda", no: indice }, texto: no.legenda },
        { onde, campo: { tipo: "fonte", no: indice }, texto: no.fonte },
      ];
    case "formula":
      return [];
  }
}

function juntar(trechos: readonly NoTexto[] | undefined): string {
  return (trechos ?? []).map((trecho) => trecho.text).join("");
}

// Todas as ocorrências no documento, na ordem de leitura.
export function buscarNoDocumento(
  documento: CorpoDoDocumento,
  termo: string,
  opcoes: OpcoesBusca = {},
): OcorrenciaBusca[] {
  return camposDoDocumento(documento).flatMap(({ onde, campo, texto }) =>
    acharNoTexto(texto, termo, opcoes).map((faixa) => ({ onde, campo, ...faixa })),
  );
}

// --- Substituir --------------------------------------------------------------

// Troca as faixas (sem sobreposição, em ordem) num texto simples.
function trocarEmTexto(
  texto: string,
  faixas: readonly { inicio: number; fim: number }[],
  substituto: string,
): string {
  let saida = "";
  let cursor = 0;
  for (const { inicio, fim } of faixas) {
    saida += texto.slice(cursor, inicio) + substituto;
    cursor = fim;
  }
  return saida + texto.slice(cursor);
}

// Troca as faixas num texto dividido em trechos com marcas. O substituto
// leva as marcas do primeiro caractere da ocorrência, como no Word: trocar
// uma palavra em negrito dá uma palavra em negrito. O resto de cada trecho
// fica com as marcas que tinha. Trecho vazio sai, porque o editor não aceita
// nó de texto vazio, e trechos vizinhos com as mesmas marcas se juntam, como
// o editor os grava.
function trocarEmTrechos(
  trechos: readonly NoTexto[],
  faixas: readonly { inicio: number; fim: number }[],
  substituto: string,
): NoTexto[] {
  const saida: NoTexto[] = [];
  const empurrar = (text: string, marks: Marca[] | undefined) => {
    if (!text) return;
    const anterior = saida.at(-1);
    if (anterior && JSON.stringify(anterior.marks ?? []) === JSON.stringify(marks ?? [])) {
      saida[saida.length - 1] = { ...anterior, text: anterior.text + text };
      return;
    }
    saida.push(marks ? { type: "text", text, marks } : { type: "text", text });
  };

  let faixa = 0;
  let posicao = 0;
  for (const trecho of trechos) {
    const inicioTrecho = posicao;
    const fimTrecho = posicao + trecho.text.length;
    let cursor = inicioTrecho;

    while (faixa < faixas.length && faixas[faixa].inicio < fimTrecho) {
      const { inicio, fim } = faixas[faixa];
      if (inicio >= cursor) {
        // A ocorrência começa neste trecho: o que vem antes fica, e o
        // substituto entra com as marcas deste trecho.
        empurrar(trecho.text.slice(cursor - inicioTrecho, inicio - inicioTrecho), trecho.marks);
        empurrar(substituto, trecho.marks);
      }
      // A ocorrência consome o trecho até `fim`, ou até o fim do trecho, se
      // continua no seguinte.
      cursor = Math.min(fim, fimTrecho);
      if (fim > fimTrecho) break;
      faixa++;
    }

    empurrar(trecho.text.slice(cursor - inicioTrecho), trecho.marks);
    posicao = fimTrecho;
  }
  return saida;
}

type Faixa = { inicio: number; fim: number };

function mesmoCampo(a: CampoTexto, b: CampoTexto): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Aplica as trocas de um bloco (seção, apêndice ou anexo). `faixasDe`
// devolve, para cada campo, as faixas a trocar.
function trocarNoBloco<B extends { titulo: string; content: NoConteudo[] }>(
  bloco: B,
  faixasDe: (campo: CampoTexto) => Faixa[],
  substituto: string,
): B {
  const titulo = faixasDe({ tipo: "titulo" });
  return {
    ...bloco,
    titulo: titulo.length ? trocarEmTexto(bloco.titulo, titulo, substituto) : bloco.titulo,
    content: bloco.content.map((no, indice) => trocarNoNo(no, indice, faixasDe, substituto)),
  };
}

function trocarNoNo(
  no: NoConteudo,
  indice: number,
  faixasDe: (campo: CampoTexto) => Faixa[],
  substituto: string,
): NoConteudo {
  const emTexto = (texto: string, campo: CampoTexto) => {
    const faixas = faixasDe(campo);
    return faixas.length ? trocarEmTexto(texto, faixas, substituto) : texto;
  };
  const emTrechos = (trechos: NoTexto[] | undefined, campo: CampoTexto) => {
    const faixas = faixasDe(campo);
    if (!faixas.length || !trechos) return trechos;
    const trocados = trocarEmTrechos(trechos, faixas, substituto);
    // Parágrafo esvaziado fica como o editor grava um parágrafo vazio: sem
    // `content`.
    return trocados.length ? trocados : undefined;
  };

  switch (no.type) {
    case "paragraph":
    case "citacao_longa": {
      const { content, ...resto } = no;
      const novo = emTrechos(content, { tipo: "no", no: indice });
      return novo ? { ...resto, content: novo } : resto;
    }
    case "tabela":
      return {
        ...no,
        legenda: emTexto(no.legenda, { tipo: "legenda", no: indice }),
        fonte: emTexto(no.fonte, { tipo: "fonte", no: indice }),
        linhas: no.linhas.map((linha, l) => ({
          ...linha,
          celulas: linha.celulas.map((celula, c) => {
            const { content, ...resto } = celula;
            const novo = emTrechos(content, { tipo: "celula", no: indice, linha: l, celula: c });
            return novo ? { ...resto, content: novo } : resto;
          }),
        })),
      };
    case "figura":
      return {
        ...no,
        legenda: emTexto(no.legenda, { tipo: "legenda", no: indice }),
        fonte: emTexto(no.fonte, { tipo: "fonte", no: indice }),
      };
    case "formula":
      return no;
  }
}

// Aplica as ocorrências dadas, agrupadas por bloco e campo. As ocorrências
// têm de ter vindo de `buscarNoDocumento` sobre este mesmo documento.
function aplicar<D extends CorpoDoDocumento>(
  documento: D,
  ocorrencias: readonly OcorrenciaBusca[],
  substituto: string,
): D {
  const faixasDe = (onde: LocalCitacao) => (campo: CampoTexto) =>
    ocorrencias
      .filter(
        (ocorrencia) =>
          ocorrencia.onde.tipo === onde.tipo &&
          ocorrencia.onde.id === onde.id &&
          mesmoCampo(ocorrencia.campo, campo),
      )
      .map(({ inicio, fim }) => ({ inicio, fim }))
      .sort((a, b) => a.inicio - b.inicio);

  return {
    ...documento,
    sections: documento.sections.map((secao) =>
      trocarNoBloco(secao, faixasDe({ tipo: "secao", id: secao.id }), substituto),
    ),
    apendices: documento.apendices.map((bloco) =>
      trocarNoBloco(bloco, faixasDe({ tipo: "apendice", id: bloco.id }), substituto),
    ),
    anexos: documento.anexos.map((bloco) =>
      trocarNoBloco(bloco, faixasDe({ tipo: "anexo", id: bloco.id }), substituto),
    ),
  };
}

// Troca todas as ocorrências do documento, de uma vez. As ocorrências são
// achadas no texto original: um substituto que contém o termo ("a" por "aa")
// não é procurado de novo.
export function substituirTodas<D extends CorpoDoDocumento>(
  documento: D,
  termo: string,
  substituto: string,
  opcoes: OpcoesBusca = {},
): ResultadoSubstituicao<D> {
  const ocorrencias = buscarNoDocumento(documento, termo, opcoes);
  if (ocorrencias.length === 0) return { documento, substituidas: 0 };
  return {
    documento: aplicar(documento, ocorrencias, substituto),
    substituidas: ocorrencias.length,
  };
}

// Troca uma ocorrência só, a que o aluno está vendo. Ela tem de ter vindo de
// `buscarNoDocumento` sobre este mesmo documento.
export function substituirOcorrencia<D extends CorpoDoDocumento>(
  documento: D,
  ocorrencia: OcorrenciaBusca,
  substituto: string,
): D {
  return aplicar(documento, [ocorrencia], substituto);
}
