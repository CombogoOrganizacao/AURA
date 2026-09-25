import { Fragment, type Node as NoProseMirror } from "@tiptap/pm/model";
import { TextSelection, type Selection, type Transaction } from "@tiptap/pm/state";

// Editar a grade da tabela (passo 6.1.3b): acrescentar e remover linha e
// coluna, marcar o cabeçalho, excluir a tabela.
//
// Os nós são os do próprio AURA (src/core/editor/nodes/table.ts), não os do
// `prosemirror-tables`, então os comandos também são. Cada operação monta a
// tabela nova inteira e troca a antiga por ela num `replaceWith` só: a grade
// de uma tabela de TCC tem dezenas de células, não milhares, e reconstruir é
// mais simples de provar certo do que calcular a posição de cada inserção
// célula a célula. O desfazer volta a operação inteira num passo.
//
// **O cabeçalho é sempre um bloco contínuo a partir da primeira linha.** É o
// que o exportador espera (`linhasDeCabecalho()` em export/docx/table.ts) e o
// que o Word consegue repetir no alto de cada página (IBGE §8.3 a): ele só
// repete linhas inteiras, e a partir da primeira. Nenhuma operação daqui
// deixa uma linha de cabeçalho solta no meio do corpo.
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
// tabela — é o que desliga os botões.
export function celulaDaSelecao(selecao: Selection): CelulaNaTabela | null {
  const $pos = selecao.$from;

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

function linhasDe(tabela: NoProseMirror): NoProseMirror[] {
  const linhas: NoProseMirror[] = [];
  tabela.forEach((linha) => linhas.push(linha));
  return linhas;
}

function celulasDe(linha: NoProseMirror): NoProseMirror[] {
  const celulas: NoProseMirror[] = [];
  linha.forEach((celula) => celulas.push(celula));
  return celulas;
}

function ehCabecalho(linha: NoProseMirror | undefined): boolean {
  return linha !== undefined && linha.childCount > 0 && linha.firstChild!.attrs.cabecalho === true;
}

function celulaVazia(tabela: NoProseMirror, cabecalho: boolean): NoProseMirror {
  return tabela.type.schema.nodes.celula_tabela.create({ cabecalho });
}

function linhaVazia(tabela: NoProseMirror, colunas: number, cabecalho: boolean): NoProseMirror {
  return tabela.type.schema.nodes.linha_tabela.create(
    null,
    Array.from({ length: colunas }, () => celulaVazia(tabela, cabecalho)),
  );
}

function linhaComCabecalho(linha: NoProseMirror, cabecalho: boolean): NoProseMirror {
  return linha.copy(
    Fragment.from(
      celulasDe(linha).map((celula) =>
        celula.attrs.cabecalho === cabecalho
          ? celula
          : celula.type.create({ ...celula.attrs, cabecalho }, celula.content, celula.marks),
      ),
    ),
  );
}

// Troca a tabela e põe o cursor no começo da célula (linha, coluna) da nova.
function trocarTabela(
  tr: Transaction,
  posTabela: number,
  antiga: NoProseMirror,
  linhas: NoProseMirror[],
  destino: { linha: number; coluna: number },
): void {
  const nova = antiga.copy(Fragment.from(linhas));
  tr.replaceWith(posTabela, posTabela + antiga.nodeSize, nova);

  const linha = Math.min(destino.linha, linhas.length - 1);
  let pos = posTabela + 1;
  for (let i = 0; i < linha; i++) pos += linhas[i].nodeSize;
  pos += 1; // borda de abertura da linha
  const celulas = celulasDe(linhas[linha]);
  const coluna = Math.min(destino.coluna, celulas.length - 1);
  for (let i = 0; i < coluna; i++) pos += celulas[i].nodeSize;
  pos += 1; // borda de abertura da célula

  tr.setSelection(TextSelection.create(tr.doc, pos));
}

// Linha nova do tamanho da linha em que o cursor está.
//
// Se ela é de cabeçalho ou de corpo depende de onde cai, para o cabeçalho
// continuar contínuo: acima de uma linha de cabeçalho, é cabeçalho; abaixo
// de uma, só se a seguinte também for (inserir entre duas linhas de
// cabeçalho). Abaixo da última linha de cabeçalho, que é o gesto comum de
// "começar os dados", nasce corpo.
export function inserirLinha(tr: Transaction, lado: LadoLinha): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const linhas = linhasDe(alvo.tabela);
  const colunas = linhas[alvo.linha].childCount;
  const indice = lado === "acima" ? alvo.linha : alvo.linha + 1;
  const cabecalho =
    lado === "acima"
      ? ehCabecalho(linhas[alvo.linha])
      : ehCabecalho(linhas[alvo.linha]) && ehCabecalho(linhas[alvo.linha + 1]);

  linhas.splice(indice, 0, linhaVazia(alvo.tabela, colunas, cabecalho));
  trocarTabela(tr, alvo.posTabela, alvo.tabela, linhas, { linha: indice, coluna: alvo.coluna });
  return true;
}

