import { describe, expect, it } from "vitest";

import { novoDocumento } from "../document/factory";
import type { AtributosCitacao, Documento, NoTexto } from "../document/types";
import { citacoesOrfas, listarCitacoes } from "./citacoes";
import type { ReferenciaLivro } from "./types";

const FREIRE: ReferenciaLivro = {
  id: "ref-freire",
  type: "book",
  author: [{ family: "Freire", given: "Paulo" }],
  title: "Pedagogia do oprimido",
  issued: { "date-parts": [[1987]] },
};

const BAUMAN: ReferenciaLivro = {
  id: "ref-bauman",
  type: "book",
  author: [{ family: "Bauman", given: "Zygmunt" }],
  title: "Globalização",
  issued: { "date-parts": [[1999]] },
};

function citando(refId: string, extra: Partial<AtributosCitacao> = {}) {
  return {
    type: "citacao" as const,
    attrs: { refId, modo: "indireta" as const, pagina: null, apud: null, ...extra },
  };
}

function documentoCom(texto: NoTexto[], references = [FREIRE, BAUMAN]): Documento {
  return {
    ...novoDocumento(),
    references,
    sections: [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "Introdução",
        content: [{ type: "paragraph", content: texto }],
      },
    ],
  };
}

// O que o painel (4.5) faz ao excluir: tira a referência da lista. Nada mais.
function excluirReferencia(documento: Documento, id: string): Documento {
  return { ...documento, references: documento.references.filter((ref) => ref.id !== id) };
}

describe("excluir a referência deixa a citação órfã, sem apagar o texto (4.8)", () => {
  const documento = documentoCom([
    { type: "text", text: "Como lembra o autor, " },
    { type: "text", text: "a educação é um ato político", marks: [citando("ref-freire")] },
    { type: "text", text: ", e " },
    { type: "text", text: "o mundo se globaliza", marks: [citando("ref-bauman")] },
    { type: "text", text: "." },
  ]);

  it("com as referências presentes, nenhuma citação é órfã", () => {
    expect(listarCitacoes(documento)).toHaveLength(2);
    expect(citacoesOrfas(documento)).toEqual([]);
  });

  it("excluída a referência, a citação dela fica órfã — e só ela", () => {
    const depois = excluirReferencia(documento, "ref-freire");

    expect(citacoesOrfas(depois)).toEqual([
      expect.objectContaining({
        origem: "marca",
        refId: "ref-freire",
        texto: "a educação é um ato político",
        local: { tipo: "secao", id: "s1" },
      }),
    ]);
  });

  it("o texto do aluno fica exatamente como estava, marca e refId inclusive", () => {
    const depois = excluirReferencia(documento, "ref-freire");

    expect(depois.sections).toEqual(documento.sections);
  });

  it("devolver a referência (o 'Desfazer' do painel) reata a ligação sozinho", () => {
    const depois = excluirReferencia(documento, "ref-freire");
    const desfeito = { ...depois, references: [...depois.references, FREIRE] };

    expect(citacoesOrfas(desfeito)).toEqual([]);
  });
});

describe("listarCitacoes", () => {
  it("nós vizinhos com a mesma citação são uma citação só", () => {
    const documento = documentoCom([
      { type: "text", text: "a educação é ", marks: [citando("ref-freire")] },
      { type: "text", text: "sempre", marks: [{ type: "italico" }, citando("ref-freire")] },
      { type: "text", text: " um ato político", marks: [citando("ref-freire")] },
    ]);

    expect(listarCitacoes(documento)).toEqual([
      expect.objectContaining({ texto: "a educação é sempre um ato político" }),
    ]);
  });

  it("a mesma obra citada duas vezes, com texto no meio, são duas citações", () => {
    const documento = documentoCom([
      { type: "text", text: "primeira", marks: [citando("ref-freire")] },
      { type: "text", text: " e " },
      { type: "text", text: "segunda", marks: [citando("ref-freire")] },
    ]);

    expect(listarCitacoes(documento).map((c) => c.texto)).toEqual(["primeira", "segunda"]);
  });

  it("vizinhas com página diferente são citações diferentes", () => {
    const documento = documentoCom([
      { type: "text", text: "um", marks: [citando("ref-freire", { pagina: "10" })] },
      { type: "text", text: "dois", marks: [citando("ref-freire", { pagina: "11" })] },
    ]);

    expect(listarCitacoes(documento)).toHaveLength(2);
  });

  it("acha citação em citação longa, célula de tabela, apêndice e anexo", () => {
    const documento: Documento = {
      ...novoDocumento(),
      references: [],
      sections: [
        {
          id: "s1",
          ordem: 0,
          nivel: 1,
          titulo: "Um",
          content: [
            {
              type: "citacao_longa",
              refId: "ref-longa",
              pagina: "42",
              content: [{ type: "text", text: "Bloco." }],
            },
            // Sem refId: incompleta, não órfã — outra regra da Fase 5.
            {
              type: "citacao_longa",
              refId: null,
              pagina: "",
              content: [{ type: "text", text: "Solta." }],
            },
            {
              type: "tabela",
              id: "t1",
              legenda: "",
              fonte: "",
              linhas: [
                {
                  celulas: [
                    {
                      cabecalho: false,
                      content: [{ type: "text", text: "dado", marks: [citando("ref-tabela")] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      apendices: [
        {
          id: "A",
          titulo: "Questionário",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "ap", marks: [citando("ref-ap")] }],
            },
          ],
        },
      ],
      anexos: [
        {
          id: "A",
          titulo: "Lei",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "an", marks: [citando("ref-an")] }],
            },
          ],
        },
      ],
    };

    expect(listarCitacoes(documento).map((c) => [c.origem, c.refId, c.local.tipo])).toEqual([
      ["citacao_longa", "ref-longa", "secao"],
      ["marca", "ref-tabela", "secao"],
      ["marca", "ref-ap", "apendice"],
      ["marca", "ref-an", "anexo"],
    ]);
    // Sem referência nenhuma cadastrada, todas as quatro ligadas são órfãs.
    expect(citacoesOrfas(documento)).toHaveLength(4);
  });

  it("percorre as seções pela ordem, não pela posição no array", () => {
    const base = novoDocumento();
    const documento: Documento = {
      ...base,
      references: [],
      sections: [
        {
          id: "b",
          ordem: 1,
          nivel: 1,
          titulo: "B",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "2", marks: [citando("r2")] }] },
          ],
        },
        {
          id: "a",
          ordem: 0,
          nivel: 1,
          titulo: "A",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "1", marks: [citando("r1")] }] },
          ],
        },
      ],
    };

    expect(listarCitacoes(documento).map((c) => c.refId)).toEqual(["r1", "r2"]);
  });
});
