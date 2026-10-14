import { mergeAttributes, Node } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

import type { NoCitacaoNarrativa } from "../../document/types";

export interface CitacaoNarrativaOptions {
  HTMLAttributes: Record<string, unknown>;
}

// Citação com o autor dentro da frase (NBR 10520:2023 §6.1.4) —
// `NoCitacaoNarrativa` em src/core/document/types.ts. Inline e atômica, como
// a fórmula no meio da frase (./formulaInline.ts): o nó guarda a ligação, e o
// node view (`CitacaoNarrativaView.tsx`) desenha "Oliveira e Leonardos (1943,
// p. 146)" a partir da referência.
//
// `renderText` vazio pelo mesmo motivo da nota e da fórmula: o nó conta zero
// caracteres no texto do parágrafo (`soTexto()`).
//
// `marks: ""`: negrito, itálico e a marca `citacao` não pegam nele. A forma
// do nome é a da norma, e o formato canônico não tem onde guardar marca num
// nó que não é texto.
export const CitacaoNarrativa = Node.create<CitacaoNarrativaOptions>({
  name: "citacao_narrativa",

  group: "inline",

  inline: true,

  atom: true,

  selectable: true,

  marks: "",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      refId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-ref-id"),
        renderHTML: (attributes) =>
          attributes.refId ? { "data-ref-id": attributes.refId as string } : {},
      },
      pagina: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-pagina"),
        renderHTML: (attributes) =>
          attributes.pagina !== null ? { "data-pagina": attributes.pagina as string } : {},
      },
      grifoNosso: {
        default: false,
        parseHTML: (element) => element.hasAttribute("data-grifo-nosso"),
        renderHTML: (attributes) => (attributes.grifoNosso ? { "data-grifo-nosso": "" } : {}),
      },
      traducaoNossa: {
        default: false,
        parseHTML: (element) => element.hasAttribute("data-traducao-nossa"),
        renderHTML: (attributes) => (attributes.traducaoNossa ? { "data-traducao-nossa": "" } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-citacao-narrativa]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-citacao-narrativa": "",
      }),
    ];
  },

  renderText() {
    return "";
  },
});

export default CitacaoNarrativa;

// Os atributos como o editor os guarda: `false` explícito nos acréscimos,
// porque `setNodeMarkup` e `updateAttributes` mesclam com os anteriores, e um
// grifo desmarcado ficaria lá (mesma armadilha do `setMark` em
// `MenuCitacao.tsx`).
export interface AtributosCitacaoNarrativa {
  refId: string;
  pagina: string | null;
  grifoNosso: boolean;
  traducaoNossa: boolean;
}

export function atributosNoEditor(no: Omit<NoCitacaoNarrativa, "type">): AtributosCitacaoNarrativa {
  return {
    refId: no.refId,
    pagina: no.pagina,
    grifoNosso: no.grifoNosso === true,
    traducaoNossa: no.traducaoNossa === true,
  };
}

// Insere no cursor, no lugar da seleção se houver (como digitar), e deixa o
// cursor logo depois: quem inseriu "Freire (1987)" continua a frase dali.
export function inserirCitacaoNarrativa(
  tr: Transaction,
  attrs: AtributosCitacaoNarrativa,
): boolean {
  const { from, to } = tr.selection;
  if (!cabeCitacaoNarrativa(tr.doc.resolve(from))) return false;

  const no = tr.doc.type.schema.nodes.citacao_narrativa.create(attrs);
  tr.replaceWith(from, to, no);
  tr.setSelection(TextSelection.create(tr.doc, from + no.nodeSize));
  return true;
}

export function podeInserirCitacaoNarrativa(estado: EditorState): boolean {
  return cabeCitacaoNarrativa(estado.selection.$from);
}

function cabeCitacaoNarrativa($pos: ResolvedPos): boolean {
  const tipo = $pos.doc.type.schema.nodes.citacao_narrativa;
  if (!tipo) return false;
  const indice = $pos.index();
  return $pos.parent.canReplaceWith(indice, indice, tipo);
}
