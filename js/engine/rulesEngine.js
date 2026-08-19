/**
 * AURA — Rules Engine & Conflict Resolver
 * Gerencia a hierarquia: Padrão -> Norma -> Instituição -> Edital -> Usuário
 */

class AuraRulesEngine {
  constructor() {
    this.presets = this.loadPresets();
  }

  getDefaultPresets() {
    return [
      { 
        id: 'unicap_abnt', 
        name: 'ABNT — Institucional UNICAP', 
        standardId: 'abnt', 
        fontFamily: 'Arial', 
        fontSize: 12,
        lineSpacing: 1.5,
        margins: { top: 3.0, left: 3.0, bottom: 2.0, right: 2.0 }
      },
      { 
        id: 'sbc_paper', 
        name: 'Artigo — SBC (Sociedade Brasileira de Computação)', 
        standardId: 'abnt', 
        fontFamily: 'Times New Roman', 
        fontSize: 12,
        lineSpacing: 1.5,
        margins: { top: 3.5, left: 3.0, bottom: 2.5, right: 3.0 } 
      },
      { 
        id: 'ieee_transactions', 
        name: 'IEEE Transactions (Duas Colunas)', 
        standardId: 'ieee', 
        fontFamily: 'Times New Roman',
        fontSize: 10,
        lineSpacing: 1.15,
        margins: { top: 1.9, left: 1.43, bottom: 2.54, right: 1.43 }
      },
      { 
        id: 'fapesp_proposal', 
        name: 'Projeto de Pesquisa FAPESP / Bolsas', 
        standardId: 'abnt', 
        fontFamily: 'Times New Roman',
        fontSize: 12,
        lineSpacing: 1.5,
        maxPages: 20,
        margins: { top: 3.0, left: 3.0, bottom: 2.0, right: 2.0 }
      }
    ];
  }

  loadPresets() {
    const defaultPresets = this.getDefaultPresets();
    try {
      const stored = localStorage.getItem('aura_presets');
      return stored ? JSON.parse(stored) : defaultPresets;
    } catch (e) {
      return defaultPresets;
    }
  }

  savePreset(preset) {
    const existingIndex = this.presets.findIndex(p => p.id === preset.id);
    if (existingIndex >= 0) {
      this.presets[existingIndex] = preset;
    } else {
      this.presets.push(preset);
    }
    localStorage.setItem('aura_presets', JSON.stringify(this.presets));
  }

  updatePreset(presetId, updatedData) {
    const idx = this.presets.findIndex(p => p.id === presetId);
    if (idx >= 0) {
      this.presets[idx] = { ...this.presets[idx], ...updatedData };
      localStorage.setItem('aura_presets', JSON.stringify(this.presets));
      return this.presets[idx];
    }
    return null;
  }

  deletePreset(presetId) {
    this.presets = this.presets.filter(p => p.id !== presetId);
    localStorage.setItem('aura_presets', JSON.stringify(this.presets));
  }

  resetDefaultPresets() {
    this.presets = this.getDefaultPresets();
    localStorage.setItem('aura_presets', JSON.stringify(this.presets));
    return this.presets;
  }

  /**
   * Resolve regras consolidadas aplicando herança e detectando conflitos explícitos
   */
  resolveRules(standardId, noticeConfig = null, userOverrides = {}) {
    const baseStandard = window.AURA_STANDARDS[standardId] || window.AURA_STANDARDS['abnt'];
    const resolved = JSON.parse(JSON.stringify(baseStandard));
    const conflicts = [];

    // Se houver regras específicas de um Edital ou Chamada
    if (noticeConfig && noticeConfig.formattingRules) {
      const noticeRules = noticeConfig.formattingRules;
      
      // Exemplo de conflito de fonte
      if (noticeRules.fontFamily && noticeRules.fontFamily !== resolved.font.family) {
        conflicts.push({
          field: 'fontFamily',
          label: 'Família da Fonte',
          standardValue: resolved.font.family,
          noticeValue: noticeRules.fontFamily,
          source: noticeConfig.title || 'Edital Específico',
          chosen: 'notice', // por padrão o edital tem prioridade
          resolutionText: `O edital exige "${noticeRules.fontFamily}". Esta regra substitui a norma base (${resolved.name}).`
        });
        resolved.font.family = noticeRules.fontFamily;
      }

      // Conflito de tamanho da fonte
      if (noticeRules.fontSize && noticeRules.fontSize !== resolved.font.size) {
        conflicts.push({
          field: 'fontSize',
          label: 'Tamanho da Fonte Principal',
          standardValue: `${resolved.font.size} pt`,
          noticeValue: `${noticeRules.fontSize} pt`,
          source: noticeConfig.title || 'Edital Específico',
          chosen: 'notice',
          resolutionText: `O edital exige corpo ${noticeRules.fontSize}pt para o texto.`
        });
        resolved.font.size = noticeRules.fontSize;
      }

      // Conflito de espaçamento
      if (noticeRules.lineSpacing && noticeRules.lineSpacing !== resolved.lineSpacing) {
        conflicts.push({
          field: 'lineSpacing',
          label: 'Espaçamento entre Linhas',
          standardValue: `${resolved.lineSpacing} linhas`,
          noticeValue: `${noticeRules.lineSpacing} linhas`,
          source: noticeConfig.title || 'Edital Específico',
          chosen: 'notice',
          resolutionText: `O edital determina espaçamento ${noticeRules.lineSpacing}.`
        });
        resolved.lineSpacing = noticeRules.lineSpacing;
      }

      // Limites de páginas do edital
      if (noticeRules.maxPages) {
        resolved.maxPages = noticeRules.maxPages;
      }
      if (noticeRules.maxAbstractWords) {
        resolved.maxAbstractWords = noticeRules.maxAbstractWords;
      }
    }

    // Sobrescritas manuais do usuário (Prioridade máxima)
    if (userOverrides && Object.keys(userOverrides).length > 0) {
      Object.assign(resolved, userOverrides);
    }

    return { resolved, conflicts };
  }

