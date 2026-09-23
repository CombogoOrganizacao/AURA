import type { Documento } from "../../document/types";

// Um TCC que passa em todas as regras da conferência — base dos testes da
// Fase 5. Cada teste de regra (5.2.2) parte daqui e quebra UMA coisa, e o
// teste do motor (`compliance.test.ts`) exige que este documento, congelado,
// dê lista de achados vazia com o registro inteiro. Uma regra nova que acuse
// algo aqui está errada, ou este documento precisa de mais um campo, e o
// motivo tem de estar no próprio teste.
//
// Não é modelo de texto acadêmico: o resumo é uma frase repetida até dar a
// extensão que a NBR 6028 §4.1.8 a) recomenda, só para ter a contagem certa.

const FRASE_DO_RESUMO =
  "Este trabalho examina a aplicação das normas de apresentação em trabalhos acadêmicos de graduação.";
const FRASE_DO_ABSTRACT =
  "This work examines how presentation standards apply to undergraduate academic papers in practice.";

// 14 palavras por frase × 12 = 168 palavras, dentro de 150 a 500.
const RESUMO = Array.from({ length: 12 }, () => FRASE_DO_RESUMO).join(" ");
const ABSTRACT = Array.from({ length: 12 }, () => FRASE_DO_ABSTRACT).join(" ");

export function documentoConforme(): Documento {
  return {
    id: "doc-conforme",
    metadados: {
      tipo: "tcc",
      norma: "abnt",
      titulo: "A formatação de trabalhos acadêmicos",
      subtitulo: "um estudo de caso",
      autores: ["Maria da Silva"],
      instituicao: "Universidade Católica de Pernambuco",
      curso: "Ciência da Computação",
      orientador: "João Souza",
      local: "Recife",
      ano: 2026,
      naturezaTrabalho:
        "Trabalho de Conclusão de Curso apresentado ao curso de Ciência da Computação da Universidade Católica de Pernambuco como requisito parcial para obtenção do título de bacharel.",
      resumo: RESUMO,
      palavrasChave: ["formatação", "normalização", "trabalho acadêmico"],
      abstract: ABSTRACT,
      keywords: ["formatting", "standardization", "academic paper"],
      abreviaturas: [
        { id: "ab1", sigla: "ABNT", significado: "Associação Brasileira de Normas Técnicas" },
      ],
      bancaExaminadora: [
        {
          id: "b1",
          nome: "João Souza",
          titulacao: "Doutor em Ciência da Computação",
          instituicao: "Universidade Católica de Pernambuco",
        },
        {
          id: "b2",
          nome: "Ana Lima",
          titulacao: "Doutora em Educação",
          instituicao: "Universidade Federal de Pernambuco",
        },
      ],
    },
    sections: [
      {
        id: "s-intro",
        ordem: 0,
        nivel: 1,
        titulo: "Introdução",
        content: [
          {
            type: "paragraph",
            content: [
              // Sigla na primeira menção: nome completo e sigla entre
              // parênteses (NBR 14724:2024 §5.6).
              {
                type: "text",
                text: "A Associação Brasileira de Normas Técnicas (ABNT) orienta a apresentação, e ",
              },
              {
                type: "text",
                text: "a educação é prática da liberdade",
                marks: [
                  {
                    type: "citacao",
                    attrs: { refId: "freire", modo: "indireta", pagina: null, apud: null },
                  },
                ],
              },
              { type: "text", text: ". Segundo o autor, " },
              {
                type: "text",
                text: "ensinar exige risco",
                marks: [
                  {
                    type: "citacao",
                    attrs: { refId: "freire", modo: "direta_curta", pagina: "35", apud: null },
                  },
                ],
              },
              { type: "text", text: ". A Figura 1 e a Tabela 1 resumem o processo." },
            ],
          },
          {
            type: "figura",
            id: "f1",
            legenda: "Fluxo de formatação",
            fonte: "Elaborada pela autora (2026).",
            imagem: null,
          },
          {
            type: "tabela",
            id: "t1",
            legenda: "Elementos obrigatórios",
            fonte: "Elaborada pela autora (2026).",
            linhas: [
              { celulas: [{ cabecalho: true, content: [{ type: "text", text: "Elemento" }] }] },
              { celulas: [{ cabecalho: false, content: [{ type: "text", text: "Capa" }] }] },
            ],
          },
          {
            type: "citacao_longa",
            refId: "freire",
            pagina: "68",
            content: [
              {
                type: "text",
                text: "Trecho transcrito com mais de três linhas, ligado à referência consultada.",
              },
            ],
          },
        ],
      },
      {
        id: "s-conclusao",
        ordem: 1,
        nivel: 1,
        titulo: "Conclusão",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "A ABNT continua a referência do trabalho." }],
          },
        ],
      },
    ],
    references: [
      {
        id: "freire",
        type: "book",
        author: [{ family: "Freire", given: "Paulo" }],
        title: "Pedagogia do oprimido",
        publisher: "Paz e Terra",
        "publisher-place": "Rio de Janeiro",
        issued: { "date-parts": [[1987]] },
      },
    ],
    apendices: [{ id: "ap1", titulo: "Questionário aplicado", content: [] }],
    anexos: [],
  };
}

// Congela em profundidade: um teste que passa o documento assim prova que a
// conferência só lê. Uma regra que escrevesse no documento lançaria.
export function congelado<T>(valor: T): T {
  if (typeof valor === "object" && valor !== null) {
    for (const filho of Object.values(valor)) congelado(filho);
    Object.freeze(valor);
  }
  return valor;
}
