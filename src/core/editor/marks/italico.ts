import { Mark, mergeAttributes } from "@tiptap/core";

// Marca `italico` — ver docs/schema-tiptap.md §5.1. Nome próprio (não o
// `italic` de fábrica do TipTap), mesma razão de `negrito.ts`. ABNT usa
// itálico pra estrangeirismo, título de obra e ênfase — papel diferente do
// negrito, por isso são duas marcas independentes, nunca uma variante da
// outra.
export const Italico = Mark.create({
  name: "italico",

  parseHTML() {
    return [{ tag: "em" }, { tag: "i" }, { style: "font-style=italic" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["em", mergeAttributes(HTMLAttributes), 0];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-i": () => this.editor.commands.toggleMark(this.name),
    };
  },
});

export default Italico;
