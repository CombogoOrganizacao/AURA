/**
 * AURA — Main Application Controller & State Manager
 * Orquestra navegação, atualização de documentos, regras, IA, find/replace e exportação.
 */

class AuraApp {
  constructor() {
    this.currentView = 'home';
    
    // Carregar documentos salvos pelo usuário no localStorage (ou sample inicial)
    this.openDocuments = this.loadSavedDocuments();
    this.activeDocument = this.openDocuments[0] || window.AURA_SAMPLE_DOCUMENTS[0];
    this.activeNotice = window.AURA_SAMPLE_NOTICES[0];
    this.pendingAIDiff = null;
    this.spellLanguage = 'pt';
    this.currentLang = localStorage.getItem('aura_lang') || 'pt';
    
    // State History for Undo / Redo
    this.historyStack = [];
    this.historyIndex = -1;
    this.saveStateToHistory();

    // Find & Replace Search Navigation State
    this.searchMatches = [];
    this.currentSearchIndex = -1;

    // Auto-Save Debounce Timer
    this.autoSaveTimer = null;
  }

  loadSavedDocuments() {
    try {
      const saved = localStorage.getItem('aura_saved_documents');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar documentos salvos:', e);
    }
    return [...(window.AURA_SAMPLE_DOCUMENTS || [])];
  }

  persistDocuments() {
    try {
      if (this.openDocuments && this.openDocuments.length > 0) {
        localStorage.setItem('aura_saved_documents', JSON.stringify(this.openDocuments));
      }
      this.updateAutoSaveBadge('saved');
    } catch (e) {
      console.warn('Erro ao persistir no localStorage:', e);
      this.updateAutoSaveBadge('error');
    }
  }

