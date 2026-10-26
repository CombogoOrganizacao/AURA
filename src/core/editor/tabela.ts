import { closeHistory } from "@tiptap/pm/history";
import { Fragment, type Node as NoProseMirror } from "@tiptap/pm/model";
import { TextSelection, type Selection, type Transaction } from "@tiptap/pm/state";

import { mapaDeMesclas, mesclaEm, type Mescla } from "../document/elements/tabela";
import { cursorDepoisDoBloco } from "./caret";

// Editar a grade da tabela (passo 6.1.3b): acrescentar e remover linha e
// coluna, marcar o cabeçalho, excluir a tabela; e, desde o 8.5.4, mesclar e
// separar células.
//
// Os nós são os do próprio AURA (src/core/editor/nodes/table.ts), não os do
// `prosemirror-tables`, então os comandos também são. Cada operação monta a
// tabela nova inteira e troca a antiga por ela num `replaceWith` só: a grade
// de uma tabela de TCC tem dezenas de células, não milhares, e reconstruir é
// mais simples de provar certo do que calcular a posição de cada inserção
// célula a célula. O desfazer volta a operação inteira num passo.
//
// **A grade é retangular, com ou sem mescla.** A célula coberta por uma
// mescla continua na linha, vazia e marcada `coberta` (`CelulaTabela` em
// document/types.ts). Cada operação trabalha numa matriz de células e numa
// lista de mesclas, ajusta as duas, e `montarLinhas()` escreve de novo os
// atributos de mescla de toda célula: nenhuma operação mexe neles à mão.
//
// **O cabeçalho é sempre um bloco contínuo a partir da primeira linha.** É o
// que o exportador espera (`linhasDeCabecalho()` em export/docx/table.ts) e o
// que o Word consegue repetir no alto de cada página (IBGE §8.3 a): ele só
// repete linhas inteiras, e a partir da primeira. Nenhuma operação daqui
// deixa uma linha de cabeçalho solta no meio do corpo, e nenhuma mescla junta
// cabeçalho e corpo.
//
// Mesma convenção de `caret.ts`/`reorder.ts`: recebem `tr` mutável, devolvem
// `true` se mudaram algo, e são testáveis só com `EditorState`, sem DOM.

export type LadoLinha = "acima" | "abaixo";
export type LadoColuna = "esquerda" | "direita";

export interface CelulaNaTabela {
  /** Posição da tabela no documento (antes da borda de abertura dela). */
  posTabela: number;
  tabela: NoProseMirror;
  linha: number;
  coluna: number;
}

// Em que célula a seleção está, subindo da posição do cursor. `null` fora de
// tabela — é o que desliga os botões. `linha` e `coluna` são índices da
// grade: a célula coberta conta.
export function celulaDaSelecao(selecao: Selection): CelulaNaTabela | null {
  return celulaEm(selecao.$from);
}

function celulaEm($pos: Selection["$from"]): CelulaNaTabela | null {
  for (let profundidade = $pos.depth; profundidade >= 2; profundidade--) {
    if ($pos.node(profundidade).type.name !== "celula_tabela") continue;
    // celula_tabela > linha_tabela > tabela, sempre: o schema não deixa
    // nenhum nível no meio.
    return {
      posTabela: $pos.before(profundidade - 2),
      tabela: $pos.node(profundidade - 2),
      linha: $pos.index(profundidade - 2),
      coluna: $pos.index(profundidade - 1),
    };
  }

  return null;
}

// --- A grade como matriz -----------------------------------------------------

type Matriz = NoProseMirror[][];

function matrizDe(tabela: NoProseMirror): Matriz {
  const linhas: Matriz = [];
  tabela.forEach((linha) => {
    const celulas: NoProseMirror[] = [];
    linha.forEach((celula) => celulas.push(celula));
    linhas.push(celulas);
  });
  return linhas;
}

function mesclasDe(tabela: NoProseMirror): Mescla[] {
  return mapaDeMesclas(matrizDe(tabela).map((linha) => linha.map((celula) => celula.attrs)))
    .mesclas;
}

function ehCabecalho(linha: readonly NoProseMirror[] | undefined): boolean {
  return linha !== undefined && linha.length > 0 && linha[0].attrs.cabecalho === true;
}

