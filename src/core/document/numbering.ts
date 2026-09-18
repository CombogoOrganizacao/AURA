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

// --- Apêndices e anexos (passo 3.7.1) ---------------------------------------
// Terceiro eixo derivado, mesma regra dos dois de cima: "APÊNDICE B" vem da
// POSIÇÃO do elemento na sua lista, nunca de um campo gravado. Inserir um
// apêndice no meio reletra todos os seguintes sozinho, porque o resultado
// inteiro é recalculado a cada chamada.
//
// **A ordem é a do array**, não um campo `ordem` como em `Secao`: apêndice e
// anexo não têm hierarquia nem numeração progressiva para reconciliar, e um
// segundo campo só existiria para poder divergir da posição. Quando houver UI
// de reordenar, ela move o item no array — é o mesmo dado.

// Alfabeto das letras de apêndice/anexo, num lugar só.
//
// **26 letras é uma ESCOLHA, não um achado de auditoria.** Repete-se que a
// NBR 14724 fala em "23 letras do alfabeto" (A–Z sem K, W e Y) antes de
// dobrar, e isso NÃO foi conferido na fonte primária — a auditoria do 3.1.1
// não tem linha para a letra do apêndice (ver docs/auditoria-abnt.md, onde a
// pendência está registrada). A diferença só aparece do 11º elemento em
// diante ("K" aqui, "L" lá), e trocar é editar esta constante: é por isso que
// ela existe separada de `letraDeIndice()`.
// **26 letras, A-Z, confirmado na fonte primária em 18/09/2026.** A NBR
// 14724:2024 §4.2.3.3 diz "letras maiúsculas consecutivas" e "quando esgotadas
// as letras do alfabeto, devem ser utilizadas letras maiúsculas dobradas" — e
// nada mais. **A regra das 23 letras (A-Z sem K, W e Y), repetida em fonte
// secundária e registrada como pendência 4 da auditoria, não existe no texto
// da norma.** A pendência está fechada; a constante fica separada da função
// porque continua sendo o lugar certo para um preset de instituição que peça
// outra coisa (docs/auditoria-abnt.md).
export const ALFABETO_POSTEXTUAL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// 0 → "A", 25 → "Z", 26 → "AA", 27 → "AB". **Letra dobrada depois de
// esgotado o alfabeto**, literal no §4.2.3.3 — e nunca `undefined`: uma função
// de numeração que devolve vazio no 27º elemento produz "APÊNDICE  — Título"
// no documento exportado, e ninguém repara até a impressão.
export function letraDeIndice(indice: number): string {
  if (!Number.isInteger(indice) || indice < 0) {
    throw new Error(`Índice de apêndice/anexo inválido: ${indice} (esperava inteiro >= 0)`);
  }

  const base = ALFABETO_POSTEXTUAL.length;
  let restante = indice;
  let letra = "";

  // Base 26 bijetiva: não existe "dígito zero", então cada volta desconta um
  // do quociente — é o que faz 26 virar "AA" e não "BA".
  do {
    letra = ALFABETO_POSTEXTUAL[restante % base] + letra;
    restante = Math.floor(restante / base) - 1;
  } while (restante >= 0);

  return letra;
}
