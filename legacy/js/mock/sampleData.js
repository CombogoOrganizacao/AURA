/**
 * AURA — Sample Academic Data & Preloaded Notices
 * Fornece dados ricos de projetos e editais acadêmicos para demonstração imediata.
 */

window.AURA_SAMPLE_NOTICES = [
  // --- NACIONAIS / FOMENTO À CIÊNCIA & PESQUISA ---
  {
    id: 'notice_cnpq_universal',
    title: 'Chamada CNPq/MCTI Nº 10/2026 — Faixa A e B Universal de Pesquisa Científica',
    agency: 'CNPq / MCTI',
    officialUrl: 'https://www.gov.br/cnpq/pt-br/assuntos/chamadas-publicas',
    category: 'ciencia_pesquisa',
    status: 'open',
    deadline: '2026-11-20',
    type: 'Auxílio à Pesquisa / Universal',
    limits: { maxPages: 20, minPages: 8, maxAbstractWords: 250, maxBudget: 350000, durationMonths: 36 },
    formattingRules: { fontFamily: 'Times New Roman', fontSize: 12, lineSpacing: 1.5, maxPages: 20, maxAbstractWords: 250 },
    eligibility: [
      { id: 'cnpq_e1', title: 'Doutorado Concluído e Cadastrado no Lattes', description: 'Bolsista de Produtividade ou pesquisador doutor com vínculo institucional ativo.', status: 'MET', source: 'Item 2.1' },
      { id: 'cnpq_e2', title: 'Equipe de Pesquisa Multidisciplinar', description: 'Composição de ao menos 2 estudantes de pós-graduação e 1 pesquisador colaborador.', status: 'MET', source: 'Item 3.2' }
    ],
    documentsChecklist: [
      { id: 'cnpq_d1', name: 'Projeto de Pesquisa Estruturado', required: true, status: 'DONE', source: 'Anexo I' },
      { id: 'cnpq_d2', name: 'Currículo Lattes Atualizado nos últimos 30 dias', required: true, status: 'DONE', source: 'Item 4.1' },
      { id: 'cnpq_d3', name: 'Termo de Anuência da Instituição Executora', required: true, status: 'PENDING', source: 'Item 4.2' },
      { id: 'cnpq_d4', name: 'Planilha Orçamentária Justificada', required: true, status: 'DONE', source: 'Item 5.1' }
    ],
    evaluationCriteria: [
      { id: 'cnpq_c1', name: 'Mérito Científico e Inovação', weight: 35, scoreObtained: 32, status: 'STRONG', requirementText: 'Originalidade, clareza dos objetivos e relevância do avanço proposto.', analysis: 'Proposta com alto impacto na fronteira do conhecimento.', suggestion: 'Destacar o diferencial frente ao estado da arte internacional.' },
      { id: 'cnpq_c2', name: 'Qualificação do Proponente e Equipe', weight: 30, scoreObtained: 28, status: 'STRONG', requirementText: 'Produção científica qualificada nos últimos 5 anos.', analysis: 'Equipe proponente com publicações Qualis A1 consolidadas.', suggestion: 'Listar 3 principais patentes ou artigos de impacto.' },
      { id: 'cnpq_c3', name: 'Viabilidade Metodológica e Orçamentária', weight: 20, scoreObtained: 18, status: 'STRONG', requirementText: 'Adequação dos recursos solicitados e cronograma de metas.', analysis: 'Orçamento de capital e custeio compatível com as fases propostas.', suggestion: 'Justificar custo de importação de insumos no mês 12.' },
      { id: 'cnpq_c4', name: 'Formação de Recursos Humanos', weight: 15, scoreObtained: 14, status: 'STRONG', requirementText: 'Inserção de mestrandos, doutorandos e bolsistas de IC.', analysis: 'Previsão de 2 dissertações e 1 tese associada ao projeto.', suggestion: 'Definir planos de trabalho específicos para bolsistas.' }
    ],
    suggestedSections: [
      { id: 's1', title: '1. IDENTIFICAÇÃO E RESUMO DA PROPOSTA', content: 'Identificação da instituição proponente, coordenador e resumo executivo.' },
      { id: 's2', title: '2. CARACTERIZAÇÃO DO PROBLEMA E JUSTIFICATIVA', content: 'Fundamentação teórica, relevância social e tecnológica da investigação.' },
      { id: 's3', title: '3. OBJETIVOS GERAIS E ESPECÍFICOS', content: 'Metas científicas mensuráveis ao longo dos 36 meses.' },
      { id: 's4', title: '4. METODOLOGIA E ESTRATÉGIA DE AÇÃO', content: 'Delineamento experimental, amostragem, técnicas de análise e infraestrutura.' },
      { id: 's5', title: '5. CRONOGRAMA FÍSICO-FINANCEIRO', content: 'Matriz temporal de metas e etapas de execução.' },
      { id: 's6', title: '6. ORÇAMENTO DETALHADO', content: 'Despesas de custeio, capital e bolsas vinculadas.' },
      { id: 's7', title: '7. REFERÊNCIAS BIBLIOGRÁFICAS', content: 'Norma ABNT NBR 6023 ou APA 7th.' }
    ]
  },
  {
    id: 'notice_capes_posdoc',
    title: 'Edital CAPES Nº 28/2026 — Programa de Desenvolvimento da Pós-Graduação (PDPG)',
    agency: 'CAPES',
    officialUrl: 'https://www.gov.br/capes/pt-br/assuntos/editais-e-resultados',
    category: 'ciencia_pesquisa',
    status: 'open',
    deadline: '2026-12-10',
    type: 'Bolsas de Pós-Doutorado e Fixação de Doutores',
    limits: { maxPages: 18, minPages: 10, maxAbstractWords: 200, maxBudget: 280000, durationMonths: 24 },
    formattingRules: { fontFamily: 'Times New Roman', fontSize: 12, lineSpacing: 1.5, maxPages: 18, maxAbstractWords: 200 },
    eligibility: [
      { id: 'capes_e1', title: 'Doutorado Reconhecido pela CAPES', description: 'Titulação máxima obtida em PPG recomendado com nota igual ou superior a 4.', status: 'MET', source: 'Item 2.2' },
      { id: 'capes_e2', title: 'Alinhamento com Áreas Estratégicas', description: 'Biotecnologia, Inteligência Artificial, Saúde Coletiva ou Sustentabilidade.', status: 'MET', source: 'Item 2.4' }
    ],
    documentsChecklist: [
      { id: 'capes_d1', name: 'Projeto de Pesquisa e Plano de Ensino', required: true, status: 'DONE', source: 'Seção IV' },
      { id: 'capes_d2', name: 'Comprovante de Vínculo com PPG Proponente', required: true, status: 'DONE', source: 'Seção IV' },
      { id: 'capes_d3', name: 'Plano de Internacionalização', required: false, status: 'PENDING', source: 'Seção V' }
    ],
    evaluationCriteria: [
      { id: 'capes_c1', name: 'Qualidade do Projeto e Plano de Trabalho', weight: 40, scoreObtained: 36, status: 'STRONG', requirementText: 'Coerência científica e metas de publicação internacional.', analysis: 'Excelente consistência teórica e metodológica.', suggestion: 'Indicar periódicos com fator de impacto alvo.' },
      { id: 'capes_c2', name: 'Impacto na Pós-Graduação', weight: 35, scoreObtained: 30, status: 'STRONG', requirementText: 'Contribuição para a elevação de conceito do PPG.', analysis: 'Atividades docentes e de coorientação bem integradas.', suggestion: 'Detalhar ministração de disciplina avançada.' },
      { id: 'capes_c3', name: 'Internacionalização', weight: 25, scoreObtained: 22, status: 'STRONG', requirementText: 'Parcerias com centros de pesquisa no exterior.', analysis: 'Convênio prévio com universidade europeia.', suggestion: 'Incluir carta de colaboração internacional.' }
    ],
    suggestedSections: [
      { id: 's1', title: '1. APRESENTAÇÃO DO PROJETO E RESUMO', content: 'Resumo estruturado do projeto e inserção no PPG.' },
      { id: 's2', title: '2. JUSTIFICATIVA E IMPACTO NO PPG', content: 'Relevância para a consolidação das linhas de pesquisa do programa.' },
      { id: 's3', title: '3. PLANO DE ATIVIDADES DE PESQUISA E ENSINO', content: 'Aulas, oficinas metodológicas e orientação discente.' },
      { id: 's4', title: '4. METODOLOGIA E CRONOGRAMA', content: 'Detalhamento das etapas de investigação ao longo dos 24 meses.' },
      { id: 's5', title: '5. REFERÊNCIAS', content: 'Padrão ABNT/APA.' }
    ]
  },
  {
    id: 'notice_facepe_inovacao',
    title: 'Edital FACEPE/CONFAP Nº 08/2026 — Apoio à Ciência, Tecnologia e Interiorização (27 FAPs)',
    agency: 'FACEPE / CONFAP',
    officialUrl: 'https://www.facepe.br/editais/abertos/',
    category: 'ciencia_pesquisa',
    status: 'in_progress',
    deadline: '2026-10-30',
    type: 'Auxílio à Pesquisa Estadual e Regional',
    limits: { maxPages: 15, minPages: 6, maxAbstractWords: 200, maxBudget: 150000, durationMonths: 24 },
    formattingRules: { fontFamily: 'Arial', fontSize: 12, lineSpacing: 1.5, maxPages: 15, maxAbstractWords: 200 },
    eligibility: [
      { id: 'facepe_e1', title: 'Vínculo com ICT de Pernambuco', description: 'Pesquisador vinculado a instituição de ensino superior ou centro tecnológico estadual.', status: 'MET', source: 'Art. 4º' }
    ],
    documentsChecklist: [
      { id: 'facepe_d1', name: 'Projeto no formulário AgilFAP', required: true, status: 'DONE', source: 'Portal AgilFAP' },
      { id: 'facepe_d2', name: 'Orçamento com 3 cotações para itens de capital', required: true, status: 'PENDING', source: 'Manual Financeiro' }
    ],
    evaluationCriteria: [
      { id: 'facepe_c1', name: 'Impacto Regional e Social', weight: 40, scoreObtained: 36, status: 'STRONG', requirementText: 'Potencial de geração de renda, inclusão ou solução de gargalos locais.', analysis: 'Projeto com aplicação direta em sistemas de saúde estaduais.', suggestion: 'Destacar parcerias com hospitais do SUS regional.' },
      { id: 'facepe_c2', name: 'Qualidade Metodológica', weight: 35, scoreObtained: 30, status: 'STRONG', requirementText: 'Rigor experimental e cronograma exequível.', analysis: 'Etapas bem distribuídas nos 24 meses.', suggestion: 'Adicionar plano de contingência.' },
      { id: 'facepe_c3', name: 'Orçamento Justificado', weight: 25, scoreObtained: 22, status: 'STRONG', requirementText: 'Adequação aos limites e rubricas da FACEPE.', analysis: 'Valor total dentro do teto de R$ 150k.', suggestion: 'Anexar orçamentos detalhados.' }
    ],
    suggestedSections: [
      { id: 's1', title: '1. IDENTIFICAÇÃO E RESUMO EXECUTIVO', content: 'Identificação dos pesquisadores e escopo da proposta.' },
      { id: 's2', title: '2. CONTEXTO REGIONAL E PROBLEMA ABORDADO', content: 'Diagnóstico dos desafios locais a serem solucionados.' },
      { id: 's3', title: '3. OBJETIVOS E METAS ESPECÍFICAS', content: 'Resultados mensuráveis de curto e médio prazo.' },
      { id: 's4', title: '4. METODOLOGIA E CRONOGRAMA', content: 'Procedimentos técnicos e plano de execução.' },
      { id: 's5', title: '5. PLANILHA ORÇAMENTÁRIA JUSTIFICADA', content: 'Custos de equipamentos, insumos e diárias.' },
      { id: 's6', title: '6. REFERÊNCIAS', content: 'Norma ABNT.' }
    ]
  },
  {
    id: 'notice_serrapilheira',
    title: 'Chamada Pública Instituto Serrapilheira — Apoio à Ciência Fundamental e Audaciosa 2026',
    agency: 'Instituto Serrapilheira',
    officialUrl: 'https://serrapilheira.org/chamadas-publicas/',
    category: 'ciencia_pesquisa',
    status: 'open',
    deadline: '2026-11-15',
    type: 'Grandes Questões da Ciência Fundamental',
    limits: { maxPages: 10, minPages: 4, maxAbstractWords: 150, maxBudget: 700000, durationMonths: 36 },
    formattingRules: { fontFamily: 'Times New Roman', fontSize: 11, lineSpacing: 1.5, maxPages: 10, maxAbstractWords: 150 },
    eligibility: [
      { id: 'serra_e1', title: 'Doutorado entre 2018 e 2024', description: 'Jovens cientistas em início de carreira com perguntas ousadas.', status: 'MET', source: 'Edital Item 1' }
    ],
    documentsChecklist: [
      { id: 'serra_d1', name: 'A Grande Pergunta de Pesquisa (1 página)', required: true, status: 'DONE', source: 'Formulário Online' },
      { id: 'serra_d2', name: 'Vídeo Explicativo de 2 minutos', required: true, status: 'DONE', source: 'Submissão Vídeo' }
    ],
    evaluationCriteria: [
      { id: 'serra_c1', name: 'Ousadia e Caráter Fundamental da Pergunta', weight: 50, scoreObtained: 46, status: 'STRONG', requirementText: 'Pergunta com alto risco e potencial transformador na área.', analysis: 'Pergunta de pesquisa de grande originalidade.', suggestion: 'Enfatizar a quebra de paradigmas conceituais.' },
      { id: 'serra_c2', name: 'Capacidade do Proponente de Liderar a Investigação', weight: 50, scoreObtained: 44, status: 'STRONG', requirementText: 'Independência científica e clareza na exposição.', analysis: 'Proponente demonstra forte liderança investigativa.', suggestion: 'Sintetizar a abordagem experimental.' }
    ],
    suggestedSections: [
      { id: 's1', title: '1. A GRANDE PERGUNTA CIENTÍFICA', content: 'Formulaçao da pergunta central e seu impacto transformador.' },
      { id: 's2', title: '2. ESTADO DA ARTE E HIPÓTESE INOVADORA', content: 'Por que esta pergunta não foi respondida até hoje e qual a hipótese.' },
      { id: 's3', title: '3. ABORDAGEM METODOLÓGICA E RISCOS', content: 'Estratégia experimental audaciosa e mitigação de riscos.' },
      { id: 's4', title: '4. CRONOGRAMA E RECURSOS', content: 'Alocação de bolsas e infraestrutura necessária.' }
    ]
  },

  // --- INOVAÇÃO & TECNOLOGIA ---
  {
    id: 'notice_finep_embrapii',
    title: 'Chamada FINEP / EMBRAPII / MCTI — Inteligência Artificial e Indústria 4.0',
    agency: 'FINEP / EMBRAPII / MCTI',
    officialUrl: 'http://www.finep.gov.br/chamadas-publicas/chamadaspublicas',
    category: 'inovacao_tecnologia',
    status: 'open',
    deadline: '2026-11-28',
    type: 'Subvenção Econômica e Inovação Aberta',
    limits: { maxPages: 25, minPages: 12, maxAbstractWords: 300, maxBudget: 1500000, durationMonths: 24 },
    formattingRules: { fontFamily: 'Arial', fontSize: 11, lineSpacing: 1.5, maxPages: 25, maxAbstractWords: 300 },
    eligibility: [
      { id: 'finep_e1', title: 'Parceria Empresa-ICT Obrigatória', description: 'Cooperação entre unidade EMBRAPII credenciada e empresa parceira cofinanciadora.', status: 'MET', source: 'Regulamento Operacional' },
      { id: 'finep_e2', title: 'Nível de Maturidade Tecnológica (TRL 4 a 7)', description: 'Solução validada em laboratório com escala para ambiente operacional.', status: 'MET', source: 'Item 3.1' }
    ],
    documentsChecklist: [
      { id: 'finep_d1', name: 'Plano de Negócios e Inovação Tecnológica', required: true, status: 'DONE', source: 'Formulário FINEP' },
      { id: 'finep_d2', name: 'Acordo de Propriedade Intelectual (PI)', required: true, status: 'PENDING', source: 'Minuta Padrão' },
      { id: 'finep_d3', name: 'Comprovante de Contrapartida Financeira', required: true, status: 'DONE', source: 'Declaração da Empresa' }
    ],
    evaluationCriteria: [
      { id: 'finep_c1', name: 'Grau de Inovação e Diferenciação no Mercado', weight: 35, scoreObtained: 31, status: 'STRONG', requirementText: 'Inovação em âmbito nacional ou global frente aos concorrentes.', analysis: 'Arquitetura com diferenciais de patenteabilidade claros.', suggestion: 'Apresentar mapa de patentes correlatas.' },
      { id: 'finep_c2', name: 'Viabilidade Técnica e Maturidade TRL', weight: 35, scoreObtained: 32, status: 'STRONG', requirementText: 'Demonstração de testes em ambiente relevante (TRL 5+).', analysis: 'Provas de conceito bem documentadas.', suggestion: 'Incluir métricas de escalabilidade em nuvem.' },
      { id: 'finep_c3', name: 'Retorno Econômico e Sustentabilidade', weight: 30, scoreObtained: 25, status: 'STRONG', requirementText: 'Estimativa de faturamento, novos empregos e redução de emissões.', analysis: 'Plano de monetização coerente com a demanda de mercado.', suggestion: 'Detalhar modelo de precificação B2B.' }
    ],
    suggestedSections: [
      { id: 's1', title: '1. RESUMO EXECUTIVO DO PROJETO', content: 'Síntese da tecnologia, proposta de valor e mercado-alvo.' },
      { id: 's2', title: '2. CARACTERIZAÇÃO DA INOVAÇÃO E TRL', content: 'Descrição do avanço frente ao estado da técnica e nível TRL atual e final.' },
      { id: 's3', title: '3. PLANO DE DESENVOLVIMENTO TECNOLÓGICO', content: 'Arquitetura de software/hardware, sprints e validação piloto.' },
      { id: 's4', title: '4. GOVERNANÇA E PROPRIEDADE INTELECTUAL', content: 'Divisão de royalties, patentes e acordos de sigilo.' },
      { id: 's5', title: '5. PLANILHA ORÇAMENTÁRIA E CONTRAPARTIDA', content: 'Distribuição dos recursos FINEP, EMBRAPII e empresa parceira.' }
    ]
  },
  {
    id: 'notice_bndes_senai_softex',
    title: 'Edital BNDES / SENAI Inovação / Softex / SEBRAE / RNP — Startups Deep Tech e Conectividade',
    agency: 'BNDES / SENAI / Softex / SEBRAE / RNP',
    officialUrl: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/garantias/bndes-garagem',
    category: 'inovacao_tecnologia',
    status: 'in_progress',
    deadline: '2026-10-25',
    type: 'Aceleração e Subvenção para Startups Tecnológicas',
    limits: { maxPages: 15, minPages: 6, maxAbstractWords: 200, maxBudget: 500000, durationMonths: 18 },
    formattingRules: { fontFamily: 'Calibri', fontSize: 11, lineSpacing: 1.15, maxPages: 15, maxAbstractWords: 200 },
    eligibility: [
      { id: 'bndes_e1', title: 'Startup Formalizada com CNPJ Ativo', description: 'Empresa inovadora com faturamento anual de até R$ 4,8 milhões.', status: 'MET', source: 'Item 2.1' }
    ],
    documentsChecklist: [
      { id: 'bndes_d1', name: 'Pitch Deck Executivo e Demo de Produto', required: true, status: 'DONE', source: 'Portal Inovação' },
      { id: 'bndes_d2', name: 'Certidões Negativas Federais e Estaduais', required: true, status: 'DONE', source: 'Receita Federal' }
    ],
    evaluationCriteria: [
      { id: 'bndes_c1', name: 'Potencial de Escala e Mercado', weight: 40, scoreObtained: 35, status: 'STRONG', requirementText: 'Mercado endereçável (TAM/SAM/SOM) e modelo de tração comercial.', analysis: 'Mercado com demanda aquecida para soluções de conformidade.', suggestion: 'Explicitar custo de aquisição de cliente (CAC).' },
      { id: 'bndes_c2', name: 'Equipe e Capacidade de Execução', weight: 35, scoreObtained: 30, status: 'STRONG', requirementText: 'Complementaridade entre time técnico e de desenvolvimento de negócios.', analysis: 'Equipe multidisciplinar qualificada.', suggestion: 'Adicionar conselheiro consultivo do setor.' },
      { id: 'bndes_c3', name: 'Uso dos Recursos e Métricas de Impacto', weight: 25, scoreObtained: 23, status: 'STRONG', requirementText: 'Clareza na alocação de verbas em desenvolvimento e go-to-market.', analysis: 'Orçamento equilibrado entre produto e comercialização.', suggestion: 'Definir OKRs semestrais.' }
    ],
    suggestedSections: [
      { id: 's1', title: '1. SUMÁRIO DA STARTUP E PRODUTO', content: 'Apresentação da solução e problema de mercado solucionado.' },
      { id: 's2', title: '2. ARQUITETURA TECNOLÓGICA E DIFERENCIAIS', content: 'Estrutura técnica, segurança e integração de sistemas.' },
      { id: 's3', title: '3. MODELO DE NEGÓCIOS E GO-TO-MARKET', content: 'Canais de venda, público-alvo e projeção financeira.' },
      { id: 's4', title: '4. PLANO DE EXECUÇÃO E RECURSOS', content: 'Cronograma de lançamentos e orçamento detalhado.' }
    ]
  },

  // --- CULTURA & ARTES ---
  {
    id: 'notice_minc_cultbr',
    title: 'Edital Ministério da Cultura / CultBR / Mapa da Cultura — Fundo Nacional de Cultura e Rede das Artes',
    agency: 'Ministério da Cultura / Secretarias Estaduais e Municipais',
    officialUrl: 'https://mapas.cultura.gov.br/oportunidades/',
    category: 'cultura_artes',
    status: 'open',
    deadline: '2026-11-05',
    type: 'Fomento a Projetos Culturais, Patrimônio e Pesquisa em Artes',
    limits: { maxPages: 12, minPages: 4, maxAbstractWords: 200, maxBudget: 200000, durationMonths: 12 },
    formattingRules: { fontFamily: 'Georgia', fontSize: 12, lineSpacing: 1.5, maxPages: 12, maxAbstractWords: 200 },
    eligibility: [
      { id: 'minc_e1', title: 'Inscrição Ativa no Mapa da Cultura / Cultura Viva', description: 'Agente cultural ou coletivo com histórico comprovado de atividades culturais.', status: 'MET', source: 'Art. 5º Lei Rouanet/FNC' }
    ],
    documentsChecklist: [
      { id: 'minc_d1', name: 'Portfólio Artístico / Cultural Comprovado', required: true, status: 'DONE', source: 'Plataforma CultBR' },
      { id: 'minc_d2', name: 'Plano de Acessibilidade e Democratização de Acesso', required: true, status: 'DONE', source: 'Item 4.3' },
      { id: 'minc_d3', name: 'Carta de Anuência de Espaços Culturais Parceiros', required: true, status: 'PENDING', source: 'Item 4.5' }
    ],
    evaluationCriteria: [
      { id: 'minc_c1', name: 'Relevância Artística e Identidade Cultural', weight: 40, scoreObtained: 38, status: 'STRONG', requirementText: 'Qualidade conceitual, estética e preservação da memória cultural.', analysis: 'Projeto com excelente resgate e valorização do patrimônio imaterial.', suggestion: 'Documentar oficinas comunitárias integradas.' },
      { id: 'minc_c2', name: 'Acessibilidade e Democratização de Acesso', weight: 30, scoreObtained: 27, status: 'STRONG', requirementText: 'Medidas de gratuidade, tradução em Libras e acessibilidade física.', analysis: 'Ações de inclusão e democratização atendem integralmente ao edital.', suggestion: 'Adicionar audiodescrição nas exposições.' },
      { id: 'minc_c3', name: 'Viabilidade e Razoabilidade Orçamentária', weight: 30, scoreObtained: 28, status: 'STRONG', requirementText: 'Valores em conformidade com as tabelas de referência de cachês e serviços.', analysis: 'Custos orçamentários justos e equilibrados.', suggestion: 'Anexar orçamentos de locação de equipamentos.' }
    ],
    suggestedSections: [
      { id: 's1', title: '1. APRESENTAÇÃO E SÍNTESE DO PROJETO CULTURAL', content: 'Conceito artístico, sinopse e objetivos da iniciativa.' },
      { id: 's2', title: '2. JUSTIFICATIVA E IMPACTO SOCIAL', content: 'Relevância sociocultural e contribuição para a diversidade.' },
      { id: 's3', title: '3. PLANO DE ACESSIBILIDADE E DEMOCRATIZAÇÃO', content: 'Medidas de inclusão para pessoas com deficiência e comunidades periféricas.' },
      { id: 's4', title: '4. CRONOGRAMA DE PRODUÇÃO E CIRCULAÇÃO', content: 'Fases de pré-produção, montagem, apresentações e pós-produção.' },
      { id: 's5', title: '5. PLANILHA ORÇAMENTÁRIA DETALHADA', content: 'Cachês artísticos, produção técnica e divulgação.' }
    ]
  },

  // --- INTERNACIONAL ---
  {
    id: 'notice_horizon_erc_msca',
    title: 'Horizon Europe / ERC / MSCA Postdoctoral Fellowships 2026 — European Commission',
    agency: 'Horizon Europe / ERC / MSCA / EURAXESS',
    officialUrl: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/programmes/horizon',
    category: 'internacional',
    status: 'open',
    deadline: '2026-09-15',
    type: 'International Research Fellowship & Mobility Grant',
    limits: { maxPages: 10, minPages: 6, maxAbstractWords: 200, maxBudget: 220000, durationMonths: 24 },
    formattingRules: { fontFamily: 'Arial', fontSize: 11, lineSpacing: 1.15, maxPages: 10, maxAbstractWords: 200 },
    eligibility: [
      { id: 'msca_e1', title: 'PhD Degree Completed', description: 'Maximum of 8 years full-time equivalent research experience since PhD.', status: 'MET', source: 'Guide for Applicants' },
      { id: 'msca_e2', title: 'Mobility Rule Complied', description: 'The applicant must not have resided or carried out main activity in host country for >12 months in last 3 years.', status: 'MET', source: 'Mobility Clause 1.2' }
    ],
    documentsChecklist: [
      { id: 'msca_d1', name: 'Part B1: Scientific Proposal (Strict 10-page limit)', required: true, status: 'DONE', source: 'EU Funding Portal' },
      { id: 'msca_d2', name: 'Part B2: CV and Host Commitment Letter', required: true, status: 'DONE', source: 'EU Funding Portal' },
      { id: 'msca_d3', name: 'Ethics Self-Assessment Table', required: true, status: 'DONE', source: 'EU Funding Portal' }
    ],
    evaluationCriteria: [
      { id: 'msca_c1', name: 'Excellence (50% Weight)', weight: 50, scoreObtained: 46, status: 'STRONG', requirementText: 'Quality and novelty of research, multidisciplinary aspects and transfer of knowledge.', analysis: 'Outstanding scientific methodology combining AI and knowledge graphs.', suggestion: 'Explicitly describe two-way knowledge transfer with the host institution.' },
      { id: 'msca_c2', name: 'Impact (30% Weight)', weight: 30, scoreObtained: 27, status: 'STRONG', requirementText: 'Enhancing career prospects, dissemination, exploitation and open science practices.', analysis: 'Comprehensive plan for Open Access publications and FAIR data management.', suggestion: 'Add concrete policy brief dissemination target.' },
      { id: 'msca_c3', name: 'Quality and Efficiency of Implementation (20% Weight)', weight: 20, scoreObtained: 19, status: 'STRONG', requirementText: 'Work plan, risk management table, work packages and institutional support.', analysis: 'Work packages and Gantt chart well balanced.', suggestion: 'Include a dedicated risk mitigation table with alternative solutions.' }
    ],
    suggestedSections: [
      { id: 's1', title: '1. EXCELLENCE: RESEARCH PROPOSAL AND OBJECTIVES', content: 'State of the art, ambition, methodology and training activities.' },
      { id: 's2', title: '2. IMPACT: CAREER, DISSEMINATION AND OPEN SCIENCE', content: 'Enhancing the researcher potential and communication strategy.' },
      { id: 's3', title: '3. QUALITY AND EFFICIENCY OF THE IMPLEMENTATION', content: 'Work packages description, milestones, deliverables and risk management.' },
      { id: 's4', title: '4. BIBLIOGRAPHIC REFERENCES', content: 'APA or IEEE standard compliant references.' }
    ]
  },
  {
    id: 'notice_fulbright_daad_unesco',
    title: 'Edital de Cooperação Internacional — Fulbright / DAAD / British Council / UNESCO / OEI / CPLP / FCT',
    agency: 'DAAD / Fulbright / British Council / UNESCO / CPLP / FCT',
    officialUrl: 'https://www.daad.org.br/pt/bolsas-de-estudo/',
    category: 'internacional',
    status: 'closed',
    deadline: '2026-08-01',
    type: 'Bolsas de Doutorado-Sanduíche e Cátedras Internacionais',
    limits: { maxPages: 12, minPages: 5, maxAbstractWords: 250, maxBudget: 95000, durationMonths: 12 },
    formattingRules: { fontFamily: 'Times New Roman', fontSize: 12, lineSpacing: 1.5, maxPages: 12, maxAbstractWords: 250 },
    eligibility: [
      { id: 'daad_e1', title: 'Proficiência Linguística Comprovada (TOEFL / IELTS / OnDaF)', description: 'Certificado oficial com pontuação mínima exigida.', status: 'MET', source: 'Edital Conjunto' }
    ],
    documentsChecklist: [
      { id: 'daad_d1', name: 'Projeto de Pesquisa em Inglês ou Alemão', required: true, status: 'DONE', source: 'Portal Internacional' },
      { id: 'daad_d2', name: 'Carta de Aceite do Orientador no Exterior', required: true, status: 'DONE', source: 'Instituição Anfitriã' }
    ],
    evaluationCriteria: [
      { id: 'daad_c1', name: 'Mérito Científico e Justificativa do Estágio no Exterior', weight: 45, scoreObtained: 42, status: 'STRONG', requirementText: 'Necessidade do uso de laboratórios e acervos no exterior.', analysis: 'Justificativa irrefutável com acesso a supercomputadores anfitriões.', suggestion: 'Demonstrar impacto da parceria no retorno ao Brasil.' },
      { id: 'daad_c2', name: 'Histórico Acadêmico e Produção do Candidato', weight: 35, scoreObtained: 31, status: 'STRONG', requirementText: 'Desempenho acadêmico e artigos publicados.', analysis: 'Excelente histórico com distinções acadêmicas.', suggestion: 'Incluir prêmios prévios.' },
      { id: 'daad_c3', name: 'Plano de Trabalho e Cronograma', weight: 20, scoreObtained: 18, status: 'STRONG', requirementText: 'Exequibilidade nos 12 meses de bolsa.', analysis: 'Cronograma bem dimensionado.', suggestion: 'Detalhar período de redação final conjunta.' }
    ],
    suggestedSections: [
      { id: 's1', title: '1. PROJECT SUMMARY & OBJECTIVES', content: 'Overview of research aims and international relevance.' },
      { id: 's2', title: '2. SCIENTIFIC BACKGROUND & REASON FOR CHOOSING HOST INSTITUTION', content: 'Why the foreign laboratory is crucial to the project.' },
      { id: 's3', title: '3. DETAILED WORK PLAN & TIMELINE', content: 'Month-by-month experimental schedule.' },
      { id: 's4', title: '4. REFERENCES', content: 'International standard references.' }
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