function celulaVazia(tabela: NoProseMirror, cabecalho: boolean): NoProseMirror {
  return tabela.type.schema.nodes.celula_tabela.create({ cabecalho });
}

function linhaVazia(tabela: NoProseMirror, colunas: number, cabecalho: boolean): NoProseMirror[] {
  return Array.from({ length: colunas }, () => celulaVazia(tabela, cabecalho));
}

function comCabecalho(linha: readonly NoProseMirror[], cabecalho: boolean): NoProseMirror[] {
  return linha.map((celula) =>
    celula.attrs.cabecalho === cabecalho
      ? celula
      : celula.type.create({ ...celula.attrs, cabecalho }, celula.content, celula.marks),
  );
}

// As linhas da tabela nova, com os atributos de mescla de toda célula
// escritos a partir da lista: a âncora leva o vão, a coberta fica vazia, e as
// outras voltam a 1 × 1. Mescla que encolheu a 1 × 1 deixa de existir.
function montarLinhas(tabela: NoProseMirror, matriz: Matriz, mesclas: Mescla[]): NoProseMirror[] {
  const validas = mesclas.filter((m) => m.linhas > 1 || m.colunas > 1);
  return matriz.map((linha, l) =>
    tabela.type.schema.nodes.linha_tabela.create(
      null,
      linha.map((celula, c) => {
        const mescla = mesclaEm(validas, l, c);
        const ancora = mescla !== null && mescla.linha === l && mescla.coluna === c;
        const coberta = mescla !== null && !ancora;
        const attrs = {
          ...celula.attrs,
          colspan: ancora ? mescla.colunas : 1,
          rowspan: ancora ? mescla.linhas : 1,
          coberta,
        };
        const igual =
          attrs.colspan === celula.attrs.colspan &&
          attrs.rowspan === celula.attrs.rowspan &&
          attrs.coberta === celula.attrs.coberta &&
          !(coberta && celula.content.size > 0);
        return igual
          ? celula
          : celula.type.create(attrs, coberta ? Fragment.empty : celula.content, celula.marks);
      }),
    ),
  );
}

// A célula que o cursor deve receber: a própria, ou, se ela está coberta, a
// âncora da mescla que a cobre.
function visivel(mesclas: readonly Mescla[], linha: number, coluna: number) {
  const mescla = mesclaEm(mesclas, linha, coluna);
  return mescla ? { linha: mescla.linha, coluna: mescla.coluna } : { linha, coluna };
}

// Troca a tabela e põe o cursor no começo da célula (linha, coluna) da nova.
function trocarTabela(
  tr: Transaction,
  posTabela: number,
  antiga: NoProseMirror,
  matriz: Matriz,
  mesclas: Mescla[],
  destino: { linha: number; coluna: number },
): void {
  const linhas = montarLinhas(antiga, matriz, mesclas);
  const nova = antiga.copy(Fragment.from(linhas));
  // Evento próprio no histórico: sem isto, duas operações em menos de 500 ms
  // (a janela do `prosemirror-history`) iam para o mesmo passo, e um Ctrl+Z
  // desfazia mesclar e separar juntos.
  closeHistory(tr);
  tr.replaceWith(posTabela, posTabela + antiga.nodeSize, nova);

  const alvo = visivel(mesclasDe(nova), Math.min(destino.linha, linhas.length - 1), destino.coluna);
  let pos = posTabela + 1;
  for (let i = 0; i < alvo.linha; i++) pos += linhas[i].nodeSize;
  pos += 1; // borda de abertura da linha
  const coluna = Math.min(alvo.coluna, linhas[alvo.linha].childCount - 1);
  for (let i = 0; i < coluna; i++) pos += linhas[alvo.linha].child(i).nodeSize;
  pos += 1; // borda de abertura da célula

  tr.setSelection(TextSelection.create(tr.doc, pos));
}

// --- Linhas e colunas --------------------------------------------------------

