import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import type { Node as NoProseMirror } from "@tiptap/pm/model";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { Secao } from "./nodes/section";
import { CelulaTabela, LinhaTabela, Tabela } from "./nodes/table";
import {
  acrescentarColunaNoFim,
  acrescentarLinhaNoFim,
  alternarCabecalho,
  celulaDaSelecao,
  excluirTabela,
  inserirColuna,
  inserirLinha,
  moverColuna,
  moverLinha,
  removerColuna,
  removerLinha,
} from "./tabela";

// Passo 6.1.3b. Mesma técnica de reorder.test.ts: só `EditorState`, sem DOM.
const schema = getSchema([Document, Paragraph, Text, Secao, Tabela, LinhaTabela, CelulaTabela]);

// Grade como matriz de textos; `cabecalho` = quantas linhas do alto são
// cabeçalho.
function estadoCom(grade: string[][], cabecalho = 1) {
  const tabela = schema.nodes.tabela.create(
    { id: "t1" },
    grade.map((linha, i) =>
      schema.nodes.linha_tabela.create(
        null,
        linha.map((texto) =>
          schema.nodes.celula_tabela.create(
            { cabecalho: i < cabecalho },
            texto ? schema.text(texto) : undefined,
          ),
        ),
      ),
    ),
  );
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.secao.create({ id: "s1", nivel: 1, titulo: "" }, [
      schema.nodes.paragraph.create(null, schema.text("Antes.")),
      tabela,
    ]),
  ]);
  return EditorState.create({ schema, doc });
}

// Cursor no começo da célula (linha, coluna).
function naCelula(estado: EditorState, linha: number, coluna: number): EditorState {
  let alvo = -1;
  estado.doc.descendants((no, pos) => {
    if (no.type.name !== "tabela") return true;
    let p = pos + 1;
    for (let i = 0; i < linha; i++) p += no.child(i).nodeSize;
    p += 1;
    for (let i = 0; i < coluna; i++) p += no.child(linha).child(i).nodeSize;
    alvo = p + 1;
    return false;
  });
  return estado.apply(estado.tr.setSelection(TextSelection.create(estado.doc, alvo)));
}

function tabelaDe(doc: NoProseMirror): NoProseMirror | null {
  let tabela: NoProseMirror | null = null;
  doc.descendants((no) => {
    if (no.type.name === "tabela") tabela = no;
    return tabela === null;
  });
  return tabela;
}

function grade(doc: NoProseMirror): string[][] {
  const linhas: string[][] = [];
  tabelaDe(doc)!.forEach((linha) => {
    const celulas: string[] = [];
    linha.forEach((celula) => celulas.push(celula.textContent));
    linhas.push(celulas);
  });
  return linhas;
}

function cabecalhos(doc: NoProseMirror): boolean[][] {
  const linhas: boolean[][] = [];
  tabelaDe(doc)!.forEach((linha) => {
    const celulas: boolean[] = [];
    linha.forEach((celula) => celulas.push(celula.attrs.cabecalho as boolean));
    linhas.push(celulas);
  });
  return linhas;
}

function aplicar(estado: EditorState, operacao: (tr: Transaction) => boolean) {
  const tr = estado.tr;
  const mudou = operacao(tr);
  const novo = estado.apply(tr);
  expect(() => novo.doc.check()).not.toThrow();
  return { mudou, estado: novo };
}

describe("celulaDaSelecao", () => {
  it("acha linha e coluna da célula do cursor", () => {
    const estado = naCelula(
      estadoCom([
        ["A", "B"],
        ["1", "2"],
      ]),
      1,
      1,
    );
    const alvo = celulaDaSelecao(estado.selection)!;
    expect([alvo.linha, alvo.coluna]).toEqual([1, 1]);
    expect(alvo.tabela.type.name).toBe("tabela");
  });

  it("devolve null fora de tabela — é o que desliga os botões", () => {
    const estado = estadoCom([["A"]]);
    const noParagrafo = estado.apply(estado.tr.setSelection(TextSelection.create(estado.doc, 3)));
    expect(celulaDaSelecao(noParagrafo.selection)).toBeNull();
  });
});

