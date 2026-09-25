import { mergeAttributes, Node } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import { NodeSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

export interface NotaRodapeOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface NotaRodapeAttributes {
  texto: string;
}

// Nó `nota_rodape` — docs/schema-tiptap.md §4.9, passo 6.1.3c. Arquivo
// `footnote.ts` (identificador em inglês, CLAUDE.md), `name` no domínio.
//
// **Inline e atômico.** Mora no fluxo do parágrafo, no ponto em que o
// expoente aparece; o conteúdo da nota é um atributo só (`texto`), editado
// num campo do node view (`NotaRodapeView.tsx`), não texto do ProseMirror.
// Texto simples: rich text dentro da nota fica fora da v1 (§4.9).
//
// **Sem atributo de número**, pelo mesmo motivo de `figura`/`tabela`: o
// "¹, ²" é derivado da ordem das notas (`numerarNotas()` em
// ../numbering.ts), e no `.docx` quem numera é o Word.
//
// **Onde cabe:** parágrafo e citação longa, que são `inline*`. A célula de
// tabela não aceita (`celula_tabela` é `text*`, ver table.ts): a tabela tem
// rodapé próprio pelo IBGE.
export const NotaRodape = Node.create<NotaRodapeOptions>({
  name: "nota_rodape",

  group: "inline",

  inline: true,

  atom: true,

  // Selecionável: é selecionar que abre o campo da nota na tela, e com ela
  // selecionada Backspace/Delete a apagam.
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

  // `span[data-nota-rodape]`, o mesmo marcador que `renderHTML()` emite: um
  // seletor que só casa com o que este nó escreveu. Copiar e colar dentro do
  // editor leva a nota junto; HTML de fora (uma nota do Word colada) não
  // traz este marcador e não vira nota.
  parseHTML() {
    return [{ tag: "span[data-nota-rodape]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-nota-rodape": "" }),
    ];
  },

  // Fora do editor (copiar como texto puro), a nota não vira texto no meio da
  // frase: o conteúdo dela não faz parte do parágrafo.
  renderText() {
    return "";
  },
});

export default NotaRodape;

// Insere uma nota vazia no fim da seleção e a deixa selecionada, que é o que
// abre o campo dela para digitar (passo 6.1.3c). No FIM, e sem apagar nada:
// com um trecho selecionado, a nota vai depois dele, como no Word, e não no
// lugar dele.
//
// `false` onde a nota não cabe, como numa célula de tabela ou com uma figura
// selecionada. É a mesma pergunta que desliga o botão (`podeInserirNota()`),
// feita ao schema, não a uma lista de lugares escrita à mão.
export function inserirNotaRodape(tr: Transaction): boolean {
  const posicao = tr.selection.to;
  if (!cabeNota(tr.doc.resolve(posicao))) return false;

  tr.insert(posicao, tr.doc.type.schema.nodes.nota_rodape.create({ texto: "" }));
  tr.setSelection(NodeSelection.create(tr.doc, posicao));
  return true;
}

export function podeInserirNota(estado: EditorState): boolean {
  return cabeNota(estado.selection.$to);
}

function cabeNota($pos: ResolvedPos): boolean {
  const tipo = $pos.doc.type.schema.nodes.nota_rodape;
  if (!tipo) return false;
  const indice = $pos.index();
  return $pos.parent.canReplaceWith(indice, indice, tipo);
}