// Linha nova do tamanho da linha em que o cursor está.
//
// Se ela é de cabeçalho ou de corpo depende de onde cai, para o cabeçalho
// continuar contínuo: acima de uma linha de cabeçalho, é cabeçalho; abaixo
// de uma, só se a seguinte também for (inserir entre duas linhas de
// cabeçalho). Abaixo da última linha de cabeçalho, que é o gesto comum de
// "começar os dados", nasce corpo.
//
// Caindo no meio de uma mescla de várias linhas, a mescla cresce e cobre a
// célula nova daquela coluna, como no Word.
export function inserirLinha(tr: Transaction, lado: LadoLinha): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const matriz = matrizDe(alvo.tabela);
  const mesclas = mesclasDe(alvo.tabela);
  const mescla = mesclaEm(mesclas, alvo.linha, alvo.coluna);
  // "Abaixo" de uma célula mesclada é abaixo da mescla inteira.
  const indice =
    lado === "acima"
      ? (mescla?.linha ?? alvo.linha)
      : mescla
        ? mescla.linha + mescla.linhas
        : alvo.linha + 1;
  const cabecalho =
    lado === "acima"
      ? ehCabecalho(matriz[indice])
      : ehCabecalho(matriz[indice - 1]) && ehCabecalho(matriz[indice]);

  matriz.splice(indice, 0, linhaVazia(alvo.tabela, matriz[0].length, cabecalho));
  for (const m of mesclas) {
    if (m.linha >= indice) m.linha++;
    else if (indice < m.linha + m.linhas) m.linhas++;
  }
  trocarTabela(tr, alvo.posTabela, alvo.tabela, matriz, mesclas, {
    linha: indice,
    coluna: alvo.coluna,
  });
  return true;
}

// Tira a linha `indice` da matriz e acerta as mesclas. A mescla que começava
// nela passa a começar na de baixo, levando o texto.
function tirarLinha(matriz: Matriz, mesclas: Mescla[], indice: number) {
  for (const m of mesclas) {
    if (m.linha === indice && m.linhas > 1) {
      const ancora = matriz[indice][m.coluna];
      const abaixo = matriz[indice + 1][m.coluna];
      matriz[indice + 1][m.coluna] = abaixo.type.create(abaixo.attrs, ancora.content, ancora.marks);
    }
  }
  matriz.splice(indice, 1);
  for (const m of mesclas) {
    if (m.linha > indice) m.linha--;
    else if (indice < m.linha + m.linhas) m.linhas--;
  }
}

function tirarColuna(matriz: Matriz, mesclas: Mescla[], indice: number) {
  for (const m of mesclas) {
    if (m.coluna === indice && m.colunas > 1) {
      const ancora = matriz[m.linha][indice];
      const ao = matriz[m.linha][indice + 1];
      matriz[m.linha][indice + 1] = ao.type.create(ao.attrs, ancora.content, ancora.marks);
    }
  }
  for (const linha of matriz) linha.splice(indice, 1);
  for (const m of mesclas) {
    if (m.coluna > indice) m.coluna--;
    else if (indice < m.coluna + m.colunas) m.colunas--;
  }
}

// A última linha não sai por aqui: tabela sem linha não cabe no schema
// (`linha_tabela+`). Para tirar tudo, `excluirTabela()`.
export function removerLinha(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo || alvo.tabela.childCount <= 1) return false;

  const matriz = matrizDe(alvo.tabela);
  const mesclas = mesclasDe(alvo.tabela);
  tirarLinha(matriz, mesclas, alvo.linha);
  trocarTabela(tr, alvo.posTabela, alvo.tabela, matriz, mesclas, alvo);
  return true;
}

// Coluna nova em todas as linhas. Cada célula nova herda o papel da linha:
// cabeçalho na linha de cabeçalho, corpo no corpo. Caindo no meio de uma
// mescla de várias colunas, a mescla cresce.
export function inserirColuna(tr: Transaction, lado: LadoColuna): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const matriz = matrizDe(alvo.tabela);
  const mesclas = mesclasDe(alvo.tabela);
  const mescla = mesclaEm(mesclas, alvo.linha, alvo.coluna);
  const indice =
    lado === "esquerda"
      ? (mescla?.coluna ?? alvo.coluna)
      : mescla
        ? mescla.coluna + mescla.colunas
        : alvo.coluna + 1;
  for (const linha of matriz) {
    linha.splice(Math.min(indice, linha.length), 0, celulaVazia(alvo.tabela, ehCabecalho(linha)));
  }
  for (const m of mesclas) {
    if (m.coluna >= indice) m.coluna++;
    else if (indice < m.coluna + m.colunas) m.colunas++;
  }
  trocarTabela(tr, alvo.posTabela, alvo.tabela, matriz, mesclas, {
    linha: alvo.linha,
    coluna: indice,
  });
  return true;
}

