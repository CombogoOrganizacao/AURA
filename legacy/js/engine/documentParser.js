/**
 * AURA — Academic Document Parser & Structure Extractor
 * Extrai títulos, seções, resumo, citações, referências e tabelas de documentos importados.
 */

class AuraDocumentParser {
  /**
   * Converte texto cru ou extraído de arquivo em modelo estruturado de documento acadêmico
   */
  parseTextToDocument(rawText, fileName = 'Documento Importado') {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let title = fileName.replace(/\.[^/.]+$/, "");
    let authors = 'Autor Não Identificado';
    let abstract = '';
    let keywords = [];
    const sections = [];
    const references = [];

    let currentSection = null;
    let mode = 'preamble'; // preamble | abstract | body | references

    // Heurística de identificação semântica
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      // Detecção de Título nas primeiras linhas
      if (i === 0 && line.length < 200 && !lower.startsWith('resumo') && !lower.startsWith('abstract')) {
        title = line;
        continue;
      }

      // Detecção de Autoria
      if (i === 1 && (lower.includes('dr.') || lower.includes('prof.') || lower.includes('@') || line.split(',').length >= 1) && !lower.startsWith('resumo')) {
        authors = line;
        continue;
      }

      // Detecção de Resumo
      if (lower.startsWith('resumo') || lower.startsWith('abstract')) {
        mode = 'abstract';
        const cleanContent = line.replace(/^(resumo|abstract)[\s:—–-]*/i, '');
        if (cleanContent) abstract += cleanContent + ' ';
        continue;
      }

      // Detecção de Palavras-Chave
      if (lower.startsWith('palavras-chave') || lower.startsWith('keywords')) {
        const kwText = line.replace(/^(palavras-chave|keywords)[\s:—–-]*/i, '');
        keywords = kwText.split(/[;,.]/).map(k => k.trim()).filter(k => k.length > 1);
        mode = 'body';
        continue;
      }

      // Detecção de Seção de Referências
      if (lower === 'referências' || lower === 'referencias' || lower === 'referências bibliográficas' || lower === 'references' || lower === 'bibliografia') {
        if (currentSection) {
          sections.push(currentSection);
          currentSection = null;
        }
        mode = 'references';
        continue;
      }

      // Coleta em modo Referências
      if (mode === 'references') {
        if (line.length > 15) {
          references.push(line);
        }
        continue;
      }

      // Coleta em modo Resumo
      if (mode === 'abstract') {
        if (this.isHeadingLine(line)) {
          mode = 'body';
          // Cairá na detecção de cabeçalho abaixo
        } else {
          abstract += line + ' ';
          continue;
        }
      }

      // Detecção de Títulos de Seção no Corpo
      if (this.isHeadingLine(line)) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          id: 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          title: line,
          content: ''
        };
      } else {
        if (!currentSection) {
          currentSection = {
            id: 'sec_intro',
            title: '1. INTRODUÇÃO',
            content: ''
          };
        }
        currentSection.content += (currentSection.content ? '\n\n' : '') + line;
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    // Se nenhuma seção foi estruturada, agrupar texto
    if (sections.length === 0 && rawText.length > 0) {
      sections.push({
        id: 'sec_main',
        title: '1. DESENVOLVIMENTO',
        content: rawText
      });
    }

    return {
      title: title || 'Trabalho Acadêmico',
      authors: authors,
      abstract: abstract.trim(),
      keywords: keywords.length > 0 ? keywords : ['Pesquisa Científica', 'Metodologia', 'Análise'],
      sections: sections,
      references: references.length > 0 ? references : [
        'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 14724: Informação e documentação — Trabalhos acadêmicos. Rio de Janeiro: ABNT, 2011.',
        'GIL, Antonio Carlos. Como elaborar projetos de pesquisa. 6. ed. São Paulo: Atlas, 2019.'
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  isHeadingLine(line) {
    // Padrões como: "1 INTRODUÇÃO", "1.1 Justificativa", "2. METODOLOGIA", "I. INTRODUCTION", "METODOLOGIA"
    const isNumbered = /^\s*(?:\d+(\.\d+)*|[IVXLCDM]+\.)\s+[A-ZÁ-Úa-zá-ú]/.test(line);
    const isShortAllCaps = line === line.toUpperCase() && line.length > 3 && line.length < 60 && !line.includes('.');
    const isKnownSection = /^(introdução|introducao|fundamentação|metodologia|métodos|materiais|resultados|discussão|conclusão|cronograma|orçamento|justificativa|objetivos)/i.test(line);
    return (isNumbered || isShortAllCaps || isKnownSection) && line.length < 80;
  }
}

window.auraDocumentParser = new AuraDocumentParser();
