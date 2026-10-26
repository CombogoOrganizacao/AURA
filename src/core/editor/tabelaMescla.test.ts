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
  alternarCabecalho,
  celulaAnterior,
  celulaSeguinte,
  descerOuSair,
  estadoDaGrade,
  inserirColuna,
  inserirLinha,
  mesclarComVizinha,
  mesclarSelecao,
  moverLinha,
  removerColuna,
  removerLinha,
  separarCelulas,
} from "./tabela";

// Passo 8.5.4 — mesclar e separar células, e os comandos de grade com uma
// mescla no caminho. Mesma técnica de tabela.test.ts: só `EditorState`.
const schema = getSchema([Document, Paragraph, Text, Secao, Tabela, LinhaTabela, CelulaTabela]);

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

function tabelaDe(doc: NoProseMirror): NoProseMirror {
  let tabela: NoProseMirror | null = null;
  doc.descendants((no) => {
    if (no.type.name === "tabela") tabela = no;
    return tabela === null;
  });
  return tabela!;
}

// Posição do começo (ou do fim) do texto da célula (linha, coluna).
function posNaCelula(doc: NoProseMirror, linha: number, coluna: number, fim = false): number {
  let alvo = -1;
  doc.descendants((no, pos) => {
    if (no.type.name !== "tabela") return true;
    let p = pos + 1;
    for (let i = 0; i < linha; i++) p += no.child(i).nodeSize;
    p += 1;
    for (let i = 0; i < coluna; i++) p += no.child(linha).child(i).nodeSize;
    alvo = p + 1 + (fim ? no.child(linha).child(coluna).content.size : 0);
    return false;
  });
  return alvo;
}

function naCelula(estado: EditorState, linha: number, coluna: number): EditorState {
  return estado.apply(
    estado.tr.setSelection(
      TextSelection.create(estado.doc, posNaCelula(estado.doc, linha, coluna)),
    ),
  );
}

// Seleção que vai do começo de uma célula ao fim de outra, como ao arrastar.
function entre(estado: EditorState, de: [number, number], ate: [number, number]): EditorState {
  return estado.apply(
    estado.tr.setSelection(
      TextSelection.create(
        estado.doc,
        posNaCelula(estado.doc, ...de),
        posNaCelula(estado.doc, ...ate, true),
      ),
    ),
  );
}

function aplicar(estado: EditorState, operacao: (tr: Transaction) => boolean) {
  const tr = estado.tr;
  const mudou = operacao(tr);
  const novo = estado.apply(tr);
  expect(() => novo.doc.check()).not.toThrow();
  return { mudou, estado: novo };
}

// A grade em texto: "Texto[2x1]" para a âncora de 2 colunas e 1 linha, "·"
// para a coberta.
function desenho(doc: NoProseMirror): string[][] {
  const linhas: string[][] = [];
  tabelaDe(doc).forEach((linha) => {
    const celulas: string[] = [];
    linha.forEach((celula) => {
      const { colspan, rowspan, coberta } = celula.attrs;
      if (coberta) celulas.push("·");
      else if (colspan > 1 || rowspan > 1)
        celulas.push(`${celula.textContent}[${colspan}x${rowspan}]`);
      else celulas.push(celula.textContent);
    });
    linhas.push(celulas);
  });
  return linhas;
}

const GRADE = [
  ["Região", "Ano", "Total"],
  ["Sul", "2020", "10"],
  ["Norte", "2021", "20"],
  ["Leste", "2022", "30"],
];

describe("mesclar", () => {
  it("a seleção de uma célula a outra vira uma célula só, com o texto junto", () => {
    const estado = entre(estadoCom(GRADE), [1, 0], [2, 1]);
    const { mudou, estado: depois } = aplicar(estado, mesclarSelecao);
    expect(mudou).toBe(true);
    expect(desenho(depois.doc)).toEqual([
      ["Região", "Ano", "Total"],
      ["Sul 2020 Norte 2021[2x2]", "·", "10"],
      ["·", "·", "20"],
      ["Leste", "2022", "30"],
    ]);
    // O cursor fica na célula mesclada.
    expect(estadoDaGrade(depois.selection)).toMatchObject({ linha: 1, coluna: 0, mesclada: true });
  });

  it("mesclar com a vizinha da direita e depois com a de baixo cresce a mescla", () => {
    let estado = naCelula(estadoCom(GRADE), 1, 1);
    estado = aplicar(estado, (tr) => mesclarComVizinha(tr, "direita")).estado;
    estado = aplicar(estado, (tr) => mesclarComVizinha(tr, "abaixo")).estado;
    expect(desenho(estado.doc)).toEqual([
      ["Região", "Ano", "Total"],
      ["Sul", "2020 10 2021 20[2x2]", "·"],
      ["Norte", "·", "·"],
      ["Leste", "2022", "30"],
    ]);
  });

  it("a seleção que toca meia mescla cresce até pegá-la inteira", () => {
    let estado = naCelula(estadoCom(GRADE), 1, 0);
    estado = aplicar(estado, (tr) => mesclarComVizinha(tr, "abaixo")).estado; // Sul+Norte
    estado = entre(estado, [2, 1], [2, 2]); // 2021 e 20, ao lado de Norte (coberta)
    estado = aplicar(estado, mesclarSelecao).estado;
    expect(desenho(estado.doc)[1]).toEqual(["Sul Norte[1x2]", "2020", "10"]);
    expect(desenho(estado.doc)[2]).toEqual(["·", "2021 20[2x1]", "·"]);
  });

  it("cabeçalho e corpo não se mesclam, e o motivo aparece", () => {
    const estado = naCelula(estadoCom(GRADE), 0, 0);
    expect(estadoDaGrade(estado.selection)!.recusaMesclar.abaixo).toBe(
      "Cabeçalho e corpo não se mesclam.",
    );
    expect(aplicar(estado, (tr) => mesclarComVizinha(tr, "abaixo")).mudou).toBe(false);
  });

  it("na borda não há vizinha", () => {
    const estado = naCelula(estadoCom(GRADE), 3, 2);
    const grade = estadoDaGrade(estado.selection)!;
    expect(grade.recusaMesclar.direita).toBe("A seleção passa da borda da tabela.");
    expect(grade.recusaMesclar.abaixo).toBe("A seleção passa da borda da tabela.");
  });

  it("separar devolve as células, vazias, e o texto fica na de cima à esquerda", () => {
    let estado = entre(estadoCom(GRADE), [1, 0], [1, 1]);
    estado = aplicar(estado, mesclarSelecao).estado;
    estado = aplicar(estado, separarCelulas).estado;
    expect(desenho(estado.doc)[1]).toEqual(["Sul 2020", "", "10"]);
    expect(estadoDaGrade(estado.selection)!.mesclada).toBe(false);
  });
});

