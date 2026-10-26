import type { CelulaTabela, LinhaTabela } from "../types";

// --- Células mescladas (passo 8.5.4) -----------------------------------------
//
// A grade é retangular: a âncora diz quantas colunas e linhas ocupa
// (`colspan`, `rowspan`), e as células que ela cobre continuam na grade,
// marcadas `coberta` (ver `CelulaTabela` em types.ts). Daqui sai o que é
// mescla válida para a tela, o `.docx`, o `.tex`, a prévia e as importações:
// nenhum deles decide sozinho.

export interface Mescla {
  linha: number;
  coluna: number;
  linhas: number;
  colunas: number;
}

// O que a regra lê de uma célula: a da tabela canônica ou os atributos do
// nó do editor.
export interface CelulaMesclavel {
  colspan?: number;
  rowspan?: number;
}

// Mescla maior que isto não é de tabela de TCC; o teto protege a grade de um
// arquivo importado com `colspan="10000"`.
export const MESCLA_MAXIMA = 50;

function vao(valor: number | undefined): number {
  return Number.isInteger(valor) && valor! > 1 ? Math.min(valor!, MESCLA_MAXIMA) : 1;
}

// As mesclas da grade e quais células elas cobrem, em ordem de leitura. A
// âncora que cairia sobre uma célula já coberta, ou passaria da borda, é
// encolhida até caber; a que encolhe até 1 × 1 deixa de ser mescla. O
// `coberta` gravado não é lido: a cobertura sai das âncoras.
export function mapaDeMesclas(grade: readonly (readonly CelulaMesclavel[])[]): {
  mesclas: Mescla[];
  cobertas: boolean[][];
} {
  const linhas = grade.length;
  const colunas = Math.max(0, ...grade.map((linha) => linha.length));
  const cobertas = grade.map(() => Array<boolean>(colunas).fill(false));
  const mesclas: Mescla[] = [];

  grade.forEach((linha, l) => {
    linha.forEach((celula, c) => {
      if (cobertas[l][c]) return;
      let largura = Math.min(vao(celula.colspan), colunas - c);
      let altura = Math.min(vao(celula.rowspan), linhas - l);
      // A primeira linha da mescla não pode passar por cima de célula já
      // coberta; as de baixo também não.
      for (let k = 1; k < largura; k++) {
        if (cobertas[l][c + k] || c + k >= grade[l].length) {
          largura = k;
          break;
        }
      }
      for (let k = 1; k < altura; k++) {
        const livre = Array.from({ length: largura }, (_, d) => c + d).every(
          (coluna) => !cobertas[l + k][coluna] && coluna < grade[l + k].length,
        );
        if (!livre) {
          altura = k;
          break;
        }
      }
      if (largura === 1 && altura === 1) return;
      mesclas.push({ linha: l, coluna: c, linhas: altura, colunas: largura });
      for (let dl = 0; dl < altura; dl++) {
        for (let dc = 0; dc < largura; dc++) {
          if (dl > 0 || dc > 0) cobertas[l + dl][c + dc] = true;
        }
      }
    });
  });
  return { mesclas, cobertas };
}

// A mescla que contém a célula (linha, coluna), ou `null` se ela está solta.
export function mesclaEm(mesclas: readonly Mescla[], linha: number, coluna: number): Mescla | null {
  return (
    mesclas.find(
      (m) =>
        linha >= m.linha &&
        linha < m.linha + m.linhas &&
        coluna >= m.coluna &&
        coluna < m.coluna + m.colunas,
    ) ?? null
  );
}

// A tabela canônica com as mesclas coerentes: âncora com o vão que cabe,
// células cobertas vazias e marcadas, e o resto sem marca nenhuma. Quem
// recebe uma grade de fora (importação, documento gravado) passa por aqui.
export function normalizarMesclas(linhas: readonly LinhaTabela[]): LinhaTabela[] {
  const { mesclas, cobertas } = mapaDeMesclas(linhas.map((linha) => linha.celulas));
  return linhas.map((linha, l) => ({
    celulas: linha.celulas.map((celula, c): CelulaTabela => {
      if (cobertas[l][c]) return { cabecalho: celula.cabecalho, coberta: true };
      const solta: CelulaTabela = {
        cabecalho: celula.cabecalho,
        ...(celula.content ? { content: celula.content } : {}),
      };
      const mescla = mesclas.find((m) => m.linha === l && m.coluna === c);
      if (!mescla) return solta;
      return {
        ...solta,
        ...(mescla.colunas > 1 ? { colspan: mescla.colunas } : {}),
        ...(mescla.linhas > 1 ? { rowspan: mescla.linhas } : {}),
      };
    }),
  }));
}

