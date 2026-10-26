import type { FonteTrabalho } from "@/core/document/types";

// Folha de estilo da prévia paginada (passo 8.6.1). Quem a lê é o Paged.js,
// que a reescreve (`@page`, margens, `float: footnote`) e a aplica às folhas.
// Os valores repetem os do `.docx` (`export/docx/constants.ts` e `styles.ts`):
// margens 3/2/3/2 cm, corpo em 12 pt e entrelinha 1,5, citação longa e
// legendas em 10 pt e espaço simples, recuo de 1,25 cm, citação a 4 cm. Se um
// deles mudar lá, mude aqui: a prévia só vale se a quebra de página sair
// perto da do Word.
//
// Tudo sob `.pv-`: o estilo global do app (Tailwind) alcança o mesmo DOM, e
// um nome de classe próprio é o que o mantém de fora.

const FAMILIAS: Record<FonteTrabalho, string> = {
  times: '"Times New Roman", Times, serif',
  arial: "Arial, Helvetica, sans-serif",
};

export function estilosDaPrevia(fonte: FonteTrabalho = "times"): string {
  const familia = FAMILIAS[fonte];
  return `
@page {
  size: 21cm 29.7cm;
  margin: 3cm 2cm 2cm 3cm;
  @top-right {
    content: counter(page);
    font-family: ${familia};
    font-size: 12pt;
    vertical-align: top;
    padding-top: 2cm;
  }
}

/* Numeração (NBR 14724:2024 §5.3): a capa fica fora da contagem; os
   pré-textuais contam a partir da folha de rosto, sem mostrar o número; o
   texto e o que vem depois contam e mostram, em sequência. As páginas
   nomeadas só trocam o número do canto; o resto herda o @page de cima. */
@page capa {
  @top-right { content: none; }
}
@page pre {
  @top-right { content: none; }
}
.pv-parte-capa { page: capa; }
.pv-parte-pre { page: pre; counter-reset: page 1; }
.pv-parte-texto { page: texto; }

/* Fonte e cor em todo elemento da prévia, e não só no .pv: o Paged.js, ao abrir
   uma folha nomeada nova, nem sempre leva o .pv junto, e o texto caía na
   fonte e na cor do app (visto na folha de rosto). Sem font-size de
   propósito: o tamanho de cada bloco é o dele. */
[class*="pv-"] {
  font-family: ${familia};
  color: #000;
}

/* "Espaço 1,5" do Word é 1,5 vez a altura NATURAL da linha da fonte, não 1,5
   vez o seu tamanho: em Times New Roman e em Arial a linha natural tem cerca
   de 1,15 em. Com 1,5 em, a prévia saía com cerca de 13% menos linhas que o
   .docx (medido contra o LibreOffice, 22/10/2026). */
:root {
  --pv-entrelinha-1: 1.15;
  --pv-entrelinha-15: 1.725;
}

.pv {
  font-family: ${familia};
  font-size: 12pt;
  line-height: var(--pv-entrelinha-15);
  color: #000;
  text-align: left;
}

.pv-elemento-novo { break-before: page; }

.pv-paragrafo {
  margin: 0;
  font-size: 12pt;
  text-indent: 1.25cm;
  text-align: justify;
  orphans: 2;
  widows: 2;
}

.pv-titulo, .pv-titulo-centro {
  /* O estilo global do app dá cor e família aos títulos: aqui valem as do
     trabalho. */
  color: #000;
  font-family: inherit;
  letter-spacing: normal;
}

.pv-titulo {
  margin: 0 0 18pt;
  font-size: 12pt;
  line-height: var(--pv-entrelinha-15);
  font-weight: 700;
  text-align: left;
  break-after: avoid;
}
.pv-titulo-1 { text-transform: uppercase; }
.pv-titulo-2, .pv-titulo-3 { margin-top: 18pt; }
.pv-titulo-3 { font-weight: 400; font-style: italic; }
.pv-titulo-abre { break-before: page; }

.pv-titulo-centro {
  margin: 0 0 18pt;
  font-size: 12pt;
  line-height: var(--pv-entrelinha-15);
  font-weight: 700;
  text-align: center;
  break-after: avoid;
}

.pv-citacao {
  margin: 12pt 0 12pt 4cm;
  font-size: 10pt;
  line-height: var(--pv-entrelinha-1);
  text-align: justify;
}

.pv-figura, .pv-tabela-bloco {
  margin: 0;
  break-inside: avoid;
}
.pv-legenda, .pv-fonte {
  margin: 0;
  font-size: 10pt;
  line-height: var(--pv-entrelinha-1);
  text-align: center;
}
.pv-legenda { break-after: avoid; padding-bottom: 6pt; }
.pv-fonte { padding-bottom: 12pt; }
.pv-imagem {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 18cm;
}
.pv-moldura {
  margin: 0;
  font-style: italic;
  text-align: center;
  padding: 6pt 0;
}

.pv-tabela {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  border-top: 1px solid #000;
  border-bottom: 1px solid #000;
}
.pv-tabela th, .pv-tabela td {
  padding: 2pt 6pt;
  text-align: center;
  text-indent: 0;
  vertical-align: top;
  font-size: 12pt;
  line-height: var(--pv-entrelinha-15);
  overflow-wrap: anywhere;
}
.pv-tabela th { font-weight: 700; border-bottom: 1px solid #000; }
.pv-tabela [rowspan] { vertical-align: middle; }
.pv-tabela tr { break-inside: avoid; }

.pv-formula {
  margin: 6pt 0;
  text-align: center;
  line-height: var(--pv-entrelinha-15);
  break-inside: avoid;
}

.pv-referencia {
  margin: 0 0 12pt;
  font-size: 12pt;
  line-height: var(--pv-entrelinha-1);
  text-align: left;
}

/* A nota sai do .pv e vai para a área de notas da folha: precisa levar a
   fonte consigo, ou cai na do app. */
.pv-nota {
  float: footnote;
  font-family: ${familia};
  font-size: 10pt;
  line-height: var(--pv-entrelinha-1);
  color: #000;
}
.pv-nota::footnote-call {
  content: counter(footnote);
  font-size: 70%;
  line-height: 0;
  vertical-align: super;
}
.pv-nota::footnote-marker {
  content: counter(footnote) " ";
  font-size: 70%;
  vertical-align: super;
}

.pv-aspas, .pv-chamada { font-style: normal; font-weight: 400; }

/* Capa, folha de rosto e de aprovação (convenção do AURA: a norma só
   enumera). Centralizado, com a ênfase por papel, como no .docx. */
.pv-linha { margin: 0; font-size: 12pt; line-height: var(--pv-entrelinha-15); text-align: center; }
.pv-linha-justificado { text-align: justify; }
.pv-linha-recuada-a-direita {
  margin-left: 8cm;
  text-align: justify;
}
.pv-papel-natureza { line-height: var(--pv-entrelinha-1); }
.pv-papel-instituicao { font-weight: 700; }
.pv-papel-autor { text-transform: uppercase; }
.pv-papel-tituloDoTrabalho { font-weight: 700; text-transform: uppercase; }

/* Dedicatória e epígrafe: no pé da página, da metade da mancha até a
   margem direita (NBR 14724:2024 §5.2.4). A altura é a da mancha menos uma
   folga, para não passar da folha. */
.pv-pe {
  height: 24.4cm;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
}
.pv-pe-linha {
  width: 8cm;
  margin: 0;
  font-size: 12pt;
  line-height: var(--pv-entrelinha-15);
  text-align: justify;
}

/* Resumo e abstract: parágrafo único, sem recuo (NBR 6028). */
.pv-resumo {
  margin: 0;
  font-size: 12pt;
  line-height: var(--pv-entrelinha-15);
  text-align: justify;
  text-indent: 0;
}
.pv-termos { margin-top: 12pt; }

/* Sumário e listas de ilustrações. O número da página sai do Paged.js:
   target-counter lê a página do bloco para onde o href aponta, já com a
   contagem acima. Alinhado à esquerda (NBR 6027 §5.1), sem recuo por nível;
   o destaque de cada nível repete o do título (§6.2). */
.pv-indice {
  margin: 0;
  font-size: 12pt;
  line-height: var(--pv-entrelinha-15);
  text-align: left;
  text-indent: 0;
}
.pv-indice a { color: inherit; text-decoration: none; }
/* Sem pontilhado: o .docx usa tabulação direita sem preenchimento (6027
   §5.4 não o pede), e o Paged.js 0.4.3 não implementa leader(). O número
   vai à margem direita por flex. */
.pv-indice a {
  display: flex;
  justify-content: space-between;
  gap: 1em;
}
.pv-indice a::after {
  content: target-counter(attr(href), page);
  flex: none;
  font-weight: 400;
  font-style: normal;
}
.pv-indice-1 { font-weight: 700; text-transform: uppercase; }
.pv-indice-2 { font-weight: 700; }
.pv-indice-3 { font-style: italic; }

/* Lista de abreviaturas e siglas: a sigla e o significado em duas colunas. */
.pv-sigla {
  display: flex;
  margin: 0;
  font-size: 12pt;
  line-height: var(--pv-entrelinha-15);
  text-align: left;
}
.pv-sigla-curta { flex: none; width: 2.67cm; }
`;
}