// A última linha não sai por aqui: tabela sem linha não cabe no schema
// (`linha_tabela+`). Para tirar tudo, `excluirTabela()`.
export function removerLinha(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo || alvo.tabela.childCount <= 1) return false;

  const linhas = linhasDe(alvo.tabela);
  linhas.splice(alvo.linha, 1);
  trocarTabela(tr, alvo.posTabela, alvo.tabela, linhas, alvo);
  return true;
}

// Coluna nova em todas as linhas. Cada célula nova herda o papel da linha:
// cabeçalho na linha de cabeçalho, corpo no corpo.
export function inserirColuna(tr: Transaction, lado: LadoColuna): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const indice = lado === "esquerda" ? alvo.coluna : alvo.coluna + 1;
  const linhas = linhasDe(alvo.tabela).map((linha) => {
    const celulas = celulasDe(linha);
    celulas.splice(Math.min(indice, celulas.length), 0, celulaVazia(alvo.tabela, ehCabecalho(linha)));
    return linha.copy(Fragment.from(celulas));
  });

  trocarTabela(tr, alvo.posTabela, alvo.tabela, linhas, { linha: alvo.linha, coluna: indice });
  return true;
}

// Mesma trava de `removerLinha()`: linha sem célula não cabe no schema
// (`celula_tabela+`).
export function removerColuna(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo || alvo.tabela.firstChild!.childCount <= 1) return false;

  const linhas = linhasDe(alvo.tabela).map((linha) => {
    const celulas = celulasDe(linha);
    if (celulas.length > 1 && alvo.coluna < celulas.length) celulas.splice(alvo.coluna, 1);
    return linha.copy(Fragment.from(celulas));
  });

  trocarTabela(tr, alvo.posTabela, alvo.tabela, linhas, alvo);
  return true;
}

// Liga ou desliga o cabeçalho a partir da linha do cursor.
//
// Ligar numa linha de corpo faz dela a última do cabeçalho (todas as de cima
// viram cabeçalho também); desligar numa linha de cabeçalho a devolve ao
// corpo junto com as de baixo. É o que mantém o cabeçalho contínuo sem pedir
// à pessoa que marque linha por linha na ordem certa.
export function alternarCabecalho(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  const linhas = linhasDe(alvo.tabela);
  const ligar = !ehCabecalho(linhas[alvo.linha]);
  const novas = linhas.map((linha, indice) => {
    if (ligar) return indice <= alvo.linha ? linhaComCabecalho(linha, true) : linha;
    return indice >= alvo.linha ? linhaComCabecalho(linha, false) : linha;
  });

  trocarTabela(tr, alvo.posTabela, alvo.tabela, novas, alvo);
  return true;
}

export function linhaEhCabecalho(alvo: CelulaNaTabela): boolean {
  return ehCabecalho(alvo.tabela.child(alvo.linha));
}

export function excluirTabela(tr: Transaction): boolean {
  const alvo = celulaDaSelecao(tr.selection);
  if (!alvo) return false;

  tr.delete(alvo.posTabela, alvo.posTabela + alvo.tabela.nodeSize);
  return true;
}