// Mesma trava de `removerLinha()`: linha sem célula não cabe no schema
// (`celula_tabela+`).
export function removerColuna(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo || alvo.tabela.firstChild!.childCount <= 1) return false;

  const matriz = matrizDe(alvo.tabela);
  const mesclas = mesclasDe(alvo.tabela);
  tirarColuna(matriz, mesclas, alvo.coluna);
  trocarTabela(tr, alvo.posTabela, alvo.tabela, matriz, mesclas, alvo);
  return true;
}

// Liga ou desliga o cabeçalho a partir da linha do cursor.
//
// Ligar numa linha de corpo faz dela a última do cabeçalho (todas as de cima
// viram cabeçalho também); desligar numa linha de cabeçalho a devolve ao
// corpo junto com as de baixo. É o que mantém o cabeçalho contínuo sem pedir
// à pessoa que marque linha por linha na ordem certa.
//
// A fronteira nova não pode cortar uma mescla de várias linhas: ela juntaria
// cabeçalho e corpo. A fronteira desce (ou sobe) até o fim (ou o começo) da
// mescla.
export function alternarCabecalho(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const matriz = matrizDe(alvo.tabela);
  const mesclas = mesclasDe(alvo.tabela);
  const ligar = !ehCabecalho(matriz[alvo.linha]);
  // Última linha do cabeçalho, ao ligar; primeira do corpo, ao desligar.
  let fronteira = alvo.linha;
  for (let mudou = true; mudou;) {
    mudou = false;
    for (const m of mesclas) {
      if (m.linhas < 2) continue;
      const fim = m.linha + m.linhas - 1;
      if (ligar && m.linha <= fronteira && fronteira < fim) {
        fronteira = fim;
        mudou = true;
      }
      if (!ligar && m.linha < fronteira && fronteira <= fim) {
        fronteira = m.linha;
        mudou = true;
      }
    }
  }
  const novas = matriz.map((linha, indice) => {
    if (ligar) return indice <= fronteira ? comCabecalho(linha, true) : linha;
    return indice >= fronteira ? comCabecalho(linha, false) : linha;
  });

  trocarTabela(tr, alvo.posTabela, alvo.tabela, novas, mesclas, alvo);
  return true;
}

export function linhaEhCabecalho(alvo: CelulaNaTabela): boolean {
  return alvo.tabela.child(alvo.linha).firstChild?.attrs.cabecalho === true;
}

export function excluirTabela(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  tr.delete(alvo.posTabela, alvo.posTabela + alvo.tabela.nodeSize);
  return true;
}

// Acrescenta uma linha de corpo no fim da tabela, qualquer que seja a linha do
// cursor (o "+" da borda de baixo, passo 8.5.3). O cursor vai para ela, na
// mesma coluna em que estava.
export function acrescentarLinhaNoFim(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const matriz = matrizDe(alvo.tabela);
  matriz.push(linhaVazia(alvo.tabela, matriz[0].length, false));
  trocarTabela(tr, alvo.posTabela, alvo.tabela, matriz, mesclasDe(alvo.tabela), {
    linha: matriz.length - 1,
    coluna: alvo.coluna,
  });
  return true;
}

// O mesmo para a coluna: uma célula nova no fim de cada linha, com o papel
// da linha. O cursor vai para a coluna nova, na mesma linha.
export function acrescentarColunaNoFim(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const matriz = matrizDe(alvo.tabela);
  const novaColuna = matriz[0].length;
  for (const linha of matriz) linha.push(celulaVazia(alvo.tabela, ehCabecalho(linha)));
  trocarTabela(tr, alvo.posTabela, alvo.tabela, matriz, mesclasDe(alvo.tabela), {
    linha: alvo.linha,
    coluna: novaColuna,
  });
  return true;
}

// Mover uma linha que faz parte de uma mescla de várias linhas a partiria:
// a mescla não anda inteira por troca com a vizinha. O mesmo para coluna.
function linhaPresa(mesclas: readonly Mescla[], linha: number): boolean {
  return mesclas.some((m) => m.linhas > 1 && linha >= m.linha && linha < m.linha + m.linhas);
}

