import { mergeAttributes, Node } from "@tiptap/core";

export interface FiguraOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface FiguraAttributes {
  id: string | null;
  legenda: string;
  fonte: string;
  imagem: string | null;
}

// Nó `figura` do editor — ver docs/schema-tiptap.md §4.6. Arquivo
// `figure.ts` (identificador em inglês, CLAUDE.md), `name` no domínio, mesma
// convenção de `secao`/`section.ts` e `citacao_longa`/`longQuote.ts`.
//
// **`atom: true`** porque §4.6 diz "atômico — sem texto editável dentro do
// próprio nó": legenda e fonte são ATRIBUTOS, não conteúdo. Quem os edita é
// o node view (`FiguraView.tsx`), com `<input>` nativo — mesma técnica que
// `SectionView.tsx` usa pro título da seção, pelo mesmo motivo (o
// ProseMirror não tenta gerenciar cursor dentro de um campo que não é
// conteúdo dele).
//
// **Sem atributo de número** (docs/schema-tiptap.md §2): "Figura 3" vem de
// `numerarFiguras()` (src/core/document/numbering.ts) na hora de exibir e de
// um campo `SEQ` no `.docx`. Um número gravado aqui ficaria errado no
// instante em que alguém inserisse uma figura antes desta.
//
// `imagem` é o id da imagem na persistência (passo 6.1.2), ou `null`. Sem
// imagem, a moldura na tela e no `.docx` é um espaço reservado, como na PoC
// congelada. Quem embute o arquivo em `word/media/` é `export/docx/media.ts`.
//
// Sem estilo aqui, de propósito (mesmo motivo de `longQuote.ts`): fonte
// menor e espaçamento simples da legenda são do CSS do editor
// (`app/globals.css`) e do exportador, não do nó.
export const Figura = Node.create<FiguraOptions>({
  name: "figura",

  group: "block",

  atom: true,

  // Selecionável como bloco inteiro: sem conteúdo editável dentro, é o que
  // permite apagar a figura com Backspace/Delete tendo-a selecionada.
  selectable: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        // `default: null` pelo mesmo motivo detalhado em `section.ts`: um
        // default estático faria toda figura nova nascer com o mesmo id, e
        // tirar o default quebraria a construção do schema. Quem gera é
        // `novaFigura()` (src/core/document/factory.ts); quem recusa uma
        // figura sem id é `toDocumento()` (serialize.ts), que lança em vez
        // de gravar um documento impossível de numerar.
        default: null,
        parseHTML: (element) => element.getAttribute("data-id"),
        renderHTML: (attributes) => ({ "data-id": attributes.id }),
      },
      legenda: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-legenda") ?? "",
        renderHTML: (attributes) => ({ "data-legenda": attributes.legenda }),
      },
      fonte: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-fonte") ?? "",
        renderHTML: (attributes) => ({ "data-fonte": attributes.fonte }),
      },
      imagem: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-imagem"),
        renderHTML: (attributes) =>
          attributes.imagem ? { "data-imagem": attributes.imagem as string } : {},
      },
    };
  },

  // `figure` — tag semântica nativa pra ilustração com legenda, mesmo
  // raciocínio de `section` pro nó `secao` e `blockquote` pra citação longa:
  // existe pronta, não precisa de `data-*` só pra dizer "isto é uma figura".
  parseHTML() {
    return [{ tag: "figure" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },
});

export default Figura;
