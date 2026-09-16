import type { NoConteudo, NoNumeravel, Secao } from "./types";

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

// --- Figuras e tabelas (passo 3.6.3) ----------------------------------------
// Mesma regra de `numerarSecoes()`, aplicada a outro eixo: "Figura 3" é
// DERIVADO da ordem de aparição, nunca um campo gravado (docs/schema-tiptap.md
// §2). Inserir uma figura no meio do documento renumera todas as seguintes
// sozinho, porque o resultado inteiro é recalculado a cada chamada — não há
// contador incremental a corrigir.
//
// Contagem **contínua no documento inteiro**, não reiniciada por seção: é a
// convenção corrente em TCC, e é a única compatível com a lista de
// ilustrações do passo 3.6.4, que é uma lista só. Como o resto das regras de
// ilustração/tabela, isto não passou pela auditoria do 3.1.1 — ver o
// cabeçalho de `elements/legenda.ts`.

type TipoNumeravel = NoNumeravel["type"];

// `no.type === tipo` com `tipo` numa variável não estreita o union sozinho —
// daí o guarda. Devolver `NoNumeravel` (e não o membro exato) basta: o que se
// lê em seguida é `id`, que figura e tabela têm igual.
function ehDoTipo(no: NoConteudo, tipo: TipoNumeravel): no is NoNumeravel {
  return no.type === tipo;
}

// Ordem de leitura do documento: seções por `ordem` (não pela posição no
// array, mesma convenção de `numerarSecoes()`), e dentro de cada seção a
// ordem do próprio `content`.
function idsEmOrdemDeLeitura(sections: Secao[], tipo: TipoNumeravel): string[] {
  return [...sections]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((secao) => secao.content.filter((no) => ehDoTipo(no, tipo)).map((no) => no.id));
}

// Atribui 1..n na ordem recebida. Exportada porque o editor numera a partir
// do documento ProseMirror, sem passar pelo formato canônico
// (src/core/editor/numbering.ts) — as duas entradas diferem, a contagem é a
// mesma função, e é isso que impede a tela e o `.docx` de divergirem.
export function numerarPorOrdem(ids: readonly string[]): Map<string, number> {
  return new Map(ids.map((id, indice) => [id, indice + 1]));
}

export function numerarFiguras(sections: Secao[]): Map<string, number> {
  return numerarPorOrdem(idsEmOrdemDeLeitura(sections, "figura"));
}

export function numerarTabelas(sections: Secao[]): Map<string, number> {
  return numerarPorOrdem(idsEmOrdemDeLeitura(sections, "tabela"));
}