function colunaPresa(mesclas: readonly Mescla[], coluna: number): boolean {
  return mesclas.some((m) => m.colunas > 1 && coluna >= m.coluna && coluna < m.coluna + m.colunas);
}

export function podeMoverLinha(alvo: CelulaNaTabela, lado: LadoLinha): boolean {
  const destino = lado === "acima" ? alvo.linha - 1 : alvo.linha + 1;
  if (destino < 0 || destino >= alvo.tabela.childCount) return false;
  const mesclas = mesclasDe(alvo.tabela);
  return !linhaPresa(mesclas, alvo.linha) && !linhaPresa(mesclas, destino);
}

export function podeMoverColuna(alvo: CelulaNaTabela, lado: LadoColuna): boolean {
  const destino = lado === "esquerda" ? alvo.coluna - 1 : alvo.coluna + 1;
  if (destino < 0 || destino >= alvo.tabela.firstChild!.childCount) return false;
  const mesclas = mesclasDe(alvo.tabela);
  return !colunaPresa(mesclas, alvo.coluna) && !colunaPresa(mesclas, destino);
}

// Troca a linha do cursor com a vizinha (passo 8.5.3). O conteúdo anda, o
// papel não: cabeçalho é um bloco contínuo a partir do alto (ver o topo do
// arquivo), e uma linha de corpo subindo para o cabeçalho, ou o contrário,
// o quebraria. O cursor acompanha a linha que andou. A mescla de uma linha
// só (várias colunas) anda com ela.
export function moverLinha(tr: Transaction, lado: LadoLinha): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo || !podeMoverLinha(alvo, lado)) return false;

  const matriz = matrizDe(alvo.tabela);
  const mesclas = mesclasDe(alvo.tabela);
  const destino = lado === "acima" ? alvo.linha - 1 : alvo.linha + 1;
  const papeis = matriz.map(ehCabecalho);
  [matriz[alvo.linha], matriz[destino]] = [matriz[destino], matriz[alvo.linha]];
  for (const m of mesclas) {
    if (m.linha === alvo.linha) m.linha = destino;
    else if (m.linha === destino) m.linha = alvo.linha;
  }
  const trocadas = matriz.map((linha, indice) => comCabecalho(linha, papeis[indice]));
  trocarTabela(tr, alvo.posTabela, alvo.tabela, trocadas, mesclas, {
    linha: destino,
    coluna: alvo.coluna,
  });
  return true;
}

// Troca a coluna do cursor com a vizinha, em todas as linhas. O papel de cada
// célula vem da linha, então não muda. A mescla de uma coluna só (várias
// linhas) anda com ela.
export function moverColuna(tr: Transaction, lado: LadoColuna): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo || !podeMoverColuna(alvo, lado)) return false;

  const matriz = matrizDe(alvo.tabela);
  const mesclas = mesclasDe(alvo.tabela);
  const destino = lado === "esquerda" ? alvo.coluna - 1 : alvo.coluna + 1;
  for (const linha of matriz) {
    [linha[alvo.coluna], linha[destino]] = [linha[destino], linha[alvo.coluna]];
  }
  for (const m of mesclas) {
    if (m.coluna === alvo.coluna) m.coluna = destino;
    else if (m.coluna === destino) m.coluna = alvo.coluna;
  }
  trocarTabela(tr, alvo.posTabela, alvo.tabela, matriz, mesclas, {
    linha: alvo.linha,
    coluna: destino,
  });
  return true;
}

// --- Mesclar e separar (passo 8.5.4) ----------------------------------------

export interface Retangulo {
  linha: number;
  coluna: number;
  linhas: number;
  colunas: number;
}

// O retângulo cresce até conter inteira toda mescla que ele toca: mesclar
// meia mescla não tem sentido.
function crescerAteAsMesclas(retangulo: Retangulo, mesclas: readonly Mescla[]): Retangulo {
  let r = { ...retangulo };
  for (let mudou = true; mudou;) {
    mudou = false;
    for (const m of mesclas) {
      const toca =
        m.linha < r.linha + r.linhas &&
        m.linha + m.linhas > r.linha &&
        m.coluna < r.coluna + r.colunas &&
        m.coluna + m.colunas > r.coluna;
      if (!toca) continue;
      const linha = Math.min(r.linha, m.linha);
      const coluna = Math.min(r.coluna, m.coluna);
      const proximo = {
        linha,
        coluna,
        linhas: Math.max(r.linha + r.linhas, m.linha + m.linhas) - linha,
        colunas: Math.max(r.coluna + r.colunas, m.coluna + m.colunas) - coluna,
      };
      if (JSON.stringify(proximo) !== JSON.stringify(r)) {
        r = proximo;
        mudou = true;
      }
    }
  }
  return r;
}

