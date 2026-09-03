import type { JSONContent } from "@tiptap/core";

import type { NivelSecao, NoConteudo, NoParagrafo, NoTexto, Secao } from "./types";

// Costura entre a árvore do editor (TipTap/ProseMirror, aninhada — uma
// subseção é um nó `secao` dentro do conteúdo da seção-mãe, ver
// docs/aura-decisoes-e-pendencias.md §1.5) e o formato canônico (`Secao[]`
// plano, hierarquia expressa só por `nivel`, ver src/core/document/types.ts).
// É a emenda que docs/aura-decisoes-e-pendencias.md §1.15 chama de "maior
// risco remanescente" — por isso a Fase 1 existe para provar o round-trip.
//
// Escopo: só `sections` (o corpo). Metadados nunca passam por aqui — são
// campos de formulário, não nós do editor (docs/schema-tiptap.md §1).
// Apêndices e anexos (`ElementoPosTextual`) usam a mesma forma de conteúdo,
// mas são identificados por letra, não por nível/ordem; ficam para quando a
// UI que os edita existir, não fazem parte deste passo.

// --- TipTap → canônico -------------------------------------------------------

// Achata a árvore aninhada de `secao` num array plano e ordenado, mantendo a
// hierarquia só em `nivel` — a mesma convenção que `validarDocumento()` já
// impõe sobre `Secao[]`. Uma subseção é um nó `secao` filho de outro `secao`;
// ao encontrá-la, ela vira o próximo item do array (nunca fica aninhada
// dentro de `content`), e qualquer conteúdo do pai que venha depois dela
// continua pertencendo ao pai — é o mesmo nó ProseMirror, só apareceu depois
// na ordem de leitura.
export function toDocumento(doc: JSONContent): Secao[] {
  const secoes: Secao[] = [];

  function processar(no: JSONContent): void {
    if (no.type !== "secao") {
      throw new Error(`Nó inesperado no topo do documento: "${no.type}" (esperava "secao")`);
    }

    const { id, nivel, titulo } = (no.attrs ?? {}) as {
      id?: string | null;
      nivel?: NivelSecao;
      titulo?: string;
    };
    if (!id) {
      throw new Error("Seção sem id — todo nó secao precisa de id ao ser criado");
    }

    const conteudo: NoConteudo[] = [];
    // Registrado já aqui, na posição correta do array (pré-ordem): o `push`
    // acontece antes de descer para os filhos, então uma subseção encontrada
    // no meio do laço abaixo entra logo em seguida, na ordem de leitura.
    secoes.push({
      id,
      ordem: secoes.length,
      nivel: nivel ?? 1,
      titulo: titulo ?? "",
      content: conteudo,
    });

    for (const filho of no.content ?? []) {
      if (filho.type === "secao") {
        processar(filho);
      } else {
        conteudo.push(paraNoConteudo(filho));
      }
    }
  }

  for (const no of doc.content ?? []) {
    processar(no);
  }

  return secoes;
}

function paraNoConteudo(no: JSONContent): NoConteudo {
  if (no.type === "paragraph") {
    const conteudo = (no.content ?? []).map(paraNoTexto);
    return conteudo.length > 0 ? { type: "paragraph", content: conteudo } : { type: "paragraph" };
  }
  throw new Error(`Nó de conteúdo ainda não suportado: "${no.type}"`);
}

function paraNoTexto(no: JSONContent): NoTexto {
  if (no.type !== "text" || typeof no.text !== "string") {
    throw new Error(`Nó inline ainda não suportado dentro de parágrafo: "${no.type}"`);
  }
  return { type: "text", text: no.text };
}

// --- Canônico → TipTap -------------------------------------------------------

// Reconstrói a árvore aninhada a partir do array plano, empilhando o último
// nó aberto de cada nível — o mesmo algoritmo de "lista com nível vira
// árvore" usado por qualquer sumário. `sections` precisa já respeitar as
// regras de `validarDocumento()` (primeira seção nível 1, sem pular nível);
// esta função não valida de novo, só monta.
export function fromDocumento(sections: Secao[]): JSONContent {
  const raiz: JSONContent = { type: "doc", content: [] };
  const pilha: { nivel: NivelSecao; no: JSONContent }[] = [];

  for (const secao of sections) {
    const no: JSONContent = {
      type: "secao",
      attrs: { id: secao.id, nivel: secao.nivel, titulo: secao.titulo },
      content: secao.content.map(deNoConteudo),
    };

    while (pilha.length > 0 && pilha[pilha.length - 1].nivel >= secao.nivel) {
      pilha.pop();
    }

    const pai = pilha.length > 0 ? pilha[pilha.length - 1].no : undefined;
    (pai ?? raiz).content!.push(no);

    pilha.push({ nivel: secao.nivel, no });
  }

  return raiz;
}

function deNoConteudo(no: NoConteudo): JSONContent {
  const paragrafo: NoParagrafo = no;
  if (!paragrafo.content || paragrafo.content.length === 0) {
    return { type: "paragraph" };
  }
  return {
    type: "paragraph",
    content: paragrafo.content.map((texto) => ({ type: "text", text: texto.text })),
  };
}
