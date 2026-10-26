import { describe, expect, it } from "vitest";

import type { NoHtmlColado } from "../../editor/paste";
import { CLASSE } from "./estilos";
import { lerDocx } from "./lerDocx";

// A árvore que `src/lib/lerDocx.ts` monta do HTML do mammoth, escrita à mão:
// o Vitest roda sem DOM. A ida e volta com um `.docx` de verdade, pelo
// mammoth e pelo `DOMParser`, é do e2e (`e2e/importar-docx.spec.ts`).

function t(texto: string): NoHtmlColado {
  return { tipo: "texto", texto };
}

function el(
  tag: string,
  filhos: (NoHtmlColado | string)[],
  extra: { classe?: string; atributos?: Record<string, string> } = {},
): NoHtmlColado {
  return {
    tipo: "elemento",
    tag,
    ...extra,
    filhos: filhos.map((filho) => (typeof filho === "string" ? t(filho) : filho)),
  };
}

const p = (...filhos: (NoHtmlColado | string)[]) => el("p", filhos);
const h = (nivel: number, texto: string) => el(`h${nivel}`, [texto]);
const strong = (texto: string) => el("strong", [texto]);
const em = (texto: string) => el("em", [texto]);
const tituloPre = (texto: string) => el("p", [texto], { classe: CLASSE.tituloPre });
const tituloPos = (texto: string) => el("p", [texto], { classe: CLASSE.tituloPos });

function mensagens(lido: ReturnType<typeof lerDocx>): string {
  return lido.avisos.map((aviso) => aviso.mensagem).join("\n");
}

describe("lerDocx — títulos pelos estilos", () => {
  it("Título 1 a 3 viram seções do nível, com a numeração digitada fora", () => {
    const lido = lerDocx([
      h(1, "1 Introdução"),
      p("Texto da introdução."),
      h(2, "1.1 Objetivos"),
      p("Os objetivos."),
      h(3, "1.1.1 Específicos"),
      h(1, "2. Método"),
    ]);
    expect(lido.secoes.map(({ nivel, titulo }) => [nivel, titulo])).toEqual([
      [1, "Introdução"],
      [2, "Objetivos"],
      [3, "Específicos"],
      [1, "Método"],
    ]);
    expect(lido.secoes[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Texto da introdução." }] },
    ]);
    expect(lido.secoes[2].content).toEqual([]);
    expect(mensagens(lido)).toContain("A numeração digitada em 4 títulos saiu");
  });

  it("número que é parte do título fica", () => {
    const lido = lerDocx([h(1, "2020 em perspectiva")]);
    expect(lido.secoes[0].titulo).toBe("2020 em perspectiva");
  });

  it("Título 4 em diante entra como nível 3, com aviso", () => {
    const lido = lerDocx([h(1, "Um"), h(4, "Fundo")]);
    expect(lido.secoes[1]).toMatchObject({ nivel: 3, titulo: "Fundo" });
    expect(mensagens(lido)).toContain("Título 4 e entrou como seção de nível 3");
  });

  it("parágrafo curto todo em negrito é possível título, nunca seção", () => {
    const lido = lerDocx([h(1, "Introdução"), p(strong("Contexto histórico")), p("Texto.")]);
    expect(lido.secoes).toHaveLength(1);
    expect(lido.secoes[0].content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Contexto histórico", marks: [{ type: "negrito" }] }],
    });
    expect(mensagens(lido)).toContain(
      "Possível título em “Introdução”: “Contexto histórico” está em negrito",
    );
  });

  it("frase em negrito com ponto final não é possível título", () => {
    const lido = lerDocx([h(1, "Introdução"), p(strong("Uma frase inteira em negrito."))]);
    expect(mensagens(lido)).not.toContain("Possível título");
  });
});