describe("a grade com uma mescla no caminho", () => {
  // Sul e Norte mesclados na coluna 0 (linhas 1 e 2).
  function comMesclaVertical() {
    const estado = naCelula(estadoCom(GRADE), 1, 0);
    return aplicar(estado, (tr) => mesclarComVizinha(tr, "abaixo")).estado;
  }

  it("linha nova no meio da mescla a faz crescer", () => {
    const estado = aplicar(comMesclaVertical(), (tr) => inserirLinha(tr, "abaixo")).estado;
    // "Abaixo" de uma célula mesclada é abaixo da mescla inteira.
    expect(desenho(estado.doc)).toEqual([
      ["Região", "Ano", "Total"],
      ["Sul Norte[1x2]", "2020", "10"],
      ["·", "2021", "20"],
      ["", "", ""],
      ["Leste", "2022", "30"],
    ]);
    const noMeio = aplicar(naCelula(comMesclaVertical(), 2, 1), (tr) =>
      inserirLinha(tr, "acima"),
    ).estado;
    expect(desenho(noMeio.doc).map((linha) => linha[0])).toEqual([
      "Região",
      "Sul Norte[1x3]",
      "·",
      "·",
      "Leste",
    ]);
  });

  it("tirar a primeira linha da mescla leva o texto para a de baixo", () => {
    const estado = aplicar(comMesclaVertical(), removerLinha).estado;
    expect(desenho(estado.doc)).toEqual([
      ["Região", "Ano", "Total"],
      ["Sul Norte", "2021", "20"],
      ["Leste", "2022", "30"],
    ]);
  });

  it("coluna nova no meio de uma mescla horizontal a faz crescer; tirar encolhe", () => {
    let estado = entre(estadoCom(GRADE), [1, 1], [1, 2]);
    estado = aplicar(estado, mesclarSelecao).estado;
    estado = aplicar(naCelula(estado, 2, 1), (tr) => inserirColuna(tr, "direita")).estado;
    expect(desenho(estado.doc)[1]).toEqual(["Sul", "2020 10[3x1]", "·", "·"]);
    estado = aplicar(naCelula(estado, 2, 2), removerColuna).estado;
    expect(desenho(estado.doc)[1]).toEqual(["Sul", "2020 10[2x1]", "·"]);
  });

  it("mover uma linha presa numa mescla de várias linhas não acontece", () => {
    const estado = naCelula(comMesclaVertical(), 3, 0);
    expect(estadoDaGrade(estado.selection)!.podeMoverLinha.acima).toBe(false);
    expect(aplicar(estado, (tr) => moverLinha(tr, "acima")).mudou).toBe(false);
  });

  it("Tab e Shift+Tab pulam a célula coberta; Enter desce para depois da mescla", () => {
    let estado = naCelula(comMesclaVertical(), 1, 2); // "10"
    estado = aplicar(estado, celulaSeguinte).estado;
    expect(estadoDaGrade(estado.selection)).toMatchObject({ linha: 2, coluna: 1 }); // pulou a coberta
    estado = aplicar(estado, celulaAnterior).estado;
    expect(estadoDaGrade(estado.selection)).toMatchObject({ linha: 1, coluna: 2 });
    estado = aplicar(naCelula(estado, 1, 0), descerOuSair).estado;
    expect(estadoDaGrade(estado.selection)).toMatchObject({ linha: 3, coluna: 0 });
  });

  it("ligar o cabeçalho no meio de uma mescla o estende até o fim dela", () => {
    const estado = aplicar(naCelula(comMesclaVertical(), 1, 1), alternarCabecalho).estado;
    const cabecalhos: boolean[] = [];
    tabelaDe(estado.doc).forEach((linha) => cabecalhos.push(linha.firstChild!.attrs.cabecalho));
    expect(cabecalhos).toEqual([true, true, true, false]);
  });
});
