/**
 * AURA — Academic Standards Specification
 * Definições estruturadas para ABNT, APA 7th, IEEE, Vancouver, Chicago e MLA.
 */

window.AURA_STANDARDS = {
  abnt: {
    id: 'abnt',
    name: 'ABNT (NBR 14724 / 6023 / 10520)',
    description: 'Normas brasileiras para trabalhos acadêmicos, teses, dissertações e artigos.',
    margins: { top: 3.0, left: 3.0, bottom: 2.0, right: 2.0, unit: 'cm' },
    font: { family: 'Times New Roman / Arial', size: 12, footnotesSize: 10, quoteSize: 10 },
    lineSpacing: 1.5,
    paragraphIndent: 1.25, // cm
    alignment: 'justify',
    pageNumbering: { position: 'top-right', startFromTextual: true, format: 'arabic' },
    headings: {
      h1: { uppercase: true, bold: true, size: 12 },
      h2: { uppercase: false, bold: true, size: 12 },
      h3: { uppercase: false, italic: true, size: 12 }
    },
    longQuote: { minLines: 4, indent: 4.0, spacing: 1.0, fontSize: 10 },
    citationStyle: 'AUTHOR-DATE', // ex: (SILVA, 2023, p. 45)
    referenceStyle: 'ALPHABETICAL_UPPERCASE',
    elements: {
      preTextual: ['Capa', 'Folha de Rosto', 'Resumo', 'Abstract', 'Sumário'],
      textual: ['Introdução', 'Desenvolvimento', 'Metodologia', 'Resultados', 'Discussão', 'Conclusão'],
      postTextual: ['Referências', 'Apêndices', 'Anexos']
    }
  },
  apa: {
    id: 'apa',
    name: 'APA 7th Edition',
    description: 'American Psychological Association — Padrão internacional para ciências sociais e humanas.',
    margins: { top: 2.54, left: 2.54, bottom: 2.54, right: 2.54, unit: 'cm' },
    font: { family: 'Times New Roman 12pt / Calibri 11pt', size: 12, footnotesSize: 10, quoteSize: 12 },
    lineSpacing: 2.0,
    paragraphIndent: 1.27, // cm (0.5 inch)
    alignment: 'left',
    pageNumbering: { position: 'top-right', startFromTextual: false, format: 'arabic' },
    headings: {
      h1: { uppercase: false, bold: true, centered: true, size: 12 },
      h2: { uppercase: false, bold: true, alignLeft: true, size: 12 },
      h3: { uppercase: false, bold: true, italic: true, alignLeft: true, size: 12 }
    },
    longQuote: { minWords: 40, indent: 1.27, spacing: 2.0, fontSize: 12 },
    citationStyle: 'Author-Date', // ex: (Silva, 2023, p. 45)
    referenceStyle: 'HANGING_INDENT_ALPHABETICAL',
    elements: {
      preTextual: ['Title Page', 'Abstract'],
      textual: ['Introduction', 'Method', 'Results', 'Discussion'],
      postTextual: ['References', 'Appendices']
    }
  },
  ieee: {
    id: 'ieee',
    name: 'IEEE Style',
    description: 'Institute of Electrical and Electronics Engineers — Padrão de engenharia e ciência da computação.',
    margins: { top: 1.9, left: 1.43, bottom: 2.54, right: 1.43, unit: 'cm' },
    font: { family: 'Times New Roman', size: 10, footnotesSize: 8, quoteSize: 9 },
    columns: 2,
    columnGap: 0.63,
    lineSpacing: 1.15,
    paragraphIndent: 0.5,
    alignment: 'justify',
    pageNumbering: { position: 'bottom-center', format: 'arabic' },
    headings: {
      h1: { uppercase: true, centered: true, romanNumerals: true, size: 10 },
      h2: { italic: true, letters: true, size: 10 }
    },
    citationStyle: 'NUMERIC_BRACKETS', // ex: [1], [2-4]
    referenceStyle: 'NUMERIC_ORDER',
    elements: {
      preTextual: ['Title & Authors', 'Abstract', 'Index Terms'],
      textual: ['I. Introduction', 'II. Architecture & Methods', 'III. Experiments', 'IV. Discussion'],
      postTextual: ['Acknowledgment', 'References']
    }
  },
  vancouver: {
    id: 'vancouver',
    name: 'Vancouver (ICMJE)',
    description: 'International Committee of Medical Journal Editors — Padrão para medicina e ciências da saúde.',
    margins: { top: 2.5, left: 2.5, bottom: 2.5, right: 2.5, unit: 'cm' },
    font: { family: 'Arial / Times New Roman', size: 12, footnotesSize: 10, quoteSize: 10 },
    lineSpacing: 1.5,
    paragraphIndent: 1.0,
    alignment: 'justify',
    citationStyle: 'NUMERIC_SUPERSCRIPT', // ex: Silva¹
    referenceStyle: 'NUMERIC_ORDER_MEDICAL',
    elements: {
      preTextual: ['Title Page', 'Structured Abstract (Objectives, Methods, Results, Conclusion)'],
      textual: ['Introduction', 'Methods', 'Results', 'Discussion'],
      postTextual: ['Ethical Approval', 'References']
    }
  },
  chicago: {
    id: 'chicago',
    name: 'Chicago 17th (Notes & Bibliography)',
    description: 'Universidade de Chicago — Usado em história, artes, literatura e ciências sociais.',
    margins: { top: 2.54, left: 2.54, bottom: 2.54, right: 2.54, unit: 'cm' },
    font: { family: 'Times New Roman', size: 12, footnotesSize: 10, quoteSize: 10 },
    lineSpacing: 2.0,
    paragraphIndent: 1.27,
    alignment: 'left',
    citationStyle: 'FOOTNOTES_NUMBERED',
    referenceStyle: 'BIBLIOGRAPHY_ALPHABETICAL',
    elements: {
      preTextual: ['Title Page'],
      textual: ['Introduction', 'Body Chapters', 'Conclusion'],
      postTextual: ['Bibliography', 'Notes']
    }
  },
  mla: {
    id: 'mla',
    name: 'MLA 9th Edition',
    description: 'Modern Language Association — Letras, linguística, literatura e estudos culturais.',
    margins: { top: 2.54, left: 2.54, bottom: 2.54, right: 2.54, unit: 'cm' },
    font: { family: 'Times New Roman', size: 12, footnotesSize: 10, quoteSize: 12 },
    lineSpacing: 2.0,
    paragraphIndent: 1.27,
    alignment: 'left',
    citationStyle: 'AUTHOR_PAGE', // ex: (Silva 45)
    referenceStyle: 'WORKS_CITED',
    elements: {
      preTextual: ['Header: Name, Instructor, Course, Date'],
      textual: ['Body Text'],
      postTextual: ['Works Cited']
    }
  }
};