// Por que o retângulo não pode virar uma célula só, ou `null` se pode.
function recusaDaMescla(matriz: Matriz, r: Retangulo): string | null {
  if (r.linhas * r.colunas < 2) return "Selecione mais de uma célula.";
  if (r.linha + r.linhas > matriz.length || r.coluna + r.colunas > matriz[0].length) {
    return "A seleção passa da borda da tabela.";
  }
  const papeis = new Set(
    Array.from({ length: r.linhas }, (_, i) => ehCabecalho(matriz[r.linha + i])),
  );
  if (papeis.size > 1) return "Cabeçalho e corpo não se mesclam.";
  return null;
}

// O retângulo que a seleção cobre quando vai de uma célula a outra da mesma
// tabela (arrastando o mouse, ou Shift + setas), já crescido até as mesclas
// que toca. `null` com a seleção numa célula só, ou fora de tabela.
export function retanguloDaSelecao(
  selecao: Selection,
): (Retangulo & { posTabela: number; tabela: NoProseMirror }) | null {
  const de = celulaEm(selecao.$from);
  const ate = celulaEm(selecao.$to);
  if (!de || !ate || de.posTabela !== ate.posTabela) return null;
  if (de.linha === ate.linha && de.coluna === ate.coluna) return null;
  const linha = Math.min(de.linha, ate.linha);
  const coluna = Math.min(de.coluna, ate.coluna);
  return {
    posTabela: de.posTabela,
    tabela: de.tabela,
    ...crescerAteAsMesclas(
      {
        linha,
        coluna,
        linhas: Math.max(de.linha, ate.linha) - linha + 1,
        colunas: Math.max(de.coluna, ate.coluna) - coluna + 1,
      },
      mesclasDe(de.tabela),
    ),
  };
}

// O retângulo da célula do cursor (ou da mescla em que ela está) mais a
// vizinha da direita ou de baixo.
function retanguloComVizinha(alvo: CelulaNaTabela, lado: "direita" | "abaixo"): Retangulo {
  const mesclas = mesclasDe(alvo.tabela);
  const atual = mesclaEm(mesclas, alvo.linha, alvo.coluna) ?? {
    linha: alvo.linha,
    coluna: alvo.coluna,
    linhas: 1,
    colunas: 1,
  };
  return crescerAteAsMesclas(
    lado === "direita"
      ? { ...atual, colunas: atual.colunas + 1 }
      : { ...atual, linhas: atual.linhas + 1 },
    mesclas,
  );
}

export function recusaDeMesclarComVizinha(
  alvo: CelulaNaTabela,
  lado: "direita" | "abaixo",
): string | null {
  return recusaDaMescla(matrizDe(alvo.tabela), retanguloComVizinha(alvo, lado));
}

export function recusaDeMesclarSelecao(selecao: Selection): string | null {
  const r = retanguloDaSelecao(selecao);
  if (!r) return "Selecione mais de uma célula.";
  return recusaDaMescla(matrizDe(r.tabela), r);
}

