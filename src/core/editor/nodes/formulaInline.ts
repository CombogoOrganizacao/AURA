import { mergeAttributes, Node } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import { NodeSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

export interface FormulaInlineOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface FormulaInlineAttributes {
  texto: string;
}

// Fórmula no meio da frase (passo 6.2.11) — `NoFormulaInline` em
// src/core/document/types.ts. Inline e atômica, como a nota de rodapé
// (./footnote.ts): o LaTeX fica num atributo, e o node view
// (`FormulaInlineView.tsx`) desenha com o KaTeX e abre o campo de edição
// quando o nó está selecionado.
//
// `renderText` vazio pelo mesmo motivo da nota: a fórmula conta zero
// caracteres no texto do parágrafo (`soTexto()`), e copiar o parágrafo como
// texto simples não deve colar o LaTeX no meio da frase.
export const FormulaInline = Node.create<FormulaInlineOptions>({
  name: "formula_inline",

  group: "inline",

  inline: true,

  atom: true,

  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      texto: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-texto") ?? "",
        renderHTML: (attributes) => ({ "data-texto": attributes.texto }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-formula-inline]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-formula-inline": "" }),
    ];
  },

  renderText() {
    return "";
  },
});

export default FormulaInline;

// Insere uma fórmula vazia no cursor e a deixa selecionada: o node view abre
// o campo do LaTeX. Mesma forma de `inserirNotaRodape()`.
export function inserirFormulaInline(tr: Transaction): boolean {
  const posicao = tr.selection.to;
  if (!cabeFormula(tr.doc.resolve(posicao))) return false;

  tr.insert(posicao, tr.doc.type.schema.nodes.formula_inline.create({ texto: "" }));
  tr.setSelection(NodeSelection.create(tr.doc, posicao));
  return true;
}

export function podeInserirFormulaInline(estado: EditorState): boolean {
  return cabeFormula(estado.selection.$to);
}

function cabeFormula($pos: ResolvedPos): boolean {
  const tipo = $pos.doc.type.schema.nodes.formula_inline;
  if (!tipo) return false;
  const indice = $pos.index();
  return $pos.parent.canReplaceWith(indice, indice, tipo);
}
