// Escape de texto do aluno para dentro do `.tex` (passo 6.2.1).
//
// **O que entra aqui é sempre texto, nunca LaTeX.** O aluno escreve texto no
// editor; o `.tex` não pode interpretar nada do que ele digitou. A única
// exceção é a fórmula, que é LaTeX por definição e não passa por aqui
// (`document.ts`).
//
// Três camadas, nesta ordem:
//
// 1. Os dez caracteres especiais do LaTeX, `\ { } & % $ # _ ~ ^`. A barra
//    invertida vem primeiro na tabela e tudo é trocado numa passada só, para
//    o `\` de `\&` não ser escapado de novo.
// 2. Ligaduras que o LaTeX formaria sozinho com a codificação T1: `--` e
//    `---` viram travessão, ` `` ` e `''` viram aspas curvas, `<<` e `>>`
//    viram aspas angulares, `,,` vira aspas baixas, `!`` e `?`` viram sinais
//    invertidos. O aluno que digitou dois hífens quer dois hífens. Um `{}`
//    entre os dois caracteres desfaz a ligadura sem mudar o texto.
// 3. Unicode que o pdfLaTeX com `inputenc`/`fontenc` T1 não desenha. Letras
//    gregas e símbolos matemáticos comuns em TCC viram o comando equivalente
//    em modo matemático; o resto, que faria a compilação parar com "Unicode
//    character not set up for use with LaTeX", sai como o código do
//    caractere, visível no PDF. **Nunca some em silêncio.**

const ESPECIAIS: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  // Não é especial para o LaTeX, mas sozinho a T1 o desenha como aspa
  // simples de abertura (‘). O aluno que digitou um acento grave quer o
  // acento grave.
  "`": "\\textasciigrave{}",
};

// Pares que formam ligadura na T1. O `{}` vai depois do primeiro caractere de
// cada par. Por antecipação (`(?=…)`), e não casando o par inteiro, para
// `---` virar `-{}-{}-`: casando pares, o terceiro hífen formaria outro `--`
// com o segundo.
const LIGADURAS = /-(?=-)|`(?=`)|'(?=')|<(?=<)|>(?=>)|,(?=,)|!(?=`)|\?(?=`)/g;

// Latim básico, Latim-1 e Latim Estendido-A: o `inputenc` com `fontenc` T1
// cobre (acentos do português, espanhol, francês, alemão, e o resto do
// Latim-1 imprimível).
function coberto(codigo: number): boolean {
  return (codigo >= 0x20 && codigo <= 0x7e) || (codigo >= 0xa0 && codigo <= 0x17f);
}

// Pontuação e símbolos fora do Latim-1 que o `inputenc` conhece com T1/
// textcomp. Passam como estão.
const PONTUACAO_COBERTA = new Set([
  "–", "—", "‘", "’", "‚", "“", "”", "„", "•", "…", "‰", "€", "™", "†", "‡", "‹", "›", "′", "″",
]);

// Grego e matemática frequentes em TCC. Modo matemático via `\ensuremath`,
// que funciona dentro e fora de fórmula. Exportada para a reimportação
// (`import/latex/inline.ts`) desfazer a troca com a mesma tabela.
export const MATEMATICA: Readonly<Record<string, string>> = {
  α: "\\alpha", β: "\\beta", γ: "\\gamma", δ: "\\delta", ε: "\\varepsilon", ζ: "\\zeta",
  η: "\\eta", θ: "\\theta", ι: "\\iota", κ: "\\kappa", λ: "\\lambda", μ: "\\mu", ν: "\\nu",
  ξ: "\\xi", π: "\\pi", ρ: "\\rho", σ: "\\sigma", τ: "\\tau", υ: "\\upsilon", φ: "\\varphi",
  χ: "\\chi", ψ: "\\psi", ω: "\\omega", Γ: "\\Gamma", Δ: "\\Delta", Θ: "\\Theta",
  Λ: "\\Lambda", Ξ: "\\Xi", Π: "\\Pi", Σ: "\\Sigma", Φ: "\\Phi", Ψ: "\\Psi", Ω: "\\Omega",
  "≤": "\\leq", "≥": "\\geq", "≠": "\\neq", "≈": "\\approx", "≡": "\\equiv", "∞": "\\infty",
  "→": "\\rightarrow", "←": "\\leftarrow", "↔": "\\leftrightarrow", "⇒": "\\Rightarrow",
  "⇔": "\\Leftrightarrow", "∈": "\\in", "∉": "\\notin", "⊂": "\\subset", "∪": "\\cup",
  "∩": "\\cap", "∑": "\\sum", "∏": "\\prod", "√": "\\surd", "∂": "\\partial", "∇": "\\nabla",
  "∀": "\\forall", "∃": "\\exists", "∅": "\\emptyset", "⋅": "\\cdot", "−": "-",
};

function caractere(simbolo: string): string {
  if (simbolo in ESPECIAIS) return ESPECIAIS[simbolo];
  const codigo = simbolo.codePointAt(0)!;
  if (coberto(codigo) || PONTUACAO_COBERTA.has(simbolo)) return simbolo;
  if (simbolo in MATEMATICA) return `\\ensuremath{${MATEMATICA[simbolo]}}`;
  // Tabulação e quebra de linha viram espaço: no `.tex`, uma linha em branco
  // abriria parágrafo novo no meio do texto do aluno. Quem divide parágrafos
  // é a estrutura do documento, não o texto.
  if (codigo === 0x09 || codigo === 0x0a || codigo === 0x0d) return " ";
  const hexa = codigo.toString(16).toUpperCase().padStart(4, "0");
  return `\\texttt{[U+${hexa}]}`;
}

export function escaparLatex(texto: string): string {
  // `Array.from` percorre por ponto de código, não por unidade UTF-16: um
  // emoji é um caractere só, não dois pedaços de par substituto.
  const escapado = Array.from(texto).map(caractere).join("");
  return escapado.replace(LIGADURAS, (primeiro) => `${primeiro}{}`);
}