window.AURA_WORK_TYPES = [
  { id: 'article', name: 'Artigo Científico', defaultStandard: 'abnt', typicalLength: '10-25 páginas' },
  { id: 'paper', name: 'Paper para Conferência / Simpósio', defaultStandard: 'ieee', typicalLength: '6-10 páginas' },
  { id: 'tcc', name: 'TCC / Monografia', defaultStandard: 'abnt', typicalLength: '30-70 páginas' },
  { id: 'dissertation', name: 'Dissertação de Mestrado', defaultStandard: 'abnt', typicalLength: '80-150 páginas' },
  { id: 'thesis', name: 'Tese de Doutorado', defaultStandard: 'abnt', typicalLength: '120-250 páginas' },
  { id: 'research_proposal', name: 'Projeto de Pesquisa (Edital/Fomento)', defaultStandard: 'abnt', typicalLength: '10-20 páginas' },
  { id: 'postdoc_project', name: 'Projeto de Pós-Doutorado', defaultStandard: 'abnt', typicalLength: '15-25 páginas' },
  { id: 'extended_abstract', name: 'Resumo Expandido', defaultStandard: 'abnt', typicalLength: '3-5 páginas' },
  { id: 'academic_review', name: 'Resenha Crítica / Acadêmica', defaultStandard: 'abnt', typicalLength: '3-6 páginas' },
  { id: 'motivation_letter', name: 'Carta de Motivação / Memorial', defaultStandard: 'abnt', typicalLength: '2-4 páginas' }
];
