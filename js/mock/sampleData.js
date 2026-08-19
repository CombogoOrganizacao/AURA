/**
 * AURA — Sample Academic Data & Preloaded Notices
 * Fornece dados ricos de projetos e editais acadêmicos para demonstração imediata.
 */

window.AURA_SAMPLE_NOTICES = [
  {
    id: 'notice_fapesp_posdoc',
    title: 'Chamada de Propostas — Bolsa de Pós-Doutorado em Computação e IA 2026',
    agency: 'FAPESP / CNPq',
    deadline: '2026-11-30',
    type: 'Bolsa de Pós-Doutorado',
    limits: {
      maxPages: 15,
      minPages: 8,
      maxAbstractWords: 200,
      maxBudget: 120000,
      durationMonths: 24
    },
    formattingRules: {
      fontFamily: 'Times New Roman',
      fontSize: 12,
      lineSpacing: 1.5,
      maxPages: 15,
      maxAbstractWords: 200
    },
    eligibility: [
      { id: 'e1', title: 'Titulação de Doutorado', description: 'Título de Doutor obtido há no máximo 7 anos.', status: 'MET', source: 'Item 2.1' },
      { id: 'e2', title: 'Produção Científica', description: 'Mínimo de 2 artigos em periódicos Qualis A1/A2 nos últimos 3 anos.', status: 'MET', source: 'Item 2.3' },
      { id: 'e3', title: 'Dedicação Exclusiva', description: 'Não acumular com outras bolsas ou cargos públicos.', status: 'MET', source: 'Item 3.1' },
      { id: 'e4', title: 'Carta de Anuência do Supervisor', description: 'Comprovante assinado pelo docente responsável pelo laboratório.', status: 'PENDING', source: 'Item 4.2' }
    ],
    documentsChecklist: [
      { id: 'd1', name: 'Projeto de Pesquisa Formatado', required: true, status: 'DONE', source: 'Anexo I' },
      { id: 'd2', name: 'Súmula Curricular do Candidato (Lattes)', required: true, status: 'DONE', source: 'Item 5.1' },
      { id: 'd3', name: 'Plano de Atividades do Bolsista', required: true, status: 'DONE', source: 'Item 5.2' },
      { id: 'd4', name: 'Carta de Motivação do Candidato', required: true, status: 'PENDING', source: 'Item 5.3' },
      { id: 'd5', name: 'Diploma de Doutorado ou Ata de Defesa', required: true, status: 'PENDING', source: 'Item 5.4' },
      { id: 'd6', name: 'Orçamento com Cotações de Equipamento', required: false, status: 'OPTIONAL', source: 'Item 6.1' }
    ],
    evaluationCriteria: [
      {
        id: 'c1',
        name: 'Relevância e Originalidade Científica',
        weight: 30,
        scoreObtained: 27,
        status: 'STRONG',
        requirementText: 'Clareza na formulação do problema e caráter inovador da proposta.',
        analysis: 'A proposta estabelece bem a fronteira do conhecimento com uso de transformers.',
        suggestion: 'Reforçar o contraste em relação às técnicas tradicionais descritas na seção 2.'
      },
      {
        id: 'c2',
        name: 'Rigor Metodológico e Viabilidade',
        weight: 25,
        scoreObtained: 23,
        status: 'STRONG',
        requirementText: 'Detalhamento de métodos experimentais, amostragem e infraestrutura.',
        analysis: 'Metodologia estruturada em 4 etapas claras.',
        suggestion: 'Mencionar a capacidade de GPU necessária para os treinamentos experimentais.'
      },
      {
        id: 'c3',
        name: 'Impacto Social, Científico e Tecnológico',
        weight: 25,
        scoreObtained: 19,
        status: 'PARTIAL',
        requirementText: 'Potencial de transferência de conhecimento e publicações de alto impacto.',
        analysis: 'A previsão de artigos está descrita, mas faltam metas quantitativas.',
        suggestion: 'Adicionar metas concretas (ex: 2 artigos IEEE Transactions e 1 software open-source).'
      },
      {
        id: 'c4',
        name: 'Coerência do Cronograma e Orçamento',
        weight: 20,
        scoreObtained: 18,
        status: 'STRONG',
        requirementText: 'Orçamento de até R$ 120.000 com itens justificados.',
        analysis: 'O valor total de R$ 94.000 está dentro do teto permitido.',
        suggestion: 'Incluir justificativa para despesas de viagem técnica no mês 14.'
      }
    ],
    suggestedSections: [
      { id: 's1', title: '1. DADOS DE IDENTIFICAÇÃO E RESUMO', content: 'Identificação completa do candidato, supervisor, laboratório de pesquisa e resumo bilíngue.' },
      { id: 's2', title: '2. ENUNCIADO DO PROBLEMA E JUSTIFICATIVA', content: 'Delimitação precisa do problema científico investigado e fundamentação do estado da arte.' },
      { id: 's3', title: '3. OBJETIVOS E HIPÓTESES', content: '3.1 Objetivo Geral: ...\n\n3.2 Objetivos Específicos:\n- Mapear os modelos de linguagem existentes...\n- Desenvolver nova arquitetura híbrida...' },
      { id: 's4', title: '4. METODOLOGIA E PLANO DE TRABALHO', content: 'Detalhamento das etapas de coleta, implementação, experimentos e validação estatística.' },
      { id: 's5', title: '5. CRONOGRAMA DE ATIVIDADES', content: 'Tabela de execução ao longo dos 24 meses de vigência.' },
      { id: 's6', title: '6. DISSEMINAÇÃO DOS RESULTADOS E IMPACTO', content: 'Publicações planejadas em periódicos Qualis A1 e repositórios abertos.' },
      { id: 's7', title: '7. ORÇAMENTO JUSTIFICADO', content: 'Quadro detalhado de itens de capital, custeio e mobilidade.' },
      { id: 's8', title: '8. REFERÊNCIAS BIBLIOGRÁFICAS', content: 'Norma ABNT NBR 6023 ou APA 7th.' }
    ]
  },
  {
    id: 'notice_ppgcc_mestrado',
    title: 'Edital de Seleção — Mestrado Acadêmico em Ciência da Computação 2027.1',
    agency: 'Universidade Federal / PPGCC',
    deadline: '2026-10-15',
    type: 'Seleção de Mestrado',
    limits: {
      maxPages: 10,
      minPages: 5,
      maxAbstractWords: 150,
      maxBudget: 0,
      durationMonths: 24
    },
    formattingRules: {
      fontFamily: 'Arial',
      fontSize: 12,
      lineSpacing: 1.5,
      maxPages: 10,
      maxAbstractWords: 150
    },
    eligibility: [
      { id: 'pe1', title: 'Graduação Concluída', description: 'Diploma de graduação em Computação, Engenharia ou áreas afins.', status: 'MET', source: 'Artigo 3º' },
      { id: 'pe2', title: 'Exame Nacional Poscomp', description: 'Nota do Poscomp dos últimos 2 anos ou prova interna.', status: 'MET', source: 'Artigo 5º' }
    ],
    documentsChecklist: [
      { id: 'pd1', name: 'Pré-Projeto de Pesquisa', required: true, status: 'DONE', source: 'Seção Documentação' },
      { id: 'pd2', name: 'Histórico Escolar da Graduação', required: true, status: 'DONE', source: 'Seção Documentação' },
      { id: 'pd3', name: 'Currículo Lattes Comprovado', required: true, status: 'PENDING', source: 'Seção Documentação' },
      { id: 'pd4', name: 'Duas Cartas de Recomendação', required: true, status: 'PENDING', source: 'Seção Documentação' }
    ],
    evaluationCriteria: [
      { id: 'pc1', name: 'Qualidade do Pré-Projeto', weight: 40, scoreObtained: 35, status: 'STRONG', requirementText: 'Coerência entre tema, metodologia e linhas de pesquisa do PPGCC.', analysis: 'Tema altamente alinhado com a linha de Sistemas Inteligentes.', suggestion: 'Especificar métricas de avaliação quantitativa.' },
      { id: 'pc2', name: 'Desempenho Acadêmico e Lattes', weight: 30, scoreObtained: 25, status: 'STRONG', requirementText: 'Histórico de graduação e iniciação científica.', analysis: 'Excelente histórico com publicação prévia em simpósio.', suggestion: 'Inserir comprovantes no anexo final.' },
      { id: 'pc3', name: 'Arguição e Defesa Oral', weight: 30, scoreObtained: 26, status: 'STRONG', requirementText: 'Domínio do tema e clareza de exposição na entrevista.', analysis: 'Estrutura do projeto permite excelente defesa oral.', suggestion: 'Treinar síntese de 10 minutos.' }
    ],
    suggestedSections: [
      { id: 'ps1', title: '1. INTRODUÇÃO E TEMA DE PESQUISA', content: 'Apresentação da contextualização teórica e delimitação do problema.' },
      { id: 'ps2', title: '2. OBJETIVOS GERAIS E ESPECÍFICOS', content: 'Definição dos propósitos centrais da pesquisa.' },
      { id: 'ps3', title: '3. REVISÃO DA LITERATURA', content: 'Principais trabalhos correlatos e lacunas existentes.' },
      { id: 'ps4', title: '4. METODOLOGIA PROPOSTA', content: 'Abordagem algorítmica e base de dados a ser utilizada.' },
      { id: 'ps5', title: '5. CRONOGRAMA ESTIMADO', content: 'Planejamento para os 24 meses do mestrado.' },
      { id: 'ps6', title: '6. REFERÊNCIAS', content: 'Norma ABNT.' }
    ]
  }
];