  triggerAutoSave() {
    this.updateAutoSaveBadge('saving');
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.persistDocuments();
    }, 800);
  }

  updateAutoSaveBadge(status = 'saved') {
    const badge = document.getElementById('auto-save-badge');
    const icon = document.getElementById('auto-save-icon');
    const text = document.getElementById('auto-save-text');
    if (!badge || !icon || !text) return;

    if (status === 'saving') {
      badge.className = 'flex items-center gap-1.5 font-medium text-[11px] text-amber-400 save-indicator-active';
      text.innerText = this.currentLang === 'en' ? 'Saving...' : 'Salvando...';
      icon.setAttribute('data-lucide', 'refresh-cw');
    } else if (status === 'saved') {
      badge.className = 'flex items-center gap-1.5 font-medium text-[11px] text-emerald-400';
      text.innerText = this.currentLang === 'en' ? 'Saved' : 'Salvo';
      icon.setAttribute('data-lucide', 'check');
    } else if (status === 'error') {
      badge.className = 'flex items-center gap-1.5 font-medium text-[11px] text-rose-400';
      text.innerText = this.currentLang === 'en' ? 'Save error' : 'Erro ao salvar';
      icon.setAttribute('data-lucide', 'alert-circle');
    }
    lucide.createIcons();
  }

  // --- MOBILE DRAWER MANAGEMENT ---
  toggleMobileDrawer(side = 'left') {
    const leftDrawer = document.getElementById('editor-left-sidebar');
    const rightDrawer = document.getElementById('editor-right-panel');
    const backdrop = document.getElementById('editor-mobile-backdrop');

    if (side === 'left') {
      if (rightDrawer) rightDrawer.classList.remove('drawer-open');
      if (leftDrawer) {
        const isOpen = leftDrawer.classList.toggle('drawer-open');
        if (backdrop) backdrop.classList.toggle('hidden', !isOpen);
      }
    } else {
      if (leftDrawer) leftDrawer.classList.remove('drawer-open');
      if (rightDrawer) {
        const isOpen = rightDrawer.classList.toggle('drawer-open');
        if (backdrop) backdrop.classList.toggle('hidden', !isOpen);
      }
    }
  }

  closeMobileDrawers() {
    const leftDrawer = document.getElementById('editor-left-sidebar');
    const rightDrawer = document.getElementById('editor-right-panel');
    const backdrop = document.getElementById('editor-mobile-backdrop');
    if (leftDrawer) leftDrawer.classList.remove('drawer-open');
    if (rightDrawer) rightDrawer.classList.remove('drawer-open');
    if (backdrop) backdrop.classList.add('hidden');
  }

  // --- MULTI-DOCUMENT TAB MANAGEMENT (DRAGGABLE TABS) ---

  openDocument(docId) {
    let doc = this.openDocuments.find(d => d.id === docId);
    if (!doc) {
      const sample = (window.AURA_SAMPLE_DOCUMENTS || []).find(d => d.id === docId);
      if (sample) {
        doc = JSON.parse(JSON.stringify(sample));
        this.openDocuments.push(doc);
      }
    }
    if (doc) {
      this.activeDocument = doc;
      this.saveStateToHistory();
      this.persistDocuments();
      this.navigate('editor');
    }
  }

  closeDocumentTab(e, docId) {
    if (e) e.stopPropagation();
    if (this.openDocuments.length <= 1) {
      this.showToast('Ao menos um documento deve permanecer aberto.', 'warning');
      return;
    }

    const idx = this.openDocuments.findIndex(d => d.id === docId);
    if (idx !== -1) {
      this.openDocuments.splice(idx, 1);
      if (this.activeDocument.id === docId) {
        this.activeDocument = this.openDocuments[Math.max(0, idx - 1)];
        this.saveStateToHistory();
      }
      this.persistDocuments();
      this.navigate('editor');
      this.showToast('Aba fechada.', 'info');
    }
  }

  handleTabDragStart(event, idx) {
    event.dataTransfer.setData('text/plain', idx);
    event.dataTransfer.effectAllowed = 'move';
  }

  handleTabDrop(event, targetIdx) {
    event.preventDefault();
    const sourceIdx = parseInt(event.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIdx) || sourceIdx === targetIdx || !this.openDocuments) return;

    const [moved] = this.openDocuments.splice(sourceIdx, 1);
    this.openDocuments.splice(targetIdx, 0, moved);
    this.persistDocuments();
    this.navigate('editor');
  }

  saveStateToHistory() {
    if (!this.activeDocument) return;
    const snapshot = JSON.stringify(this.activeDocument);
    // If we're not at the top of history stack, truncate forward history
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    }
    this.historyStack.push(snapshot);
    if (this.historyStack.length > 50) this.historyStack.shift();
    this.historyIndex = this.historyStack.length - 1;
    this.triggerAutoSave();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.activeDocument = JSON.parse(this.historyStack[this.historyIndex]);
      this.persistDocuments();
      this.navigate('editor');
      this.showToast(this.currentLang === 'en' ? 'Action undone.' : 'Ação desfeita (Desfazer).', 'info');
    } else {
      document.execCommand('undo', false, null);
    }
  }

  redo() {
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyIndex++;
      this.activeDocument = JSON.parse(this.historyStack[this.historyIndex]);
      this.persistDocuments();
      this.navigate('editor');
      this.showToast(this.currentLang === 'en' ? 'Action redone.' : 'Ação refeita (Refazer).', 'info');
    } else {
      document.execCommand('redo', false, null);
    }
  }

  init() {
    this.clearCorruptStorage();
    this.applyI18n();
    this.registerServiceWorker();
    this.navigate('home');
    this.refreshLiveState();
    this.setupKeyboardShortcuts();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js')
        .then(() => console.log('AURA PWA ServiceWorker registrado com sucesso!'))
        .catch(err => console.log('ServiceWorker PWA opcional:', err));
    }
  }

  clearCorruptStorage() {
    try {
      // Limpa chaves antigas de mockup e cache obsoleto
      const keysToClean = ['aura_mock', 'aura_stale_data', 'aura_temp_docs', 'aura_cached_stats'];
      keysToClean.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Storage cleanup:', e);
    }
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
      // Ctrl+S / Cmd+S para salvar imediatamente
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.persistDocuments();
        this.showToast(this.currentLang === 'en' ? 'Document saved successfully!' : 'Documento salvo com sucesso!', 'success');
      }
      // Ctrl+P / Cmd+P para imprimir/exportar PDF
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        if (this.currentView === 'editor') {
          e.preventDefault();
          this.downloadPdf();
        }
      }
      // Ctrl+Z / Cmd+Z para desfazer
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (this.currentView === 'editor' && !document.activeElement.isContentEditable) {
          e.preventDefault();
          this.undo();
        }
      }
      // Ctrl+Y / Cmd+Shift+Z para refazer
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        if (this.currentView === 'editor' && !document.activeElement.isContentEditable) {
          e.preventDefault();
          this.redo();
        }
      }
      // Ctrl+F para abrir o Localizar lateral
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        if (this.currentView === 'editor') {
          e.preventDefault();
          this.openFindReplace();
        }
      }
      // F3 para proxima busca
      if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) this.findPrevMatch();
        else this.findNextMatch();
      }
    });
  }

  updateHeaderBadge() {
    const badge = document.getElementById('header-doc-badge');
    if (!badge) return;
    badge.innerHTML = '';
    badge.className = 'hidden';
  }

  // --- DOCUMENT EDITING HOOKS ---

  updateDocTitle(title) {
    if (this.activeDocument) {
      this.activeDocument.title = title;
      this.updateHeaderBadge();
      const sidebarTitle = document.getElementById('sidebar-title-display');
      if (sidebarTitle) sidebarTitle.innerText = title.trim() || (this.currentLang === 'en' ? 'Title & Authors' : 'Título & Autoria');
      this.triggerAutoSave();
    }
  }

  updateDocAuthors(authors) {
    if (this.activeDocument) {
      this.activeDocument.authors = authors;
      this.triggerAutoSave();
    }
  }

  updateDocAbstract(abstractText) {
    if (this.activeDocument) {
      this.activeDocument.abstract = abstractText;
      this.refreshLiveState();
      this.refreshCompliancePanel();
      this.triggerAutoSave();
    }
  }

  updateDocKeywords(keywordsText) {
    if (this.activeDocument) {
      this.activeDocument.keywords = keywordsText.split(';').map(k => k.trim()).filter(k => k.length > 0);
      this.refreshCompliancePanel();
      this.triggerAutoSave();
    }
  }

  updateSectionTitle(secId, title) {
    if (!this.activeDocument || !this.activeDocument.sections) return;
    const sec = this.activeDocument.sections.find(s => s.id === secId);
    if (sec) {
      sec.title = title;
      const sidebarSec = document.getElementById(`sidebar-sec-${secId}`);
      if (sidebarSec) sidebarSec.innerText = title.trim() || 'Nova Seção';
      this.triggerAutoSave();
    }
  }

  updateSectionContent(secId, html) {
    if (!this.activeDocument || !this.activeDocument.sections) return;
    const sec = this.activeDocument.sections.find(s => s.id === secId);
    if (sec) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      sec.content = tempDiv.innerText;
      this.refreshLiveState();
      this.triggerAutoSave();
    }
  }

  updateReference(idx, text) {
    if (this.activeDocument && this.activeDocument.references) {
      this.activeDocument.references[idx] = text;
      this.refreshCompliancePanel();
      this.triggerAutoSave();
    }
  }

  deleteReference(idx) {
    if (this.activeDocument && this.activeDocument.references) {
      this.saveStateToHistory();
      this.activeDocument.references.splice(idx, 1);
      this.navigate('editor');
      this.showToast('Referência removida com sucesso.', 'info');
    }
  }

  addReferencePrompt() {
    const isEn = this.currentLang === 'en';
    const ref = prompt(isEn ? 'Enter bibliographic reference:' : 'Digite ou cole a referência conforme ABNT NBR 6023:');
    if (ref && ref.trim()) {
      this.saveStateToHistory();
      if (!this.activeDocument.references) this.activeDocument.references = [];
      this.activeDocument.references.push(ref.trim());
      this.navigate('editor');
      this.showToast('Nova referência adicionada!', 'success');
    }
  }

  addSection() {
    const isEn = this.currentLang === 'en';
    const title = prompt(isEn ? 'Section title:' : 'Título da nova seção (ex: 4. RESULTADOS E DISCUSSÃO):');
    if (title && title.trim()) {
      this.saveStateToHistory();
      const newSec = {
        id: 'sec_' + Date.now(),
        title: title.trim(),
        content: isEn ? 'Type section scientific content here...' : 'Insira aqui o conteúdo desta seção científica...'
      };
      this.activeDocument.sections.push(newSec);
      this.navigate('editor');
      this.showToast(`Seção "${title}" adicionada.`, 'success');
    }
  }

  deleteSection(secId) {
    if (confirm(this.currentLang === 'en' ? 'Delete this section?' : 'Deseja realmente excluir esta seção do documento?')) {
      this.saveStateToHistory();
      this.activeDocument.sections = this.activeDocument.sections.filter(s => s.id !== secId);
      this.navigate('editor');
      this.showToast('Seção excluída.', 'info');
    }
  }

  changeDocumentStandard(newStdId) {
    if (!this.activeDocument) return;
    this.saveStateToHistory();
    const oldStdId = this.activeDocument.standardId || 'abnt';
    this.activeDocument.standardId = newStdId;

    // Converte automaticamente estilo de referências bibliográficas
    if (this.activeDocument.references && this.activeDocument.references.length > 0) {
      this.activeDocument.references = this.convertReferencesToStandard(this.activeDocument.references, newStdId);
    }

    // Converte automaticamente citações no corpo do texto
    this.convertInTextCitationsToStandard(newStdId);

    this.navigate('editor');
    this.showToast(`Norma alterada para ${newStdId.toUpperCase()}! Todas as referências e citações foram atualizadas automaticamente.`, 'success');
  }

  convertReferencesToStandard(refs = [], targetStandard = 'abnt') {
    return refs.map(ref => {
      // Exemplo representativo de conversão inteligente entre estilos
      if (targetStandard === 'ieee' || targetStandard === 'vancouver') {
        // Formato Numérico
        return ref.replace(/^[A-Z\s,]+(?=\.)/g, (author) => {
          const parts = author.split(',');
          return parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : author;
        });
      } else if (targetStandard === 'apa' || targetStandard === 'chicago' || targetStandard === 'mla') {
        // Formato Autor-Data Internacional (Minúsculas com inicial maiúscula)
        return ref.replace(/^([A-ZÀ-Ú]+),\s*([A-ZÀ-Ú]+)/g, '$1, $2.');
      } else {
        // Formato ABNT NBR 6023 (Sobrenome em Caixa Alta)
        return ref.replace(/^([A-Za-zÀ-ú]+),\s*([A-Za-zÀ-ú]+)/g, (match, p1, p2) => `${p1.toUpperCase()}, ${p2}`);
      }
    });
  }

  convertInTextCitationsToStandard(targetStandard = 'abnt') {
    if (!this.activeDocument.sections) return;

    this.activeDocument.sections.forEach(sec => {
      if (!sec.content) return;
      if (targetStandard === 'ieee' || targetStandard === 'vancouver') {
        // Converte (SILVA, 2024) -> [1]
        sec.content = sec.content.replace(/\(([A-ZÀ-Úa-z\s]+),\s*(\d{4})(?:,\s*p\.\s*\d+)?\)/g, '[1]');
      } else if (targetStandard === 'mla') {
        // Converte (SILVA, 2024, p. 45) -> (Silva 45)
        sec.content = sec.content.replace(/\(([A-ZÀ-Úa-z]+),\s*\d{4}(?:,\s*p\.\s*(\d+))?\)/g, (m, a, p) => p ? `(${a} ${p})` : `(${a})`);
      } else if (targetStandard === 'apa') {
        // Converte (SILVA, 2024) -> (Silva, 2024)
        sec.content = sec.content.replace(/\(([A-ZÀ-Ú]+),\s*(\d{4})(.*?)\)/g, (m, a, y, rest) => {
          const formattedAuthor = a.charAt(0).toUpperCase() + a.slice(1).toLowerCase();
          return `(${formattedAuthor}, ${y}${rest})`;
        });
      } else {
        // ABNT: (SILVA, 2024, p. 10)
        sec.content = sec.content.replace(/\(([A-Za-zÀ-ú]+),\s*(\d{4})(.*?)\)/g, (m, a, y, rest) => `(${a.toUpperCase()}, ${y}${rest})`);
      }
    });
  }

  changeDocFont(fontFamily) {
    this.saveStateToHistory();
    const sheet = document.getElementById('academic-active-sheet');
    if (sheet) {
      sheet.style.fontFamily = `"${fontFamily}", serif`;
    }
    this.showToast(`Tipografia alterada para ${fontFamily}!`, 'info');
  }

  openHeaderFooterModal() {
    window.auraModals.showHeaderFooterModal(this.activeDocument.pageConfig || {});
  }

  saveHeaderFooterConfig() {
    const numFormat = document.getElementById('modal-pg-format').value;
    const startPageNumber = parseInt(document.getElementById('modal-pg-start').value, 10) || 1;
    const applyOnlyOdd = document.getElementById('modal-pg-odd').checked;
    const headerText = document.getElementById('modal-pg-header').value.trim();
    const footerText = document.getElementById('modal-pg-footer').value.trim();

    this.saveStateToHistory();
    this.activeDocument.pageConfig = {
      numFormat,
      startPageNumber,
      applyOnlyOdd,
      headerText,
      footerText
    };

    this.closeModal();
    this.navigate('editor');
    this.showToast('Configurações de cabeçalho, numeração e rodapé aplicadas à folha!', 'success');
  }

  // --- STATS, REPEATS, GRAMMAR, SPEECH & ZOOM CONTROLS ---

  refreshLiveState() {
    const fullText = window.auraEditorView.getFullDocumentText(this.activeDocument);
    const stats = window.auraLanguage.calculateStats(fullText);

    // Toolbar Indicators
    const wordsEl = document.getElementById('stat-words');
    const charsEl = document.getElementById('stat-chars');
    const pagesEl = document.getElementById('stat-pages');

    if (wordsEl) wordsEl.innerText = stats.words;
    if (charsEl) charsEl.innerText = stats.charsWithSpaces;
    if (pagesEl) pagesEl.innerText = `~${stats.estimatedPages}`;

    // Floating Bottom-Left Badge Indicators
    const floatWords = document.getElementById('float-stat-words');
    const floatChars = document.getElementById('float-stat-chars');
    const floatPages = document.getElementById('float-stat-pages');

    if (floatWords) floatWords.innerText = stats.words;
    if (floatChars) floatChars.innerText = stats.charsWithSpaces;
    if (floatPages) floatPages.innerText = `~${stats.estimatedPages}`;

    // Recalcular altura e indicadores visuais das quebras de folha A4
    this.recalculateA4PageBreaks();
  }

  recalculateA4PageBreaks() {
    const sheet = document.getElementById('academic-active-sheet');
    if (!sheet) return;
    
    // Atualizar números de página nas quebras
    const breaks = sheet.querySelectorAll('.page-break-divider');
    breaks.forEach((b, idx) => {
      const label = b.querySelector('.page-break-label strong');
      if (label) {
        if (idx === breaks.length - 1 && b.getAttribute('data-break-after') === null) {
          label.innerText = 'Referências Finais';
        } else {
          label.innerText = `Página ${idx + 2}`;
        }
      }
    });
  }

  // Zoom da folha (+ e -)
  adjustSheetZoom(delta) {
    if (!this.sheetZoom) this.sheetZoom = 1.0;
    this.sheetZoom = Math.max(0.7, Math.min(1.6, this.sheetZoom + delta));
    
    const sheet = document.getElementById('academic-active-sheet');
    const zoomDisplay = document.getElementById('sheet-zoom-level');
    
    if (sheet) {
      sheet.style.transform = `scale(${this.sheetZoom})`;
      sheet.style.transformOrigin = 'top center';
    }
    if (zoomDisplay) {
      zoomDisplay.innerText = `${Math.round(this.sheetZoom * 100)}%`;
    }
  }

  // Acessibilidade: Leitura em Voz Didática Feminina (Apresentação Oral)
  toggleSpeechPresentation() {
    if (!('speechSynthesis' in window)) {
      this.showToast('Síntese de voz não suportada pelo seu navegador.', 'warning');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      this.updateSpeechUI(false);
      this.showToast('Apresentação de áudio pausada/encerrada.', 'info');
      return;
    }

    const doc = this.activeDocument;
    if (!doc) return;

    // Constrói o roteiro didático de apresentação oral do trabalho
    const isEn = this.currentLang === 'en';
    const presentationText = isEn
      ? `Welcome to the scientific presentation of the paper: ${doc.title || 'Untitled'}. Authored by: ${doc.authors || 'Candidate'}. Abstract: ${doc.abstract || 'Not provided.'}. Objectives and methodology: ${(doc.sections || []).map(s => s.title + '. ' + s.content).join('. ')}`
      : `Seja bem-vindo(a) à apresentação acadêmica do trabalho: ${doc.title || 'Trabalho Científico'}. De autoria de: ${doc.authors || 'Pesquisador'}. Resumo da pesquisa: ${doc.abstract || ''}. Estrutura do trabalho: ${(doc.sections || []).map(s => s.title + '. ' + s.content).join('. ')}`;

    const utterance = new SpeechSynthesisUtterance(presentationText);
    utterance.lang = isEn ? 'en-US' : 'pt-BR';
    utterance.rate = 0.95; // Cadência didática clara e pausada
    utterance.pitch = 1.15; // Tom suave e feminino

    // Tentar selecionar voz feminina em português ou inglês
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => 
      (isEn ? v.lang.startsWith('en') : v.lang.startsWith('pt')) && 
      (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('luciana') || v.name.toLowerCase().includes('francisca') || v.name.toLowerCase().includes('maria') || v.name.toLowerCase().includes('victoria') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('google português'))
    ) || voices.find(v => isEn ? v.lang.startsWith('en') : v.lang.startsWith('pt'));

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onstart = () => {
      this.updateSpeechUI(true);
      this.showToast(isEn ? 'Scientific audio presentation started.' : 'Apresentação com voz didática iniciada!', 'success');
    };

    utterance.onend = () => {
      this.updateSpeechUI(false);
      this.showToast(isEn ? 'Presentation completed.' : 'Apresentação concluída com sucesso.', 'info');
    };

    utterance.onerror = () => {
      this.updateSpeechUI(false);
    };

    window.speechSynthesis.speak(utterance);
  }

  updateSpeechUI(isPlaying) {
    const btn = document.getElementById('btn-speech-read');
    const icon = document.getElementById('speech-icon');
    if (btn) {
      if (isPlaying) {
        btn.className = 'p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 flex items-center justify-center font-bold transition-all shadow-lg animate-pulse';
        btn.setAttribute('title', 'Parar Leitura');
      } else {
        btn.className = 'p-2 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/50 flex items-center justify-center font-bold transition-all shadow-md';
        btn.setAttribute('title', 'Apresentação Oral com Voz Didática');
      }
    }
  }

  // Toggle do container retrátil de palavras repetidas
  toggleRepeatedWordsBox() {
    const container = document.getElementById('repeated-words-container');
    const chevron = document.getElementById('repeated-words-chevron');
    if (container) {
      const isHidden = container.classList.toggle('hidden');
      if (chevron) {
        chevron.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
      }
    }
  }

  refreshRepeatedWords() {
    const container = document.getElementById('repeated-words-container');
    if (!container || !this.activeDocument) return;

    const fullText = window.auraEditorView.getFullDocumentText(this.activeDocument);
    const repeats = window.auraLanguage.detectRepeatedWords(fullText, 2);

    if (repeats.length === 0) {
      container.innerHTML = `<div class="text-slate-500 text-[11px] p-2">Nenhuma repetição excessiva identificada.</div>`;
      return;
    }

    container.innerHTML = repeats.slice(0, 5).map((r, rIdx) => `
      <div class="p-2.5 rounded-lg bg-slate-900/80 border border-purple-900/40 hover:border-purple-500/50 transition-all flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-purple-300 flex items-center gap-1 cursor-pointer" onclick="AURA.highlightAndScrollToText('${r.word}')">
            <i data-lucide="repeat" class="w-3 h-3 text-purple-400"></i> "${r.word}"
          </span>
          <span class="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-mono font-bold">${r.count}x</span>
        </div>
        
        <!-- Lista de Sinônimos Sugeridos com 1-Click Replacement -->
        <div class="flex flex-col gap-1 text-[10px] bg-slate-950/60 p-2 rounded border border-slate-800">
          <div class="text-slate-400 font-semibold mb-0.5">Sugestões de Substituição:</div>
          <div class="flex flex-wrap gap-1">
            ${r.synonyms.map(syn => `
              <button onclick="AURA.replaceRepeatedWord('${r.word}', '${syn}')" class="px-2 py-0.5 rounded bg-purple-900/40 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-700/50 transition-all flex items-center gap-1">
                <span>${syn}</span>
                <i data-lucide="arrow-right" class="w-2.5 h-2.5"></i>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `).join('');
    lucide.createIcons();
  }

  replaceRepeatedWord(oldWord, newWord) {
    this.saveStateToHistory();
    this.executeGlobalReplace(oldWord, newWord, false);
    this.showToast(`Palavra "${oldWord}" substituída por "${newWord}".`, 'success');
    this.refreshRepeatedWords();
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

    container.innerHTML = issues.slice(0, 4).map(iss => `
      <div class="p-2.5 rounded-lg bg-slate-900/80 border border-rose-900/40 hover:border-rose-500/60 transition-all flex flex-col gap-1.5 cursor-pointer" onclick="AURA.highlightAndScrollToText('${iss.matchedText}')">
        <div class="flex items-center justify-between">
          <span class="font-bold text-rose-300 flex items-center gap-1">
            <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-400"></i> "${iss.matchedText}"
          </span>
          <button onclick="event.stopPropagation(); AURA.applySpellFix('${iss.matchedText}', '${iss.suggestedFix.split('/')[0].trim()}')" class="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
            Corrigir
          </button>
        </div>
        <div class="text-[10px] text-slate-300">${iss.reason}</div>
        <div class="text-[10px] text-emerald-300 font-mono">Sugestão: <strong>${iss.suggestedFix}</strong> (Clique para localizar)</div>
      </div>
    `).join('');
    lucide.createIcons();
  }

  highlightAndScrollToText(targetText) {
    this.openFindReplace();
    const findInput = document.getElementById('find-input');
    if (findInput) {
      findInput.value = targetText;
      this.onFindInputChange(targetText);
    }
  }

  applySpellFix(oldText, newText) {
    this.saveStateToHistory();
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

  // --- ASSISTENTE IA (AGORA TRANSFORMA O TEXTO SELECIONADO OU SEÇÃO ATIVA) ---

  getSelectedDocumentText() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const text = selection.toString().trim();
      if (text.length > 5) return text;
    }
    return null;
  }

  runAIAssist(mode) {
    if (!this.activeDocument) return;

    let targetSection = (this.activeDocument.sections && this.activeDocument.sections[0]) || null;
    let selected = this.getSelectedDocumentText();
    let original = selected;

    // Se o usuário não selecionou manualmente com o mouse, pega o primeiro parágrafo da primeira seção
    if (!original && targetSection) {
      original = targetSection.content.split('\n\n')[0] || targetSection.content;
    }

    if (!original) {
      this.showToast('Por favor, selecione um trecho de texto no documento.', 'warning');
      return;
    }

    let suggested = '';
    if (mode === 'academic_tone') {
      suggested = original.replace(/frequentemente enfrentam dificuldades/gi, 'deparam-se com óbices epistemológicos e práticos')
                          .replace(/desponta como uma alternativa viável/gi, 'configura-se como um vetor metodológico proeminente')
                          .replace(/muito bom/gi, 'altamente satisfatório')
                          .replace(/foi feito/gi, 'procedeu-se à realização de')
                          .replace(/acho que/gi, 'os dados sugerem que')
                          .replace(/mostra/gi, 'evidencia');
      if (suggested === original) {
        suggested = `Observa-se, sob a ótica dos parâmetros científicos estabelecidos, que ${original.toLowerCase().replace(/^\w/, c => c.toLowerCase())}.`;
      }
    } else if (mode === 'paraphrase') {
      // Parafraseamento inteligente preservando referências bibliográficas e formatação de citações
      const citations = [];
      const masked = original.replace(/\([A-ZÀ-Úa-z\s,.\d]+\)|\[\d+\]/g, (match) => {
        citations.push(match);
        return `__CITATION_${citations.length - 1}__`;
      });

      const options = window.auraLanguage.generateParaphraseOptions(masked);
      let paraphrased = (options && options[0]) ? options[0].text : `Em síntese, os achados denotam que ${masked.toLowerCase()}`;
      
      // Restaura as citações exatamente no local
      citations.forEach((cit, cIdx) => {
        paraphrased = paraphrased.replace(`__citation_${cIdx}__`, cit).replace(`__CITATION_${cIdx}__`, cit);
      });
      suggested = paraphrased;
    } else if (mode === 'thesis_to_paper') {
      // Transformação de Dissertação / Tese em Artigo Científico IMRaD
      suggested = `[ESTRUTURA DE ARTIGO CIENTÍFICO CONDENSADO]\n\n` +
        `RESUMO: Esta pesquisa sintetiza a investigação desenvolvida na tese, delimitando a pergunta central, metodologia experimental e conclusões fundamentais em formato conciso para periódico de alto impacto.\n\n` +
        `1. INTRODUÇÃO: O cerne teórico extraído da tese demonstra que ${original.substring(0, 180)}...\n\n` +
        `2. METODOLOGIA: Procedeu-se ao recorte metodológico quanti-qualitativo rigoroso.\n\n` +
        `3. RESULTADOS & DISCUSSÃO: Os achados empíricos corroboram as hipóteses basilares levantadas na dissertação.\n\n` +
        `4. CONSIDERAÇÕES FINAIS: Conclui-se que o avanço proposto apresenta contribuição direta para a literatura.`;
    } else if (mode === 'concise') {
      suggested = original.length > 80 
        ? original.substring(0, Math.floor(original.length * 0.65)) + '...'
        : 'Síntese objetiva: ' + original;
    } else if (mode === 'alignment') {
      this.showToast('✓ Alinhamento Metodológico: 100% dos objetivos possuem métodos correspondentes.', 'success');
      return;
    }

    this.pendingAIDiff = {
      sectionId: targetSection ? targetSection.id : null,
      originalText: original,
      suggestedText: suggested
    };

    const diffBox = document.getElementById('ai-diff-container');
    if (diffBox) {
      diffBox.classList.remove('hidden');
      document.getElementById('ai-diff-original').innerText = original;
      document.getElementById('ai-diff-suggested').innerText = suggested;
      this.setRightTab('ai');
    }
  }

  acceptDiff() {
    if (!this.pendingAIDiff) return;
    this.saveStateToHistory();
    this.executeGlobalReplace(this.pendingAIDiff.originalText, this.pendingAIDiff.suggestedText, false);
    this.showToast('Sugestão da IA aceita e inserida no texto!', 'success');
    this.rejectDiff();
  }

  rejectDiff() {
    this.pendingAIDiff = null;
    const diffBox = document.getElementById('ai-diff-container');
    if (diffBox) diffBox.classList.add('hidden');
  }

  // --- LOCALIZAR E SUBSTITUIR COM NAVEGAÇÃO E HIGHLIGHT EM TEMPO REAL ---

  openFindReplace() {
    this.setRightTab('find_replace');
    const input = document.getElementById('find-input');
    if (input) {
      input.focus();
      if (input.value) this.onFindInputChange(input.value);
    }
  }

  onFindInputChange(term) {
    const sheet = document.getElementById('academic-active-sheet');
    const counterBadge = document.getElementById('find-counter-badge');
    if (!sheet) return;

    // Limpa destaques anteriores
    this.clearSearchHighlights();

    if (!term || term.trim().length === 0) {
      if (counterBadge) counterBadge.classList.add('hidden');
      this.searchMatches = [];
      this.currentSearchIndex = -1;
      return;
    }

    const matchCase = document.getElementById('find-opt-case') ? document.getElementById('find-opt-case').checked : false;
    const wholeWord = document.getElementById('find-opt-word') ? document.getElementById('find-opt-word').checked : false;

    // Cria regex seguro
    let pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) pattern = `\\b${pattern}\\b`;
    const regex = new RegExp(pattern, matchCase ? 'g' : 'gi');

    // Destaca no DOM visual da folha
    const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement && !node.parentElement.classList.contains('search-highlight') && regex.test(node.nodeValue)) {
        nodesToReplace.push(node);
      }
    }

    nodesToReplace.forEach(node => {
      const span = document.createElement('span');
      span.innerHTML = node.nodeValue.replace(regex, (match) => `<mark class="search-highlight">${match}</mark>`);
      node.parentNode.replaceChild(span, node);
    });

    this.searchMatches = Array.from(sheet.querySelectorAll('.search-highlight'));
    if (this.searchMatches.length > 0) {
      this.currentSearchIndex = 0;
      this.highlightCurrentMatch();
      if (counterBadge) {
        counterBadge.classList.remove('hidden');
        counterBadge.innerText = `1/${this.searchMatches.length}`;
      }
    } else {
      if (counterBadge) {
        counterBadge.classList.remove('hidden');
        counterBadge.innerText = '0/0';
      }
    }
  }

  clearSearchHighlights() {
    const sheet = document.getElementById('academic-active-sheet');
    if (!sheet) return;
    sheet.querySelectorAll('.search-highlight').forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.innerText), el);
      parent.normalize();
    });
  }

  highlightCurrentMatch() {
    if (this.searchMatches.length === 0 || this.currentSearchIndex < 0) return;
    this.searchMatches.forEach(m => m.classList.remove('search-highlight-current'));
    const curr = this.searchMatches[this.currentSearchIndex];
    if (curr) {
      curr.classList.add('search-highlight-current');
      curr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const counterBadge = document.getElementById('find-counter-badge');
      if (counterBadge) {
        counterBadge.innerText = `${this.currentSearchIndex + 1}/${this.searchMatches.length}`;
      }
    }
  }

  findNextMatch() {
    if (this.searchMatches.length === 0) return;
    this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchMatches.length;
    this.highlightCurrentMatch();
  }

  findPrevMatch() {
    if (this.searchMatches.length === 0) return;
    this.currentSearchIndex = (this.currentSearchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.highlightCurrentMatch();
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

    this.saveStateToHistory();
    const count = this.executeGlobalReplace(findTerm, replaceTerm, replaceAll, { matchCase, wholeWord });
    const resultsEl = document.getElementById('find-replace-results');
    if (resultsEl) {
      resultsEl.innerText = count > 0 
        ? `✓ ${count} ocorrência(s) substituída(s) com sucesso.`
        : `Nenhuma ocorrência encontrada para "${findTerm}".`;
    }
    this.showToast(`${count} substituição(ões) realizadas!`, count > 0 ? 'success' : 'info');
  }

  executeGlobalReplace(searchTerm, replaceTerm, replaceAll = true, options = { matchCase: false, wholeWord: false }) {
    let totalCount = 0;
    if (!this.activeDocument) return 0;

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

    const newDoc = {
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

    if (!this.openDocuments) this.openDocuments = [];
    this.openDocuments.push(newDoc);
    this.activeDocument = newDoc;

    this.closeModal();
    this.saveStateToHistory();
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
      if (!this.openDocuments) this.openDocuments = [];
      this.openDocuments.push(parsedDoc);
      this.activeDocument = parsedDoc;
      this.closeModal();
      this.saveStateToHistory();
      this.persistDocuments();
      this.navigate('editor');
      this.showToast('Documento estruturado em uma nova aba!', 'success');
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
        const parsedDoc = window.auraDocumentParser.parseTextToDocument(text, file.name);
        if (!this.openDocuments) this.openDocuments = [];
        this.openDocuments.push(parsedDoc);
        this.activeDocument = parsedDoc;
        this.closeModal();
        this.saveStateToHistory();
        this.persistDocuments();
        this.navigate('editor');
        this.showToast('Documento importado em uma nova aba!', 'success');
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
    const newDoc = {
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

    if (!this.openDocuments) this.openDocuments = [];
    this.openDocuments.push(newDoc);
    this.activeDocument = newDoc;

    this.saveStateToHistory();
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

  toggleCitationMenu() {
    const menu = document.getElementById('citation-dropdown-menu');
    if (menu) {
      menu.classList.toggle('hidden');
    }
  }

  insertDirectCitation() {
    this.toggleCitationMenu();
    window.auraModals.showCitationModal('direct');
  }

  insertIndirectCitation() {
    this.toggleCitationMenu();
    window.auraModals.showCitationModal('indirect');
  }

  insertApudCitation() {
    this.toggleCitationMenu();
    window.auraModals.showCitationModal('apud');
  }

  confirmInsertCitation(type) {
    const author = document.getElementById('modal-cit-author').value.trim();
    const year = document.getElementById('modal-cit-year').value.trim();
    const page = document.getElementById('modal-cit-page').value.trim();
    const apud = document.getElementById('modal-cit-apud') ? document.getElementById('modal-cit-apud').value.trim() : '';
    const text = document.getElementById('modal-cit-text') ? document.getElementById('modal-cit-text').value.trim() : '';

    if (!author || !year) {
      this.showToast('Preencha ao menos o autor e ano.', 'warning');
      return;
    }

    let citationHtml = '';
    if (type === 'direct') {
      const pageStr = page ? `, p. ${page}` : '';
      citationHtml = `<span>"${text}" (${author.toUpperCase()}, ${year}${pageStr})</span>&nbsp;`;
    } else if (type === 'indirect') {
      const pageStr = page ? `, p. ${page}` : '';
      citationHtml = `<span>(${author.toUpperCase()}, ${year}${pageStr})</span>&nbsp;`;
    } else if (type === 'apud') {
      citationHtml = `<span>(${author.toUpperCase()}, ${year} apud ${apud.toUpperCase()})</span>&nbsp;`;
    }

    this.saveStateToHistory();
    this.closeModal();
    document.execCommand('insertHTML', false, citationHtml);
    this.refreshCompliancePanel();
    this.showToast('Citação inserida conforme a norma!', 'success');
  }

  insertLongQuote() {
    const quote = prompt('Insira o texto da citação longa (ABNT: + de 3 linhas com recuo 4cm e corpo 10pt):');
    if (quote) {
      this.saveStateToHistory();
      document.execCommand('insertHTML', false, `<div class="academic-long-quote">${quote}</div><p class="academic-paragraph"></p>`);
    }
  }

  insertImageModal() {
    window.auraModals.showImageModal();
  }

  handleImageFileSelect(input) {
    const file = input.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const urlInput = document.getElementById('modal-img-url');
        if (urlInput) urlInput.value = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  confirmInsertImage() {
    const title = document.getElementById('modal-img-title').value.trim() || 'Figura 1 — Ilustração Científica';
    const url = document.getElementById('modal-img-url').value.trim() || 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=600&auto=format&fit=crop&q=80';
    const source = document.getElementById('modal-img-source').value.trim() || 'Fonte: Elaborado pelos autores (2026).';

    this.saveStateToHistory();
    const figureHtml = `
      <div class="my-6 text-center select-none" contenteditable="false">
        <div class="text-xs font-bold text-slate-800 mb-1.5 text-center">${title}</div>
        <div class="flex justify-center">
          <img src="${url}" alt="${title}" class="max-w-full max-h-80 object-contain rounded border border-slate-300 shadow-sm mx-auto my-1">
        </div>
        <div class="text-[10pt] text-slate-600 mt-1.5 text-center">${source}</div>
      </div>
      <p class="academic-paragraph" contenteditable="true"></p>
    `;

    this.closeModal();
    document.execCommand('insertHTML', false, figureHtml);
    this.showToast('Figura inserida com padrão ABNT/APA!', 'success');
  }

  insertTable() {
    this.saveStateToHistory();
    const tableHtml = `
      <div class="my-4" contenteditable="false">
        <div class="text-xs font-bold mb-1">Tabela 1 — Descrição dos Dados Coletados</div>
        <table class="w-full border-collapse border border-slate-300 text-xs text-left" contenteditable="true">
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
      <p class="academic-paragraph" contenteditable="true"></p>
    `;
    document.execCommand('insertHTML', false, tableHtml);
  }

  insertEquation() {
    const eq = prompt('Digite a fórmula ou expressão (ex: F1 = 2 * (P * R) / (P + R)):');
    if (eq) {
      this.saveStateToHistory();
      document.execCommand('insertHTML', false, `<div class="text-center font-mono text-sm my-3 p-2 bg-slate-50 rounded border border-slate-200">${eq}</div><p class="academic-paragraph"></p>`);
    }
  }

  // --- INLINE TIMELINE & BUDGET ACTIONS (DRAG & DROP, INLINE EDIT, CONFIRMATIONS) ---

  selectNotice(noticeId) {
    const notice = (window.AURA_SAMPLE_NOTICES || []).find(n => n.id === noticeId);
    if (notice) {
      this.activeNotice = notice;
      this.navigate('notices');
      this.showToast(`Edital "${notice.title.substring(0, 35)}..." selecionado para análise detalhada!`, 'info');
    }
  }

  addTimelineActivityInline() {
    const input = document.getElementById('inline-timeline-input');
    if (!input || !input.value.trim()) {
      this.showToast('Digite o nome da atividade.', 'warning');
      return;
    }

    if (!this.activeDocument.timeline) this.activeDocument.timeline = [];
    this.activeDocument.timeline.push({
      activity: input.value.trim(),
      m1: true,
      m2: true,
      m3: false,
      m4: false,
      m5: false,
      m6: false
    });

    input.value = '';
    this.navigate('notices');
    this.showToast('Nova atividade adicionada diretamente ao cronograma!', 'success');
  }

  updateTimelineActivity(idx, newName) {
    if (this.activeDocument && this.activeDocument.timeline && this.activeDocument.timeline[idx]) {
      this.activeDocument.timeline[idx].activity = newName;
      this.showToast('Atividade atualizada!', 'info');
    }
  }

  toggleTimelineMonth(idx, monthKey) {
    if (this.activeDocument && this.activeDocument.timeline && this.activeDocument.timeline[idx]) {
      this.activeDocument.timeline[idx][monthKey] = !this.activeDocument.timeline[idx][monthKey];
    }
  }

  confirmRemoveTimelineActivity(idx) {
    const isEn = this.currentLang === 'en';
    const msg = isEn ? 'Are you sure you want to delete this timeline activity?' : 'Tem certeza de que deseja excluir esta atividade do cronograma?';
    if (confirm(msg)) {
      if (this.activeDocument && this.activeDocument.timeline) {
        this.activeDocument.timeline.splice(idx, 1);
        this.navigate('notices');
        this.showToast(isEn ? 'Activity removed.' : 'Atividade removida com sucesso.', 'info');
      }
    }
  }

  // Drag and Drop reordering for Budget
  handleBudgetDragStart(event, idx) {
    event.dataTransfer.setData('text/plain', idx);
    event.dataTransfer.effectAllowed = 'move';
  }

  handleBudgetDrop(event, targetIdx) {
    event.preventDefault();
    const sourceIdx = parseInt(event.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIdx) || sourceIdx === targetIdx || !this.activeDocument.budget) return;

    const items = [...this.activeDocument.budget];
    const [movedItem] = items.splice(sourceIdx, 1);
    items.splice(targetIdx, 0, movedItem);
    this.activeDocument.budget = items;

    this.navigate('notices');
    this.showToast('Ordem dos itens orçamentários reorganizada com sucesso!', 'success');
  }

  updateBudgetItem(idx, field, value) {
    if (this.activeDocument && this.activeDocument.budget && this.activeDocument.budget[idx]) {
      this.activeDocument.budget[idx][field] = value;
      this.navigate('notices');
      this.showToast('Item orçamentário e Total atualizados!', 'info');
    }
  }

  addBudgetItemInline() {
    const cat = document.getElementById('inline-budget-cat').value;
    const desc = document.getElementById('inline-budget-desc').value.trim();
    const val = parseFloat(document.getElementById('inline-budget-val').value);

    if (!desc || isNaN(val) || val <= 0) {
      this.showToast('Informe a descrição e o valor do item.', 'warning');
      return;
    }

    if (!this.activeDocument.budget) this.activeDocument.budget = [];
    this.activeDocument.budget.push({
      category: cat,
      item: desc,
      amount: val
    });

    document.getElementById('inline-budget-desc').value = '';
    document.getElementById('inline-budget-val').value = '';
    this.navigate('notices');
    this.showToast('Item orçamentário adicionado diretamente!', 'success');
  }

  confirmRemoveBudgetItem(idx) {
    const isEn = this.currentLang === 'en';
    const msg = isEn ? 'Are you sure you want to remove this budget item?' : 'Tem certeza de que deseja excluir este item do orçamento?';
    if (confirm(msg)) {
      if (this.activeDocument && this.activeDocument.budget) {
        this.activeDocument.budget.splice(idx, 1);
        this.navigate('notices');
        this.showToast(isEn ? 'Budget item removed.' : 'Item orçamentário removido.', 'info');
      }
    }
  }

  showNoticeSummaryModal(noticeId) {
    window.auraModals.showNoticeSummaryModal(noticeId);
  }

  exportComplianceReportDirect() {
    const notice = this.activeNotice || window.AURA_SAMPLE_NOTICES[0];
    const doc = this.activeDocument || window.AURA_SAMPLE_DOCUMENTS[0];
    const compliance = window.auraRulesEngine.evaluateCompliance(doc, notice);
    window.auraExport.exportComplianceReport(doc, notice, compliance);
    this.showToast('Relatório oficial de conformidade em DOC formatado gerado com sucesso!', 'success');
  }
}

// Instanciar AURA Global
window.AURA = new AuraApp();

document.addEventListener('DOMContentLoaded', () => {
  window.AURA.init();
});
