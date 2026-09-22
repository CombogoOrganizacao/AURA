import { mergeAttributes, Node } from "@tiptap/core";

export interface CitacaoLongaOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface CitacaoLongaAttributes {
  refId: string | null;
  pagina: string;
}

// Nó `citacao_longa` do editor — ver docs/schema-tiptap.md §4.3 (NBR 10520:
// citação direta com mais de três linhas). Arquivo `longQuote.ts` (inglês,
// como o passo 3.4.1 pede), mas `name`/identificador seguem o nome do
// domínio que schema-tiptap.md já usa e que o estilo nomeado `CitacaoLonga`
// do `.docx` (passo 3.4.2/6.1.1) vai casar — mesma convenção de `Secao`
// (arquivo `section.ts`, nome `secao`).
//
// `refId`/`pagina` existem porque schema-tiptap.md já define esta forma,
// mas **sem UI pra preencher nenhum dos dois ainda**: não existe lista de
// referências editável (`Documento.references` existe no tipo, sempre `[]`
// na prática — nenhum componente escreve nela). Ficam com default vazio,
// mesmo padrão de campo-que-existe-mas-não-tem-UI que `Metadados.tipo` já
// tem desde o passo 3.1.3 — preencher de verdade é trabalho da Fase 4
// (citação) e não deste passo, que só cobre o nó e o estilo na tela.
//
// Sem estilo aqui de propósito (docs/schema-tiptap.md §4.3: "recuo de 4 cm,
// fonte menor e espaçamento simples... é formatação do exportador [e do CSS
// do editor], não do nó") — quem aplica é `app/globals.css`
// (`.ProseMirror blockquote`), pelo mesmo motivo que `secao`/`paragrafo` não
// têm cor nem fonte embutida no nó.
export const CitacaoLonga = Node.create<CitacaoLongaOptions>({
  name: "citacao_longa",

  group: "block",

  // Inline direto, sem parágrafo por dentro — mesma forma de conteúdo de
  // `paragrafo`, com texto em `negrito`/`italico`.
  content: "inline*",

  // Nunca a marca `citacao` (4.8): a ligação com a referência já mora em
  // `refId`/`pagina`, atributos do próprio bloco (docs/schema-tiptap.md
  // §4.3). Uma marca dentro dele seria uma segunda ligação, que poderia
  // apontar para outra obra e deixar o bloco com duas chamadas.
  marks: "negrito italico",

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
        default: "",
        parseHTML: (element) => element.getAttribute("data-pagina") ?? "",
        renderHTML: (attributes) => ({ "data-pagina": attributes.pagina }),
      },
    };
  },

  // `blockquote` — tag semântica nativa do HTML pra citação em bloco, mesmo
  // papel que `<section>` já cumpre pro nó `secao`: existe pronta, não
  // precisa de `data-*` só pra dizer "isto é um bloco distinto".
  parseHTML() {
    return [{ tag: "blockquote" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["blockquote", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

export default CitacaoLonga;