describe("lerDocx — texto pela regra da colagem", () => {
  it("negrito e itálico ficam; espaços e tabulações do Word viram um espaço", () => {
    const lido = lerDocx([
      h(1, "Introdução"),
      p("\tUm  ", em("termo"), " e um ", strong("destaque"), ".  "),
    ]);
    expect(lido.secoes[0].content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Um " },
          { type: "text", text: "termo", marks: [{ type: "italico" }] },
          { type: "text", text: " e um " },
          { type: "text", text: "destaque", marks: [{ type: "negrito" }] },
          { type: "text", text: "." },
        ],
      },
    ]);
  });

  it("a quebra de linha manual separa parágrafos, como na colagem", () => {
    const lido = lerDocx([h(1, "A"), p("primeira", el("br", []), "segunda")]);
    expect(lido.secoes[0].content).toHaveLength(2);
  });

  it("o estilo de citação vira citação longa, sem referência ligada", () => {
    const lido = lerDocx([
      h(1, "A"),
      el("p", ["Trecho citado de mais de três linhas."], { classe: CLASSE.citacaoLonga }),
    ]);
    expect(lido.secoes[0].content).toEqual([
      {
        type: "citacao_longa",
        refId: null,
        pagina: "",
        content: [{ type: "text", text: "Trecho citado de mais de três linhas." }],
      },
    ]);
  });

  it("lista vira um parágrafo por item, com aviso", () => {
    const lido = lerDocx([h(1, "A"), el("ul", [el("li", ["um"]), el("li", ["dois"])])]);
    expect(lido.secoes[0].content).toHaveLength(2);
    expect(mensagens(lido)).toContain("As listas (2 itens) viraram um parágrafo por item");
  });

  it("citação digitada entra como texto, e o aviso conta quantas", () => {
    const lido = lerDocx([
      h(1, "A"),
      p("Como diz o autor (Freire, 1987, p. 35), e outros (SILVA; SOUZA, 2020)."),
    ]);
    expect(mensagens(lido)).toContain("2 citações digitadas");
  });
});

describe("lerDocx — antes do texto", () => {
  const preTextuais = [
    p(strong("UNIVERSIDADE FEDERAL")),
    p("FULANA DE TAL"),
    p("Vitória"),
    tituloPre("RESUMO"),
    p("Resumo do trabalho, em um parágrafo só."),
    p(strong("Palavras-chave: "), "formatação; normas técnicas; LaTeX."),
    tituloPre("ABSTRACT"),
    p("Abstract of the work."),
    p(strong("Keywords: "), "formatting, standards."),
    tituloPre("SUMÁRIO"),
    t("1 Introdução 5"),
    p("1 INTRODUÇÃO ........ 5"),
    h(1, "1 Introdução"),
    p("Texto."),
  ];

  it("resumo, abstract e os termos vão para os dados do trabalho", () => {
    const lido = lerDocx(preTextuais);
    expect(lido.metadados).toEqual({
      resumo: "Resumo do trabalho, em um parágrafo só.",
      palavrasChave: ["formatação", "normas técnicas", "LaTeX"],
      abstract: "Abstract of the work.",
      keywords: ["formatting", "standards"],
    });
  });

  it("capa e sumário não entram, e o aviso diz o que ficou de fora", () => {
    const lido = lerDocx(preTextuais);
    expect(lido.secoes.map((secao) => secao.titulo)).toEqual(["Introdução"]);
    expect(lido.secoes[0].content).toHaveLength(1);
    const texto = mensagens(lido);
    expect(texto).toContain("3 parágrafos antes do primeiro título");
    expect(texto).toContain("Não foi importado: SUMÁRIO");
  });

  it("o título escrito à mão, sem estilo, também é reconhecido", () => {
    const lido = lerDocx([p(strong("RESUMO")), p("Texto do resumo."), h(1, "Introdução")]);
    expect(lido.metadados).toEqual({ resumo: "Texto do resumo." });
  });

  it("resumo em mais de um parágrafo entra junto, com aviso", () => {
    const lido = lerDocx([tituloPre("RESUMO"), p("Um."), p("Dois."), h(1, "Introdução")]);
    expect(lido.metadados?.resumo).toBe("Um. Dois.");
    expect(mensagens(lido)).toContain("O resumo tinha 2 parágrafos");
  });

  it("depois do texto começar, uma seção chamada Resumo é uma seção", () => {
    const lido = lerDocx([h(1, "Introdução"), h(1, "Resumo"), p("Texto.")]);
    expect(lido.secoes.map((secao) => secao.titulo)).toEqual(["Introdução", "Resumo"]);
    expect(lido.metadados).toBeNull();
  });
});

