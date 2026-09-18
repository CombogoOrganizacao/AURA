import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { cursorDepoisDoBloco, cursorNaUltimaLinha } from "./caret";
import { Figura } from "./nodes/figure";
import { Secao } from "./nodes/section";
import { CelulaTabela, LinhaTabela, Tabela } from "./nodes/table";

// Mesma técnica de reorder.test.ts: só `EditorState`, sem `EditorView` nem
// DOM — o que mantém este teste dentro de src/core.
const schema = getSchema([Document, Paragraph, Text, Secao, Figura, Tabela, LinhaTabela, CelulaTabela]);

function paragrafo(texto = "") {
  return schema.nodes.paragraph.create(null, texto ? schema.text(texto) : undefined);
}

function figura(id = "f1") {
  return schema.nodes.figura.create({ id, legenda: "", fonte: "", imagem: null });
}

function tabela(id = "t1") {
  const celula = schema.nodes.celula_tabela.create({ cabecalho: false }, paragrafo());
  return schema.nodes.tabela.create(
    { id, legenda: "", fonte: "" },
    schema.nodes.linha_tabela.create(null, celula),
  );
}

function secao(filhos: ReturnType<typeof paragrafo>[], id = "s1") {
  return schema.nodes.secao.create({ id, nivel: 1, titulo: "" }, filhos);
}

function estadoCom(...secoes: ReturnType<typeof secao>[]) {
  return EditorState.create({ schema, doc: schema.nodes.doc.create(null, secoes) });
}

// Lista os tipos dos filhos da seção mais profunda no fim do documento — é o
// que diz se um parágrafo foi criado, e onde.
function tiposDoFim(doc: ReturnType<typeof schema.nodeFromJSON>): string[] {
  let no = doc;
  while (no.lastChild?.type.name === "secao") no = no.lastChild;
  const tipos: string[] = [];
  no.forEach((filho) => tipos.push(filho.type.name));
  return tipos;
}

describe("cursorNaUltimaLinha (clique no vazio da folha)", () => {
  // O defeito relatado: inserida a tabela, não havia como escrever depois
  // dela — não existe posição de texto entre o fim da tabela e o fim da
  // seção.
  it("cria a linha que falta quando o documento termina em tabela", () => {
    const estado = estadoCom(secao([paragrafo("Introdução"), tabela()]));
    const tr = estado.tr;

    const pos = cursorNaUltimaLinha(tr);
    const depois = estado.apply(tr);

    expect(tiposDoFim(depois.doc)).toEqual(["paragraph", "tabela", "paragraph"]);
    // O cursor fica DENTRO do parágrafo novo, pronto para digitar.
    expect(depois.selection.empty).toBe(true);
    expect(depois.selection.from).toBe(pos);
    expect(depois.doc.resolve(pos).parent.type.name).toBe("paragraph");
  });

  it("faz o mesmo quando o documento termina em figura", () => {
    const estado = estadoCom(secao([figura()]));
    const tr = estado.tr;
    const depois = estado.apply(tr);

    cursorNaUltimaLinha(tr);
    expect(tiposDoFim(estado.apply(tr).doc)).toEqual(["figura", "paragraph"]);
    expect(depois.doc).toBeTruthy();
  });

  // Clicar embaixo de um texto leva o cursor para o fim dele — não empilha
  // parágrafo vazio a cada clique.
  it("não cria nada quando a última linha já é um parágrafo", () => {
    const estado = estadoCom(secao([paragrafo("Introdução"), paragrafo("Fim")]));
    const tr = estado.tr;

    cursorNaUltimaLinha(tr);
    const depois = estado.apply(tr);

    expect(tiposDoFim(depois.doc)).toEqual(["paragraph", "paragraph"]);
    expect(depois.doc.resolve(depois.selection.from).parent.textContent).toBe("Fim");
  });

  it("clicar duas vezes seguidas não empilha dois parágrafos", () => {
    const estado = estadoCom(secao([tabela()]));

    const primeiro = estado.apply((() => {
      const tr = estado.tr;
      cursorNaUltimaLinha(tr);
      return tr;
    })());

    const segundo = primeiro.apply((() => {
      const tr = primeiro.tr;
      cursorNaUltimaLinha(tr);
      return tr;
    })());

    expect(tiposDoFim(segundo.doc)).toEqual(["tabela", "paragraph"]);
  });

  // Subseção é um nó `secao` dentro de outro: o fim do corpo não é o fim do
  // último filho do `doc`, e sim o fim do último descendente.
  it("acha o fim do corpo dentro da última subseção, não no topo", () => {
    const subsecao = schema.nodes.secao.create({ id: "s2", nivel: 2, titulo: "" }, [tabela()]);
    const estado = estadoCom(secao([paragrafo("Texto"), subsecao]));
    const tr = estado.tr;

    cursorNaUltimaLinha(tr);
    const depois = estado.apply(tr);

    expect(tiposDoFim(depois.doc)).toEqual(["tabela", "paragraph"]);
    expect(depois.doc.resolve(depois.selection.from).parent.type.name).toBe("paragraph");
  });
});

describe("cursorDepoisDoBloco (inserir figura/tabela/fórmula pela barra)", () => {
  it("abre uma linha depois do bloco recém-inserido", () => {
    const estado = estadoCom(secao([paragrafo("Introdução"), tabela()]));
    // Fim da tabela: começo da seção (1) + parágrafo + tabela.
    const secaoNode = estado.doc.firstChild!;
    const fim = 1 + secaoNode.firstChild!.nodeSize + secaoNode.lastChild!.nodeSize;
    const tr = estado.tr;

    const pos = cursorDepoisDoBloco(tr, fim);
    const depois = estado.apply(tr);

    expect(tiposDoFim(depois.doc)).toEqual(["paragraph", "tabela", "paragraph"]);
    expect(depois.doc.resolve(pos).parent.type.name).toBe("paragraph");
  });

  it("reaproveita o parágrafo que já existe embaixo em vez de criar outro", () => {
    const estado = estadoCom(secao([tabela(), paragrafo("Depois")]));
    const fim = 1 + estado.doc.firstChild!.firstChild!.nodeSize;
    const tr = estado.tr;

    cursorDepoisDoBloco(tr, fim);
    const depois = estado.apply(tr);

    expect(tiposDoFim(depois.doc)).toEqual(["tabela", "paragraph"]);
    expect(depois.doc.resolve(depois.selection.from).parent.textContent).toBe("Depois");
  });
});
