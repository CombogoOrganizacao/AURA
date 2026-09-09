// Porte de `legacy/js/engine/standards.js` (`AURA_STANDARDS`). Ver
// docs/legado.md e docs/aura-decisoes-e-pendencias.md §2.1 para o
// recorte de porte.
//
// **Só `abnt` foi auditada** contra a NBR 14724/6023/10520
// (docs/auditoria-abnt.md, passo 3.1.1) e é a única exposta na interface da
// v1 (CLAUDE.md, "Escopo da v1"). `apa`/`ieee`/`vancouver`/`chicago`/`mla`
// são porte 1:1 dos valores do legado, sem conferência contra o manual de
// cada uma — ficam na tabela para o motor de regras de Fase 5+ ter a forma
// de dado pronta, não para uso em produção agora. Não usar nenhum valor
// delas para decisão de produto sem antes auditar, pela mesma razão que
// motivou o passo 3.1.1 para a ABNT.
//
// Dois valores da ABNT abaixo não têm citação de norma no comentário
// (`recuoParagrafo`, `alinhamento`) de propósito: a auditoria não achou o
// número/regra no texto da NBR 14724 — são convenção de mercado consolidada,
// mantida por decisão do usuário, não por exigência normativa. Ver
// docs/auditoria-abnt.md para o raciocínio completo de cada campo.

import type { IdNorma, Norma } from "./types";

const abnt: Norma = {
  id: "abnt",
  nome: "ABNT (NBR 14724 / 6023 / 10520)",
  descricao: "Normas brasileiras para trabalhos acadêmicos, teses, dissertações e artigos.",
  margens: { top: 3, left: 3, bottom: 2, right: 2, unidade: "cm" }, // NBR 14724:2011 §5.1/§5.2
  fonte: {
    familia: "Times New Roman / Arial", // convenção — a norma não fixa família, só tamanho
    tamanho: 12, // NBR 14724:2011 §5.1
    tamanhoNotaRodape: 10, // convenção — a norma só pede "tamanho menor e uniforme", sem número
    tamanhoCitacao: 10, // idem
  },
  espacamentoLinhas: 1.5, // NBR 14724:2011 §5.2
  recuoParagrafo: 1.25, // convenção de mercado — sem citação literal na NBR 14724 (docs/auditoria-abnt.md)
  alinhamento: "justify", // idem — sem citação literal na NBR 14724
  paginacao: { posicao: "top-right", contarDoTextual: true, formato: "arabic" }, // NBR 14724:2011 §5.3
  titulos: {
    // NBR 6024 exige gradação e consistência sumário↔texto, não esta
    // combinação específica — escolha de estilo do AURA (docs/auditoria-abnt.md).
    h1: { caixaAlta: true, negrito: true, tamanho: 12 },
    h2: { negrito: true, tamanho: 12 },
    h3: { italico: true, tamanho: 12 },
  },
  citacaoLonga: {
    // ">3 linhas" = a partir da 4ª. Recuo de 4cm era obrigatório até a NBR
    // 10520:2023, que o rebaixou a recomendação — mantido por decisão do
    // usuário (docs/auditoria-abnt.md).
    minLinhas: 4,
    recuo: 4,
    espacamento: 1,
    tamanhoFonte: 10,
  },
  estiloCitacao: "AUTOR_DATA", // NBR 10520 — um dos dois sistemas previstos, dominante no TCC brasileiro
  estiloReferencia: "ALFABETICA_MAIUSCULA", // NBR 6023:2018 — SOBRENOME, Nome + ordenação alfabética
  elementos: {
    preTextuais: ["Capa", "Folha de Rosto", "Resumo", "Abstract", "Sumário"],
    textuais: [
      "Introdução",
      "Desenvolvimento",
      "Metodologia",
      "Resultados",
      "Discussão",
      "Conclusão",
    ],
    posTextuais: ["Referências", "Apêndices", "Anexos"],
  },
};

const apa: Norma = {
  id: "apa",
  nome: "APA 7th Edition",
  descricao:
    "American Psychological Association — Padrão internacional para ciências sociais e humanas.",
  margens: { top: 2.54, left: 2.54, bottom: 2.54, right: 2.54, unidade: "cm" },
  fonte: {
    familia: "Times New Roman 12pt / Calibri 11pt",
    tamanho: 12,
    tamanhoNotaRodape: 10,
    tamanhoCitacao: 12,
  },
  espacamentoLinhas: 2.0,
  recuoParagrafo: 1.27, // 0.5 polegada
  alinhamento: "left",
  paginacao: { posicao: "top-right", contarDoTextual: false, formato: "arabic" },
  titulos: {
    h1: { negrito: true, centralizado: true, tamanho: 12 },
    h2: { negrito: true, alinhadoEsquerda: true, tamanho: 12 },
    h3: { negrito: true, italico: true, alinhadoEsquerda: true, tamanho: 12 },
  },
  citacaoLonga: { minPalavras: 40, recuo: 1.27, espacamento: 2.0, tamanhoFonte: 12 },
  estiloCitacao: "AUTOR_DATA",
  estiloReferencia: "RECUO_DESLOCADO_ALFABETICO",
  elementos: {
    preTextuais: ["Title Page", "Abstract"],
    textuais: ["Introduction", "Method", "Results", "Discussion"],
    posTextuais: ["References", "Appendices"],
  },
};

