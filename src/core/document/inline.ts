import type { NoInline, NoNotaRodape, NoTexto } from "./types";

// O conteúdo inline de um parágrafo ou citação longa mistura texto e nota de
// rodapé (passo 6.1.3c). Quem só lê o texto do parágrafo, como a conferência,
// a busca e as estatísticas, usa `soTexto()`: pela regra de `NoNotaRodape`
// (types.ts), a nota conta zero caracteres, então tirá-la não desloca nenhum
// índice de caractere, e "palavra¹ continua" é lido como "palavra continua".

export function ehNota(no: NoInline): no is NoNotaRodape {
  return no.type === "nota_rodape";
}

export function soTexto(content: readonly NoInline[] | undefined): NoTexto[] {
  return (content ?? []).filter((no): no is NoTexto => no.type === "text");
}