describe("linhas", () => {
  it("2×2 vira 3×2 com uma linha de corpo embaixo, e o cursor vai para ela", () => {
    const { mudou, estado } = aplicar(
      naCelula(
        estadoCom([
          ["A", "B"],
          ["1", "2"],
        ]),
        1,
        1,
      ),
      (tr) => inserirLinha(tr, "abaixo"),
    );
    expect(mudou).toBe(true);
    expect(grade(estado.doc)).toEqual([
      ["A", "B"],
      ["1", "2"],
      ["", ""],
    ]);
    expect(cabecalhos(estado.doc)[2]).toEqual([false, false]);
    const alvo = celulaDaSelecao(estado.selection)!;
    expect([alvo.linha, alvo.coluna]).toEqual([2, 1]);
  });

  it("abaixo da última linha de cabeçalho nasce corpo — começar os dados", () => {
    const { estado } = aplicar(
      naCelula(
        estadoCom([
          ["A", "B"],
          ["1", "2"],
        ]),
        0,
        0,
      ),
      (tr) => inserirLinha(tr, "abaixo"),
    );
    expect(grade(estado.doc)).toEqual([
      ["A", "B"],
      ["", ""],
      ["1", "2"],
    ]);
    expect(cabecalhos(estado.doc).map((l) => l[0])).toEqual([true, false, false]);
  });

  it("acima de uma linha de cabeçalho nasce cabeçalho — o bloco segue contínuo", () => {
    const { estado } = aplicar(
      naCelula(
        estadoCom([
          ["A", "B"],
          ["1", "2"],
        ]),
        0,
        0,
      ),
      (tr) => inserirLinha(tr, "acima"),
    );
    expect(cabecalhos(estado.doc).map((l) => l[0])).toEqual([true, true, false]);
  });

  it("entre duas linhas de cabeçalho nasce cabeçalho", () => {
    const { estado } = aplicar(
      naCelula(
        estadoCom(
          [
            ["A", "B"],
            ["a", "b"],
            ["1", "2"],
          ],
          2,
        ),
        0,
        0,
      ),
      (tr) => inserirLinha(tr, "abaixo"),
    );
    expect(cabecalhos(estado.doc).map((l) => l[0])).toEqual([true, true, true, false]);
  });

  it("remove a linha do cursor", () => {
    const { mudou, estado } = aplicar(
      naCelula(
        estadoCom([
          ["A", "B"],
          ["1", "2"],
          ["3", "4"],
        ]),
        1,
        0,
      ),
      removerLinha,
    );
    expect(mudou).toBe(true);
    expect(grade(estado.doc)).toEqual([
      ["A", "B"],
      ["3", "4"],
    ]);
  });

  it("não remove a última linha — tabela sem linha não cabe no schema", () => {
    const antes = naCelula(estadoCom([["A", "B"]]), 0, 0);
    const { mudou, estado } = aplicar(antes, removerLinha);
    expect(mudou).toBe(false);
    expect(estado.doc.eq(antes.doc)).toBe(true);
  });
});

describe("colunas", () => {
  it("2×2 vira 2×3, e a célula nova herda o papel de cada linha", () => {
    const { mudou, estado } = aplicar(
      naCelula(
        estadoCom([
          ["A", "B"],
          ["1", "2"],
        ]),
        1,
        0,
      ),
      (tr) => inserirColuna(tr, "direita"),
    );
    expect(mudou).toBe(true);
    expect(grade(estado.doc)).toEqual([
      ["A", "", "B"],
      ["1", "", "2"],
    ]);
    expect(cabecalhos(estado.doc)).toEqual([
      [true, true, true],
      [false, false, false],
    ]);
    const alvo = celulaDaSelecao(estado.selection)!;
    expect([alvo.linha, alvo.coluna]).toEqual([1, 1]);
  });

  it("insere à esquerda", () => {
    const { estado } = aplicar(
      naCelula(
        estadoCom([
          ["A", "B"],
          ["1", "2"],
        ]),
        0,
        0,
      ),
      (tr) => inserirColuna(tr, "esquerda"),
    );
    expect(grade(estado.doc)).toEqual([
      ["", "A", "B"],
      ["", "1", "2"],
    ]);
  });

  it("remove a coluna do cursor em todas as linhas", () => {
    const { mudou, estado } = aplicar(
      naCelula(
        estadoCom([
          ["A", "B", "C"],
          ["1", "2", "3"],
        ]),
        1,
        1,
      ),
      removerColuna,
    );
    expect(mudou).toBe(true);
    expect(grade(estado.doc)).toEqual([
      ["A", "C"],
      ["1", "3"],
    ]);
  });

  it("não remove a última coluna", () => {
    const { mudou } = aplicar(naCelula(estadoCom([["A"], ["1"]]), 0, 0), removerColuna);
    expect(mudou).toBe(false);
  });
});

describe("cabeçalho", () => {
  it("ligar numa linha de corpo liga todas as de cima também", () => {
    const { estado } = aplicar(
      naCelula(estadoCom([["A"], ["B"], ["C"], ["D"]], 0), 2, 0),
      alternarCabecalho,
    );
    expect(cabecalhos(estado.doc).map((l) => l[0])).toEqual([true, true, true, false]);
  });

  it("desligar numa linha de cabeçalho devolve ela e as de baixo ao corpo", () => {
    const { estado } = aplicar(
      naCelula(estadoCom([["A"], ["B"], ["C"], ["D"]], 3), 1, 0),
      alternarCabecalho,
    );
    expect(cabecalhos(estado.doc).map((l) => l[0])).toEqual([true, false, false, false]);
  });

  it("preserva o texto das células que mudam de papel", () => {
    const { estado } = aplicar(
      naCelula(
        estadoCom([
          ["A", "B"],
          ["1", "2"],
        ]),
        1,
        0,
      ),
      alternarCabecalho,
    );
    expect(grade(estado.doc)).toEqual([
      ["A", "B"],
      ["1", "2"],
    ]);
    expect(cabecalhos(estado.doc)[1]).toEqual([true, true]);
  });
});

