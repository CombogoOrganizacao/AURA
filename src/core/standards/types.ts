// Forma de dado para a tabela de normas acadêmicas — porte de
// `legacy/js/engine/standards.js` (`AURA_STANDARDS`). Só a ABNT foi
// auditada contra a NBR (docs/auditoria-abnt.md, passo 3.1.1) e é a única
// exposta na interface da v1 (CLAUDE.md, "Escopo da v1"); as outras cinco
// ficam na tabela porque o motor de regras de Fase 5+
// (docs/aura-decisoes-e-pendencias.md, "camadas de regras") e um preset de
// instituição futuro esperam a mesma forma de dado pronta — não porque a v1
// as use ou as tenha conferido contra APA/IEEE/Vancouver/Chicago/MLA.
//
// Vários campos são opcionais porque o próprio legado é inconsistente entre
// normas: só ABNT/APA/IEEE têm `paginacao` e `titulos`; só ABNT/APA têm
// `citacaoLonga`. Preservado assim de propósito — inventar um valor para
// preencher o buraco seria dado não auditado com aparência de auditado,
// exatamente o que CLAUDE.md pede para evitar.

export type IdNorma = "abnt" | "apa" | "ieee" | "vancouver" | "chicago" | "mla";

export interface Margens {
  top: number;
  left: number;
  bottom: number;
  right: number;
  unidade: "cm";
}

export interface Fonte {
  familia: string;
  tamanho: number;
  tamanhoNotaRodape: number;
  tamanhoCitacao: number;
}

export type PosicaoPaginacao = "top-right" | "bottom-center";

export interface Paginacao {
  posicao: PosicaoPaginacao;
  // Ausente em normas que não distinguem pré-textual de textual na contagem
  // exibida (ex.: IEEE, que numera do início).
  contarDoTextual?: boolean;
  formato: "arabic";
}

// Um recurso de destaque por vez, combináveis (ex.: ABNT h1 é
// caixaAlta+negrito). Nenhuma norma exige uma combinação fixa — ver
// docs/auditoria-abnt.md, achado sobre `titulos` da ABNT: a NBR 6024 só pede
// gradação visível e consistência entre sumário e texto, não um esquema
// específico. A combinação aqui é a escolha do AURA para a ABNT, não uma
// citação literal da norma.
export interface EstiloTitulo {
  caixaAlta?: boolean;
  negrito?: boolean;
  italico?: boolean;
  centralizado?: boolean;
  alinhadoEsquerda?: boolean;
  numeraisRomanos?: boolean;
  letras?: boolean;
  tamanho: number;
}

export interface NiveisTitulo {
  h1?: EstiloTitulo;
  h2?: EstiloTitulo;
  h3?: EstiloTitulo;
}

export interface CitacaoLonga {
  // Um dos dois critérios de "citação longa" — nunca os dois (ABNT conta
  // linhas, APA conta palavras).
  minLinhas?: number;
  minPalavras?: number;
  recuo: number;
  espacamento: number;
  tamanhoFonte: number;
}

export type EstiloCitacao =
  | "AUTOR_DATA"
  | "COLCHETE_NUMERICO"
  | "SOBRESCRITO_NUMERICO"
  | "NOTA_RODAPE_NUMERADA"
  | "AUTOR_PAGINA";

export type EstiloReferencia =
  | "ALFABETICA_MAIUSCULA"
  | "RECUO_DESLOCADO_ALFABETICO"
  | "ORDEM_NUMERICA"
  | "ORDEM_NUMERICA_MEDICA"
  | "BIBLIOGRAFIA_ALFABETICA"
  | "OBRAS_CITADAS";

// Rótulos de exibição dos elementos da estrutura, na língua da própria
// norma (ABNT em português, as internacionais em inglês) — mesma decisão do
// legado. Não é dado normativo (a lista oficial de elementos pré-textuais da
// ABNT, por exemplo, tem 13 itens — ver docs/auditoria-abnt.md; isto aqui é
// só rótulo ilustrativo, não a fonte de verdade da estrutura).
export interface ElementosEstrutura {
  preTextuais: string[];
  textuais: string[];
  posTextuais: string[];
}

// Limites de extensão que a conferência (Fase 5) lê das regras resolvidas —
// passo 5.1.1. Ficam na norma, e não soltos na regra que os consome, porque
// são o que um edital ou preset de instituição sobrescreve: o legado tinha
// `maxAbstractWords` na camada de edital pelo mesmo motivo.
export interface LimitesExtensao {
  // Palavras do resumo, inclusive. Vale para o resumo na língua vernácula e
  // na estrangeira.
  resumoPalavras?: { min: number; max: number };
}

export interface Norma {
  id: IdNorma;
  nome: string;
  descricao: string;
  margens: Margens;
  fonte: Fonte;
  // Só IEEE usa (duas colunas).
  colunas?: number;
  espacoEntreColunas?: number;
  espacamentoLinhas: number;
  recuoParagrafo: number;
  alinhamento: "justify" | "left";
  paginacao?: Paginacao;
  titulos?: NiveisTitulo;
  citacaoLonga?: CitacaoLonga;
  estiloCitacao: EstiloCitacao;
  estiloReferencia: EstiloReferencia;
  elementos: ElementosEstrutura;
  // Só na ABNT por enquanto: nenhuma das outras cinco foi auditada.
  limites?: LimitesExtensao;
}
