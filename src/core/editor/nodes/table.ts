import { mergeAttributes, Node } from "@tiptap/core";

export interface TabelaOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface TabelaAttributes {
  id: string | null;
  legenda: string;
  fonte: string;
}

export interface CelulaTabelaAttributes {
  cabecalho: boolean;
}

// Nós `tabela`, `linha_tabela` e `celula_tabela` — ver docs/schema-tiptap.md
// §4.7. Os três moram no mesmo arquivo porque não existem separados: uma
// linha fora de uma tabela e uma célula fora de uma linha não são estados
// que o schema permita, e separá-los em três arquivos só espalharia uma
// estrutura única.
//
// **`legenda`/`fonte` são atributos da tabela, não linhas dela.** Ficam fora
// da grade porque não são dado tabular — vão acima e abaixo do objeto na
// hora de exibir/exportar. Mesmo desenho de `figura`.
//
// **Sem atributo de número** (docs/schema-tiptap.md §2), pelo mesmo motivo
// de `figura`: "Tabela 2" é derivado de `numerarTabelas()`
// (src/core/document/numbering.ts).
//
// Sem estilo aqui: o padrão IBGE adotado pela ABNT (laterais abertas, sem
// traço vertical, um fio fechando em cima e embaixo e outro separando o
// cabeçalho) é do CSS do editor e do exportador, não do nó — mesma divisão
// de `longQuote.ts`.

export const Tabela = Node.create<TabelaOptions>({
  name: "tabela",

  group: "block",

  // `+`, não `*`: tabela sem nenhuma linha não tem onde receber o cursor —
  // mesma razão pela qual `novaSecao()` nasce com um parágrafo dentro.
  content: "linha_tabela+",

  // O conteúdo interno é editável (célula a célula), mas a tabela como um
  // todo é uma ilha: `isolating` impede que apagar no começo da primeira
  // célula funda a tabela com o bloco anterior.
  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        // Mesmo raciocínio de `figura`/`secao`: quem gera é `novaTabela()`
        // (src/core/document/factory.ts), e `toDocumento()` recusa uma
        // tabela sem id em vez de gravar algo que não dá pra numerar.
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
    };
  },

  parseHTML() {
    return [{ tag: "table" }];
  },

  renderHTML({ HTMLAttributes }) {
    // `tbody` explícito: sem ele o navegador insere um na hora de parsear o
    // HTML de volta, e a árvore deixaria de bater com o schema (`tabela` >
    // `linha_tabela`, sem nível intermediário).
    return ["table", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ["tbody", 0]];
  },
});

export const LinhaTabela = Node.create({
  name: "linha_tabela",

  content: "celula_tabela+",

  // Sem `group: "block"` de propósito: uma linha não é um bloco que uma
  // seção possa conter — só existe dentro de `tabela`, e é o `content` dela
  // que a cita pelo nome.
  parseHTML() {
    return [{ tag: "tr" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["tr", mergeAttributes(HTMLAttributes), 0];
  },
});

export const CelulaTabela = Node.create({
  name: "celula_tabela",

  // Inline direto, sem parágrafo por dentro: texto com `negrito`/`italico`.
  // Uma célula que aceitasse blocos aceitaria uma tabela dentro de outra, que
  // não é coisa que a v1 queira.
  //
  // `text*` e não `inline*` desde o passo 6.1.3c: o único outro nó inline, a
  // nota de rodapé, não entra na grade. A tabela tem rodapé próprio (fonte,
  // nota geral e nota específica, IBGE §3.2.3 e §4.10–4.12).
  content: "text*",

  addAttributes() {
    return {
      cabecalho: {
        default: false,
        parseHTML: (element) => element.tagName.toLowerCase() === "th",
        // Não vai pra `data-*`: a informação já está na escolha da tag em
        // `renderHTML()` abaixo, e `<th>` é o que a torna acessível a
        // leitor de tela — duplicá-la num atributo criaria duas fontes que
        // podem discordar.
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "th" }, { tag: "td" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const tag = node.attrs.cabecalho ? "th" : "td";
    return [tag, mergeAttributes(HTMLAttributes), 0];
  },
});

export default Tabela;
