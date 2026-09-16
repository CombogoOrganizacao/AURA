import { AlignmentType, Paragraph, SequentialIdentifier, TextRun } from "docx";

import { SEPARADOR_LEGENDA, rotuloDe, textoFonte } from "../../document/elements/legenda";
import type { NoNumeravel } from "../../document/types";
import { ABNT } from "./constants";

// Legenda e fonte de ilustração/tabela no `.docx` — passo 3.6.3. **Porte de
// `poc/docx/gerar.js`** (`legendaComSeq` e `fonteDe`), congelada e conferida
// no Word.
//
// **O número é um campo `SEQ`, não um número escrito.** `SequentialIdentifier`
// gera `{ SEQ Figura \* ARABIC }`: o Word conta as ocorrências do campo e
// renumera sozinho quando alguém insere uma figura no meio do arquivo já
// exportado. É o mesmo raciocínio do campo `TOC` no sumário (3.6.2) — número
// derivado, nunca gravado (docs/schema-tiptap.md §2) — e é o que a lista de
// ilustrações do passo 3.6.4 vai recolher, via
// `captionLabelIncludingNumbers` (é assim que a PoC monta as listas dela).
//
// Por isso `textoLegenda()` (src/core/document/elements/legenda.ts) **não** é
// usado aqui: aquela função monta a string inteira, com o número dentro, que
// é o certo pra tela; aqui o número não é texto, é campo. O que os dois
// compartilham é o rótulo e o separador — o rótulo vem de `rotuloDe()`, e o
// travessão é o mesmo ` — ` dos dois lados.
//
// Fonte menor e espaçamento simples: dos poucos valores de legenda que a
// auditoria do 3.1.1 cobriu (ver `docs/auditoria-abnt.md` e o cabeçalho de
// `document/elements/legenda.ts`, que registra o que ficou por auditar).

function runMenor(texto: string): TextRun {
  return new TextRun({ text: texto, size: ABNT.tamanhoMenor });
}

// `keepNext`: a legenda não pode cair sozinha no fim de uma página, separada
// do objeto que ela nomeia.
export function paragrafoLegenda(no: NoNumeravel): Paragraph {
  const rotulo = rotuloDe(no);
  return new Paragraph({
    children: [
      runMenor(`${rotulo} `),
      new SequentialIdentifier(rotulo),
      ...(no.legenda ? [runMenor(`${SEPARADOR_LEGENDA}${no.legenda}`)] : []),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { line: ABNT.espacamento1 },
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
      children: [runMenor(texto)],
      alignment: AlignmentType.CENTER,
      spacing: { line: ABNT.espacamento1, after: 240 },
    }),
  ];
}
