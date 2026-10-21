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

.pv {
  font-family: ${familia};
  font-size: 12pt;
  line-height: 1.5;
  color: #000;
  text-align: left;
}

.pv-elemento-novo { break-before: page; }

.pv-paragrafo {
  margin: 0;
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
  line-height: 1.5;
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
  line-height: 1.5;
  font-weight: 700;
  text-align: center;
  break-after: avoid;
}

.pv-citacao {
  margin: 12pt 0 12pt 4cm;
  font-size: 10pt;
  line-height: 1;
  text-align: justify;
}

.pv-figura, .pv-tabela-bloco {
  margin: 0;
  break-inside: avoid;
}
.pv-legenda, .pv-fonte {
  margin: 0;
  font-size: 10pt;
  line-height: 1;
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
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.pv-tabela th { font-weight: 700; border-bottom: 1px solid #000; }
.pv-tabela tr { break-inside: avoid; }

.pv-formula {
  margin: 6pt 0;
  text-align: center;
  line-height: 1.5;
  break-inside: avoid;
}

.pv-referencia {
  margin: 0 0 12pt;
  font-size: 12pt;
  line-height: 1;
  text-align: left;
}

/* A nota sai do .pv e vai para a área de notas da folha: precisa levar a
   fonte consigo, ou cai na do app. */
.pv-nota {
  float: footnote;
  font-family: ${familia};
  font-size: 10pt;
  line-height: 1;
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
`;
}
