import type { LinhaTabela } from "../types";

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
export function textosDasCelulas(linhas: readonly LinhaTabela[]): string[][] {
  return linhas.map((linha) =>
    linha.celulas.map((celula) => (celula.content ?? []).map((no) => no.text).join("")),
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
