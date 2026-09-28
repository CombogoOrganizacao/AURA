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