  /**
   * Avalia a conformidade de um documento com as regras ativas
   */
  evaluateCompliance(documentData, resolvedRules) {
    const issues = [];
    let score = 100;

    // 1. Verificação de Elementos Essenciais
    if (!documentData.title || documentData.title.trim().length < 5) {
      issues.push({ type: 'error', category: 'Estrutura', text: 'Título do trabalho ausente ou muito curto.' });
      score -= 15;
    } else {
      issues.push({ type: 'success', category: 'Estrutura', text: 'Título identificado e bem estruturado.' });
    }

    if (!documentData.abstract || documentData.abstract.trim().length < 50) {
      issues.push({ type: 'warning', category: 'Estrutura', text: 'Resumo / Abstract não identificado ou incompleto.' });
      score -= 10;
    } else {
      const abstractWords = documentData.abstract.trim().split(/\s+/).length;
      if (resolvedRules.maxAbstractWords && abstractWords > resolvedRules.maxAbstractWords) {
        issues.push({ type: 'warning', category: 'Limites', text: `Resumo ultrapassa o limite do edital (${abstractWords}/${resolvedRules.maxAbstractWords} palavras).` });
        score -= 8;
      } else {
        issues.push({ type: 'success', category: 'Estrutura', text: `Resumo em conformidade (${abstractWords} palavras).` });
      }
    }

    // 2. Verificação de Seções Metodológicas
    const sections = documentData.sections || [];
    const sectionTitles = sections.map(s => (s.title || '').toLowerCase());
    
    const hasIntro = sectionTitles.some(t => t.includes('introdução') || t.includes('introduction'));
    const hasMethod = sectionTitles.some(t => t.includes('metodologia') || t.includes('método') || t.includes('method'));
    const hasResults = sectionTitles.some(t => t.includes('resultado') || t.includes('discussão') || t.includes('result'));
    const hasRefs = sectionTitles.some(t => t.includes('referência') || t.includes('reference') || t.includes('bibliografia'));

    if (hasIntro) issues.push({ type: 'success', category: 'Estrutura', text: 'Seção de Introdução identificada.' });
    else { issues.push({ type: 'error', category: 'Estrutura', text: 'Seção de Introdução não encontrada.' }); score -= 10; }

    if (hasMethod) issues.push({ type: 'success', category: 'Estrutura', text: 'Metodologia / Procedimentos identificados.' });
    else { issues.push({ type: 'warning', category: 'Estrutura', text: 'Seção de Metodologia ausente ou não estruturada.' }); score -= 10; }

    if (hasResults) issues.push({ type: 'success', category: 'Estrutura', text: 'Resultados / Discussão identificados.' });
    else { issues.push({ type: 'warning', category: 'Estrutura', text: 'Seção de Resultados / Discussão pendente.' }); score -= 8; }

    if (hasRefs) issues.push({ type: 'success', category: 'Referências', text: 'Seção de Referências identificada.' });
    else { issues.push({ type: 'error', category: 'Referências', text: 'Lista de Referências bibliográficas ausente.' }); score -= 15; }

    // 3. Verificação de Citações Cruzadas
    const bodyText = sections.map(s => s.content || '').join(' ');
    const citationsInText = this.extractCitations(bodyText);
    const referencesList = documentData.references || [];

    let orphanCitations = 0;
    citationsInText.forEach(cite => {
      const match = referencesList.some(ref => ref.toLowerCase().includes(cite.author.toLowerCase()));
      if (!match) orphanCitations++;
    });

    if (orphanCitations > 0) {
      issues.push({ 
        type: 'warning', 
        category: 'Referências', 
        text: `${orphanCitations} citação(ões) no texto não possuem correspondência na lista de referências.` 
      });
      score -= Math.min(15, orphanCitations * 5);
    } else if (citationsInText.length > 0) {
      issues.push({ type: 'success', category: 'Referências', text: 'Todas as citações possuem referência correspondente.' });
    }

    score = Math.max(10, Math.min(100, score));
    return { score, issues, citationsFound: citationsInText.length, referencesCount: referencesList.length };
  }

  extractCitations(text) {
    const citations = [];
    // Regex para estilo autor-data ABNT/APA: (SILVA, 2023) ou (Silva & Souza, 2022, p. 12)
    const authorDateRegex = /\(([A-ZÁ-Úa-zá-ú\s&,]+),\s*([12][0-9]{3})(?:,\s*p\.\s*\d+)?\)/g;
    let match;
    while ((match = authorDateRegex.exec(text)) !== null) {
      citations.push({
        full: match[0],
        author: match[1].trim(),
        year: match[2].trim()
      });
    }

    // Regex para estilo numérico IEEE: [1], [2, 3]
    const numericRegex = /\[(\d+)\]/g;
    while ((match = numericRegex.exec(text)) !== null) {
      citations.push({
        full: match[0],
        numericId: match[1]
      });
    }

    return citations;
  }
}

window.auraRulesEngine = new AuraRulesEngine();
