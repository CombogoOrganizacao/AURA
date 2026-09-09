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
        //
        // **Tentei trocar isto por `isRequired: true` sem `default`** no
        // passo 2B.12, esperando que o próprio ProseMirror recusasse criar
        // uma seção sem id. Duas surpresas, as duas achadas ao vivo (uma
        // via Vitest, não via navegador):
        // (1) não funciona pro problema que motivou a mudança —
        // `NodeType.create()`/`createAndFill()` chamados **sem nenhum
        // argumento** tratam `attrs` como `null`, não `undefined`, e a
        // checagem de atributo obrigatório do ProseMirror só dispara em
        // `undefined`. É exatamente essa chamada sem argumento que o
        // ProseMirror usa internamente pra preencher conteúdo obrigatório
        // — a checagem nunca roda no caso que importa.
        // (2) e ainda quebra a construção do schema: com `content:
        // "secao+"` em `documento.ts`, o ProseMirror verifica se `secao` é
        // "generatable" (consegue se criar só com defaults) — sem
        // `default` em `id`, não consegue, e `new Schema(...)` lança
        // "Only non-generatable nodes (secao) in a required position"
        // antes de qualquer editor existir. Pego por
        // `documento.test.ts`, não pelo navegador.
        //
        // A defesa real é o `filterTransaction` em `documento.ts`: ele
        // inspeciona o **resultado** de cada transação e recusa qualquer
        // uma que deixaria uma seção sem id, independente de como esse
        // id ausente teria surgido. `default: null` aqui só precisa
        // continuar existindo pra manter `secao` "generatable" — o
        // schema pode construir um filler, mas o guarda garante que esse
        // filler nunca chega a ser aplicado ao estado do editor.
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

  // Atalho de nível de título (passo 2.5) — `updateAttributes` é o comando
  // de fábrica do TipTap, genérico por nome de nó; não precisou de comando
  // próprio aqui. Muda o `nivel` da seção mais próxima da seleção, sem
  // impedir salto de nível (quem confere isso é `validarDocumento()`, não o
  // schema — já registrado em docs/schema-tiptap.md §4.1). `Toolbar.tsx`
  // chama o mesmo `updateAttributes` no clique; o atalho existe
  // independente do toolbar estar montado.
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-1": () => this.editor.commands.updateAttributes(this.name, { nivel: 1 }),
      "Mod-Alt-2": () => this.editor.commands.updateAttributes(this.name, { nivel: 2 }),
      "Mod-Alt-3": () => this.editor.commands.updateAttributes(this.name, { nivel: 3 }),
    };
  },
});

export default Secao;