describe("critério do passo", () => {
  it("uma tabela criada 2×2 vira 3×3 e mantém legenda, fonte e id", () => {
    let estado = naCelula(
      estadoCom([
        ["A", "B"],
        ["1", "2"],
      ]),
      1,
      1,
    );
    estado = aplicar(estado, (tr) => inserirLinha(tr, "abaixo")).estado;
    estado = aplicar(estado, (tr) => inserirColuna(tr, "direita")).estado;

    expect(grade(estado.doc)).toEqual([
      ["A", "B", ""],
      ["1", "2", ""],
      ["", "", ""],
    ]);
    expect(tabelaDe(estado.doc)!.attrs.id).toBe("t1");
  });
});

describe("excluirTabela", () => {
  it("tira a tabela inteira e deixa o resto da seção", () => {
    const { mudou, estado } = aplicar(naCelula(estadoCom([["A"]]), 0, 0), excluirTabela);
    expect(mudou).toBe(true);
    expect(tabelaDe(estado.doc)).toBeNull();
    expect(estado.doc.textContent).toBe("Antes.");
  });
});

describe("mover e acrescentar no fim (passo 8.5.3)", () => {
  const base = () =>
    estadoCom([
      ["A", "B", "C"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);

  it("mover a linha para baixo troca com a vizinha, e o cabeçalho continua no alto", () => {
    const { mudou, estado } = aplicar(naCelula(base(), 1, 2), (tr) => moverLinha(tr, "abaixo"));
    expect(mudou).toBe(true);
    expect(grade(estado.doc)).toEqual([
      ["A", "B", "C"],
      ["4", "5", "6"],
      ["1", "2", "3"],
    ]);
    expect(cabecalhos(estado.doc).map((linha) => linha[0])).toEqual([true, false, false]);
    const alvo = celulaDaSelecao(estado.selection)!;
    expect([alvo.linha, alvo.coluna]).toEqual([2, 2]);
  });

  it("a linha de corpo que sobe ao lado do cabeçalho não vira cabeçalho", () => {
    const { estado } = aplicar(naCelula(base(), 1, 0), (tr) => moverLinha(tr, "acima"));
    expect(grade(estado.doc)[0]).toEqual(["1", "2", "3"]);
    expect(cabecalhos(estado.doc).map((linha) => linha[0])).toEqual([true, false, false]);
  });

  it("não move além das pontas", () => {
    expect(aplicar(naCelula(base(), 0, 0), (tr) => moverLinha(tr, "acima")).mudou).toBe(false);
    expect(aplicar(naCelula(base(), 2, 0), (tr) => moverLinha(tr, "abaixo")).mudou).toBe(false);
  });

  it("mover a coluna troca em todas as linhas, e o cursor a acompanha", () => {
    const { estado } = aplicar(naCelula(base(), 2, 0), (tr) => moverColuna(tr, "direita"));
    expect(grade(estado.doc)).toEqual([
      ["B", "A", "C"],
      ["2", "1", "3"],
      ["5", "4", "6"],
    ]);
    const alvo = celulaDaSelecao(estado.selection)!;
    expect([alvo.linha, alvo.coluna]).toEqual([2, 1]);
    expect(aplicar(naCelula(base(), 0, 0), (tr) => moverColuna(tr, "esquerda")).mudou).toBe(false);
    expect(aplicar(naCelula(base(), 0, 2), (tr) => moverColuna(tr, "direita")).mudou).toBe(false);
  });

  it("acrescentar linha no fim, de qualquer linha, nasce corpo e leva o cursor", () => {
    const { estado } = aplicar(naCelula(base(), 0, 1), acrescentarLinhaNoFim);
    expect(grade(estado.doc)).toHaveLength(4);
    expect(cabecalhos(estado.doc)[3]).toEqual([false, false, false]);
    const alvo = celulaDaSelecao(estado.selection)!;
    expect([alvo.linha, alvo.coluna]).toEqual([3, 1]);
  });

  it("acrescentar coluna no fim herda o papel de cada linha", () => {
    const { estado } = aplicar(naCelula(base(), 1, 0), acrescentarColunaNoFim);
    expect(grade(estado.doc)[0]).toHaveLength(4);
    expect(cabecalhos(estado.doc).map((linha) => linha[3])).toEqual([true, false, false]);
    const alvo = celulaDaSelecao(estado.selection)!;
    expect([alvo.linha, alvo.coluna]).toEqual([1, 3]);
  });

  it("fora de tabela não faz nada", () => {
    const fora = estadoCom([["A"]]);
    for (const operacao of [
      acrescentarLinhaNoFim,
      acrescentarColunaNoFim,
      (tr: Transaction) => moverLinha(tr, "abaixo"),
      (tr: Transaction) => moverColuna(tr, "direita"),
    ]) {
      expect(aplicar(fora, operacao).mudou).toBe(false);
    }
  });
});