// Quantas linhas, do começo da tabela, formam o espaço do cabeçalho: as
// primeiras linhas em que toda célula é de cabeçalho. Morava em
// `export/docx/table.ts` até o passo 6.2.1; veio para cá porque o `.tex`
// precisa da mesma divisão (o que repete na página seguinte, o traço que
// separa o cabeçalho do corpo), e os dois formatos não podem discordar dela.
export function linhasDeCabecalho(linhas: readonly LinhaTabela[]): number {
  const primeiraDoCorpo = linhas.findIndex(
    (linha) => linha.celulas.length === 0 || !linha.celulas.every((celula) => celula.cabecalho),
  );
  return primeiraDoCorpo === -1 ? linhas.length : primeiraDoCorpo;
}

// Fração da largura útil que cabe a cada coluna, pelo texto das células — o
// que o `.docx`, o `.tex` e a tela usam, para os três saírem iguais.
//
// Eram colunas de largura igual (herança da PoC). Num cronograma, com a
// coluna de atividades e seis meses, isso deixava as atividades numa faixa
// estreita, quebradas em quatro ou cinco linhas, e os meses quase vazios
// (achado no TCC exportado, 02/10/2026). A conta é a do layout automático de
// tabela do navegador, medida em caracteres:
// - **mínimo** de cada coluna: a palavra mais longa dela, ou o texto inteiro
//   quando é curto (até `CURTO` caracteres: "Mês 1" não quebra em duas linhas);
// - **desejado**: o texto mais longo, sem quebrar;
// - cabendo tudo no desejado, a sobra é repartida por igual (tabela de textos
//   curtos continua quase de colunas iguais, como antes); não cabendo nem o
//   mínimo, proporção do mínimo; no meio, cada coluna ganha além do mínimo na
//   proporção do que ainda lhe falta.
//
// Caracteres, e não a largura real do texto: o núcleo não tem fonte nem
// medida (CLAUDE.md, `src/core/` sem DOM). A proporção é o que importa, e a
// mesma para Times e Arial.
const CURTO = 12;
const MINIMO_POR_COLUNA = 3; // coluna vazia não some
const CARACTERES_NA_LARGURA_UTIL = 70; // 16 cm em 12 pt, já sem o respiro das células

// O texto de cada célula da tabela canônica, para `proporcoesDasColunas`. A
// tela passa o `textContent` das células do ProseMirror, que dá o mesmo.
//
// A célula que ocupa mais de uma coluna não entra na conta (passo 8.5.4): o
// texto dela se reparte entre as colunas que ocupa, e contá-lo inteiro na
// primeira alargaria só essa. Como no layout automático do navegador, as
// colunas saem das células soltas.
export function textosDasCelulas(linhas: readonly LinhaTabela[]): string[][] {
  return linhas.map((linha) =>
    linha.celulas.map((celula) =>
      (celula.colspan ?? 1) > 1 ? "" : (celula.content ?? []).map((no) => no.text).join(""),
    ),
  );
}

export function proporcoesDasColunas(textos: readonly (readonly string[])[]): number[] {
  const colunas = Math.max(1, ...textos.map((linha) => linha.length));
  const minimos = Array<number>(colunas).fill(MINIMO_POR_COLUNA);
  const desejados = Array<number>(colunas).fill(MINIMO_POR_COLUNA);

  for (const linha of textos) {
    linha.forEach((bruto, coluna) => {
      const texto = bruto.replace(/\s+/g, " ").trim();
      const palavraMaisLonga = Math.max(0, ...texto.split(" ").map((palavra) => palavra.length));
      const minimo = texto.length <= CURTO ? texto.length : palavraMaisLonga;
      minimos[coluna] = Math.max(minimos[coluna], minimo);
      desejados[coluna] = Math.max(desejados[coluna], texto.length);
    });
  }

  const disponivel = Math.max(colunas, CARACTERES_NA_LARGURA_UTIL - 2 * colunas);
  const soma = (valores: number[]) => valores.reduce((total, valor) => total + valor, 0);
  const somaMinimos = soma(minimos);
  const somaDesejados = soma(desejados);

  let larguras: number[];
  if (somaDesejados <= disponivel) {
    const sobra = (disponivel - somaDesejados) / colunas;
    larguras = desejados.map((desejado) => desejado + sobra);
  } else if (somaMinimos >= disponivel) larguras = minimos;
  else {
    const fator = (disponivel - somaMinimos) / (somaDesejados - somaMinimos);
    larguras = minimos.map((minimo, coluna) => minimo + (desejados[coluna] - minimo) * fator);
  }

  const total = soma(larguras);
  return larguras.map((largura) => largura / total);
}
