import katex from "katex";

// LaTeX da fórmula → árvore de MathML — passo 6.1.4.
//
// **Quem lê o LaTeX é o KaTeX**, o mesmo que desenha a fórmula na tela
// (`FormulaView.tsx`). A saída MathML dele é pública e estável (MathML de
// apresentação, padrão W3C), e `renderToString` não precisa de DOM. Escrever
// um segundo leitor de LaTeX aqui faria a tela e o `.docx` discordarem sobre
// o que a fórmula diz.
//
// O MathML chega como string, e `src/core/` não tem `DOMParser`. O leitor
// abaixo cobre só o que o KaTeX escreve: elementos, atributos entre aspas
// duplas, texto e as entidades que ele usa. Não é um leitor de XML geral.

export interface NoMathml {
  tag: string;
  atributos: Record<string, string>;
  filhos: NoMathml[];
  // Conteúdo de texto dos elementos folha (`mi`, `mn`, `mo`, `mtext`).
  texto: string;
}

// `null` quando o LaTeX não é válido — a tela já mostra o erro, e o
// exportador sai com o código-fonte como texto.
export function mathmlDoLatex(latex: string): NoMathml | null {
  let marcacao: string;
  try {
    marcacao = katex.renderToString(latex, {
      output: "mathml",
      displayMode: true,
      throwOnError: true,
      strict: false,
      trust: false,
    });
  } catch {
    return null;
  }
  const raiz = lerXml(marcacao);
  return acharTag(raiz, "math");
}

function acharTag(no: NoMathml, tag: string): NoMathml | null {
  if (no.tag === tag) return no;
  for (const filho of no.filhos) {
    const achado = acharTag(filho, tag);
    if (achado) return achado;
  }
  return null;
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (inteira, nome: string) => {
    if (nome.startsWith("#x")) return String.fromCodePoint(parseInt(nome.slice(2), 16));
    if (nome.startsWith("#")) return String.fromCodePoint(parseInt(nome.slice(1), 10));
    return ENTIDADES[nome] ?? inteira;
  });
}

const MARCA = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
const ATRIBUTO = /([\w:-]+)="([^"]*)"/g;

export function lerXml(marcacao: string): NoMathml {
  const raiz: NoMathml = { tag: "#raiz", atributos: {}, filhos: [], texto: "" };
  const pilha: NoMathml[] = [raiz];

  for (const [, fecha, tag, atributos, autoFechada, texto] of marcacao.matchAll(MARCA)) {
    const atual = pilha[pilha.length - 1];
    if (texto !== undefined) {
      atual.texto += decodificar(texto);
      continue;
    }
    if (fecha) {
      if (pilha.length > 1 && atual.tag === tag) pilha.pop();
      continue;
    }
    const no: NoMathml = { tag, atributos: {}, filhos: [], texto: "" };
    for (const [, nome, valor] of (atributos ?? "").matchAll(ATRIBUTO)) {
      no.atributos[nome] = decodificar(valor);
    }
    atual.filhos.push(no);
    if (!autoFechada) pilha.push(no);
  }

  return raiz;
}