describe("lerDocx — depois do texto", () => {
  it("referências viram aviso; apêndices e anexos entram com o título", () => {
    const lido = lerDocx([
      h(1, "Introdução"),
      p("Texto."),
      tituloPos("REFERÊNCIAS"),
      p("FREIRE, Paulo. ", strong("Pedagogia do oprimido"), ". Rio de Janeiro: Paz e Terra, 1987."),
      p("SILVA, Ana. Outro livro. 2020."),
      tituloPos("APÊNDICE A — QUESTIONÁRIO"),
      p("Perguntas aplicadas."),
      h(1, "Anexo B – Lei de diretrizes"),
      p("Texto da lei."),
    ]);
    expect(lido.secoes.map((secao) => secao.titulo)).toEqual(["Introdução"]);
    expect(lido.apendices).toMatchObject([
      {
        titulo: "QUESTIONÁRIO",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Perguntas aplicadas." }] }],
      },
    ]);
    expect(lido.anexos).toMatchObject([{ titulo: "Lei de diretrizes" }]);
    expect(mensagens(lido)).toContain("A lista de referências (2 parágrafos) não foi convertida");
  });

  it("subtítulo dentro de apêndice vira parágrafo em negrito", () => {
    const lido = lerDocx([h(1, "A"), h(1, "APÊNDICE A - Roteiro"), h(2, "Parte 1")]);
    expect(lido.apendices[0].content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Parte 1", marks: [{ type: "negrito" }] }],
      },
    ]);
    expect(mensagens(lido)).toContain("apêndice e anexo não têm seções no AURA");
  });

  it("título desconhecido depois das referências não entra", () => {
    const lido = lerDocx([h(1, "A"), h(1, "Referências"), p("X."), h(1, "Glossário"), p("Y.")]);
    expect(lido.secoes.map((secao) => secao.titulo)).toEqual(["A"]);
    expect(mensagens(lido)).toContain("“Glossário”, depois das referências, não tem lugar no AURA");
  });
});

describe("lerDocx — documento sem estilos de título", () => {
  it("o texto entra numa seção só, sem título, e o aviso explica", () => {
    const lido = lerDocx([
      p("UNIVERSIDADE"),
      p(strong("RESUMO")),
      p("O resumo."),
      p("Palavras-chave: um; dois."),
      p(strong("SUMÁRIO")),
      p(strong("1 INTRODUÇÃO")),
      p("Texto do trabalho."),
      p(strong("REFERÊNCIAS")),
      p("FREIRE, Paulo. Livro. 1987."),
    ]);
    expect(lido.metadados).toEqual({ resumo: "O resumo.", palavrasChave: ["um", "dois"] });
    expect(lido.secoes).toHaveLength(1);
    expect(lido.secoes[0].titulo).toBe("");
    expect(
      lido.secoes[0].content.map((bloco) =>
        bloco.type === "paragraph"
          ? bloco.content?.map((no) => ("text" in no ? no.text : "")).join("")
          : "",
      ),
    ).toEqual(["UNIVERSIDADE", "SUMÁRIO", "1 INTRODUÇÃO", "Texto do trabalho."]);
    const texto = mensagens(lido);
    expect(texto).toContain("não usa os estilos de Título do Word");
    expect(texto).toContain("Possível título: “1 INTRODUÇÃO”");
    expect(texto).toContain("A lista de referências (1 parágrafo)");
  });
});

describe("lerDocx — o que ainda não vem", () => {
  it("a chamada da nota sai do texto, e a lista de notas não vira parágrafo", () => {
    const chamada = el("sup", [el("a", ["[1]"], { atributos: { href: "#footnote-1" } })]);
    const lido = lerDocx([
      h(1, "A"),
      p("Isso importa", chamada, "."),
      el("ol", [
        el(
          "li",
          [p("Nota de teste. ", el("a", ["↑"], { atributos: { href: "#footnote-ref-1" } }))],
          {
            atributos: { id: "footnote-1" },
          },
        ),
      ]),
    ]);
    expect(lido.secoes[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Isso importa." }] },
    ]);
    expect(mensagens(lido)).toContain("A nota de rodapé ainda não vem do .docx");
  });

  it("equação do Word vira um aviso só; estilo desconhecido não vira nenhum", () => {
    const lido = lerDocx([h(1, "A")], {
      mensagens: [
        "Unrecognised paragraph style: 'Corpo' (Style ID: Corpo)",
        "An unrecognised element was ignored: {http://schemas.openxmlformats.org/officeDocument/2006/math}oMath",
        "An unrecognised element was ignored: {http://schemas.openxmlformats.org/officeDocument/2006/math}oMathPara",
        "An unrecognised element was ignored: w:fldSimple",
      ],
    });
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "O arquivo tem equações do Word, e o AURA não as lê: elas não vieram. Recrie cada uma com o botão de fórmula.",
    ]);
  });

  it("outro elemento que o mammoth não leu vira o aviso genérico", () => {
    const lido = lerDocx([h(1, "A")], {
      mensagens: ["An unrecognised element was ignored: w:pict"],
    });
    expect(mensagens(lido)).toContain("caixas de texto, desenhos ou objetos incorporados");
  });
});