window.AURA_SAMPLE_DOCUMENTS = [
  {
    id: 'doc_demo_posdoc',
    title: 'Arquiteturas Híbridas de Aprendizado Profundo para Revisão Automatizada de Literatura Científica',
    standardId: 'abnt',
    workTypeId: 'postdoc_project',
    noticeId: 'notice_fapesp_posdoc',
    authors: 'Dr. Leonardo Vasconcelos de Alencar',
    abstract: 'Este projeto de pesquisa investiga o desenvolvimento de arquiteturas híbridas baseadas em Transformers e Grafos de Conhecimento para a automação da síntese e verificação de conformidade em grandes volumes de literatura científica. A metodologia proposta combina extração de entidades semânticas, alinhamento ontológico e verificação de requisitos normativos.',
    keywords: ['Processamento de Linguagem Natural', 'Revisão Sistemática', 'Modelos de Linguagem', 'Conformidade Acadêmica'],
    sections: [
      {
        id: 's_intro',
        title: '1. INTRODUÇÃO E JUSTIFICATIVA',
        content: 'O crescimento exponencial na publicação de artigos científicos tem imposto desafios severos à condução de revisões sistemáticas da literatura e à verificação de conformidade metodológica. Pesquisadores e comitês de avaliação de agências de fomento frequentemente enfrentam dificuldades para analisar centenas de propostas de forma rápida e reprodutível (SILVA, 2023).\n\nNeste cenário, a aplicação de técnicas avançadas de inteligência artificial desponta como uma alternativa viável para acelerar a extração de evidências e a checagem de conformidade com normas estabelecidas (MENDES & SOUZA, 2024).'
      },
      {
        id: 's_prob',
        title: '2. PROBLEMA DE PESQUISA E HIPÓTESES',
        content: 'Como integrar modelos de linguagem de grande escala com representações baseadas em grafos de conhecimento de forma a garantir interpretabilidade e alta precisão na extração de regras de documentos acadêmicos?\n\nHipótese: Modelos híbridos que combinam aprendizado supervisionado com regras determinísticas apresentam acurácia 30% superior na identificação de discrepâncias metodológicas quando comparados a abordagens puramente probabilísticas.'
      },
      {
        id: 's_obj',
        title: '3. OBJETIVOS',
        content: '3.1 Objetivo Geral:\nDesenvolver e validar um framework inteligente capaz de analisar, verificar e adequar propostas de pesquisa científica a editais de fomento e normas acadêmicas.\n\n3.2 Objetivos Específicos:\n- Construir um corpus bilíngue de editais e artigos científicos anotados;\n- Implementar módulo de detecção de coerência entre objetivos e metodologia;\n- Validar a ferramenta em um estudo de caso real com 100 propostas acadêmicas.'
      },
      {
        id: 's_method',
        title: '4. METODOLOGIA PROPOSTA',
        content: 'A investigação adotará uma abordagem quantitativa e experimental, estruturada em quatro fases sequenciais:\n\nFase 1: Coleta e pré-processamento de dados utilizando técnicas de raspagem segura e conversão em UTF-8;\nFase 2: Treinamento e ajuste fino de modelos BERTimbau e RoBERTa para classificação hierárquica de seções acadêmicas;\nFase 3: Construção do motor de regras de formatação (ABNT, APA, IEEE);\nFase 4: Avaliação de desempenho através de métricas de Precisão, Recall e F1-Score.'
      },
      {
        id: 's_results',
        title: '5. RESULTADOS ESPERADOS E IMPACTO',
        content: 'Espera-se disponibilizar um protótipo funcional em código aberto, publicar pelo menos dois artigos em periódicos internacionais de alto impacto (Qualis A1) e submeter um pedido de registro de software junto ao INPI.'
      }
    ],
    references: [
      'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 14724: Informação e documentação — Trabalhos acadêmicos. Rio de Janeiro: ABNT, 2011.',
      'MENDES, Carlos; SOUZA, Rafaela. Inteligência artificial aplicada à gestão da produção científica. Revista Brasileira de Informática na Educação, v. 32, p. 112-130, 2024.',
      'SILVA, Marcos Vinicius. Mineração de texto e descoberta de conhecimento em bases bibliográficas. São Paulo: Editora Acadêmica, 2023.'
    ],
    timeline: [
      { activity: 'Levantamento bibliográfico e estado da arte', m1: true, m2: true, m3: false, m4: false, m5: false, m6: false },
      { activity: 'Coleta e anotação do corpus experimental', m1: false, m2: true, m3: true, m4: false, m5: false, m6: false },
      { activity: 'Implementação dos modelos de inteligência artificial', m1: false, m2: false, m3: true, m4: true, m5: false, m6: false },
      { activity: 'Validação empírica e testes de usabilidade', m1: false, m2: false, m3: false, m4: true, m5: true, m6: false },
      { activity: 'Redação de artigos e relatório final do projeto', m1: false, m2: false, m3: false, m4: false, m5: true, m6: true }
    ],
    budget: [
      { category: 'Equipamentos e Servidores', item: 'Workstation com GPU RTX 4090 para treino de modelos', amount: 38000 },
      { category: 'Serviços de Terceiros / Nuvem', item: 'Créditos de computação em nuvem (AWS/GCP)', amount: 18000 },
      { category: 'Viagens e Participação em Congressos', item: 'Inscrição e passagens para IEEE Conference', amount: 16000 },
      { category: 'Publicações Científicas', item: 'Taxas de processamento de artigo (APC em periódico A1)', amount: 12000 },
      { category: 'Material de Consumo', item: 'Periféricos e material de escritório', amount: 4000 }
    ],
    updatedAt: 'Há 12 minutos'
  }
];
