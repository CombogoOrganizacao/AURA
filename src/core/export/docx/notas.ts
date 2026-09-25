import { FootnoteReferenceRun, Paragraph, Tab, TextRun } from "docx";

// Notas de rodapé no `.docx` — passo 6.1.3c, porte de `registrarNota()` em
// `poc/docx/gerar.js`.
//
// **O número não sai daqui.** O id que cada nota recebe é só a chave que liga
// a referência no texto ao conteúdo em `word/footnotes.xml`; o expoente que
// aparece ("¹, ², ³") é o Word que desenha, contando as referências na ordem
// do documento. É a numeração "por números arábicos sequenciais" da NBR
// 10520:2023 §8, derivada da posição e nunca gravada, a mesma regra do
// editor (`NoNotaRodape`). Contínua no trabalho inteiro: a §8.2 recomenda
// reiniciar a cada capítulo ou parte, e o TCC não tem capítulos (NBR
// 14724:2024 §4.2.2, "não pode ser dividido em capítulos; deve ser
// organizado em seções").
//
// A forma da nota (fonte menor, espaço simples, sem espaço entre notas,
// segunda linha sob a primeira letra) é do estilo `FootnoteText`
// (`styles.ts`). O `Tab` depois do expoente é o que leva a primeira palavra
// até o recuo deslocado do estilo, onde as linhas seguintes começam.

export interface NotasDeRodape {
  // A referência que vai no texto, no ponto da nota.
  referencia(texto: string): FootnoteReferenceRun;
  // O conteúdo, para `new Document({ footnotes })`.
  readonly conteudo: Record<number, { children: Paragraph[] }>;
}

export function criarNotasDeRodape(): NotasDeRodape {
  const conteudo: Record<number, { children: Paragraph[] }> = {};
  let proxima = 1;

  return {
    conteudo,
    referencia(texto) {
      const id = proxima++;
      // O `docx` põe o expoente da nota (`FootnoteRefRun`) na frente do
      // primeiro parágrafo sozinho.
      conteudo[id] = {
        children: [
          new Paragraph({
            style: "FootnoteText",
            children: [new TextRun({ children: [new Tab(), texto] })],
          }),
        ],
      };
      return new FootnoteReferenceRun(id);
    },
  };
}
