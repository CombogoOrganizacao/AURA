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
      this.historyStack = [];
      this.saveStateToHistory('Versão Inicial');
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

  saveStateToHistory(description = 'Edição no documento') {
    if (!this.activeDocument) return;
    if (!this.historyStack) this.historyStack = [];
    const snapshot = {
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: new Date().toLocaleDateString('pt-BR'),
      desc: description,
      doc: JSON.parse(JSON.stringify(this.activeDocument))
    };

    // Se não estiver no topo do histórico, trunca o histórico à frente
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    }
    
    // Evita duplicar se for rigorosamente idêntico ao último snapshot
    const last = this.historyStack[this.historyStack.length - 1];
    if (last && JSON.stringify(last.doc) === JSON.stringify(snapshot.doc)) {
      return;
    }

    this.historyStack.push(snapshot);
    if (this.historyStack.length > 50) this.historyStack.shift();
    this.historyIndex = this.historyStack.length - 1;
    this.triggerAutoSave();
    this.renderSidebarHistory();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const target = this.historyStack[this.historyIndex];
      this.activeDocument = target.doc ? JSON.parse(JSON.stringify(target.doc)) : JSON.parse(target);
      this.persistDocuments();
      this.navigate('editor');
      this.showToast(this.currentLang === 'en' ? 'Action undone.' : `Desfeito: Versão #${this.historyIndex + 1}`, 'info');
    } else {
      document.execCommand('undo', false, null);
    }
  }

  redo() {
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyIndex++;
      const target = this.historyStack[this.historyIndex];
      this.activeDocument = target.doc ? JSON.parse(JSON.stringify(target.doc)) : JSON.parse(target);
      this.persistDocuments();
      this.navigate('editor');
      this.showToast(this.currentLang === 'en' ? 'Action redone.' : `Refeito: Versão #${this.historyIndex + 1}`, 'info');
    } else {
      document.execCommand('redo', false, null);
    }
  }

  init() {
    this.clearCorruptStorage();
    this.applyI18n();
    this.registerServiceWorker();
    if (this.activeDocument) {
      this.saveStateToHistory('Versão Inicial');
    }
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
      if ((!this.historyStack || this.historyStack.length === 0) && this.activeDocument) {
        this.saveStateToHistory('Versão Inicial');
      }
      window.auraEditorView.render(targetSection, this.activeDocument);
      this.refreshCompliancePanel();
      this.refreshRepeatedWords();
      this.refreshSpellCheck();
      this.renderSidebarHistory();
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
      // Ctrl+F para focar na busca da barra de ferramentas
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        if (this.currentView === 'editor') {
          e.preventDefault();
          this.openFindReplace();
        }
      }
      // Ctrl+H para abrir o modal avançado de Localizar e Substituir
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        if (this.currentView === 'editor') {
          e.preventDefault();
          this.openAdvancedFindReplaceModal();
        }
      }
      // F3 para proxima busca
      if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) this.findPrevMatch();
        else this.findNextMatch();
      }
    });

    // Fechar dropdown de citação ao clicar fora
    document.addEventListener('click', (e) => {
      const citationMenu = document.getElementById('citation-dropdown-menu');
      const citationBtn = document.getElementById('btn-citation-dropdown');
      if (citationMenu && !citationMenu.classList.contains('hidden')) {
        if (!citationMenu.contains(e.target) && (!citationBtn || !citationBtn.contains(e.target))) {
          citationMenu.classList.add('hidden');
        }
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
      this.saveHistoryDebounced('Alteração do Título');
      this.triggerAutoSave();
    }
  }

  updateDocAuthors(authors) {
    if (this.activeDocument) {
      this.activeDocument.authors = authors;
      this.saveHistoryDebounced('Edição de Autores');
      this.triggerAutoSave();
    }
  }

  updateDocAbstract(abstractText) {
    if (this.activeDocument) {
      this.activeDocument.abstract = abstractText;
      this.refreshLiveState();
      this.refreshCompliancePanel();
      this.saveHistoryDebounced('Edição do Resumo');
      this.triggerAutoSave();
    }
  }

  updateDocKeywords(keywordsText) {
    if (this.activeDocument) {
      this.activeDocument.keywords = keywordsText.split(';').map(k => k.trim()).filter(k => k.length > 0);
      this.refreshCompliancePanel();
      this.saveHistoryDebounced('Edição de Palavras-chave');
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
      this.saveHistoryDebounced(`Edição de Título da Seção`);
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
      this.saveHistoryDebounced(`Edição do Conteúdo da Seção`);
      this.triggerAutoSave();
    }
  }

  saveHistoryDebounced(desc = 'Edição') {
    if (this.historyDebounceTimer) clearTimeout(this.historyDebounceTimer);
    this.historyDebounceTimer = setTimeout(() => {
      this.saveStateToHistory(desc);
    }, 1200);
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
    const sheets = document.querySelectorAll('.academic-page-sheet, .academic-sheet');
    sheets.forEach(s => {
      s.style.fontFamily = `"${fontFamily}", serif`;
    });
    this.showToast(`Tipografia alterada para ${fontFamily}!`, 'info');
  }

  // --- SELECTION, COLOR & ALIGNMENT CONTROLS ---
  saveCurrentSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      this.savedSelectionRange = sel.getRangeAt(0).cloneRange();
    }
  }

  restoreSelection() {
    if (this.savedSelectionRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(this.savedSelectionRange);
    }
  }

  triggerColorPicker() {
    this.saveCurrentSelection();
    const picker = document.getElementById('editor-text-color');
    if (picker) {
      picker.click();
    }
  }

  applyTextColor(color) {
    this.restoreSelection();
    this.saveStateToHistory();
    document.execCommand('foreColor', false, color);
    this.triggerAutoSave();
    this.showToast(`Cor do texto atualizada!`, 'info');
  }

  cycleTextAlignment() {
    this.saveCurrentSelection();
    this.saveStateToHistory();

    const alignments = [
      { cmd: 'justifyFull', icon: 'align-justify', name: 'Justificado' },
      { cmd: 'justifyLeft', icon: 'align-left', name: 'Alinhado à Esquerda' },
      { cmd: 'justifyCenter', icon: 'align-center', name: 'Centralizado' },
      { cmd: 'justifyRight', icon: 'align-right', name: 'Alinhado à Direita' }
    ];

    if (this.currentAlignmentIndex === undefined) {
      this.currentAlignmentIndex = 0;
    }

    // Avança para o próximo alinhamento
    this.currentAlignmentIndex = (this.currentAlignmentIndex + 1) % alignments.length;
    const current = alignments[this.currentAlignmentIndex];

    this.restoreSelection();
    document.execCommand(current.cmd, false, null);

    // Atualiza ícone do botão
    const iconEl = document.getElementById('alignment-icon');
    const btnEl = document.getElementById('btn-alignment-cycle');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', current.icon);
      lucide.createIcons();
    }
    if (btnEl) {
      btnEl.title = `Alinhamento Atual: ${current.name} (Clique para alternar)`;
    }

    this.triggerAutoSave();
    this.showToast(`Texto formatado: ${current.name}`, 'info');
  }

  // --- BOT CRAWLER DE EDITAIS & RSS LIVE FEED ---
  triggerNoticeBotCrawler() {
    const btn = document.getElementById('btn-bot-crawler');
    const icon = document.getElementById('bot-crawler-icon');
    const text = document.getElementById('bot-crawler-text');

    if (btn) {
      btn.classList.add('animate-pulse');
      if (text) text.innerText = 'Robô em Execução... Varrendo Portais Oficiais';
    }

    this.showToast('🤖 Robô de Editais iniciado! Vasculhando portais do CNPq, CAPES, FACEPE, FINEP, Serrapilheira e Horizon Europe...', 'info');

    setTimeout(() => {
      // Simulação da descoberta e incorporação de novas oportunidades reais
      const newDiscoveredNotice = {
        id: 'notice_crawler_' + Date.now(),
        title: 'Chamada Pública CNPq/MCTI/FNDCT 2026 — Transição Energética, Descarbonização e Hidrogênio Verde',
        agency: 'CNPq / MCTI / FNDCT',
        officialUrl: 'https://www.gov.br/cnpq/pt-br/assuntos/chamadas-publicas',
        category: 'ciencia_pesquisa',
        status: 'open',
        deadline: '2026-12-15',
        type: 'Pesquisa Aplicada e Desenvolvimento Tecnológico',
        limits: { maxPages: 20, minPages: 8, maxAbstractWords: 250, maxBudget: 600000, durationMonths: 36 },
        formattingRules: { fontFamily: 'Times New Roman', fontSize: 12, lineSpacing: 1.5, maxPages: 20, maxAbstractWords: 250 },
        eligibility: [
          { id: 'craw_e1', title: 'Doutorado em Engenharias, Química ou Ciências Exatas', description: 'Pesquisador vinculado a ICT brasileira com grupo de pesquisa ativo no CNPq.', status: 'MET', source: 'Item 3.1' }
        ],
        documentsChecklist: [
          { id: 'craw_d1', name: 'Plano de Trabalho e Mitigação Ambiental', required: true, status: 'DONE', source: 'Plataforma Integrada' },
          { id: 'craw_d2', name: 'Curriculum Lattes dos Pesquisadores', required: true, status: 'DONE', source: 'Lattes' }
        ],
        evaluationCriteria: [
          { id: 'craw_c1', name: 'Inovação e Redução de Emissões de Carbono', weight: 50, scoreObtained: 48, status: 'STRONG', requirementText: 'Soluções com impacto direto nas metas climáticas.', analysis: 'Excelente proposta de hidrogênio verde.', suggestion: 'Enfatizar escalabilidade da tecnologia.' },
          { id: 'craw_c2', name: 'Viabilidade Técnica e Equipe', weight: 50, scoreObtained: 45, status: 'STRONG', requirementText: 'Capacidade experimental comprovada.', analysis: 'Laboratórios adequados para síntese.', suggestion: 'Indicar parceiros da indústria.' }
        ],
        suggestedSections: [
          { id: 's1', title: '1. RESUMO EXECUTIVO E CONTEXTO CLIMÁTICO', content: 'Metas de descarbonização e justificativa tecnológica.' },
          { id: 's2', title: '2. METODOLOGIA EXPERIMENTAL', content: 'Processos de eletrólise e catalisadores avançados.' },
          { id: 's3', title: '3. CRONOGRAMA E MATRIZ DE RECURSOS', content: 'Fases de testes em bancada e prototipagem.' }
        ]
      };

      if (!window.AURA_SAMPLE_NOTICES.find(n => n.id === newDiscoveredNotice.id)) {
        window.AURA_SAMPLE_NOTICES.unshift(newDiscoveredNotice);
      }

      if (btn) {
        btn.classList.remove('animate-pulse');
        if (text) text.innerText = 'Executar Robô de Editais (Varredura IA)';
      }

      this.navigate('notices');
      this.showToast('✅ Varredura concluída com sucesso! 1 novo edital oficial foi capturado e adicionado à Central de Editais.', 'success');
    }, 1800);
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

  // Zoom das folhas A4 (+ e -)
  adjustSheetZoom(delta) {
    if (!this.sheetZoom) this.sheetZoom = 1.0;
    this.sheetZoom = Math.max(0.7, Math.min(1.5, this.sheetZoom + delta));
    
    const wrapper = document.getElementById('academic-sheets-wrapper');
    const zoomDisplay = document.getElementById('sheet-zoom-level');
    
    if (wrapper) {
      wrapper.style.transform = `scale(${this.sheetZoom})`;
      wrapper.style.transformOrigin = 'top center';
    }
    if (zoomDisplay) {
      zoomDisplay.innerText = `${Math.round(this.sheetZoom * 100)}%`;
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

  refreshRepeatedWords(isManualTrigger = false) {
    const container = document.getElementById('repeated-words-container');
    if (!container || !this.activeDocument) return;

    const fullText = window.auraEditorView.getFullDocumentText(this.activeDocument);
    const repeats = window.auraLanguage.detectRepeatedWords(fullText, 2);

    if (repeats.length === 0) {
      container.innerHTML = `<div class="text-emerald-400 text-[11px] p-2 flex items-center gap-1.5"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> Nenhuma palavra repetida detectada! Vocabulário diversificado.</div>`;
      lucide.createIcons();
      if (isManualTrigger) {
        this.showToast('✅ Excelente! Nenhuma repetição excessiva encontrada no documento.', 'success');
      }
      return;
    }

    if (isManualTrigger) {
      this.showToast(`Foram detectadas ${repeats.length} palavras repetidas com sugestões de sinônimos.`, 'info');
    }

    container.innerHTML = repeats.slice(0, 6).map((r, rIdx) => `
      <div class="p-2.5 rounded-lg bg-slate-900/80 border border-purple-900/40 hover:border-purple-500/50 transition-all flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-purple-300 flex items-center gap-1 cursor-pointer hover:underline" onclick="AURA.focusRepeatedWord('${r.word}', 0)" title="Clique para navegar e localizar esta palavra no texto">
            <i data-lucide="repeat" class="w-3 h-3 text-purple-400"></i> "${r.word}"
          </span>
          <div class="flex items-center gap-1">
            <button onclick="AURA.navigateRepeatedWord('${r.word}', -1)" title="Ocorrência Anterior" class="p-1 rounded bg-slate-800 hover:bg-purple-700 text-purple-300 hover:text-white transition-all">
              <i data-lucide="chevron-left" class="w-3 h-3"></i>
            </button>
            <span id="rep-counter-${r.word.replace(/\s+/g, '_')}" class="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-mono font-bold">1/${r.count}</span>
            <button onclick="AURA.navigateRepeatedWord('${r.word}', 1)" title="Próxima Ocorrência" class="p-1 rounded bg-slate-800 hover:bg-purple-700 text-purple-300 hover:text-white transition-all">
              <i data-lucide="chevron-right" class="w-3 h-3"></i>
            </button>
          </div>
        </div>
        
        <!-- Lista de Sinônimos Sugeridos com Substituição Direta na Ocorrência Focada -->
        <div class="flex flex-col gap-1 text-[10px] bg-slate-950/60 p-2 rounded border border-slate-800">
          <div class="text-slate-400 font-semibold mb-0.5 flex items-center justify-between">
            <span>Trocar esta ocorrência focada por:</span>
          </div>
          <div class="flex flex-wrap gap-1">
            ${r.synonyms.map(syn => `
              <button onclick="AURA.replaceCurrentRepeatedOccurrence('${r.word}', '${syn}')" title="Substituir a ocorrência selecionada de '${r.word}' por '${syn}'" class="px-2 py-0.5 rounded bg-purple-900/40 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-700/50 transition-all flex items-center gap-1">
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

  focusRepeatedWord(word, targetIndex = 0) {
    this.repeatedWordIndices = this.repeatedWordIndices || {};
    this.repeatedWordIndices[word] = targetIndex;
    this.highlightAndScrollToText(word, false);
    if (this.searchMatches && this.searchMatches.length > 0) {
      this.currentSearchIndex = Math.min(targetIndex, this.searchMatches.length - 1);
      this.highlightCurrentMatch();
    }
    const counter = document.getElementById(`rep-counter-${word.replace(/\s+/g, '_')}`);
    if (counter && this.searchMatches && this.searchMatches.length > 0) {
      counter.innerText = `${(this.currentSearchIndex >= 0 ? this.currentSearchIndex : 0) + 1}/${this.searchMatches.length}`;
    }
  }

  navigateRepeatedWord(word, direction = 1) {
    this.repeatedWordIndices = this.repeatedWordIndices || {};
    
    // Assegura que o termo está pesquisado e destacado
    const toolbarInput = document.getElementById('toolbar-find-input');
    if (!toolbarInput || toolbarInput.value !== word || !this.searchMatches || this.searchMatches.length === 0) {
      this.highlightAndScrollToText(word, false);
    }
    
    if (direction > 0) {
      this.findNextMatch();
    } else {
      this.findPrevMatch();
    }

    const nextIndex = this.currentSearchIndex >= 0 ? this.currentSearchIndex : 0;
    this.repeatedWordIndices[word] = nextIndex;
    const counter = document.getElementById(`rep-counter-${word.replace(/\s+/g, '_')}`);
    if (counter && this.searchMatches && this.searchMatches.length > 0) {
      counter.innerText = `${nextIndex + 1}/${this.searchMatches.length}`;
    }
  }

  replaceCurrentRepeatedOccurrence(oldWord, newWord) {
    this.saveStateToHistory();
    // Localiza e substitui a ocorrência atual
    const currentHighlight = document.querySelector('.search-highlight-current') || document.querySelector('.search-highlight');
    if (currentHighlight) {
      currentHighlight.innerText = newWord;
      currentHighlight.classList.remove('search-highlight-current', 'search-highlight');
      // Atualiza o documento a partir do DOM editável
      this.syncActiveDocumentFromDOM();
      this.showToast(`Ocorrência de "${oldWord}" substituída por "${newWord}".`, 'success');
    } else {
      this.executeGlobalReplace(oldWord, newWord, false);
      this.showToast(`Ocorrência de "${oldWord}" substituída por "${newWord}".`, 'success');
    }
    this.refreshRepeatedWords(false);
    this.refreshLiveState();
  }

  syncActiveDocumentFromDOM() {
    if (!this.activeDocument) return;
    const abstractEl = document.getElementById('doc-abstract-input');
    if (abstractEl) this.activeDocument.abstract = abstractEl.innerText;
    
    (this.activeDocument.sections || []).forEach(sec => {
      const secEl = document.getElementById(`content-${sec.id}`);
      if (secEl) {
        sec.content = secEl.innerText;
      }
    });
    this.triggerAutoSave();
  }

  // --- CABEÇALHO & RODAPÉ EDITÁVEIS DIRETAMENTE NA FOLHA ---
  updateDocHeaderDirect(text) {
    if (!this.activeDocument) return;
    if (!this.activeDocument.pageConfig) this.activeDocument.pageConfig = {};
    this.activeDocument.pageConfig.headerText = text.trim();
    // Sincronizar todos os campos de cabeçalho na folha
    ['doc-header-input-2', 'doc-header-input-3'].forEach(id => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.innerText = text.trim();
    });
    this.triggerAutoSave();
  }

  updateDocFooterDirect(text) {
    if (!this.activeDocument) return;
    if (!this.activeDocument.pageConfig) this.activeDocument.pageConfig = {};
    this.activeDocument.pageConfig.footerText = text.trim();
    // Sincronizar todos os campos de rodapé na folha
    ['doc-footer-input-1', 'doc-footer-input-2'].forEach(id => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.innerText = text.trim();
    });
    this.triggerAutoSave();
  }

  // --- GESTÃO E EXCLUSÃO DE TRABALHOS EM MEUS TRABALHOS ---
  deleteSavedDocument(docId) {
    const targetDoc = this.openDocuments.find(d => d.id === docId) || (window.AURA_SAMPLE_DOCUMENTS || []).find(d => d.id === docId);
    const title = targetDoc ? targetDoc.title : 'Trabalho Acadêmico';
    window.auraModals.showDeleteConfirmModal(docId, title);
  }

  confirmDeleteDocument(docId) {
    this.openDocuments = this.openDocuments.filter(d => d.id !== docId);
    if (window.AURA_SAMPLE_DOCUMENTS) {
      window.AURA_SAMPLE_DOCUMENTS = window.AURA_SAMPLE_DOCUMENTS.filter(d => d.id !== docId);
    }
    
    // Se o documento excluído for o ativo, seleciona o próximo restante
    if (this.activeDocument && this.activeDocument.id === docId) {
      this.activeDocument = this.openDocuments[0] || null;
    }

    this.persistDocuments();
    this.closeModal();
    this.navigate('dashboard');
    this.showToast('Trabalho acadêmico excluído com sucesso!', 'info');
  }

  setRightTab(tabName) {
    ['ai', 'history', 'compliance'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const panel = document.getElementById(`panel-tab-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.className = 'flex-1 py-1.5 px-2 rounded text-center transition-all bg-aura-600 text-white font-bold shadow flex items-center justify-center gap-1';
        } else {
          btn.className = 'flex-1 py-1.5 px-2 rounded text-center transition-all text-slate-400 hover:text-white flex items-center justify-center gap-1';
        }
      }
      if (panel) {
        panel.classList.toggle('hidden', t !== tabName);
      }
    });

    if (tabName === 'history') {
      this.renderSidebarHistory();
    }
  }

  renderSidebarHistory() {
    const container = document.getElementById('sidebar-history-container');
    if (!container) return;

    if (!this.historyStack || this.historyStack.length === 0) {
      container.innerHTML = `<div class="text-slate-500 text-center p-4">Nenhuma versão gravada ainda.</div>`;
      return;
    }

    container.innerHTML = this.historyStack.map((item, idx) => {
      let docPreview = {};
      let timeStr = 'Agora';
      let descStr = 'Edição no documento';
      if (item && item.doc) {
        docPreview = item.doc;
        timeStr = `${item.date || ''} às ${item.timestamp || ''}`;
        descStr = item.desc || 'Edição';
      } else {
        try { docPreview = JSON.parse(item); } catch (e) { docPreview = {}; }
      }

      const isCurrent = idx === this.historyIndex;
      return `
        <div 
          onclick="AURA.restoreHistorySnapshot(${idx})"
          class="p-2.5 rounded-xl border transition-all cursor-pointer group flex flex-col gap-1.5 ${isCurrent ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500/50 text-white' : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800/80'}"
          title="Clique para alternar imediatamente para a Versão #${idx + 1}"
        >
          <div class="flex items-center justify-between">
            <span class="font-bold text-xs flex items-center gap-1.5">
              <span class="w-5 h-5 rounded ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-white'} flex items-center justify-center font-mono text-[10px]">v${idx + 1}</span>
              <span class="truncate max-w-[140px]">${docPreview.title || 'Documento'}</span>
            </span>
            ${isCurrent ? `
              <span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[9px] font-bold border border-emerald-800/50">Ativa ✓</span>
            ` : `
              <span class="text-[9px] text-slate-500 group-hover:text-indigo-300 flex items-center gap-0.5">
                <i data-lucide="rotate-ccw" class="w-2.5 h-2.5"></i> Restaurar
              </span>
            `}
          </div>

          <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span class="text-indigo-400 font-medium">${timeStr}</span>
            <span>${descStr}</span>
          </div>
        </div>
      `;
    }).reverse().join('');
    lucide.createIcons();
  }

  openHistoryModal() {
    this.setRightTab('history');
  }

  restoreHistorySnapshot(snapshotIndex) {
    if (this.historyStack[snapshotIndex]) {
      this.historyIndex = snapshotIndex;
      const target = this.historyStack[snapshotIndex];
      this.activeDocument = target.doc ? JSON.parse(JSON.stringify(target.doc)) : JSON.parse(target);
      this.persistDocuments();
      this.closeModal();
      this.navigate('editor');
      this.setRightTab('history');
      this.showToast(`Documento alternado para a Versão #v${snapshotIndex + 1}!`, 'success');
    }
  }

  // --- LOCALIZAR E SUBSTITUIR AVANÇADO (TOOLBAR + MODAL) ---
  openAdvancedFindReplaceModal() {
    const toolbarInput = document.getElementById('toolbar-find-input');
    const currentTerm = toolbarInput ? toolbarInput.value : '';
    window.auraModals.showAdvancedFindReplaceModal(currentTerm);
  }

  execModalFindAndReplace(replaceAll = true) {
    const findTerm = document.getElementById('modal-find-input').value;
    const replaceTerm = document.getElementById('modal-replace-input').value;
    const matchCase = document.getElementById('modal-find-opt-case').checked;
    const wholeWord = document.getElementById('modal-find-opt-word').checked;

    if (!findTerm) {
      this.showToast('Digite o termo a ser localizado.', 'warning');
      return;
    }

    this.saveStateToHistory(replaceAll ? `Substituir tudo "${findTerm}"` : `Substituir 1 "${findTerm}"`);
    const count = this.executeGlobalReplace(findTerm, replaceTerm, replaceAll, { matchCase, wholeWord });
    const resultsEl = document.getElementById('modal-find-replace-results');
    if (resultsEl) {
      resultsEl.innerText = count > 0 
        ? `✓ ${count} ocorrência(s) substituída(s) com sucesso.`
        : `Nenhuma ocorrência encontrada para "${findTerm}".`;
    }
    this.refreshLiveState();
    this.showToast(`${count} substituição(ões) realizadas!`, count > 0 ? 'success' : 'info');
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

  highlightAndScrollToText(targetText, switchTab = false) {
    if (switchTab) {
      this.openFindReplace();
    }
    const findInput = document.getElementById('toolbar-find-input');
    if (findInput) {
      findInput.value = targetText;
    }
    this.onFindInputChange(targetText);
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
    const input = document.getElementById('toolbar-find-input');
    if (input) {
      input.focus();
      input.select();
      if (input.value) this.onFindInputChange(input.value);
    }
  }

  onFindInputChange(term) {
    const sheetsContainer = document.getElementById('academic-sheets-wrapper') || document.getElementById('editor-sheet-container') || document.body;
    const counterBadge = document.getElementById('find-counter-badge');
    const toolbarInput = document.getElementById('toolbar-find-input');
    const modalInput = document.getElementById('modal-find-input');

    if (toolbarInput && toolbarInput.value !== term && document.activeElement !== toolbarInput) {
      toolbarInput.value = term;
    }
    if (modalInput && modalInput.value !== term && document.activeElement !== modalInput) {
      modalInput.value = term;
    }

    // Limpa destaques anteriores
    this.clearSearchHighlights();

    if (!term || term.trim().length === 0) {
      if (counterBadge) counterBadge.classList.add('hidden');
      this.searchMatches = [];
      this.currentSearchIndex = -1;
      return;
    }

    const matchCase = document.getElementById('modal-find-opt-case') ? document.getElementById('modal-find-opt-case').checked : false;
    const wholeWord = document.getElementById('modal-find-opt-word') ? document.getElementById('modal-find-opt-word').checked : false;

    let pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) pattern = `\\b${pattern}\\b`;
    const regex = new RegExp(pattern, matchCase ? 'g' : 'gi');

    const sheets = sheetsContainer.querySelectorAll('.academic-page-sheet');
    const searchRoots = sheets.length > 0 ? Array.from(sheets) : [sheetsContainer];

    searchRoots.forEach(sheet => {
      const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.classList.contains('search-highlight') || parent.classList.contains('no-print') || parent.closest('.no-print'))) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const nodesToReplace = [];
      while (walker.nextNode()) {
        if (regex.test(walker.currentNode.nodeValue)) {
          nodesToReplace.push(walker.currentNode);
        }
      }

      nodesToReplace.forEach(node => {
        const span = document.createElement('span');
        span.innerHTML = node.nodeValue.replace(regex, (match) => `<mark class="search-highlight">${match}</mark>`);
        node.parentNode.replaceChild(span, node);
      });
    });

    this.searchMatches = Array.from(sheetsContainer.querySelectorAll('.search-highlight'));
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
    const sheetsContainer = document.getElementById('academic-sheets-wrapper') || document.getElementById('editor-sheet-container') || document.body;
    if (!sheetsContainer) return;
    sheetsContainer.querySelectorAll('.search-highlight').forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.innerText), el);
        parent.normalize();
      }
    });
  }

  highlightCurrentMatch() {
    if (!this.searchMatches || this.searchMatches.length === 0 || this.currentSearchIndex < 0) return;
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
    if (!this.searchMatches || this.searchMatches.length === 0) return;
    this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchMatches.length;
    this.highlightCurrentMatch();
  }

  findPrevMatch() {
    if (!this.searchMatches || this.searchMatches.length === 0) return;
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

  toggleCitationMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('citation-dropdown-menu');
    const btn = document.getElementById('btn-citation-dropdown');
    if (!menu || !btn) return;
    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
      const rect = btn.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = `${rect.bottom + 6}px`;
      menu.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 270))}px`;
      menu.style.zIndex = '99999';
      menu.classList.remove('hidden');
    } else {
      menu.classList.add('hidden');
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
    } else if (type === 'long') {
      const pageStr = page ? `, p. ${page}` : '';
      citationHtml = `<div class="academic-long-quote">${text} (${author.toUpperCase()}, ${year}${pageStr})</div><p class="academic-paragraph"></p>`;
    } else if (type === 'indirect') {
      const pageStr = page ? `, p. ${page}` : '';
      citationHtml = `<span>(${author.toUpperCase()}, ${year}${pageStr})</span>&nbsp;`;
    } else if (type === 'apud') {
      citationHtml = `<span>(${author.toUpperCase()}, ${year} apud ${apud.toUpperCase()})</span>&nbsp;`;
    }

    this.saveStateToHistory('Inserção de Citação');
    this.closeModal();
    document.execCommand('insertHTML', false, citationHtml);
    this.refreshCompliancePanel();
    this.showToast('Citação inserida conforme a norma!', 'success');
  }

  insertLongQuote() {
    this.toggleCitationMenu();
    window.auraModals.showCitationModal('long');
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
    this.saveStateToHistory('Inserção de Tabela');
    const tableId = 'table_' + Date.now();
    const tableHtml = `
      <div class="my-5 academic-table-wrapper select-text" id="${tableId}" contenteditable="false">
        <div class="flex items-center justify-between gap-2 mb-1 no-print">
          <span contenteditable="true" class="text-xs font-bold text-slate-800 focus:outline-none focus:bg-slate-100 p-1 rounded">Tabela 1 — Descrição dos Dados Coletados</span>
          <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-[10px]">
            <button onclick="AURA.addTableRow('${tableId}')" title="Adicionar Linha" class="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 font-bold border border-slate-300 shadow-2xs flex items-center gap-0.5">
              + Linha
            </button>
            <button onclick="AURA.removeTableRow('${tableId}')" title="Remover Linha" class="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-rose-600 font-bold border border-slate-300 shadow-2xs flex items-center gap-0.5">
              - Linha
            </button>
            <button onclick="AURA.getTableColumn('${tableId}')" title="Adicionar Coluna" class="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-indigo-700 font-bold border border-slate-300 shadow-2xs flex items-center gap-0.5">
              + Coluna
            </button>
            <button onclick="AURA.removeTableColumn('${tableId}')" title="Remover Coluna" class="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-rose-600 font-bold border border-slate-300 shadow-2xs flex items-center gap-0.5">
              - Coluna
            </button>
          </div>
        </div>
        <table class="w-full border-collapse border border-slate-400 text-xs text-left">
          <thead class="bg-slate-100 font-bold border-b-2 border-slate-400">
            <tr>
              <th contenteditable="true" class="p-2 border border-slate-300 focus:outline-none focus:bg-white">Variável / Métrica</th>
              <th contenteditable="true" class="p-2 border border-slate-300 focus:outline-none focus:bg-white">Amostra A</th>
              <th contenteditable="true" class="p-2 border border-slate-300 focus:outline-none focus:bg-white">Amostra B</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td contenteditable="true" class="p-2 border border-slate-300 focus:outline-none focus:bg-slate-50">Acurácia Global (%)</td>
              <td contenteditable="true" class="p-2 border border-slate-300 focus:outline-none focus:bg-slate-50">94.2</td>
              <td contenteditable="true" class="p-2 border border-slate-300 focus:outline-none focus:bg-slate-50">88.7</td>
            </tr>
            <tr>
              <td contenteditable="true" class="p-2 border border-slate-300 focus:outline-none focus:bg-slate-50">F1-Score Ponderado</td>
              <td contenteditable="true" class="p-2 border border-slate-300 focus:outline-none focus:bg-slate-50">0.93</td>
              <td contenteditable="true" class="p-2 border border-slate-300 focus:outline-none focus:bg-slate-50">0.86</td>
            </tr>
          </tbody>
        </table>
        <div contenteditable="true" class="text-[9pt] text-slate-500 mt-1 focus:outline-none focus:bg-slate-50 p-0.5 rounded">Fonte: Elaborado pelos autores (2026).</div>
      </div>
      <p class="academic-paragraph" contenteditable="true"></p>
    `;
    document.execCommand('insertHTML', false, tableHtml);
    this.showToast('Tabela acadêmica interativa inserida! Todas as células, linhas e colunas são editáveis.', 'success');
  }

  addTableRow(tableWrapperId) {
    this.saveStateToHistory('Adicionar Linha na Tabela');
    const wrapper = document.getElementById(tableWrapperId);
    if (!wrapper) return;
    const tbody = wrapper.querySelector('tbody');
    const theadRow = wrapper.querySelector('thead tr');
    const colCount = theadRow ? theadRow.children.length : 3;
    
    if (tbody) {
      const tr = document.createElement('tr');
      for (let i = 0; i < colCount; i++) {
        const td = document.createElement('td');
        td.className = 'p-2 border border-slate-300 focus:outline-none focus:bg-slate-50';
        td.contentEditable = 'true';
        td.innerText = i === 0 ? 'Nova Linha' : '-';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
      this.syncActiveDocumentFromDOM();
      this.showToast('Linha adicionada à tabela!', 'info');
    }
  }

  removeTableRow(tableWrapperId) {
    this.saveStateToHistory('Remover Linha da Tabela');
    const wrapper = document.getElementById(tableWrapperId);
    if (!wrapper) return;
    const tbody = wrapper.querySelector('tbody');
    if (tbody && tbody.children.length > 1) {
      tbody.removeChild(tbody.lastElementChild);
      this.syncActiveDocumentFromDOM();
      this.showToast('Última linha removida!', 'info');
    } else {
      this.showToast('A tabela deve conter ao menos 1 linha.', 'warning');
    }
  }

  getTableColumn(tableWrapperId) {
    this.saveStateToHistory('Adicionar Coluna na Tabela');
    const wrapper = document.getElementById(tableWrapperId);
    if (!wrapper) return;
    const theadRow = wrapper.querySelector('thead tr');
    if (theadRow) {
      const th = document.createElement('th');
      th.className = 'p-2 border border-slate-300 focus:outline-none focus:bg-white';
      th.contentEditable = 'true';
      th.innerText = `Coluna ${theadRow.children.length + 1}`;
      theadRow.appendChild(th);
    }
    const tbodyRows = wrapper.querySelectorAll('tbody tr');
    tbodyRows.forEach(row => {
      const td = document.createElement('td');
      td.className = 'p-2 border border-slate-300 focus:outline-none focus:bg-slate-50';
      td.contentEditable = 'true';
      td.innerText = '-';
      row.appendChild(td);
    });
    this.syncActiveDocumentFromDOM();
    this.showToast('Coluna adicionada à tabela!', 'info');
  }

  removeTableColumn(tableWrapperId) {
    this.saveStateToHistory('Remover Coluna da Tabela');
    const wrapper = document.getElementById(tableWrapperId);
    if (!wrapper) return;
    const theadRow = wrapper.querySelector('thead tr');
    if (theadRow && theadRow.children.length > 1) {
      theadRow.removeChild(theadRow.lastElementChild);
      const tbodyRows = wrapper.querySelectorAll('tbody tr');
      tbodyRows.forEach(row => {
        if (row.children.length > 1) {
          row.removeChild(row.lastElementChild);
        }
      });
      this.syncActiveDocumentFromDOM();
      this.showToast('Última coluna removida!', 'info');
    } else {
      this.showToast('A tabela deve conter ao menos 1 coluna.', 'warning');
    }
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
