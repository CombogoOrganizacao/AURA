import type { Secao } from "./types";

// Numeração progressiva de seção (NBR 6024): "2.1", nunca escrita dentro de
// `Secao.titulo` (ver CLAUDE.md, "Formato e dados", e docs/schema-tiptap.md
// §2 — "1.2 Metodologia" é o que aparece na tela, "Metodologia" é o que fica
// gravado). Esta função é a única fonte dessa string: quem precisa exibir a
// numeração (editor, painel de seções, exportador) chama aqui, nunca
// recalcula por conta própria.
//
// Assume `sections` já validado por `validarDocumento()` (primeira seção
// nível 1, sem pular nível) — mesma convenção de `fromDocumento()` em
// src/core/export/docx/fromDocumento.ts: não valida de novo, só deriva.
//
// Como funciona: três contadores, um por nível. Cada seção incrementa o
// contador do seu nível e zera os contadores mais profundos — a mesma regra
// que qualquer sumário numerado usa (1, 1.1, 1.2, 2, 2.1.1...). Como o
// resultado inteiro é recalculado a cada chamada a partir de `ordem`/`nivel`,
// inserir uma seção no meio, remover uma seção ou promover/rebaixar o nível
// de uma seção existente renumeram tudo sozinhos — não há estado incremental
// para corrigir à mão.
export function numerarSecoes(sections: Secao[]): Map<string, string> {
  const emOrdem = [...sections].sort((a, b) => a.ordem - b.ordem);
  const contadores = [0, 0, 0];
  const numeracao = new Map<string, string>();

  for (const secao of emOrdem) {
    const indice = secao.nivel - 1;
    contadores[indice] += 1;
    for (let i = indice + 1; i < contadores.length; i++) {
      contadores[i] = 0;
    }
    numeracao.set(secao.id, contadores.slice(0, secao.nivel).join("."));
  }

  return numeracao;
}
