import type { Mark, Node as NoPM } from "@tiptap/pm/model";

import type { AtributosCitacao } from "../document/types";

// Onde estão as citações dentro da árvore do editor, em posições do
// ProseMirror — passo 4.10. É o que o plugin da tela
// (src/components/editor/chamadas.ts) usa para desenhar as aspas e a chamada
// ao lado do texto do aluno. Fica em `src/core/` porque é só leitura da
// árvore, sem DOM; quem cria os elementos na tela é o componente.
//
// Mesma regra de `listarCitacoes()` (src/core/references/citacoes.ts), agora
// sobre a árvore viva em vez do formato canônico: nós de texto vizinhos com a
// mesma citação formam UMA faixa — uma palavra em itálico no meio do excerto
// não pode partir a citação em duas chamadas.

export type FaixaCitacao =
  | { tipo: "marca"; de: number; ate: number; attrs: AtributosCitacao }
  // Citação longa: a ligação é do bloco, e a chamada vai no fim do conteúdo
  // dele (10520 §7.1.1, exemplo: "... de qualquer dimensão (Nichols, 1993,
  // p. 181).").
  | { tipo: "longa"; fimDoConteudo: number; refId: string; pagina: string };

export function faixasDeCitacao(doc: NoPM): FaixaCitacao[] {
  const faixas: FaixaCitacao[] = [];

  doc.descendants((no, pos) => {
    if (no.type.name === "citacao_longa" && typeof no.attrs.refId === "string" && no.attrs.refId) {
      faixas.push({
        tipo: "longa",
        fimDoConteudo: pos + no.nodeSize - 1,
        refId: no.attrs.refId,
        pagina: typeof no.attrs.pagina === "string" ? no.attrs.pagina : "",
      });
    }
    if (!no.isTextblock) return true;

    let aberta: Extract<FaixaCitacao, { tipo: "marca" }> | null = null;
    let marcaAberta: Mark | null = null;

    no.forEach((filho, deslocamento) => {
      const inicio = pos + 1 + deslocamento;
      const marca = filho.marks.find((item) => item.type.name === "citacao") ?? null;

      if (!marca) {
        aberta = null;
        marcaAberta = null;
        return;
      }
      if (aberta && marcaAberta && marcaAberta.eq(marca)) {
        aberta.ate = inicio + filho.nodeSize;
        return;
      }
      aberta = {
        tipo: "marca",
        de: inicio,
        ate: inicio + filho.nodeSize,
        attrs: marca.attrs as AtributosCitacao,
      };
      marcaAberta = marca;
      faixas.push(aberta);
    });
    return false;
  });

  return faixas;
}