// O retângulo vira uma célula só. O texto de todas vai para a de cima à
// esquerda, na ordem de leitura e separado por espaço, como no Word; as
// outras ficam cobertas.
function mesclar(tr: Transaction, posTabela: number, tabela: NoProseMirror, r: Retangulo): boolean {
  const matriz = matrizDe(tabela);
  if (recusaDaMescla(matriz, r)) return false;

  const textos: Fragment[] = [];
  for (let l = r.linha; l < r.linha + r.linhas; l++) {
    for (let c = r.coluna; c < r.coluna + r.colunas; c++) {
      if (matriz[l][c].content.size > 0) textos.push(matriz[l][c].content);
    }
  }
  const espaco = tabela.type.schema.text(" ");
  let juntos = Fragment.empty;
  textos.forEach((texto, i) => {
    juntos = juntos.append(i === 0 ? texto : Fragment.from(espaco).append(texto));
  });
  const ancora = matriz[r.linha][r.coluna];
  matriz[r.linha][r.coluna] = ancora.type.create(ancora.attrs, juntos, ancora.marks);

  const mesclas = mesclasDe(tabela).filter(
    (m) =>
      !(
        m.linha >= r.linha &&
        m.linha < r.linha + r.linhas &&
        m.coluna >= r.coluna &&
        m.coluna < r.coluna + r.colunas
      ),
  );
  mesclas.push({ linha: r.linha, coluna: r.coluna, linhas: r.linhas, colunas: r.colunas });
  trocarTabela(tr, posTabela, tabela, matriz, mesclas, r);
  return true;
}

export function mesclarSelecao(tr: Transaction): boolean {
  const r = retanguloDaSelecao(tr.selection);
  return r ? mesclar(tr, r.posTabela, r.tabela, r) : false;
}

export function mesclarComVizinha(tr: Transaction, lado: "direita" | "abaixo"): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;
  return mesclar(tr, alvo.posTabela, alvo.tabela, retanguloComVizinha(alvo, lado));
}

export function celulaMesclada(alvo: CelulaNaTabela): boolean {
  return mesclaEm(mesclasDe(alvo.tabela), alvo.linha, alvo.coluna) !== null;
}

// Desfaz a mescla do cursor: o texto fica na célula de cima à esquerda, e as
// outras voltam vazias.
export function separarCelulas(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;
  const mesclas = mesclasDe(alvo.tabela);
  const mescla = mesclaEm(mesclas, alvo.linha, alvo.coluna);
  if (!mescla) return false;

  trocarTabela(
    tr,
    alvo.posTabela,
    alvo.tabela,
    matrizDe(alvo.tabela),
    mesclas.filter((m) => m !== mescla),
    { linha: mescla.linha, coluna: mescla.coluna },
  );
  return true;
}

// --- O que os controles mostram ---------------------------------------------

// Tudo o que os controles da tabela (`ControlesDaTabela.tsx`) precisam saber
// para mostrar e habilitar os itens, calculado aqui para a regra não ficar
// repetida na tela. Dados simples: a tela o compara como texto a cada
// transação.
export interface EstadoGrade {
  posTabela: number;
  linhas: number;
  colunas: number;
  linha: number;
  coluna: number;
  cabecalho: boolean;
  mesclada: boolean;
  podeMoverLinha: Record<LadoLinha, boolean>;
  podeMoverColuna: Record<LadoColuna, boolean>;
  // `null`: pode; senão, por que não.
  recusaMesclar: Record<"direita" | "abaixo", string | null>;
  // A seleção vai de uma célula a outra desta tabela: `recusa` diz se o
  // retângulo pode virar uma célula só. `null` com a seleção numa célula.
  selecaoEntreCelulas: { recusa: string | null } | null;
}

export function estadoDaGrade(selecao: Selection): EstadoGrade | null {
  const alvo = celulaDaSelecao(selecao);
  if (!alvo) return null;
  const retangulo = retanguloDaSelecao(selecao);
  return {
    posTabela: alvo.posTabela,
    linhas: alvo.tabela.childCount,
    colunas: alvo.tabela.child(alvo.linha).childCount,
    linha: alvo.linha,
    coluna: alvo.coluna,
    cabecalho: linhaEhCabecalho(alvo),
    mesclada: celulaMesclada(alvo),
    podeMoverLinha: {
      acima: podeMoverLinha(alvo, "acima"),
      abaixo: podeMoverLinha(alvo, "abaixo"),
    },
    podeMoverColuna: {
      esquerda: podeMoverColuna(alvo, "esquerda"),
      direita: podeMoverColuna(alvo, "direita"),
    },
    recusaMesclar: {
      direita: recusaDeMesclarComVizinha(alvo, "direita"),
      abaixo: recusaDeMesclarComVizinha(alvo, "abaixo"),
    },
    selecaoEntreCelulas:
      retangulo && retangulo.posTabela === alvo.posTabela
        ? { recusa: recusaDaMescla(matrizDe(retangulo.tabela), retangulo) }
        : null,
  };
}

