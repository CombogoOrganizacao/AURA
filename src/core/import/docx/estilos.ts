// Como o mammoth lê os estilos do Word (passo 8.7.1). A conversão para HTML é
// feita no navegador (`src/lib/lerDocx.ts`); o que ela marca e o que o AURA
// faz com a marca moram aqui, em `src/core/`, porque são a mesma decisão.
//
// O mammoth já traz um mapa de fábrica: "Heading 1" a "Heading 6" viram `h1`
// a `h6`, negrito e itálico viram `strong` e `em`, listas viram `ul`/`ol`. Os
// nomes abaixo vêm antes dele e cobrem o que ele não conhece: os estilos
// nomeados do próprio exportador do AURA (`export/docx/styles.ts`), que fazem
// a ida e volta reconhecer os títulos sem título, e os nomes que o Word usa
// para legenda e citação.
//
// **Nome de estilo, não o ID.** O Word grava o nome interno em inglês para os
// estilos de fábrica ("heading 1", "caption", "toc 1"), mesmo com a interface
// em português, e o mammoth compara os nomes sem diferenciar maiúscula de
// minúscula.

export const CLASSE = {
  // "Titulo Pre-Textual" e "Titulo Pos-Textual" do AURA: RESUMO, SUMÁRIO,
  // REFERÊNCIAS, APÊNDICE A — …
  tituloPre: "aura-titulo-pre",
  tituloPos: "aura-titulo-pos",
  legenda: "aura-legenda",
  citacaoLonga: "aura-citacao-longa",
} as const;

export const MAPA_DE_ESTILOS: readonly string[] = [
  "p[style-name='Titulo Pre-Textual'] => p.aura-titulo-pre:fresh",
  "p[style-name='Titulo Pos-Textual'] => p.aura-titulo-pos:fresh",
  "p[style-name='Legenda'] => p.aura-legenda:fresh",
  "p[style-name='caption'] => p.aura-legenda:fresh",
  "p[style-name='Citacao Longa'] => p.aura-citacao-longa:fresh",
  "p[style-name='Citação Longa'] => p.aura-citacao-longa:fresh",
  "p[style-name='Citação'] => p.aura-citacao-longa:fresh",
  "p[style-name='Quote'] => p.aura-citacao-longa:fresh",
  "p[style-name='Intense Quote'] => p.aura-citacao-longa:fresh",
  // Modelos de universidade que dão aos títulos o nome em português.
  "p[style-name='Título 1'] => h1:fresh",
  "p[style-name='Título 2'] => h2:fresh",
  "p[style-name='Título 3'] => h3:fresh",
  "p[style-name='Titulo 1'] => h1:fresh",
  "p[style-name='Titulo 2'] => h2:fresh",
  "p[style-name='Titulo 3'] => h3:fresh",
  // O sumário e as listas que o Word monta: o AURA os refaz do texto.
  "p[style-name^='toc'] =>",
  "p[style-name='table of figures'] =>",
];
