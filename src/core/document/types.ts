// Formato canônico do documento AURA — ver docs/aura-decisoes-e-pendencias.md
// §1.4. É a fonte de verdade que o editor, a persistência e os exportadores
// compartilham; nenhum deles guarda sua própria cópia da estrutura.
//
// Invariantes (ver CLAUDE.md, "Formato e dados"):
// - a numeração de seção é DERIVADA de `ordem` e `nivel`, nunca um campo;
// - referências são objetos CSL-JSON, nunca texto já formatado numa norma;
// - elementos pré-textuais são campos de `Metadados`, não nós do editor.

export type NivelSecao = 1 | 2 | 3;

// Nó de conteúdo do editor. A lista fechada de tipos — parágrafo, citação
// longa, lista, figura, tabela, fórmula, nota de rodapé, e as marcas inline —
// chega no passo 1.1.2 (docs/schema-tiptap.md). Por ora `NoConteudo` só
// existe para `Secao["content"]` não precisar de `any`.
export interface NoConteudo {
  type: string;
}

export interface Secao {
  id: string;
  ordem: number;
  nivel: NivelSecao;
  titulo: string;
  content: NoConteudo[];
}

// Apêndice ou anexo (NBR 14724): mesma forma de conteúdo de uma seção, mas
// identificado por letra, não por nível/ordem numérica.
export interface ElementoPosTextual {
  id: string;
  letra: string;
  titulo: string;
  content: NoConteudo[];
}

// --- Referências: CSL-JSON --------------------------------------------------
// Campos separados (autor, título, ano...), nunca uma string já formatada.
// Um formatador por norma (NBR 6023 na v1) monta o texto na hora de exibir
// ou exportar. Nomes de campo seguem o padrão CSL-JSON, não traduzidos.

export interface CSLName {
  family?: string;
  given?: string;
  // Nome que não se divide em sobrenome/nome próprio — ex.: uma instituição
  // como autora ("ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS").
  literal?: string;
}

export interface CSLDate {
  "date-parts"?: Array<[number, number?, number?]>;
  raw?: string;
}

// Subconjunto de tipos CSL cobertos na v1 (livro, artigo de periódico,
// página web, capítulo, tese/dissertação). Ampliar só quando a NBR 6023
// exigir um tipo que nenhum destes cobre.
export type CSLType = "book" | "article-journal" | "webpage" | "chapter" | "thesis";

export interface Referencia {
  id: string;
  type: CSLType;
  title: string;
  author?: CSLName[];
  issued?: CSLDate;
  publisher?: string;
  "publisher-place"?: string;
  // Nome do periódico, quando type === "article-journal".
  "container-title"?: string;
  volume?: string;
  issue?: string;
  page?: string;
  URL?: string;
  accessed?: CSLDate;
}

// --- Metadados ---------------------------------------------------------------
// Elementos pré-textuais (capa, folha de rosto, resumo/abstract) vêm daqui,
// nunca de nós do editor — é o que os mantém fora do corpo editável e do
// sumário (NBR 6027).

export interface Metadados {
  // A v1 atende só TCC em ABNT; os campos existem para não ter que migrar o
  // formato quando outra norma ou tipo de trabalho entrar.
  tipo: "tcc";
  norma: "abnt";

  titulo: string;
  subtitulo?: string;
  autores: string[];
  instituicao: string;
  curso: string;
  orientador: string;
  local: string;
  ano: number;
  naturezaTrabalho: string;

  resumo: string;
  palavrasChave: string[];
  abstract: string;
  keywords: string[];
}

export interface Documento {
  id: string;
  metadados: Metadados;
  sections: Secao[];
  references: Referencia[];
  apendices: ElementoPosTextual[];
  anexos: ElementoPosTextual[];
}
