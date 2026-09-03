import { mergeAttributes, Node } from "@tiptap/core";

import type { NivelSecao } from "../../document/types";

export interface SecaoOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface SecaoAttributes {
  id: string | null;
  nivel: NivelSecao;
  titulo: string;
}

// Nó `secao` do editor — ver docs/schema-tiptap.md §4.1. Corresponde 1:1 a
// `Secao` (src/core/document/types.ts): mesmos `id`, `nivel`, `titulo`. O
// título nunca carrega numeração (docs/schema-tiptap.md §2) — "1.2
// Metodologia" nunca é digitado, é sempre derivado da posição do nó no
// documento.
export const Secao = Node.create<SecaoOptions>({
  name: "secao",

  group: "block",

  // Sequência de blocos — parágrafo por enquanto; citação longa, lista,
  // figura, tabela e fórmula entram no content conforme cada um vira nó
  // próprio — e subseções aninhadas, já cobertas aqui porque `secao`
  // pertence ao grupo `block`. Uma subseção deve declarar `nivel` igual ao
  // da seção-mãe mais um, mas o schema por si só não garante isso — quem
  // confere é `validarDocumento()` (src/core/document/validate.ts) sobre o
  // documento serializado, como já registrado em docs/schema-tiptap.md §4.1.
  content: "block*",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        // Gerado por quem cria a seção (comando/UI), nunca aqui: um default
        // estático faria toda seção nova nascer com o mesmo id.
        default: null,
        parseHTML: (element) => element.getAttribute("data-id"),
        renderHTML: (attributes) => ({ "data-id": attributes.id }),
      },
      nivel: {
        default: 1,
        parseHTML: (element) => {
          const valor = Number(element.getAttribute("data-nivel"));
          return valor === 2 || valor === 3 ? valor : 1;
        },
        renderHTML: (attributes) => ({ "data-nivel": attributes.nivel }),
      },
      titulo: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-titulo") ?? "",
        renderHTML: (attributes) => ({ "data-titulo": attributes.titulo }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "section" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

export default Secao;