// --- Teclado dentro da tabela (passo 8.5.2) ---------------------------------
//
// A célula é `text*`: sem parágrafo por dentro, então o Enter e o Backspace
// padrão do ProseMirror partiriam ou fundiriam CÉLULAS e deixariam a grade
// torta. Estes comandos os substituem dentro da tabela. A célula coberta por
// uma mescla é pulada: ela está escondida.

// Cursor no começo da célula (linha, coluna), sem trocar a tabela.
function irParaCelula(tr: Transaction, alvo: CelulaNaTabela, linha: number, coluna: number) {
  let pos = alvo.posTabela + 1;
  for (let i = 0; i < linha; i++) pos += alvo.tabela.child(i).nodeSize;
  pos += 1;
  const celulas = alvo.tabela.child(linha);
  const ate = Math.min(coluna, celulas.childCount - 1);
  for (let i = 0; i < ate; i++) pos += celulas.child(i).nodeSize;
  tr.setSelection(TextSelection.create(tr.doc, pos + 1));
}

function coberta(tabela: NoProseMirror, linha: number, coluna: number): boolean {
  return tabela.child(linha).child(coluna).attrs.coberta === true;
}

// Tab: a célula seguinte, de linha em linha. Na última, acrescenta uma linha
// de corpo e vai para a primeira célula dela, como no Word.
export function celulaSeguinte(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const { tabela } = alvo;
  const colunas = tabela.child(0).childCount;
  for (let i = alvo.linha * colunas + alvo.coluna + 1; i < tabela.childCount * colunas; i++) {
    const linha = Math.floor(i / colunas);
    const coluna = i % colunas;
    if (coluna >= tabela.child(linha).childCount || coberta(tabela, linha, coluna)) continue;
    irParaCelula(tr, alvo, linha, coluna);
    return true;
  }
  const matriz = matrizDe(tabela);
  matriz.push(linhaVazia(tabela, colunas, false));
  trocarTabela(tr, alvo.posTabela, tabela, matriz, mesclasDe(tabela), {
    linha: matriz.length - 1,
    coluna: 0,
  });
  return true;
}

// Shift+Tab: a célula anterior. Na primeira, não faz nada (devolve `false`),
// e quem chama decide se segura a tecla.
export function celulaAnterior(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const { tabela } = alvo;
  const colunas = tabela.child(0).childCount;
  for (let i = alvo.linha * colunas + alvo.coluna - 1; i >= 0; i--) {
    const linha = Math.floor(i / colunas);
    const coluna = i % colunas;
    if (coluna >= tabela.child(linha).childCount || coberta(tabela, linha, coluna)) continue;
    irParaCelula(tr, alvo, linha, coluna);
    return true;
  }
  return false;
}

// Enter: desce para a célula de baixo, na mesma coluna (de uma célula
// mesclada, para a primeira linha depois da mescla). Na última linha, sai da
// tabela para a linha seguinte (que `cursorDepoisDoBloco()` garante que
// exista, o que também resolve o fim de seção do 8.1.3).
export function descerOuSair(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const mesclas = mesclasDe(alvo.tabela);
  const mescla = mesclaEm(mesclas, alvo.linha, alvo.coluna);
  const proxima = mescla ? mescla.linha + mescla.linhas : alvo.linha + 1;
  if (proxima < alvo.tabela.childCount) {
    const destino = visivel(mesclas, proxima, alvo.coluna);
    irParaCelula(tr, alvo, destino.linha, destino.coluna);
  } else {
    cursorDepoisDoBloco(tr, alvo.posTabela + alvo.tabela.nodeSize);
  }
  return true;
}

// Backspace no começo da célula, ou Delete no fim, ou qualquer apagar com a
// seleção cruzando células: o ProseMirror juntaria as células. Devolve `true`
// quando o apagar deve ser engolido. Apagar texto dentro da célula passa.
export function apagarFundiriaCelulas(selecao: Selection, tecla: "Backspace" | "Delete"): boolean {
  if (!celulaDaSelecao(selecao)) return false;

  const { $from, $to, empty } = selecao;
  if (!empty) return $from.parent !== $to.parent;
  return tecla === "Backspace"
    ? $from.parentOffset === 0
    : $from.parentOffset === $from.parent.content.size;
}