const ieee: Norma = {
  id: "ieee",
  nome: "IEEE Style",
  descricao:
    "Institute of Electrical and Electronics Engineers — Padrão de engenharia e ciência da computação.",
  margens: { top: 1.9, left: 1.43, bottom: 2.54, right: 1.43, unidade: "cm" },
  fonte: { familia: "Times New Roman", tamanho: 10, tamanhoNotaRodape: 8, tamanhoCitacao: 9 },
  colunas: 2,
  espacoEntreColunas: 0.63,
  espacamentoLinhas: 1.15,
  recuoParagrafo: 0.5,
  alinhamento: "justify",
  paginacao: { posicao: "bottom-center", formato: "arabic" },
  titulos: {
    h1: { caixaAlta: true, centralizado: true, numeraisRomanos: true, tamanho: 10 },
    h2: { italico: true, letras: true, tamanho: 10 },
  },
  estiloCitacao: "COLCHETE_NUMERICO",
  estiloReferencia: "ORDEM_NUMERICA",
  elementos: {
    preTextuais: ["Title & Authors", "Abstract", "Index Terms"],
    textuais: [
      "I. Introduction",
      "II. Architecture & Methods",
      "III. Experiments",
      "IV. Discussion",
    ],
    posTextuais: ["Acknowledgment", "References"],
  },
};

const vancouver: Norma = {
  id: "vancouver",
  nome: "Vancouver (ICMJE)",
  descricao:
    "International Committee of Medical Journal Editors — Padrão para medicina e ciências da saúde.",
  margens: { top: 2.5, left: 2.5, bottom: 2.5, right: 2.5, unidade: "cm" },
  fonte: {
    familia: "Arial / Times New Roman",
    tamanho: 12,
    tamanhoNotaRodape: 10,
    tamanhoCitacao: 10,
  },
  espacamentoLinhas: 1.5,
  recuoParagrafo: 1.0,
  alinhamento: "justify",
  estiloCitacao: "SOBRESCRITO_NUMERICO",
  estiloReferencia: "ORDEM_NUMERICA_MEDICA",
  elementos: {
    preTextuais: ["Title Page", "Structured Abstract (Objectives, Methods, Results, Conclusion)"],
    textuais: ["Introduction", "Methods", "Results", "Discussion"],
    posTextuais: ["Ethical Approval", "References"],
  },
};

const chicago: Norma = {
  id: "chicago",
  nome: "Chicago 17th (Notes & Bibliography)",
  descricao: "Universidade de Chicago — Usado em história, artes, literatura e ciências sociais.",
  margens: { top: 2.54, left: 2.54, bottom: 2.54, right: 2.54, unidade: "cm" },
  fonte: { familia: "Times New Roman", tamanho: 12, tamanhoNotaRodape: 10, tamanhoCitacao: 10 },
  espacamentoLinhas: 2.0,
  recuoParagrafo: 1.27,
  alinhamento: "left",
  estiloCitacao: "NOTA_RODAPE_NUMERADA",
  estiloReferencia: "BIBLIOGRAFIA_ALFABETICA",
  elementos: {
    preTextuais: ["Title Page"],
    textuais: ["Introduction", "Body Chapters", "Conclusion"],
    posTextuais: ["Bibliography", "Notes"],
  },
};

const mla: Norma = {
  id: "mla",
  nome: "MLA 9th Edition",
  descricao: "Modern Language Association — Letras, linguística, literatura e estudos culturais.",
  margens: { top: 2.54, left: 2.54, bottom: 2.54, right: 2.54, unidade: "cm" },
  fonte: { familia: "Times New Roman", tamanho: 12, tamanhoNotaRodape: 10, tamanhoCitacao: 12 },
  espacamentoLinhas: 2.0,
  recuoParagrafo: 1.27,
  alinhamento: "left",
  estiloCitacao: "AUTOR_PAGINA",
  estiloReferencia: "OBRAS_CITADAS",
  elementos: {
    preTextuais: ["Header: Name, Instructor, Course, Date"],
    textuais: ["Body Text"],
    posTextuais: ["Works Cited"],
  },
};

// `Record<IdNorma, Norma>` explícito (não inferido): um campo obrigatório
// faltando ou um `id` errado em qualquer entrada quebra o typecheck, sem
// precisar de teste — é o que o passo 3.1.2 pediu ("um campo escrito errado
// na tabela quebra o typecheck").
export const NORMAS: Record<IdNorma, Norma> = { abnt, apa, ieee, vancouver, chicago, mla };
