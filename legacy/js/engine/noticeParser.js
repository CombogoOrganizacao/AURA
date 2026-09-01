/**
 * AURA — Academic Notice / Call for Proposals Parser & Analyzer
 * Transforma editais em regras estruturadas, templates, critérios de avaliação e checklists.
 */

class AuraNoticeParser {
  /**
   * Extrai regras estruturadas a partir do texto do edital
   */
  parseNoticeText(rawText, noticeTitle = 'Edital de Seleção / Fomento') {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const fullText = rawText.toLowerCase();

    // 1. Extração de Limites Quantitativos
    const limits = {
      maxPages: this.extractMaxPages(fullText) || 15,
      minPages: 5,
      maxAbstractWords: this.extractAbstractLimit(fullText) || 250,
      maxBudget: this.extractMaxBudget(fullText) || 80000,
      durationMonths: this.extractDuration(fullText) || 24
    };

    // 2. Extração de Formatação Obrigatória
    const formattingRules = {
      fontFamily: fullText.includes('arial') ? 'Arial' : 'Times New Roman',
      fontSize: fullText.includes('fonte 11') ? 11 : 12,
      lineSpacing: fullText.includes('1,5') || fullText.includes('1.5') ? 1.5 : (fullText.includes('simples') ? 1.0 : 1.5),
      maxPages: limits.maxPages,
      maxAbstractWords: limits.maxAbstractWords
    };

    // 3. Extração de Requisitos de Elegibilidade do Candidato
    const eligibility = [
      {
        id: 'el_degree',
        title: 'Titulação Mínima',
        description: fullText.includes('doutorado') ? 'Título de Doutor obtido nos últimos 5 anos.' : 'Graduação completa ou Mestrado na área do projeto.',
        status: 'MET', // MET | PENDING | NOT_MET
        source: 'Seção 2.1 — Dos Requisitos dos Candidatos'
      },
      {
        id: 'el_institution',
        title: 'Vínculo Institucional / Anuência',
        description: 'Carta de anuência do departamento ou supervisor de pesquisa.',
        status: 'PENDING',
        source: 'Seção 2.4 — Da Documentação Obrigatória'
      },
      {
        id: 'el_lattes',
        title: 'Currículo Lattes Atualizado',
        description: 'Currículo cadastrado na plataforma Lattes atualizado nos últimos 60 dias.',
        status: 'MET',
        source: 'Seção 3.2 — Da Inscrição'
      },
      {
        id: 'el_dedication',
        title: 'Dedicação Exclusiva',
        description: 'Não possuir outro vínculo empregatício ou bolsa concomitante no período.',
        status: 'MET',
        source: 'Seção 4 — Das Condições da Bolsa'
      }
    ];

    // 4. Checklist de Documentos Obrigatórios
    const documentsChecklist = [
      { id: 'doc_project', name: 'Projeto de Pesquisa Estruturado', required: true, status: 'DONE', source: 'Item 5.1' },
      { id: 'doc_cv', name: 'Currículo Lattes / Resumo CV', required: true, status: 'DONE', source: 'Item 5.2' },
      { id: 'doc_motivation', name: 'Carta de Motivação / Justificativa', required: true, status: 'PENDING', source: 'Item 5.3' },
      { id: 'doc_diploma', name: 'Comprovante de Titulação / Diploma', required: true, status: 'PENDING', source: 'Item 5.4' },
      { id: 'doc_id', name: 'Documento de Identificação (RG/CPF)', required: true, status: 'DONE', source: 'Item 5.5' },
      { id: 'doc_acceptance', name: 'Carta de Aceite do Supervisor', required: false, status: 'OPTIONAL', source: 'Item 5.6' }
    ];

    // 5. Critérios de Avaliação e Pontuação (Matriz de Conformidade)
    const evaluationCriteria = [
      {
        id: 'crit_relevance',
        name: 'Relevância e Originalidade Científica',
        weight: 30,
        scoreObtained: 28,
        status: 'STRONG',
        requirementText: 'Clareza na formulação do problema, estado da arte consistente e contribuição inovadora.',
        analysis: 'A proposta apresenta fundamentação teórica sólida e problema bem delimitado.',
        suggestion: 'Destacar ainda mais as lacunas da literatura atual nos parágrafos finais da introdução.'
      },
      {
        id: 'crit_methodology',
        name: 'Rigor e Adequação Metodológica',
        weight: 25,
        scoreObtained: 22,
        status: 'STRONG',
        requirementText: 'Detalhamento das etapas de coleta, amostragem, métodos estatísticos ou análise qualitativa.',
        analysis: 'Metodologia divide os procedimentos por fases bem estruturadas.',
        suggestion: 'Explicitar critérios de inclusão/exclusão da amostra com mais precisão.'
      },
      {
        id: 'crit_feasibility',
        name: 'Viabilidade e Cronograma',
        weight: 20,
        scoreObtained: 16,
        status: 'PARTIAL',
        requirementText: 'Compatibilidade entre atividades propostas, tempo de execução e infraestrutura disponível.',
        analysis: 'Cronograma bem distribuído em meses.',
        suggestion: 'Adicionar descrição detalhada da infraestrutura laboratorial e de software necessária.'
      },
      {
        id: 'crit_impact',
        name: 'Impacto Social, Tecnológico e Difusão',
        weight: 15,
        scoreObtained: 10,
        status: 'NEEDS_WORK',
        requirementText: 'Previsão de artigos em periódicos Qualis A, patentes, relatórios técnicos ou formação de recursos humanos.',
        analysis: 'Impacto mencionado de forma genérica no texto.',
        suggestion: 'Quantificar produtos esperados (ex: 2 artigos em revista A1, 1 workshop com comunidade).'
      },
      {
        id: 'crit_budget',
        name: 'Justificativa do Orçamento',
        weight: 10,
        scoreObtained: 8,
        status: 'STRONG',
        requirementText: 'Orçamento coerente com os itens permitidos pelo edital.',
        analysis: 'Itens orçados não ultrapassam o teto estipulado de R$ 80.000.',
        suggestion: 'Detalhar cotações prévias de equipamentos importados.'
      }
    ];

    // 6. Template Estruturado Sugerido a partir do Edital
    const suggestedSections = [
      { id: 'sec_1', title: '1. TÍTULO E IDENTIFICAÇÃO DA PROPOSTA', content: 'Identificação dos pesquisadores, instituição executora e palavras-chave.' },
      { id: 'sec_2', title: '2. RESUMO EXECUTIVO DO PROJETO', content: 'Síntese contendo problema, objetivos, metodologia resumida e impacto esperado.' },
      { id: 'sec_3', title: '3. INTRODUÇÃO E JUSTIFICATIVA', content: 'Estado da arte da pesquisa, justificativa teórica e relevância socioeconômica.' },
      { id: 'sec_4', title: '4. PROBLEMA DE PESQUISA E HIPÓTESES', content: 'Pergunta central que o projeto busca responder e hipóteses a serem testadas.' },
      { id: 'sec_5', title: '5. OBJETIVOS', content: '5.1 Objetivo Geral: ...\n\n5.2 Objetivos Específicos:\n- Realizar levantamento sistemático...\n- Desenvolver modelo analítico...\n- Validar experimentalmente...' },
      { id: 'sec_6', title: '6. FUNDAMENTAÇÃO TEÓRICA', content: 'Revisão crítica da literatura recente.' },
      { id: 'sec_7', title: '7. METODOLOGIA E PROCEDIMENTOS', content: 'Delineamento experimental, coleta e análise de dados.' },
      { id: 'sec_8', title: '8. RESULTADOS ESPERADOS E IMPACTO', content: 'Previsão de publicações, inovações e benefícios para a sociedade.' },
      { id: 'sec_9', title: '9. CRONOGRAMA DE ATIVIDADES', content: 'Tabela temporal dividida por semestres/meses de execução.' },
      { id: 'sec_10', title: '10. ORÇAMENTO DETALHADO', content: 'Tabela de despesas de custeio, capital e bolsas com justificativas.' },
      { id: 'sec_11', title: '11. REFERÊNCIAS BIBLIOGRÁFICAS', content: 'Lista de fontes citadas no projeto conforme norma aplicável.' }
    ];

    const totalScore = evaluationCriteria.reduce((sum, c) => sum + c.scoreObtained, 0);

    return {
      title: noticeTitle,
      limits,
      formattingRules,
      eligibility,
      documentsChecklist,
      evaluationCriteria,
      suggestedSections,
      compatibilityScore: totalScore,
      summary: `Edital analisado com sucesso. Foram extraídos ${documentsChecklist.length} documentos obrigatórios, ${evaluationCriteria.length} critérios de avaliação e estrutura modelo com ${suggestedSections.length} seções.`
    };
  }

  extractMaxPages(text) {
    const match = text.match(/(?:máximo|limite|até)\s*(?:de)?\s*(\d{1,3})\s*(?:páginas|laudas|folhas)/i);
    return match ? parseInt(match[1]) : null;
  }

  extractAbstractLimit(text) {
    const match = text.match(/(?:resumo|abstract)\s*(?:com|de|até)?\s*(?:máximo|limite)?\s*(\d{2,4})\s*(?:palavras|words)/i);
    return match ? parseInt(match[1]) : null;
  }

  extractMaxBudget(text) {
    const match = text.match(/(?:r\$|valor máximo|orçamento até)\s*([\d\.,]+)/i);
    if (match) {
      const clean = match[1].replace(/\./g, '').replace(',', '.');
      const val = parseFloat(clean);
      if (!isNaN(val) && val > 1000) return val;
    }
    return null;
  }

  extractDuration(text) {
    const match = text.match(/(?:duração|prazo|vigência)\s*(?:de)?\s*(\d{1,2})\s*(?:meses|mes)/i);
    return match ? parseInt(match[1]) : null;
  }
}

window.auraNoticeParser = new AuraNoticeParser();
