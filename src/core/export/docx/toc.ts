import { TableOfContents, type FileChild } from "docx";

import { TITULO_SUMARIO } from "../../document/elements/sumario";
import { paragrafoTituloPreTextual } from "./preTextuais";

// Sumário do `.docx` (NBR 6027) — passo 3.6.2. **Porte de `poc/docx/gerar.js`**
// (bloco "SEÇÃO 2 — Pré-textuais", o `new TableOfContents("Sumário", ...)`),
// congelada e conferida no Word.
//
// **Campo `TOC`, não texto digitado.** A entrada é montada pelo Word a partir
// dos parágrafos com estilo de título, e o número de página vem da paginação
// real — que só existe depois que o Word quebra o documento em páginas.
// `src/core/` não pagina (é o que `AvisoPaginacao.tsx` avisa na tela, e o
// motivo de `ItemSumario` não ter campo de página, ver
// `document/elements/sumario.ts`): escrever aqui um número qualquer seria
// inventar dado. O campo é o único jeito de o número estar certo.
//
// `gerarSumario()` (3.6.1) e este arquivo não competem: um serve a tela, que
// precisa navegar; o outro serve o `.docx`, onde quem numera é o Word. O que
// os dois compartilham — e é o que a 6027 exige — é a **grafia do título**:
// o campo copia o texto do parágrafo de título do corpo, e esse texto sai de
// `textoItemSumario()` em `fromDocumento.ts`. Não há segunda montagem de
// string que possa divergir.

// `\o "1-3"` no campo: o Word recolhe os parágrafos com estilo Heading1 a
// Heading3. É o que "ligado aos estilos nomeados" quer dizer — a ligação é
// pelo estilo (`styles.ts`), não por marcação manual entrada a entrada.
//
// Três níveis, não os cinco da PoC: `NivelSecao`
// (src/core/document/types.ts) para em 3, então Heading4/Heading5 nunca são
// produzidos por `fromDocumento()` — só ficam declarados por paridade de
// `<w:style>` com a PoC. Pedir "1-5" recolheria níveis que não existem.
const NIVEIS_DE_TITULO = "1-3";

// Título + campo, juntos: o par é o elemento pré-textual "sumário" inteiro, e
// separá-los só daria a `sections.ts` a chance de montar um sem o outro.
//
// O título usa `TituloPreTextual`, que **não** é estilo de título — é o que o
// mantém fora do próprio sumário, sem regra especial (NBR 6027: o sumário não
// se lista). Mesma razão pela qual resumo e abstract também não aparecem lá.
export function blocoSumario(): FileChild[] {
  return [
    paragrafoTituloPreTextual(TITULO_SUMARIO),
    // `hyperlink: true` (`\h`): cada entrada vira link para o título no
    // corpo. Não muda o impresso — a norma não pede nem proíbe —, e é o que
    // torna o `.docx` navegável na tela de quem vai ler.
    new TableOfContents(TITULO_SUMARIO, {
      hyperlink: true,
      headingStyleRange: NIVEIS_DE_TITULO,
    }),
  ];
}
