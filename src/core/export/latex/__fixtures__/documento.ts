import { novoDocumento } from "../../../document/factory";
import type { Documento, NoTexto } from "../../../document/types";
import type { ImagemArmazenada } from "../../../persistence/types";
import type { Referencia } from "../../../references/types";
import type { ImagensParaTex } from "../document";

// Documento de teste do `.tex` (passo 6.2.1): um de cada elemento que o
// exportador conhece, com os caracteres especiais no meio do texto do aluno.
// Serve aos testes de marcação (`document.test.ts`) e ao de compilação
// (`compila.test.ts`).

export const FREIRE: Referencia = {
  id: "freire",
  type: "book",
  author: [{ family: "Freire", given: "Paulo" }],
  title: "Pedagogia do oprimido",
  publisher: "Paz e Terra",
  "publisher-place": "Rio de Janeiro",
  issued: { "date-parts": [[1987]] },
};

const texto = (text: string, marks?: NoTexto["marks"]): NoTexto =>
  marks ? { type: "text", text, marks } : { type: "text", text };

const citacao = (modo: "direta_curta" | "indireta", pagina: string | null) => ({
  type: "citacao" as const,
  attrs: { refId: "freire", modo, pagina, apud: null },
});

export function documentoCompleto(): Documento {
  const documento = novoDocumento();
  Object.assign(documento.metadados, {
    titulo: "Formatação de trabalhos acadêmicos",
    subtitulo: "um estudo & 100% de teste",
    autores: ["Fulana de Tal"],
    instituicao: "Universidade Federal do Espírito Santo",
    curso: "Curso de Graduação em Letras",
    orientador: "Prof. Dr. Beltrano de Souza",
    local: "Vitória",
    ano: 2026,
    naturezaTrabalho:
      "Trabalho de Conclusão de Curso apresentado ao Curso de Letras como requisito parcial para obtenção do grau de Licenciada.",
    resumo: "Resumo do trabalho, em um parágrafo só, sobre a ABNT e o LaTeX.",
    palavrasChave: ["formatação", "normas técnicas", "LaTeX"],
    abstract: "Abstract of the work, in a single paragraph.",
    keywords: ["formatting", "technical standards"],
    dedicatoria: { ativo: true, texto: "A quem ensina." },
    agradecimentos: { ativo: true, texto: "Agradeço à banca." },
    epigrafe: { ativo: true, texto: "Ensinar exige risco." },
    abreviaturas: [{ sigla: "ABNT", significado: "Associação Brasileira de Normas Técnicas" }],
    bancaExaminadora: [
      { id: "m1", nome: "Beltrano de Souza", titulacao: "Doutor", instituicao: "UFES" },
    ],
  });
  documento.references = [FREIRE];
  documento.sections = [
    {
      id: "s-intro",
      ordem: 0,
      nivel: 1,
      titulo: "Introdução",
      content: [
        {
          type: "paragraph",
          content: [
            texto("A ABNT pede fonte 12 & espaço 1,5 (100% dos casos, custo R$ 0, item #1, x_1 {y} ~ ^ \\). Um "),
            texto("termo", [{ type: "italico" }]),
            texto(" e um "),
            texto("destaque", [{ type: "negrito" }]),
            texto(". Segundo o autor, "),
            texto("ensinar exige risco", [citacao("direta_curta", "35")]),
            texto(". "),
            texto("A educação é prática da liberdade", [citacao("indireta", null)]),
            texto(" e isso importa"),
            { type: "nota_rodape", texto: "Nota com 50% de teste." },
            texto("."),
          ],
        },
      ],
    },
    {
      id: "s-obj",
      ordem: 1,
      nivel: 2,
      titulo: "Objetivos & métodos",
      content: [
        {
          type: "citacao_longa",
          refId: "freire",
          pagina: "181",
          content: [
            texto(
              "Citação longa de teste, com mais de três linhas, para ver o recuo de quatro centímetros, a letra menor e o espaço simples do ambiente de citação longa.",
            ),
          ],
        },
        { type: "formula", texto: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
        { type: "formula", texto: "\\frac{1}{" },
      ],
    },
    {
      id: "s-dev",
      ordem: 2,
      nivel: 1,
      titulo: "Desenvolvimento",
      content: [
        { type: "figura", id: "f1", legenda: "Fluxo do processo", fonte: "Elaborado pela autora", imagem: "img1" },
        { type: "figura", id: "f2", legenda: "Figura sem imagem", fonte: "", imagem: null },
        {
          type: "tabela",
          id: "t1",
          legenda: "Resultados por grupo",
          fonte: "Dados da pesquisa",
          linhas: [
            { celulas: [{ cabecalho: true, content: [texto("Grupo")] }, { cabecalho: true, content: [texto("Total (%)")] }] },
            { celulas: [{ cabecalho: false, content: [texto("A")] }, { cabecalho: false, content: [texto("40%")] }] },
            { celulas: [{ cabecalho: false, content: [texto("B")] }, { cabecalho: false, content: [texto("60%")] }] },
          ],
        },
      ],
    },
  ];
  documento.apendices = [
    {
      id: "ap1",
      titulo: "Questionário",
      content: [{ type: "paragraph", content: [texto("Perguntas aplicadas.")] }],
    },
  ];
  documento.anexos = [
    {
      id: "an1",
      titulo: "Lei & decreto",
      content: [{ type: "formula", texto: "E = mc^2" }],
    },
  ];
  return documento;
}

export const IMAGENS: ImagensParaTex = new Map([["img1", { formato: "png", largura: 400, altura: 200 }]]);

// PNG de 1 × 1 pixel, para o teste de compilação ter um arquivo de verdade
// em `figuras/`. O tamanho na folha vem de `IMAGENS`, não do arquivo.
export const PNG_1X1 = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (caractere) => caractere.charCodeAt(0),
);

// As imagens como a persistência as entrega, com os bytes: o que o `.zip`
// (passo 6.2.3) recebe.
export function imagensDoZip(documentoId: string): Map<string, ImagemArmazenada> {
  return new Map([
    [
      "img1",
      { id: "img1", documentoId, formato: "png", largura: 400, altura: 200, bytes: PNG_1X1 },
    ],
  ]);
}
