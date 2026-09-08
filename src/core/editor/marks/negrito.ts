import { Mark, mergeAttributes } from "@tiptap/core";

// Marca `negrito` — ver docs/schema-tiptap.md §5.1. Nome próprio (não o
// `bold` de fábrica do TipTap), pra casar com o `type` gravado em `NoTexto`
// (src/core/document/types.ts) e com o nome que a skill/norma usam. ABNT
// exige negrito em referências e em rótulos como "Palavras-chave:" — é
// distinto de `italico`, nunca a mesma marca com variante.
export const Negrito = Mark.create({
  name: "negrito",

  parseHTML() {
    return [
      { tag: "strong" },
      { tag: "b" },
      {
        style: "font-weight",
        getAttrs: (valor) => (/^(bold(er)?|[5-9]\d{2}|1000)$/.test(valor) ? null : false),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["strong", mergeAttributes(HTMLAttributes), 0];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-b": () => this.editor.commands.toggleMark(this.name),
    };
  },
});

export default Negrito;
