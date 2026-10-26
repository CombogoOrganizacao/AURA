import type { NoHtmlColado } from "@/core/editor/paste";

// Ponte entre `DOMParser` (só existe no navegador) e a árvore própria que
// `src/core/` sabe percorrer: `mapearHtmlColado()` na colagem (passo 3.3.4)
// e `lerDocx()` na importação do `.docx` (8.7.1). A decisão de "o que vira o
// quê" mora inteira lá, testável sem navegador; aqui só se anda o DOM e se
// converte a forma, sem decidir nada.
//
// O `DOMParser` com `text/html` monta um documento inerte: não roda script
// nem carrega imagem. E a árvore que sai daqui não guarda HTML nenhum.

// O que a leitura do `.docx` usa: a classe que o mapa de estilos põe
// (`import/docx/estilos.ts`), os atributos que ligam a nota de rodapé à
// chamada e a imagem aos bytes, e a mescla das células da tabela. Nada mais
// é copiado.
const ATRIBUTOS_LIDOS = ["id", "href", "src", "alt", "colspan", "rowspan"] as const;

function noDomParaArvore(no: Node, comAtributos: boolean): NoHtmlColado | null {
  if (no.nodeType === Node.TEXT_NODE) {
    return { tipo: "texto", texto: no.textContent ?? "" };
  }
  if (no.nodeType !== Node.ELEMENT_NODE) return null; // comentário etc. — descartado
  const elemento = no as Element;
  const filhos = Array.from(elemento.childNodes)
    .map((filho) => noDomParaArvore(filho, comAtributos))
    .filter((filho): filho is NoHtmlColado => filho !== null);
  const tag = elemento.tagName.toLowerCase();
  if (!comAtributos) return { tipo: "elemento", tag, filhos };

  const atributos: Record<string, string> = {};
  for (const nome of ATRIBUTOS_LIDOS) {
    const valor = elemento.getAttribute(nome);
    if (valor !== null) atributos[nome] = valor;
  }
  const classe = elemento.getAttribute("class");
  return { tipo: "elemento", tag, ...(classe ? { classe } : {}), atributos, filhos };
}

// `comAtributos`: só a leitura do `.docx` precisa deles; a colagem não.
export function arvoreDoHtml(html: string, { comAtributos = false } = {}): NoHtmlColado[] {
  const documento = new DOMParser().parseFromString(html, "text/html");
  return Array.from(documento.body.childNodes)
    .map((no) => noDomParaArvore(no, comAtributos))
    .filter((no): no is NoHtmlColado => no !== null);
}
