import { Paragraph, SimpleField, TextRun } from "docx";

import { SEPARADOR_LEGENDA, rotuloDe, textoFonte } from "../../document/elements/legenda";
import type { NoNumeravel } from "../../document/types";
import { ABNT } from "./constants";

// Legenda e fonte de ilustração/tabela no `.docx` — passo 3.6.3, com a
// correção da lista de tabelas descrita abaixo. **Porte de
// `poc/docx/gerar.js`** (`legendaComSeq` e `fonteDe`), congelada e conferida
// no Word.
//
// **O número é um campo `SEQ`, não um número escrito.** O campo faz o Word
// contar as ocorrências e renumerar sozinho quando alguém insere uma figura
// no meio do arquivo já exportado. É o mesmo raciocínio do campo `TOC` no
// sumário (3.6.2) — número derivado, nunca gravado (docs/schema-tiptap.md
// §2).
//
// **Mas o campo carrega o número derivado como resultado em cache**, e é o
// que conserta a lista de figuras/tabelas (3.6.4). Um campo `SEQ` sem cache é
// gravado vazio: `<w:fldChar separate/>` seguido direto de `<w:fldChar
// end/>`, sem texto nenhum entre os dois. O Word só o preenche ao atualizar
// os campos — e atualiza em ORDEM DE DOCUMENTO. As listas ficam nos
// pré-textuais, ANTES do corpo, então quando o campo `TOC \c "Tabela"` da
// lista é montado, os `SEQ` das legendas ainda estão vazios: a entrada sai
// com o rótulo e o número de página, sem o número da tabela. O sumário não
// sofre disso porque título de seção é texto literal, não campo.
//
// O cache não é número gravado no documento: `numerarTabelas()`
// (src/core/document/numbering.ts) continua sendo quem deriva, o valor é
// recalculado a cada exportação, e o campo segue no arquivo — quem editar o
// `.docx` no Word continua tendo renumeração automática. É exatamente o que o
// próprio Word grava: instrução mais último resultado conhecido.
//
// Por isso `textoLegenda()` (src/core/document/elements/legenda.ts) **não** é
// usado aqui: aquela função monta a string inteira, com o número dentro, que
// é o certo pra tela; aqui o número é campo, e o texto em volta vem em runs
// separados. O que os dois compartilham é o rótulo e o separador.
//
// Fonte menor e espaçamento simples vêm do estilo nomeado `Legenda`
// (`styles.ts`), não de cada run — ver o comentário lá: o run do cache do
// campo é montado pela biblioteca `docx` e não aceita `size`, então preso ao
// run o número sairia em 12 pt no meio de uma legenda de 10 pt. Dos poucos
// valores de legenda que a auditoria do 3.1.1 cobriu (ver
// `docs/auditoria-abnt.md` e o cabeçalho de `document/elements/legenda.ts`,
// que registra o que ficou por auditar).

// `\* ARABIC` explícito, e não o padrão implícito: é o que a PoC documentava
// e o que deixa a numeração imune a um `\* alphabetic` herdado do documento.
function campoNumero(rotulo: string, numero: number): SimpleField {
  return new SimpleField(`SEQ ${rotulo} \\* ARABIC`, String(numero));
}

// `keepNext`: a legenda não pode cair sozinha no fim de uma página, separada
// do objeto que ela nomeia.
//
// `numero` é o valor derivado por `numerarFiguras()`/`numerarTabelas()` —
// quem chama já o tem em mãos (`fromDocumento.ts`), e passá-lo aqui é o que
// evita este módulo recontar por conta própria.
export function paragrafoLegenda(no: NoNumeravel, numero: number): Paragraph {
  const rotulo = rotuloDe(no);
  return new Paragraph({
    children: [
      new TextRun(`${rotulo} `),
      campoNumero(rotulo, numero),
      ...(no.legenda ? [new TextRun(`${SEPARADOR_LEGENDA}${no.legenda}`)] : []),
    ],
    style: "Legenda",
    keepNext: true,
  });
}

// Devolve `[]` quando não há fonte — não fabrica uma "Fonte:" pendurada só
// pra ter aparência de conformidade (mesma lógica de `paragrafosResumo()` em
// `preTextuais.ts`). Elemento obrigatório que falta é assunto de
// `validarDocumento()`, não do exportador.
export function paragrafoFonte(no: NoNumeravel): Paragraph[] {
  const texto = textoFonte(no.fonte);
  if (!texto) return [];

  return [
    new Paragraph({
      children: [new TextRun(texto)],
      style: "Legenda",
      spacing: { line: ABNT.espacamento1, after: 240 },
    }),
  ];
}
