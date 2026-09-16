import type { JSONContent } from "@tiptap/core";

import type {
  CelulaTabela,
  LinhaTabela,
  Marca,
  NivelSecao,
  NoConteudo,
  NoTexto,
  Secao,
  TipoMarca,
} from "./types";

const TIPOS_MARCA: readonly TipoMarca[] = ["negrito", "italico"];

function ehTipoMarca(valor: string): valor is TipoMarca {
  return (TIPOS_MARCA as readonly string[]).includes(valor);
}

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
  if (no.type === "citacao_longa") {
    const conteudo = (no.content ?? []).map(paraNoTexto);
    const { refId, pagina } = (no.attrs ?? {}) as { refId?: string | null; pagina?: string };
    return {
      type: "citacao_longa",
      refId: refId ?? null,
      pagina: pagina ?? "",
      ...(conteudo.length > 0 ? { content: conteudo } : {}),
    };
  }
  if (no.type === "figura") {
    const { id, legenda, fonte, imagem } = (no.attrs ?? {}) as {
      id?: string | null;
      legenda?: string;
      fonte?: string;
      imagem?: string | null;
    };
    // Mesma exigência que `secao` já faz: sem id não há como numerar a
    // figura nem apontar pra ela na lista de ilustrações (3.6.4). Quem cria
    // gera o id (`novaFigura()`), nunca o schema.
    if (!id) {
      throw new Error("Figura sem id — todo nó figura precisa de id ao ser criado");
    }
    return {
      type: "figura",
      id,
      legenda: legenda ?? "",
      fonte: fonte ?? "",
      imagem: imagem ?? null,
    };
  }
  if (no.type === "tabela") {
    const { id, legenda, fonte } = (no.attrs ?? {}) as {
      id?: string | null;
      legenda?: string;
      fonte?: string;
    };
    if (!id) {
      throw new Error("Tabela sem id — todo nó tabela precisa de id ao ser criado");
    }
    return {
      type: "tabela",
      id,
      legenda: legenda ?? "",
      fonte: fonte ?? "",
      linhas: (no.content ?? []).map(paraLinhaTabela),
    };
  }
  throw new Error(`Nó de conteúdo ainda não suportado: "${no.type}"`);
}

// `linha_tabela`/`celula_tabela` (docs/schema-tiptap.md §4.7) não são membros
// de `NoConteudo`: existem só dentro de uma tabela, então viram campos
// aninhados de `NoTabela` em vez de blocos que uma seção poderia conter.
function paraLinhaTabela(no: JSONContent): LinhaTabela {
  if (no.type !== "linha_tabela") {
    throw new Error(`Nó inesperado dentro de tabela: "${no.type}" (esperava "linha_tabela")`);
  }
  return { celulas: (no.content ?? []).map(paraCelulaTabela) };
}

function paraCelulaTabela(no: JSONContent): CelulaTabela {
  if (no.type !== "celula_tabela") {
    throw new Error(`Nó inesperado dentro de linha: "${no.type}" (esperava "celula_tabela")`);
  }
  const { cabecalho } = (no.attrs ?? {}) as { cabecalho?: boolean };
  const conteudo = (no.content ?? []).map(paraNoTexto);
  return {
    cabecalho: cabecalho === true,
    ...(conteudo.length > 0 ? { content: conteudo } : {}),
  };
}

function paraNoTexto(no: JSONContent): NoTexto {
  if (no.type !== "text" || typeof no.text !== "string") {
    throw new Error(`Nó inline ainda não suportado dentro de parágrafo: "${no.type}"`);
  }
  const marks = paraMarcas(no.marks);
  return marks.length > 0
    ? { type: "text", text: no.text, marks }
    : { type: "text", text: no.text };
}

function paraMarcas(marks: JSONContent["marks"]): Marca[] {
  return (marks ?? []).map((marca) => {
    if (!ehTipoMarca(marca.type)) {
      throw new Error(`Marca ainda não suportada: "${marca.type}"`);
    }
    return { type: marca.type };
  });
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

// Texto+marca compartilhado por todo `NoConteudo` que carrega inline
// diretamente (`paragrafo`, `citacao_longa`) — extraído aqui pra
// `deNoConteudo` não repetir o mesmo mapeamento de marca por tipo de bloco.
function deConteudoInline(content: NoTexto[] | undefined): JSONContent[] | undefined {
  if (!content || content.length === 0) return undefined;
  return content.map((texto) => ({
    type: "text",
    text: texto.text,
    ...(texto.marks && texto.marks.length > 0
      ? { marks: texto.marks.map((marca) => ({ type: marca.type })) }
      : {}),
  }));
}

// Exportada (passo 3.6.3) para a toolbar inserir uma figura/tabela nova sem
// escrever um segundo literal com a forma do nó: `novaFigura()` produz o nó
// canônico, esta função o converte pro JSON do TipTap, e é a MESMA conversão
// que o round-trip usa — uma divergência entre as duas seria impossível.
export function deNoConteudo(no: NoConteudo): JSONContent {
  if (no.type === "figura") {
    // Atômico — `content` nenhum, nem vazio: o nó do editor é `atom: true`
    // (src/core/editor/nodes/figure.ts) e tudo o que ele carrega é atributo.
    return {
      type: "figura",
      attrs: { id: no.id, legenda: no.legenda, fonte: no.fonte, imagem: no.imagem },
    };
  }

  if (no.type === "tabela") {
    return {
      type: "tabela",
      attrs: { id: no.id, legenda: no.legenda, fonte: no.fonte },
      content: no.linhas.map(deLinhaTabela),
    };
  }

  const conteudo = deConteudoInline(no.content);

  if (no.type === "citacao_longa") {
    return {
      type: "citacao_longa",
      attrs: { refId: no.refId, pagina: no.pagina },
      ...(conteudo ? { content: conteudo } : {}),
    };
  }

  return conteudo ? { type: "paragraph", content: conteudo } : { type: "paragraph" };
}

function deLinhaTabela(linha: LinhaTabela): JSONContent {
  return { type: "linha_tabela", content: linha.celulas.map(deCelulaTabela) };
}

function deCelulaTabela(celula: CelulaTabela): JSONContent {
  const conteudo = deConteudoInline(celula.content);
  return {
    type: "celula_tabela",
    attrs: { cabecalho: celula.cabecalho },
    ...(conteudo ? { content: conteudo } : {}),
  };
}
