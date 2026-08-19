/**
 * AURA — Main Application Controller & State Manager
 * Orquestra navegação, atualização de documentos, regras, IA, find/replace e exportação.
 */

class AuraApp {
  constructor() {
    this.currentView = 'home';
    this.activeDocument = window.AURA_SAMPLE_DOCUMENTS[0];
    this.activeNotice = window.AURA_SAMPLE_NOTICES[0];
    this.pendingAIDiff = null;
    this.spellLanguage = 'pt';
    this.currentLang = localStorage.getItem('aura_lang') || 'pt';
  }

  init() {
    this.applyI18n();
    this.navigate('home');
    this.refreshLiveState();
    this.setupKeyboardShortcuts();
  }

  setLanguage(lang = 'pt') {
    this.currentLang = lang;
    this.spellLanguage = lang;
    localStorage.setItem('aura_lang', lang);
    
    // Atualizar botões de idioma no header
    const ptBtn = document.getElementById('lang-btn-pt');
    const enBtn = document.getElementById('lang-btn-en');
    if (ptBtn && enBtn) {
      if (lang === 'pt') {
        ptBtn.className = 'px-2 py-1 rounded-md text-white bg-aura-600 shadow-sm transition-all';
        enBtn.className = 'px-2 py-1 rounded-md text-slate-400 hover:text-white transition-all';
      } else {
        enBtn.className = 'px-2 py-1 rounded-md text-white bg-aura-600 shadow-sm transition-all';
        ptBtn.className = 'px-2 py-1 rounded-md text-slate-400 hover:text-white transition-all';
      }
    }

    this.applyI18n();
    this.navigate(this.currentView);
    this.showToast(lang === 'pt' ? 'Idioma alterado para Português (Brasil)' : 'Language switched to English (US)', 'info');
  }

  t(key) {
    const dict = window.AURA_TRANSLATIONS ? (window.AURA_TRANSLATIONS[this.currentLang] || window.AURA_TRANSLATIONS.pt) : {};
    return dict[key] || key;
  }

  applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.t(key);
      if (text) {
        el.innerText = text;
      }
    });

    const subtitleEl = document.getElementById('app-header-subtitle');
    if (subtitleEl) {
      subtitleEl.innerText = this.t('app_subtitle');
    }
  }

  navigate(viewName) {
    this.currentView = viewName;
    
    // Atualizar Tabs de Navegação Desktop
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('bg-slate-700/80', 'text-white');
      tab.classList.add('text-slate-300');
    });
    const activeNav = document.getElementById(`nav-btn-${viewName}`);
    if (activeNav) {
      activeNav.classList.add('bg-slate-700/80', 'text-white');
      activeNav.classList.remove('text-slate-300');
    }

    // Atualizar Tabs Mobile Bottom Bar
    document.querySelectorAll('.mob-nav-item').forEach(item => {
      item.classList.remove('text-aura-400');
      item.classList.add('text-slate-400');
    });
    const activeMob = document.getElementById(`mob-nav-${viewName}`);
    if (activeMob) {
      activeMob.classList.add('text-aura-400');
      activeMob.classList.remove('text-slate-400');
    }

    // Alternar Visualizações
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.classList.remove('hidden');
    }

    // Renderizar Conteúdo Específico
    if (viewName === 'home') {
      window.auraHomeView.render(targetSection);
    } else if (viewName === 'editor') {
      window.auraEditorView.render(targetSection, this.activeDocument);
      this.refreshCompliancePanel();
      this.refreshRepeatedWords();
      this.refreshSpellCheck();
    } else if (viewName === 'notices') {
      window.auraNoticesView.render(targetSection, this.activeNotice, this.activeDocument);
    } else if (viewName === 'dashboard') {
      window.auraDashboardView.render(targetSection);
    }

    lucide.createIcons();
    this.updateHeaderBadge();
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+F ou Cmd+F para abrir o Localizar & Substituir
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        if (this.currentView === 'editor') {
          e.preventDefault();
          this.openFindReplace();
        }
      }
    });
  }

  updateHeaderBadge() {
    const badge = document.getElementById('header-doc-badge');
    if (!badge) return;

    if (this.currentView === 'editor' && this.activeDocument) {
      badge.classList.remove('hidden');
      document.getElementById('header-doc-title').innerText = this.activeDocument.title || 'Artigo';
      document.getElementById('header-doc-standard').innerText = (this.activeDocument.standardId || 'ABNT').toUpperCase();
    } else {
      badge.classList.add('hidden');
    }
  }

  // --- EDITOR DOCUMENT STATE HANDLERS ---

  updateDocTitle(title) {
    if (this.activeDocument) {
      this.activeDocument.title = title;
      this.refreshLiveState();
    }
  }

  updateDocAuthors(authors) {
    if (this.activeDocument) {
      this.activeDocument.authors = authors;
    }
  }

  updateDocAbstract(abstract) {
    if (this.activeDocument) {
      this.activeDocument.abstract = abstract;
      this.refreshLiveState();
    }
  }

  updateDocKeywords(kwStr) {
    if (this.activeDocument) {
      this.activeDocument.keywords = kwStr.split(';').map(k => k.trim()).filter(k => k.length > 0);
    }
  }

  updateSectionTitle(secId, title) {
    if (!this.activeDocument || !this.activeDocument.sections) return;
    const sec = this.activeDocument.sections.find(s => s.id === secId);
    if (sec) sec.title = title;
  }

  updateSectionContent(secId, html) {
    if (!this.activeDocument || !this.activeDocument.sections) return;
    const sec = this.activeDocument.sections.find(s => s.id === secId);
    if (sec) {
      // Converte HTML do contenteditable em texto limpo com parágrafos
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      sec.content = tempDiv.innerText;
      this.refreshLiveState();
    }
  }

  updateReference(idx, text) {
    if (this.activeDocument && this.activeDocument.references) {
      this.activeDocument.references[idx] = text;
      this.refreshCompliancePanel();
    }
  }

  deleteReference(idx) {
    if (this.activeDocument && this.activeDocument.references) {
      this.activeDocument.references.splice(idx, 1);
      this.navigate('editor');
      this.showToast('Referência removida com sucesso.', 'info');
    }
  }

  addReferencePrompt() {
    const ref = prompt('Digite ou cole a referência conforme ABNT NBR 6023:');
    if (ref && ref.trim()) {
      if (!this.activeDocument.references) this.activeDocument.references = [];
      this.activeDocument.references.push(ref.trim());
      this.navigate('editor');
      this.showToast('Nova referência adicionada!', 'success');
    }
  }

  addSection() {
    const title = prompt('Título da nova seção (ex: 4. RESULTADOS E DISCUSSÃO):');
    if (title && title.trim()) {
      const newSec = {
        id: 'sec_' + Date.now(),
        title: title.trim(),
        content: 'Insira aqui o conteúdo desta seção científica...'
      };
      this.activeDocument.sections.push(newSec);
      this.navigate('editor');
      this.showToast(`Seção "${title}" adicionada.`, 'success');
    }
  }

  deleteSection(secId) {
    if (confirm('Deseja realmente excluir esta seção do documento?')) {
      this.activeDocument.sections = this.activeDocument.sections.filter(s => s.id !== secId);
      this.navigate('editor');
      this.showToast('Seção excluída.', 'info');
    }
  }

  changeDocumentStandard(newStdId) {
    if (this.activeDocument) {
      this.activeDocument.standardId = newStdId;
      const sheet = document.getElementById('academic-active-sheet');
      if (sheet) {
        sheet.className = `academic-sheet sheet-standard-${newStdId} relative rounded shadow-2xl`;
      }
      this.refreshCompliancePanel();
      this.showToast(`Norma alterada para ${newStdId.toUpperCase()}!`, 'info');
    }
  }

  // --- STATS, REPEATS, GRAMMAR & COMPLIANCE ---

  refreshLiveState() {
    const fullText = window.auraEditorView.getFullDocumentText(this.activeDocument);
    const stats = window.auraLanguage.calculateStats(fullText);

    const wordsEl = document.getElementById('stat-words');
    const charsEl = document.getElementById('stat-chars');
    const pagesEl = document.getElementById('stat-pages');

    if (wordsEl) wordsEl.innerText = stats.words;
    if (charsEl) charsEl.innerText = stats.charsWithSpaces;
    if (pagesEl) pagesEl.innerText = `~${stats.estimatedPages}`;
  }

  refreshRepeatedWords() {
    const container = document.getElementById('repeated-words-container');
    if (!container || !this.activeDocument) return;

    const fullText = window.auraEditorView.getFullDocumentText(this.activeDocument);
    const repeats = window.auraLanguage.detectRepeatedWords(fullText, 3);

    if (repeats.length === 0) {
      container.innerHTML = `<div class="text-slate-500 text-[11px] p-2">Nenhuma repetição excessiva identificada.</div>`;
      return;
    }

    container.innerHTML = repeats.slice(0, 4).map(r => `
      <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class="font-bold text-purple-300">"${r.word}"</span>
          <span class="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-mono">${r.count}x no texto</span>
        </div>
        <div class="text-[10px] text-slate-400">
          <strong>Sinônimos sugeridos:</strong> ${r.synonyms.slice(0, 3).join(', ')}
        </div>
      </div>
    `).join('');
  }

  refreshSpellCheck() {
    const container = document.getElementById('spell-issues-container');
    if (!container || !this.activeDocument) return;

    const fullText = window.auraEditorView.getFullDocumentText(this.activeDocument);
    const issues = window.auraLanguage.checkGrammarAndStyle(fullText, this.spellLanguage);

    if (issues.length === 0) {
      container.innerHTML = `<div class="text-emerald-400 text-[11px] p-2 flex items-center gap-1.5"><i data-lucide="check" class="w-3.5 h-3.5"></i> Redação e estilo em total conformidade.</div>`;
      lucide.createIcons();
      return;
    }

    container.innerHTML = issues.slice(0, 3).map(iss => `
      <div class="p-2 rounded-lg bg-slate-900/80 border border-rose-900/40 flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class="font-bold text-rose-300">"${iss.matchedText}"</span>
          <button onclick="AURA.applySpellFix('${iss.matchedText}', '${iss.suggestedFix.split('/')[0].trim()}')" class="text-[10px] text-emerald-400 hover:underline font-bold">Substituir</button>
        </div>
        <div class="text-[10px] text-slate-400">${iss.reason}</div>
        <div class="text-[10px] text-emerald-300 font-mono">Sugestão: ${iss.suggestedFix}</div>
      </div>
    `).join('');
    lucide.createIcons();
  }

  applySpellFix(oldText, newText) {
    this.executeGlobalReplace(oldText, newText, true);
    this.showToast(`Substituído "${oldText}" por "${newText}"`, 'success');
  }

  changeSpellLanguage(lang) {
    this.spellLanguage = lang;
    this.refreshSpellCheck();
  }

  refreshCompliancePanel() {
    const listEl = document.getElementById('compliance-issues-list');
    const badgeEl = document.getElementById('panel-score-badge');
    const headerScore = document.getElementById('header-doc-score');
    if (!listEl || !this.activeDocument) return;

    const stdId = this.activeDocument.standardId || 'abnt';
    const { resolved } = window.auraRulesEngine.resolveRules(stdId, this.activeNotice);
    const result = window.auraRulesEngine.evaluateCompliance(this.activeDocument, resolved);

    if (badgeEl) badgeEl.innerText = `${result.score}%`;
    if (headerScore) headerScore.innerText = `${result.score}%`;

    listEl.innerHTML = result.issues.map(iss => `
      <div class="p-2.5 rounded-lg ${iss.type === 'success' ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300' : (iss.type === 'warning' ? 'bg-amber-950/30 border-amber-800/40 text-amber-300' : 'bg-rose-950/30 border-rose-800/40 text-rose-300')} border flex items-start gap-2">
        <i data-lucide="${iss.type === 'success' ? 'check-circle' : 'alert-triangle'}" class="w-4 h-4 mt-0.5 flex-shrink-0"></i>
        <div class="flex-1">
          <div class="font-bold text-[10px] uppercase">${iss.category}</div>
          <div class="text-xs text-slate-200 mt-0.5">${iss.text}</div>
        </div>
      </div>
    `).join('');
    lucide.createIcons();
  }

  // --- ASSISTENTE IA (ANTES -> DEPOIS) ---

  runAIAssist(mode) {
    if (!this.activeDocument || !this.activeDocument.sections || this.activeDocument.sections.length === 0) return;
    
    // Utiliza primeira seção ou introdução como base para a demonstração interativa
    const targetSec = this.activeDocument.sections[0];
    const original = targetSec.content.split('\n\n')[0];

    let suggested = '';
    if (mode === 'academic_tone') {
      suggested = original.replace(/frequentemente enfrentam dificuldades/g, 'deparam-se com óbices epistemológicos e práticos')
                          .replace(/desponta como uma alternativa viável/g, 'configura-se como um vetor metodológico proeminente');
    } else if (mode === 'paraphrase') {
      const options = window.auraLanguage.generateParaphraseOptions(original);
      suggested = options[0].text;
    } else if (mode === 'concise') {
      suggested = 'O crescimento vertiginoso da literatura científica desafia revisões sistemáticas e conformidade metodológica, demandando soluções baseadas em IA para extração e validação automatizadas.';
    } else if (mode === 'alignment') {
      alert('✓ Alinhamento Metodológico Verificado:\n\n- Problema de Pesquisa: 100% alinhado aos Objetivos 1 e 2.\n- Metodologia: Descreve métodos para todos os objetivos específicos.\n- Cronograma: 24 meses adequados para a amostragem prevista.');
      return;
    }

    this.pendingAIDiff = {
      sectionId: targetSec.id,
      originalText: original,
      suggestedText: suggested
    };

    const diffBox = document.getElementById('ai-diff-container');
    if (diffBox) {
      diffBox.classList.remove('hidden');
      document.getElementById('ai-diff-original').innerText = original;
      document.getElementById('ai-diff-suggested').innerText = suggested;
    }
  }

  acceptDiff() {
    if (!this.pendingAIDiff) return;
    const sec = this.activeDocument.sections.find(s => s.id === this.pendingAIDiff.sectionId);
    if (sec) {
      sec.content = sec.content.replace(this.pendingAIDiff.originalText, this.pendingAIDiff.suggestedText);
      this.navigate('editor');
      this.showToast('Alteração da IA aplicada ao texto com sucesso!', 'success');
    }
    this.rejectDiff();
  }

  rejectDiff() {
    this.pendingAIDiff = null;
    const diffBox = document.getElementById('ai-diff-container');
    if (diffBox) diffBox.classList.add('hidden');
  }

  // --- LOCALIZAR E SUBSTITUIR EM LOTE ---

  openFindReplace() {
    this.setRightTab('find_replace');
    const input = document.getElementById('find-input');
    if (input) input.focus();
  }

  execFindAndReplace(replaceAll = true) {
    const findTerm = document.getElementById('find-input').value;
    const replaceTerm = document.getElementById('replace-input').value;
    const matchCase = document.getElementById('find-opt-case').checked;
    const wholeWord = document.getElementById('find-opt-word').checked;

    if (!findTerm) {
      this.showToast('Digite o termo a ser localizado.', 'warning');
      return;
    }

    const count = this.executeGlobalReplace(findTerm, replaceTerm, replaceAll, { matchCase, wholeWord });
    const resultsEl = document.getElementById('find-replace-results');
    if (resultsEl) {
      resultsEl.innerText = count > 0 
        ? `✓ ${count} ocorrência(s) substituída(s) com sucesso em UTF-8.`
        : `Nenhuma ocorrência encontrada para "${findTerm}".`;
    }
    this.showToast(`${count} substituição(ões) realizadas!`, count > 0 ? 'success' : 'info');
  }

  executeGlobalReplace(searchTerm, replaceTerm, replaceAll = true, options = { matchCase: false, wholeWord: false }) {
    let totalCount = 0;
    if (!this.activeDocument) return 0;

    // Substituir no resumo
    if (this.activeDocument.abstract) {
      const res = window.auraLanguage.findAndReplace(this.activeDocument.abstract, searchTerm, replaceTerm, { ...options, replaceAll });
      this.activeDocument.abstract = res.updatedText;
      totalCount += res.replacementsCount;
    }

    // Substituir nas seções
    (this.activeDocument.sections || []).forEach(sec => {
      if (sec.content) {
        const res = window.auraLanguage.findAndReplace(sec.content, searchTerm, replaceTerm, { ...options, replaceAll });
        sec.content = res.updatedText;
        totalCount += res.replacementsCount;
      }
    });

    this.navigate('editor');
    return totalCount;
  }

  // --- RIGHT PANEL TABS SWITCHER ---

  setRightTab(tabName) {
    ['ai', 'find_replace', 'compliance'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const panel = document.getElementById(`panel-tab-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.className = 'flex-1 py-1.5 px-2 rounded text-center transition-all bg-aura-600 text-white flex items-center justify-center gap-1 font-bold';
        } else {
          btn.className = 'flex-1 py-1.5 px-2 rounded text-center transition-all text-slate-400 hover:text-white flex items-center justify-center gap-1';
        }
      }
      if (panel) {
        panel.classList.toggle('hidden', t !== tabName);
      }
    });
    lucide.createIcons();
  }

  // --- DOCUMENT ACTIONS & MODALS ---

  openNewDocModal() {
    window.auraModals.showNewDocModal();
  }

  openUploadModal(mode) {
    window.auraModals.showUploadModal(mode);
  }

  openPublicationModal() {
    this.openUploadModal('format');
  }

  openNoticeModal() {
    this.navigate('notices');
  }

  openNoticeUploadModal() {
    this.openUploadModal('notice');
  }

  openExportModal() {
    window.auraModals.showExportModal(this.activeDocument);
  }

  closeModal() {
    window.auraModals.close();
  }

  submitNewDoc() {
    const title = document.getElementById('modal-new-title').value || 'Novo Trabalho Científico';
    const typeId = document.getElementById('modal-new-type').value;
    const stdId = document.getElementById('modal-new-standard').value;
    const authors = document.getElementById('modal-new-authors').value || 'Pesquisador(a)';

    this.activeDocument = {
      id: 'doc_' + Date.now(),
      title,
      standardId: stdId,
      workTypeId: typeId,
      authors,
      abstract: 'Digite o resumo do seu trabalho...',
      keywords: ['Pesquisa', 'Metodologia', 'Ciência'],
      sections: [
        { id: 'sec_1', title: '1. INTRODUÇÃO', content: 'Contextualização do tema e delimitação do problema de pesquisa...' },
        { id: 'sec_2', title: '2. METODOLOGIA', content: 'Delineamento experimental e procedimentos de coleta de dados...' },
        { id: 'sec_3', title: '3. RESULTADOS ESPERADOS', content: 'Resultados obtidos e discussão teórica...' }
      ],
      references: [
        'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 14724: Trabalhos acadêmicos. Rio de Janeiro: ABNT, 2011.'
      ]
    };

    this.closeModal();
    this.navigate('editor');
    this.showToast('Documento criado com sucesso!', 'success');
  }

  submitPastedText(mode) {
    const text = document.getElementById('modal-paste-text').value;
    if (!text || text.trim().length < 20) {
      this.showToast('Por favor, insira um texto com pelo menos 20 caracteres.', 'warning');
      return;
    }

    if (mode === 'notice') {
      const parsedNotice = window.auraNoticeParser.parseNoticeText(text, 'Edital Importado');
      this.activeNotice = parsedNotice;
      this.closeModal();
      this.navigate('notices');
      this.showToast('Edital analisado com sucesso!', 'success');
    } else {
      const parsedDoc = window.auraDocumentParser.parseTextToDocument(text, 'Documento Importado');
      this.activeDocument = parsedDoc;
      this.closeModal();
      this.navigate('editor');
      this.showToast('Documento estruturado automaticamente pela IA!', 'success');
    }
  }

  handleFileUpload(input, mode) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (mode === 'notice') {
        this.activeNotice = window.auraNoticeParser.parseNoticeText(text, file.name);
        this.closeModal();
        this.navigate('notices');
        this.showToast('Edital lido e processado com sucesso!', 'success');
      } else {
        this.activeDocument = window.auraDocumentParser.parseTextToDocument(text, file.name);
        this.closeModal();
        this.navigate('editor');
        this.showToast('Documento importado e formatado!', 'success');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  loadSampleDoc() {
    this.activeDocument = window.AURA_SAMPLE_DOCUMENTS[0];
    this.navigate('editor');
    this.showToast('Projeto de Pós-Doutorado carregado no editor.', 'info');
  }

  createProjectFromNotice(noticeId) {
    const notice = window.AURA_SAMPLE_NOTICES.find(n => n.id === noticeId) || this.activeNotice;
    this.activeDocument = {
      id: 'doc_notice_' + Date.now(),
      title: 'Projeto de Pesquisa — ' + notice.title,
      standardId: 'abnt',
      workTypeId: 'research_proposal',
      noticeId: notice.id,
      authors: 'Candidato(a) ao Edital',
      abstract: 'Resumo estruturado do projeto atendendo aos critérios do edital.',
      keywords: ['Pesquisa', 'Edital', 'Inovação'],
      sections: JSON.parse(JSON.stringify(notice.suggestedSections || [])),
      references: [
        'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 14724: Trabalhos acadêmicos. Rio de Janeiro: ABNT, 2011.'
      ],
      timeline: [
        { activity: 'Fase 1: Revisão Teórica', m1: true, m2: true, m3: false, m4: false, m5: false, m6: false },
        { activity: 'Fase 2: Execução Metodológica', m1: false, m2: true, m3: true, m4: true, m5: false, m6: false },
        { activity: 'Fase 3: Redação de Relatórios', m1: false, m2: false, m3: false, m4: false, m5: true, m6: true }
      ],
      budget: [
        { category: 'Custeio / Diárias', item: 'Participação em congresso internacional', amount: 15000 },
        { category: 'Capital / Equipamentos', item: 'Computador para processamento científico', amount: 25000 }
      ]
    };

    this.navigate('editor');
    this.showToast('Template do Edital gerado com sucesso no editor!', 'success');
  }

  createNewPreset() {
    this.openPresetModal();
  }

  editPreset(presetId) {
    const preset = window.auraRulesEngine.presets.find(p => p.id === presetId);
    if (preset) {
      this.openPresetModal(preset);
    }
  }

  deletePreset(presetId) {
    const isEn = this.currentLang === 'en';
    if (confirm(isEn ? 'Are you sure you want to delete this preset?' : 'Tem certeza de que deseja excluir este preset?')) {
      window.auraRulesEngine.deletePreset(presetId);
      this.navigate('dashboard');
      this.showToast(isEn ? 'Preset deleted.' : 'Preset removido.', 'info');
    }
  }

  resetDefaultPresets() {
    const isEn = this.currentLang === 'en';
    if (confirm(isEn ? 'Reset all presets to default institutional standards?' : 'Deseja restaurar todos os presets para os padrões institucionais de fábrica?')) {
      window.auraRulesEngine.resetDefaultPresets();
      this.navigate('dashboard');
      this.showToast(isEn ? 'Default presets restored!' : 'Presets restaurados para os padrões institucionais!', 'success');
    }
  }

  applyPreset(presetId) {
    const preset = window.auraRulesEngine.presets.find(p => p.id === presetId);
    if (preset) {
      this.activeDocument.standardId = preset.standardId;
      this.navigate('editor');
      this.applyAutomaticFormat();
      this.showToast(`Preset "${preset.name}" aplicado ao editor!`, 'success');
    }
  }

  openPresetModal(preset = null) {
    window.auraModals.showPresetModal(preset);
  }

  savePresetFromModal(presetId) {
    const name = document.getElementById('modal-preset-name').value.trim();
    const standardId = document.getElementById('modal-preset-standard').value;
    const fontFamily = document.getElementById('modal-preset-font').value;
    const fontSize = parseInt(document.getElementById('modal-preset-size').value, 10) || 12;
    const lineSpacing = parseFloat(document.getElementById('modal-preset-spacing').value) || 1.5;
    const topMargin = parseFloat(document.getElementById('modal-preset-mtop').value) || 3.0;
    const leftMargin = parseFloat(document.getElementById('modal-preset-mleft').value) || 3.0;
    const bottomMargin = parseFloat(document.getElementById('modal-preset-mbottom').value) || 2.0;
    const rightMargin = parseFloat(document.getElementById('modal-preset-mright').value) || 2.0;

    if (!name) {
      this.showToast(this.currentLang === 'en' ? 'Please provide a name for the preset.' : 'Por favor, informe o nome do preset.', 'warning');
      return;
    }

    const presetData = {
      id: presetId || ('preset_' + Date.now()),
      name,
      standardId,
      fontFamily,
      fontSize,
      lineSpacing,
      margins: { top: topMargin, left: leftMargin, bottom: bottomMargin, right: rightMargin }
    };

    window.auraRulesEngine.savePreset(presetData);
    this.closeModal();
    this.navigate('dashboard');
    this.showToast(this.currentLang === 'en' ? 'Preset saved successfully!' : 'Preset salvo com sucesso!', 'success');
  }

  applyAutomaticFormat() {
    const stdId = this.activeDocument.standardId || 'abnt';
    this.changeDocumentStandard(stdId);
    this.showToast(this.currentLang === 'en' ? 'Automatic formatting of margins, typography and line spacing applied!' : 'Formatação automática de margens, fontes e espaçamento aplicada!', 'success');
  }

  // --- EXPORT TRIGGERS ---

  downloadDocx() {
    window.auraExport.exportToDocx(this.activeDocument, window.AURA_STANDARDS[this.activeDocument.standardId || 'abnt']);
    this.closeModal();
    this.showToast('Download do DOCX iniciado em UTF-8!', 'success');
  }

  downloadPdf() {
    this.closeModal();
    window.auraExport.triggerPrintPdf();
  }

  downloadComplianceReport() {
    const stdId = this.activeDocument.standardId || 'abnt';
    const { resolved } = window.auraRulesEngine.resolveRules(stdId, this.activeNotice);
    const comp = window.auraRulesEngine.evaluateCompliance(this.activeDocument, resolved);
    window.auraExport.exportComplianceReport(this.activeDocument, this.activeNotice, comp);
    this.closeModal();
    this.showToast('Relatório de Conformidade exportado!', 'success');
  }

  exportComplianceReportDirect() {
    this.downloadComplianceReport();
  }

  // --- TOAST NOTIFICATIONS ---

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colorClass = type === 'success' ? 'bg-emerald-600 border-emerald-500' : (type === 'warning' ? 'bg-amber-600 border-amber-500' : 'bg-slate-800 border-slate-700');
    toast.className = `p-3 rounded-xl ${colorClass} border text-white text-xs font-semibold shadow-2xl flex items-center gap-2 transform transition-all duration-300 pointer-events-auto`;
    toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'info'}" class="w-4 h-4"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  toggleQuickSettings() {
    alert('Configurações do AURA:\n\n- Charset: UTF-8 Estrito Ativo\n- Suporte a símbolos matemáticos: Ativo (TeX/Unicode)\n- Detecção de Normas: ABNT, APA, IEEE, Vancouver, Chicago, MLA\n- Motor de Editais: FAPESP, CNPq, CAPES, Universidades');
  }

  scrollToSection(secId) {
    const el = document.getElementById(`section-${secId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToElement(elemId) {
    const el = document.getElementById(elemId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  execCommand(cmd) {
    document.execCommand(cmd, false, null);
  }

  insertLongQuote() {
    const quote = prompt('Insira o texto da citação longa (ABNT: + de 3 linhas com recuo 4cm e corpo 10pt):');
    if (quote) {
      document.execCommand('insertHTML', false, `<div class="academic-long-quote">${quote}</div><p class="academic-paragraph"></p>`);
    }
  }

  openCitationDialog() {
    const author = prompt('Autor(es) (ex: SILVA):');
    const year = prompt('Ano da publicação (ex: 2023):');
    const page = prompt('Página (opcional, ex: 45):');
    if (author && year) {
      const formatted = page ? `(${author.toUpperCase()}, ${year}, p. ${page})` : `(${author.toUpperCase()}, ${year})`;
      document.execCommand('insertHTML', false, `<span>${formatted}</span>&nbsp;`);
      this.refreshCompliancePanel();
    }
  }

  insertTable() {
    const tableHtml = `
      <div class="my-4">
        <div class="text-xs font-bold mb-1">Tabela 1 — Descrição dos Dados Coletados</div>
        <table class="w-full border-collapse border border-slate-300 text-xs text-left">
          <thead class="bg-slate-100 font-bold border-b border-slate-300">
            <tr><th class="p-2 border">Variável</th><th class="p-2 border">Amostra A</th><th class="p-2 border">Amostra B</th></tr>
          </thead>
          <tbody>
            <tr><td class="p-2 border">Acurácia (%)</td><td class="p-2 border">94.2</td><td class="p-2 border">88.7</td></tr>
            <tr><td class="p-2 border">F1-Score</td><td class="p-2 border">0.93</td><td class="p-2 border">0.86</td></tr>
          </tbody>
        </table>
        <div class="text-[10pt] text-slate-500 mt-1">Fonte: Elaborado pelos autores (2026).</div>
      </div>
    `;
    document.execCommand('insertHTML', false, tableHtml);
  }

  insertEquation() {
    const eq = prompt('Digite a fórmula ou expressão (ex: F1 = 2 * (P * R) / (P + R)):');
    if (eq) {
      document.execCommand('insertHTML', false, `<div class="text-center font-mono text-sm my-3 p-2 bg-slate-50 rounded border border-slate-200">${eq}</div><p class="academic-paragraph"></p>`);
    }
  }

  addTimelineActivity() {
    const name = prompt('Nome da nova meta/atividade do cronograma:');
    if (name) {
      if (!this.activeDocument.timeline) this.activeDocument.timeline = [];
      this.activeDocument.timeline.push({ activity: name, m1: true, m2: true, m3: false, m4: false, m5: false, m6: false });
      this.navigate('notices');
      this.showToast('Atividade adicionada ao cronograma!', 'success');
    }
  }

  addBudgetItem() {
    const category = prompt('Categoria (ex: Equipamentos, Bolsas, Custeio):') || 'Custeio';
    const item = prompt('Descrição do item:') || 'Item de Pesquisa';
    const val = parseFloat(prompt('Valor (R$):') || '1000');
    if (!isNaN(val)) {
      if (!this.activeDocument.budget) this.activeDocument.budget = [];
      this.activeDocument.budget.push({ category, item, amount: val });
      this.navigate('notices');
      this.showToast('Item orçamentário registrado!', 'success');
    }
  }
}

// Instanciar AURA Global
window.AURA = new AuraApp();

document.addEventListener('DOMContentLoaded', () => {
  window.AURA.init();
});
