import { Extension } from "@tiptap/core";
import type { Node as NoPM } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import type { OcorrenciaBusca } from "../language/findReplace";
import { alvoNoEditor, posicaoDaNota, type AlvoNoEditor } from "./localizar";

// A ponte entre a busca (src/core/language/findReplace.ts, passo 5.4.2) e o
// editor — passo 5.4.3. Três peças, nenhuma com React:
//
// 1. `alvosDasOcorrencias`: onde cada ocorrência está na árvore do editor,
//    para selecionar a atual e realçar as outras;
// 2. `RealceBusca`: o realce, feito com decorações do ProseMirror. Decoração
//    é desenho, não conteúdo: não entra em `getJSON()`, e por isso nunca
//    chega ao documento salvo nem ao `.docx`;
// 3. `trocarConteudo`: leva ao editor o documento que a substituição produziu,
//    numa transação só, trocando só o trecho que mudou. Por ser transação, o
//    Ctrl+Z desfaz a substituição inteira de uma vez.

// --- Onde está cada ocorrência -----------------------------------------------

// Parágrafo, citação longa e célula de tabela viram um trecho selecionável.
// Título de seção, legenda e fonte são atributos editados em campos do node
// view, fora do texto do ProseMirror: a ocorrência leva ao nó, sem realce.
// Apêndice e anexo ainda não têm tela de edição (3.7.1): `null`.
export function alvosDasOcorrencias(
  doc: NoPM,
  ocorrencias: readonly OcorrenciaBusca[],
): (AlvoNoEditor | null)[] {
  return ocorrencias.map((ocorrencia) => alvoDaOcorrencia(doc, ocorrencia));
}

function alvoDaOcorrencia(doc: NoPM, { onde, campo, inicio, fim }: OcorrenciaBusca) {
  switch (campo.tipo) {
    case "titulo":
      return alvoNoEditor(doc, { tipo: "bloco", onde });
    case "no":
      return alvoNoEditor(doc, { tipo: "bloco", onde, no: campo.no, trecho: { inicio, fim } });
    case "legenda":
    case "fonte":
      return alvoNoEditor(doc, { tipo: "bloco", onde, no: campo.no });
    case "nota": {
      // A nota inteira fica selecionada, o que abre o campo dela na tela
      // (`NotaRodapeView`): o texto da nota não é texto do ProseMirror, e não
      // há trecho para realçar.
      const bloco = alvoNoEditor(doc, { tipo: "bloco", onde, no: campo.no });
      if (!bloco || bloco.alvo !== "no") return null;
      const posicao = posicaoDaNota(doc, bloco.posicao, campo.nota);
      return posicao === null ? null : ({ alvo: "no", posicao } as const);
    }
    case "celula": {
      const tabela = alvoNoEditor(doc, { tipo: "bloco", onde, no: campo.no });
      if (!tabela || tabela.alvo !== "no") return null;
      return trechoNaCelula(doc, tabela.posicao, campo.linha, campo.celula, inicio, fim);
    }
  }
}

function trechoNaCelula(
  doc: NoPM,
  posicaoTabela: number,
  linha: number,
  celula: number,
  inicio: number,
  fim: number,
): AlvoNoEditor | null {
  const tabela = doc.nodeAt(posicaoTabela);
  if (!tabela || linha >= tabela.childCount) return null;
  const noLinha = tabela.child(linha);
  if (celula >= noLinha.childCount) return null;

  // Posição do começo de cada nó: um a mais para entrar no pai, e o tamanho
  // dos irmãos anteriores.
  let posicao = posicaoTabela + 1;
  for (let l = 0; l < linha; l++) posicao += tabela.child(l).nodeSize;
  posicao += 1;
  for (let c = 0; c < celula; c++) posicao += noLinha.child(c).nodeSize;

  const limite = noLinha.child(celula).content.size;
  const de = Math.min(inicio, limite);
  const ate = Math.min(Math.max(fim, de), limite);
  return { alvo: "trecho", de: posicao + 1 + de, ate: posicao + 1 + ate };
}

// --- Realce ------------------------------------------------------------------

export interface Realce {
  de: number;
  ate: number;
  atual: boolean;
}

const chaveRealce = new PluginKey<DecorationSet>("realceBusca");

// Classes do CSS do editor (app/globals.css).
const CLASSE = "realce-busca";
const CLASSE_ATUAL = "realce-busca realce-busca-atual";

// Marca a transação com os realces novos. Transação só de meta: não muda o
// texto, e `addToHistory: false` a deixa fora do desfazer.
export function definirRealces(tr: Transaction, realces: readonly Realce[]): Transaction {
  return tr.setMeta(chaveRealce, realces).setMeta("addToHistory", false);
}

// O plugin, separado da extensão para o teste montá-lo com `EditorState`
// puro, sem editor.
export function pluginRealceBusca(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: chaveRealce,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, realces) {
        const novos = tr.getMeta(chaveRealce) as readonly Realce[] | undefined;
        if (novos) {
          return DecorationSet.create(
            tr.doc,
            novos
              .filter((realce) => realce.ate > realce.de)
              .map((realce) =>
                Decoration.inline(realce.de, realce.ate, {
                  class: realce.atual ? CLASSE_ATUAL : CLASSE,
                }),
              ),
          );
        }
        // Digitando com a busca aberta, os realces acompanham o texto até a
        // próxima busca.
        return realces.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations: (estado) => chaveRealce.getState(estado),
    },
  });
}

export function realcesDoEstado(estado: EditorState): DecorationSet {
  return chaveRealce.getState(estado) ?? DecorationSet.empty;
}

export const RealceBusca = Extension.create({
  name: "realceBusca",
  addProseMirrorPlugins() {
    return [pluginRealceBusca()];
  },
});

// --- Levar a substituição ao editor ------------------------------------------

// Troca o conteúdo de `tr.doc` por `novo`, mexendo só no intervalo que
// difere. É a receita do próprio ProseMirror (`findDiffStart`/`findDiffEnd`):
// o que não mudou não é recriado, a seleção fora do trecho trocado continua
// onde estava, e o desfazer guarda só a diferença. Devolve `false` quando os
// dois são iguais.
export function trocarConteudo(tr: Transaction, novo: NoPM): boolean {
  const atual = tr.doc;
  const inicio = atual.content.findDiffStart(novo.content);
  if (inicio === null) return false;

  const fim = atual.content.findDiffEnd(novo.content);
  let fimAtual = fim?.a ?? atual.content.size;
  let fimNovo = fim?.b ?? novo.content.size;
  // Quando o trecho igual do começo e o do fim se sobrepõem ("aa" por
  // "aaa"), o fim recua para depois do começo.
  const sobreposicao = inicio - Math.min(fimAtual, fimNovo);
  if (sobreposicao > 0) {
    fimAtual += sobreposicao;
    fimNovo += sobreposicao;
  }

  tr.replace(inicio, fimAtual, novo.slice(inicio, fimNovo));
  return true;
}
