import { mergeAttributes, Node } from "@tiptap/core";

export interface FormulaOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface FormulaAttributes {
  texto: string;
}

// Nó `formula` do editor — ver docs/schema-tiptap.md §4.8. Arquivo
// `formula.ts` (identificador em inglês, CLAUDE.md), `name` no domínio,
// mesma convenção de `secao`/`section.ts` e `citacao_longa`/`longQuote.ts`.
//
// **O que fica gravado é a FONTE em LaTeX, nunca a renderização.** `texto`
// guarda `E = mc^2`; o `<span>` cheio de `<span>`s que o KaTeX desenha na
// tela é produzido a cada render e jogado fora — não entra no schema, não é
// persistido e não passa por `innerHTML` (CLAUDE.md, "Segurança": nenhum
// HTML bruto no schema). Quem renderiza é o node view (`FormulaView.tsx`),
// com `katex.render()`, que monta nós de DOM de verdade.
//
// É a mesma divisão de `figura`/`tabela`: o dado é o mínimo do qual tudo o
// mais é derivado. E é o que torna o passo 6.1.4 (OMML no `.docx`) possível
// sem migrar documento nenhum — converter LaTeX em OMML é ler `texto` de
// novo, não desfazer HTML gravado.
//
// **`atom: true`** porque §4.8 diz "atômico": a fórmula não tem texto
// editável do ProseMirror dentro dela. Quem edita a fonte LaTeX é um
// `<input>` nativo no node view — mesma técnica (e mesmo motivo) do título
// da seção em `SectionView.tsx` e da legenda em `CamposLegenda.tsx`.
//
// **Sem atributo de número** (docs/schema-tiptap.md §2). Aqui isso vai além
// de "seria derivado": a NBR 14724 numera equação só "se necessário", e a v1
// não numera nenhuma — não existe lista de equações (3.6.4 cobre figuras,
// tabelas e abreviaturas) nem referência cruzada que precise do número. Um
// atributo de número seria um campo sem quem o preenchesse.
//
// **Sem `id`**, ao contrário de `figura`/`tabela`: aqueles dois precisam de
// id porque a numeração derivada indexa por ele e a lista de ilustrações
// aponta de volta pra eles. Uma fórmula não é numerada nem listada, então um
// id aqui seria um campo que ninguém lê.
//
// Sem estilo aqui, de propósito (mesmo motivo de `longQuote.ts`): "destacada
// do parágrafo e centralizada" é do CSS do editor (`app/globals.css`) e do
// exportador, não do nó.
export const Formula = Node.create<FormulaOptions>({
  name: "formula",

  group: "block",

  atom: true,

  // Selecionável como bloco inteiro: sem conteúdo editável dentro, é o que
  // permite apagar a fórmula com Backspace/Delete tendo-a selecionada.
  selectable: true,

  draggable: true,

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

  // Não existe tag semântica nativa para "fórmula escrita em LaTeX" — a que
  // chega perto, `<math>`, é MathML e deveria conter MathML, não o código
  // fonte. Daí `div[data-formula]`, o mesmo marcador que `renderHTML()`
  // abaixo emite: um seletor que só casa com o que este nó escreveu.
  parseHTML() {
    return [{ tag: "div[data-formula]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    // A fonte LaTeX também vai como texto do elemento, além do atributo:
    // é o que faz copiar uma fórmula e colar fora do AURA entregar
    // `E = mc^2` em vez de um bloco vazio. Ao colar de volta, o nó é leaf e
    // o texto é ignorado — quem manda é `data-texto`, uma fonte só.
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-formula": "" }),
      node.attrs.texto as string,
    ];
  },
});

export default Formula;
