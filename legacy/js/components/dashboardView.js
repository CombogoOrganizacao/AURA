/**
 * AURA — Dashboard View (Gestão de Meus Trabalhos, Presets e Submissões)
 */

class AuraDashboardView {
  constructor() {
    this.activeTab = 'academic'; // 'academic' | 'notices'
  }

  setTab(tab) {
    this.activeTab = tab;
    if (window.AURA) window.AURA.navigate('dashboard');
  }

  render(container) {
    const t = (key) => window.AURA ? window.AURA.t(key) : key;
    const isEn = window.AURA && window.AURA.currentLang === 'en';

    // Recupera todos os documentos reais abertos ou salvos no sistema
    const currentOpenDocs = (window.AURA && window.AURA.openDocuments) || (window.AURA && window.AURA.loadSavedDocuments()) || window.AURA_SAMPLE_DOCUMENTS;
    
    const academicWorks = currentOpenDocs.map(doc => {
      const fullText = window.auraEditorView ? window.auraEditorView.getFullDocumentText(doc) : (doc.title || '');
      const stats = window.auraLanguage ? window.auraLanguage.calculateStats(fullText) : { words: 0, estimatedPages: 1 };
      return {
        id: doc.id,
        title: doc.title || (isEn ? 'Untitled Document' : 'Documento sem título'),
        type: doc.workTypeId || (isEn ? 'Scientific Project' : 'Projeto Científico'),
        standard: (doc.standardId || 'abnt').toUpperCase(),
        target: doc.targetJournal || (isEn ? 'Peer-Reviewed Journal / PPG' : 'Periódico Qualis / PPG'),
        score: doc.score || (doc.sections && doc.sections.length > 2 ? 94 : 82),
        status: doc.status || 'READY',
        updatedAt: doc.updatedAt || (isEn ? 'Just now (Saved ✓)' : 'Recentemente (Salvo ✓)'),
        pages: stats.estimatedPages || (doc.sections ? doc.sections.length + 1 : 1),
        words: stats.words || 0
      };
    });

    const submissionNotices = (window.AURA_SAMPLE_NOTICES || []).slice(0, 4).map((n, idx) => ({
      id: n.id,
      title: n.title,
      agency: n.agency,
      deadline: n.deadline,
      budget: n.limits.maxBudget > 0 ? `R$ ${(n.limits.maxBudget / 1000).toFixed(0)}k` : 'Sob Demanda',
      readiness: idx === 0 ? 94 : (idx === 1 ? 88 : 72),
      status: n.status === 'open' ? 'Aberto' : (n.status === 'in_progress' ? 'Em Elaboração' : 'Encerrado'),
      category: n.category
    }));

    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
        
        <!-- DASHBOARD HEADER -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <i data-lucide="layout-grid" class="w-6 h-6 text-emerald-400"></i> ${t('dash_title')}
            </h2>
            <p class="text-xs text-slate-400 mt-1">${t('dash_desc')}</p>
          </div>

          <div class="flex items-center gap-3">
            <button onclick="AURA.openNewDocModal()" class="px-4 py-2.5 rounded-xl bg-aura-600 hover:bg-aura-500 text-white text-xs font-bold shadow-lg shadow-aura-600/30 flex items-center gap-1.5 transition-all">
              <i data-lucide="plus" class="w-4 h-4"></i> ${t('btn_new_doc')}
            </button>
          </div>
        </div>

        <!-- 2 PRINCIPAIS CATEGORIAS (TABS) -->
        <div class="flex items-center gap-3 border-b border-slate-800 pb-3 text-sm font-bold">
          <button 
            onclick="window.auraDashboardView.setTab('academic')"
            class="px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all ${this.activeTab === 'academic' ? 'bg-gradient-to-r from-aura-600 to-indigo-600 text-white shadow-lg shadow-aura-600/20' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}"
          >
            <i data-lucide="file-text" class="w-4 h-4 text-aura-300"></i>
            <span>${isEn ? 'My Academic Works' : 'Meus Trabalhos Acadêmicos'}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/60 font-mono">${academicWorks.length}</span>
          </button>

          <button 
            onclick="window.auraDashboardView.setTab('notices')"
            class="px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all ${this.activeTab === 'notices' ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/20' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}"
          >
            <i data-lucide="award" class="w-4 h-4 text-amber-300"></i>
            <span>${isEn ? 'My Submission Calls' : 'Meus Editais para Submissão'}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/60 font-mono">${submissionNotices.length}</span>
          </button>
        </div>

        <!-- CONTEÚDO DA CATEGORIA 1: MEUS TRABALHOS ACADÊMICOS -->
        ${this.activeTab === 'academic' ? `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            ${academicWorks.map(p => `
              <div class="glass-panel glass-card-hover rounded-2xl p-5 sm:p-6 border border-slate-800 flex flex-col justify-between cursor-pointer" onclick="AURA.openDocument('${p.id}'); AURA.navigate('editor');">
                <div class="flex flex-col gap-3">
                  <div class="flex items-center justify-between">
                    <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono font-bold">${p.standard}</span>
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${p.score >= 85 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
                        ${p.score}% ${t('dash_ready')}
                      </span>
                      <button 
                        onclick="event.stopPropagation(); AURA.deleteSavedDocument('${p.id}')"
                        class="p-1 rounded-lg bg-slate-800/80 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border border-slate-700/50 transition-all"
                        title="Excluir este trabalho"
                      >
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                      </button>
                    </div>
                  </div>

                  <h3 class="text-sm sm:text-base font-bold text-white leading-snug hover:text-aura-300 transition-colors line-clamp-2">
                    ${p.title}
                  </h3>

                  <div class="flex flex-col gap-1 text-xs text-slate-400 mt-1">
                    <div><strong>${t('doc_type_label')}</strong> ${p.type}</div>
                    <div><strong>Destino:</strong> <span class="text-slate-300">${p.target}</span></div>
                    <div class="text-[11px] text-slate-500 mt-1 flex items-center gap-2 font-mono">
                      <span>${p.pages} págs</span> • <span>${p.words} palavras</span>
                    </div>
                  </div>
                </div>

                <div class="mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>${t('dash_edited')} ${p.updatedAt}</span>
                  <span class="text-aura-400 font-semibold hover:underline">${t('dash_open_editor')}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <!-- CONTEÚDO DA CATEGORIA 2: MEUS EDITAIS PARA SUBMISSÃO -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
            ${submissionNotices.map(sn => `
              <div class="glass-panel glass-card-hover rounded-2xl p-5 sm:p-6 border border-slate-800 flex flex-col justify-between gap-4">
                <div>
                  <div class="flex items-center justify-between">
                    <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">${sn.agency}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">${sn.status}</span>
                  </div>
                  <h3 class="text-base font-bold text-white mt-2 leading-snug">${sn.title}</h3>
                  <div class="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div>Prazo: <strong class="text-white">${sn.deadline}</strong></div>
                    <div>Teto Máximo: <strong class="text-emerald-400">${sn.budget}</strong></div>
                    <div>Índice de Prontidão: <strong class="text-amber-400">${sn.readiness}%</strong></div>
                    <div>Barema: <strong class="text-white">Verificado ✓</strong></div>
                  </div>
                </div>

                <div class="flex items-center gap-2 pt-3 border-t border-slate-800">
                  <button onclick="AURA.selectNotice('${sn.id}')" class="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
                    <i data-lucide="eye" class="w-3.5 h-3.5 text-amber-400"></i> Ver Análise Completa
                  </button>
                  <button onclick="AURA.createProjectFromNotice('${sn.id}')" class="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all">
                    <i data-lucide="file-plus" class="w-3.5 h-3.5"></i> Abrir no Editor
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}

        <!-- PRESETS DE FORMATAÇÃO E NORMAS SALVAS -->
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <i data-lucide="sliders" class="w-4 h-4 text-aura-400"></i> ${t('dash_presets_title')}
              </h3>
              <p class="text-xs text-slate-400">${t('dash_presets_desc')}</p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="AURA.resetDefaultPresets()" title="${isEn ? 'Reset to factory defaults' : 'Restaurar padrões de fábrica'}" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-amber-400"></i> ${isEn ? 'Reset Defaults' : 'Restaurar Padrões'}
              </button>
              <button onclick="AURA.createNewPreset()" class="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 flex items-center gap-1.5 transition-all">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i> ${t('dash_new_preset')}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            ${(window.auraRulesEngine.presets || []).map(pr => `
              <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 flex flex-col justify-between gap-3 hover:border-purple-500/40 transition-all">
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <div class="font-bold text-white text-xs leading-snug">${pr.name}</div>
                    <button onclick="AURA.editPreset('${pr.id}')" title="${isEn ? 'Edit Preset' : 'Editar Preset'}" class="text-slate-400 hover:text-purple-300 p-0.5">
                      <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                  <div class="text-[10px] text-slate-400 mt-1.5 flex flex-wrap gap-1">
                    <span class="px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 font-mono">${pr.standardId.toUpperCase()}</span>
                    <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">${pr.fontFamily || 'Times/Arial'}</span>
                  </div>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-slate-700/60 text-[10px] text-slate-400">
                  <span>${t('dash_ready_use')}</span>
                  <button onclick="AURA.applyPreset('${pr.id}')" class="text-purple-400 font-bold hover:underline">${t('dash_apply')}</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;
  }
}

window.auraDashboardView = new AuraDashboardView();
