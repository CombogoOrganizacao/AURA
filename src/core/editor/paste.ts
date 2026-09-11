import type { JSONContent } from "@tiptap/core";

// Colar do Word e de outras fontes (passo 3.3.4) — CLAUDE.md, "Segurança":
// "todo conteúdo colado é sanitizado antes de entrar no documento; nenhum
// HTML bruto no schema". `mapearHtmlColado()` é a sanitização: o tipo de
// retorno (`JSONContent[]`, mas só `paragraph`/`text` com marca `negrito` ou
// `italico`, nunca uma tag ou atributo bruto) não tem onde guardar HTML —
// não é uma checagem em runtime que pode ter um buraco, é a forma do dado.
//
// Fica em `src/core/` porque a árvore que esta função percorre
// (`NoHtmlColado`) é um tipo próprio, não `Node`/`Element` do DOM — CLAUDE.md
// proíbe DOM em `src/core/`. Quem tem um `Node` de verdade (`DOMParser`, só
// existe no navegador) é `Editor.tsx`, o primeiro lugar de cima pra baixo
// onde isso está disponível; a função ali (`arvoreColadaDoHtml`) só anda o
// DOM e converte pra esta forma, sem decidir nada — toda a decisão de "o que
// vira o quê" mora aqui, testável sem navegador.
//
// O schema de hoje só tem `secao`/`paragrafo`/`negrito`/`italico`
// (docs/schema-tiptap.md) — sem lista, citação, título como nó. Por isso a
// regra do passo ("o que não mapeia vira parágrafo simples") cobre bem mais
// do que pareceria: título de estilo do Word (`h1`-`h6`, ou um `<p>` com
// classe de estilo do Word — este parser não lê `class`/`style`, cai no
// mesmo lugar de um `<p>` comum) e item de lista (`li`, dentro ou fora de
// `ul`/`ol`) viram parágrafo comum, sem o negrito/nível que tinham — perder
// o estilo aqui é a escolha certa: não existe UI pra criar seção nova a
// partir de colar (docs/to-do.md registra isso como lacuna, sem passo
// numerado ainda), então uma seção nova nascendo do nada, sem id nem lugar
// na hierarquia, seria pior que virar parágrafo.

export type NoHtmlColado =
  { tipo: "texto"; texto: string } | { tipo: "elemento"; tag: string; filhos: NoHtmlColado[] };

// Tags que Word, Google Docs e navegadores usam pra negrito/itálico — as
// duas únicas marcas que o schema tem (docs/schema-tiptap.md §5.1). Mesmas
// tags que `Negrito`/`Italico` já reconhecem em `parseHTML()`
// (src/core/editor/marks/) — coincidência proposital, não duas fontes de
// verdade: aqui decide o que a pessoa *cola*, lá o que o ProseMirror
// reidrata ao *carregar* um documento salvo; nenhum dos dois lê o outro.
const TAGS_NEGRITO = new Set(["b", "strong"]);
const TAGS_ITALICO = new Set(["em", "i"]);

// Tags que fecham o parágrafo corrente e abrem outro — bloco de verdade
// (`p`, `div`) ou algo que vira parágrafo por não ter nó próprio ainda
// (título `h1`-`h6`, item de lista `li`). `ul`/`ol`/`table`/`tr`/`td` não
// entram aqui de propósito: são só contêiner, ficam transparentes — quem
// fecha parágrafo é o `li`/`p` dentro deles, não o wrapper.
const TAGS_BLOCO = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"]);

// Conteúdo que nunca deve virar texto visível — tag e filhos inteiros
// descartados, nem o texto de dentro sobrevive. `script`/`style` são o caso
// de segurança (o texto de dentro não é HTML executável depois de virar nó
// de texto do ProseMirror — React nunca renderiza com `innerHTML` — mas
// deixá-lo vazar como parágrafo visível seria lixo, não sanitização); o
// resto (`img`, `svg`, `iframe`, ...) é mídia sem equivalente em texto, sem
// nó pra isso ainda (figura entra na Fase 3.6/6.1.2).
const TAGS_IGNORADAS = new Set([
  "script",
  "style",
  "head",
  "template",
  "noscript",
  "svg",
  "img",
  "video",
  "audio",
  "iframe",
  "object",
  "embed",
]);

interface Acumulador {
  paragrafos: JSONContent[];
  atual: JSONContent[];
}

function fecharParagrafo(acc: Acumulador): void {
  if (acc.atual.length > 0) {
    acc.paragrafos.push({ type: "paragraph", content: acc.atual });
    acc.atual = [];
  }
}

function percorrer(no: NoHtmlColado, negrito: boolean, italico: boolean, acc: Acumulador): void {
  if (no.tipo === "texto") {
    // Nó de texto puro entre tags (quebra de linha da formatação do HTML de
    // origem, não conteúdo) não vira parágrafo vazio nem espaço perdido no
    // meio de uma frase real — só descarta o que é só espaço em branco.
    if (no.texto.trim() === "") return;
    const marks = [
      ...(negrito ? [{ type: "negrito" }] : []),
      ...(italico ? [{ type: "italico" }] : []),
    ];
    acc.atual.push(
      marks.length > 0 ? { type: "text", text: no.texto, marks } : { type: "text", text: no.texto },
    );
    return;
  }

  if (TAGS_IGNORADAS.has(no.tag)) return;

  if (no.tag === "br") {
    fecharParagrafo(acc);
    return;
  }

  const proximoNegrito = negrito || TAGS_NEGRITO.has(no.tag);
  const proximoItalico = italico || TAGS_ITALICO.has(no.tag);
  const ehBloco = TAGS_BLOCO.has(no.tag);

  if (ehBloco) fecharParagrafo(acc);
  for (const filho of no.filhos) {
    percorrer(filho, proximoNegrito, proximoItalico, acc);
  }
  if (ehBloco) fecharParagrafo(acc);
}

// Sanitiza e mapeia HTML colado pro schema fechado do editor — ver os
// comentários acima pro que cada regra decide. Devolve conteúdo pronto pra
// `editor.commands.insertContent()`; array vazio quando não sobra nada
// aproveitável (colou só uma imagem, por exemplo).
export function mapearHtmlColado(raiz: readonly NoHtmlColado[]): JSONContent[] {
  const acc: Acumulador = { paragrafos: [], atual: [] };
  for (const no of raiz) {
    percorrer(no, false, false, acc);
  }
  fecharParagrafo(acc);
  return acc.paragrafos;
}
