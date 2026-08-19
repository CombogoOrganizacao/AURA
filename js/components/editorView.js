/**
 * AURA — Editor View (Editor Acadêmico Completo, Overleaf/Docs style)
 * Inclui:
 * - Sidebar retrátil com árvore de seções do documento (arrastável)
 * - Barra de ferramentas acadêmicas (citações, equações, tabelas, notas de rodapé)
 * - Painel de Formatação (Modo Simples e Avançado com Presets)
 * - Visualização em folha com margens reais ABNT/APA/IEEE
 * - Painel de IA com comparador Antes -> Depois
 * - Localizar e Substituir individual e em lote (UTF-8)
 * - Detector de repetições, corretor ortográfico PT/EN e estatísticas em tempo real
 */

class AuraEditorView {
  constructor() {
    this.activeTab = 'editor'; // 'editor' | 'formatting' | 'ai' | 'compliance' | 'find_replace' | 'stats'
    this.editorMode = 'paginated'; // 'paginated' | 'blocks'
    this.activeSectionId = null;
    this.selectedLanguage = 'pt';
  }

  render(container, docData) {
    if (!docData) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400">Nenhum documento carregado.</div>`;
      return;
    }

    const currentDoc = docData;
    const stdId = currentDoc.standardId || 'abnt';
    const std = window.AURA_STANDARDS[stdId] || window.AURA_STANDARDS.abnt;
    const stats = window.auraLanguage ? window.auraLanguage.calculateStats(this.getFullDocumentText(currentDoc)) : { words: 0, charsWithSpaces: 0, estimatedPages: 0 };
    const t = (key) => window.AURA ? window.AURA.t(key) : key;

    container.innerHTML = `
      <div class="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-slate-950">
        
        <!-- EDITOR TOP TOOLBAR (Mobile-First Responsive with horizontal scroll) -->
        <div class="bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto text-xs z-20 whitespace-nowrap scrollbar-none">
          
          <!-- Formatting Buttons -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <button onclick="AURA.execCommand('bold')" title="Negrito" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"><i data-lucide="bold" class="w-4 h-4"></i></button>
            <button onclick="AURA.execCommand('italic')" title="Itálico" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"><i data-lucide="italic" class="w-4 h-4"></i></button>
            <button onclick="AURA.execCommand('underline')" title="Sublinhado" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"><i data-lucide="underline" class="w-4 h-4"></i></button>
            <div class="h-4 w-px bg-slate-700 mx-1"></div>

            <button onclick="AURA.insertLongQuote()" title="Citação Longa ABNT (Recuo 4cm)" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1">
              <i data-lucide="quote" class="w-3.5 h-3.5 text-aura-400"></i> <span class="hidden sm:inline">${t('long_quote')}</span>
            </button>
            <button onclick="AURA.openCitationDialog()" title="Inserir Citação (Autor-Data ou Numérica)" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1">
              <i data-lucide="bookmark" class="w-3.5 h-3.5 text-indigo-400"></i> <span class="hidden sm:inline">${t('citation_nbr')}</span>
            </button>
            <button onclick="AURA.insertTable()" title="Inserir Tabela Acadêmica" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"><i data-lucide="table" class="w-4 h-4"></i></button>
            <button onclick="AURA.insertEquation()" title="Inserir Equação Matemática" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"><i data-lucide="sigma" class="w-4 h-4"></i></button>
            <div class="h-4 w-px bg-slate-700 mx-1"></div>

            <!-- Find & Replace Button -->
            <button onclick="AURA.openFindReplace()" title="Localizar e Substituir (Ctrl+F)" class="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-amber-300 flex items-center gap-1.5 font-medium">
              <i data-lucide="search" class="w-3.5 h-3.5"></i> <span class="hidden md:inline">${t('find_replace')}</span>
            </button>
          </div>

          <!-- Document Limits & Live Stats Indicators -->
          <div class="flex items-center gap-2 sm:gap-3 text-slate-400 flex-shrink-0">
            <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/60 border border-slate-700/50">
              <i data-lucide="file-text" class="w-3.5 h-3.5 text-aura-400"></i>
              <span id="stat-words" class="text-slate-200 font-bold">${stats.words}</span> <span class="hidden md:inline">${t('words')}</span>
              <span class="text-slate-600">|</span>
              <span id="stat-chars" class="text-slate-200 font-bold">${stats.charsWithSpaces}</span> <span class="hidden md:inline">${t('characters')}</span>
              <span class="text-slate-600">|</span>
              <span id="stat-pages" class="text-slate-200 font-bold">~${stats.estimatedPages}</span> ${t('pages')}
            </div>

            <!-- Standard Selector Quick Switch -->
            <div class="flex items-center gap-1.5">
              <span class="text-slate-400 hidden sm:inline">${t('standard')}:</span>
              <select onchange="AURA.changeDocumentStandard(this.value)" class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-medium focus:outline-none focus:border-aura-500">
                <option value="abnt" ${stdId === 'abnt' ? 'selected' : ''}>ABNT</option>
                <option value="apa" ${stdId === 'apa' ? 'selected' : ''}>APA 7th</option>
                <option value="ieee" ${stdId === 'ieee' ? 'selected' : ''}>IEEE</option>
                <option value="vancouver" ${stdId === 'vancouver' ? 'selected' : ''}>Vancouver</option>
                <option value="chicago" ${stdId === 'chicago' ? 'selected' : ''}>Chicago</option>
                <option value="mla" ${stdId === 'mla' ? 'selected' : ''}>MLA</option>
              </select>
            </div>

            <!-- Export Button -->
            <button onclick="AURA.openExportModal()" class="px-2.5 sm:px-3 py-1 rounded bg-aura-600 hover:bg-aura-500 text-white font-semibold flex items-center gap-1 transition-all">
              <i data-lucide="download" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">${t('export')}</span>
            </button>
          </div>

        </div>

        <!-- WORKSPACE (SIDEBAR + MAIN CANVAS + CONTEXT PANEL) -->
        <div class="flex-1 flex overflow-hidden">
          
          <!-- LEFT SIDEBAR: STRUCTURE TREE (ESTRUTURA DO TRABALHO) -->
          <aside class="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between hidden md:flex">
            <div class="p-3 border-b border-slate-800 flex items-center justify-between">
              <span class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="list-tree" class="w-4 h-4 text-aura-400"></i> ${t('structure_title')}
              </span>
              <button onclick="AURA.addSection()" title="Adicionar Seção" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-aura-400">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <!-- Sections List -->
            <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-1 text-xs" id="editor-section-tree">
              <!-- Elementos Pré-Textuais -->
              <div class="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">${t('pre_textual')}</div>
              <div onclick="AURA.scrollToElement('doc-pretextual')" class="tree-item px-2.5 py-1.5 rounded bg-slate-800/40 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer flex items-center gap-2">
                <i data-lucide="file" class="w-3.5 h-3.5 text-slate-400"></i> ${t('title_and_authors')}
              </div>
              <div onclick="AURA.scrollToElement('doc-abstract')" class="tree-item px-2.5 py-1.5 rounded bg-slate-800/40 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer flex items-center gap-2">
                <i data-lucide="align-left" class="w-3.5 h-3.5 text-indigo-400"></i> ${t('abstract_section')}
              </div>

              <!-- Elementos Textuais (Seções Dinâmicas) -->
              <div class="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">${t('textual')}</div>
              ${(currentDoc.sections || []).map((sec, idx) => `
                <div onclick="AURA.scrollToSection('${sec.id}')" class="tree-item px-2.5 py-1.5 rounded bg-slate-800/60 text-slate-200 hover:bg-aura-900/30 hover:text-aura-300 cursor-pointer flex items-center justify-between group">
                  <span class="truncate">${sec.title}</span>
                  <button onclick="event.stopPropagation(); AURA.deleteSection('${sec.id}')" class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                  </button>
                </div>
              `).join('')}

              <!-- Elementos Pós-Textuais -->
              <div class="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">${t('post_textual')}</div>
              <div onclick="AURA.scrollToElement('doc-references')" class="tree-item px-2.5 py-1.5 rounded bg-slate-800/40 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer flex items-center gap-2">
                <i data-lucide="book-marked" class="w-3.5 h-3.5 text-amber-400"></i> ${t('references')} (${(currentDoc.references || []).length})
              </div>
            </div>

            <!-- Quick Action: Auto-Format 1-Click -->
            <div class="p-3 border-t border-slate-800 bg-slate-900/80">
              <button onclick="AURA.applyAutomaticFormat()" class="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 transition-all">
                <i data-lucide="wand-2" class="w-3.5 h-3.5"></i> ${t('auto_format_btn')}
              </button>
            </div>
          </aside>

          <!-- CENTER: CANVAS COM FOLHA ACADÊMICA REAL -->
          <div class="flex-1 academic-page-container overflow-y-auto p-4 lg:p-8 flex justify-center" id="editor-sheet-container">
            
            <!-- Folha A4 Formatada Conforme Norma -->
            <div class="academic-sheet sheet-standard-${stdId} relative rounded shadow-2xl" id="academic-active-sheet">
              
              <!-- Cabeçalho de Página Simulado -->
              <div class="absolute top-4 right-8 text-[10pt] font-mono text-slate-400 no-print select-none">
                Pág. 1
              </div>

              <!-- BLOCO PRÉ-TEXTUAL -->
              <div id="doc-pretextual" class="mb-8">
                <!-- Título -->
                <h1 
                  contenteditable="true" 
                  id="doc-title-input"
                  oninput="AURA.updateDocTitle(this.innerText)"
                  class="text-center font-bold text-xl uppercase mb-4 focus:outline-none focus:ring-1 focus:ring-aura-500 rounded p-1"
                  placeholder="DIGITE O TÍTULO DO SEU TRABALHO CIENTÍFICO"
                >${currentDoc.title || 'DIGITE O TÍTULO DO SEU TRABALHO'}</h1>

                <!-- Autoria -->
                <div 
                  contenteditable="true" 
                  id="doc-authors-input"
                  oninput="AURA.updateDocAuthors(this.innerText)"
                  class="text-center text-sm font-medium mb-8 text-slate-700 focus:outline-none focus:ring-1 focus:ring-aura-500 rounded p-1"
                >${currentDoc.authors || 'Nome do(a) Autor(a) — Instituição / Programa de Pós-Graduação'}</div>

                <!-- Resumo -->
                <div id="doc-abstract" class="bg-slate-50 p-4 rounded border border-slate-200 text-justify text-sm leading-relaxed mb-6">
                  <div class="font-bold text-xs uppercase mb-1">RESUMO</div>
                  <div 
                    contenteditable="true" 
                    id="doc-abstract-input"
                    oninput="AURA.updateDocAbstract(this.innerText)"
                    class="focus:outline-none focus:bg-white p-1 rounded"
                  >${currentDoc.abstract || 'Insira aqui o resumo do seu trabalho de acordo com a norma selecionada...'}</div>
                  
                  <div class="mt-3 text-xs font-bold">
                    Palavras-chave: 
                    <span 
                      contenteditable="true" 
                      id="doc-keywords-input"
                      oninput="AURA.updateDocKeywords(this.innerText)"
                      class="font-normal font-sans focus:outline-none"
                    >${(currentDoc.keywords || []).join('; ')}</span>.
                  </div>
                </div>
              </div>

              <!-- BLOCO TEXTUAL (SEÇÕES DO ARTIGO/PROJETO) -->
              <div class="document-body-content flex flex-col gap-6" id="doc-sections-container">
                ${(currentDoc.sections || []).map((sec, idx) => `
                  <section id="section-${sec.id}" class="academic-section-block">
                    <h2 
                      contenteditable="true" 
                      oninput="AURA.updateSectionTitle('${sec.id}', this.innerText)"
                      class="academic-heading-1 focus:outline-none focus:ring-1 focus:ring-aura-500 rounded"
                    >${sec.title}</h2>
                    <div 
                      contenteditable="true" 
                      id="content-${sec.id}"
                      oninput="AURA.updateSectionContent('${sec.id}', this.innerHTML)"
                      class="academic-section-content text-justify focus:outline-none focus:bg-slate-50/50 p-1 rounded min-h-[60px]"
                    >${sec.content.replace(/\n\n/g, '</p><p class="academic-paragraph">').replace(/^/, '<p class="academic-paragraph">') + '</p>'}</div>
                  </section>
                `).join('')}
              </div>

              <!-- BLOCO PÓS-TEXTUAL (REFERÊNCIAS) -->
              <div id="doc-references" class="mt-12 pt-6 border-t border-slate-300">
                <h2 class="academic-heading-1 text-center font-bold uppercase mb-4">${t('references')}</h2>
                <div id="doc-references-list" class="flex flex-col gap-3 text-xs">
                  ${(currentDoc.references || []).map((ref, idx) => `
                    <div class="flex items-start justify-between gap-2 p-1 hover:bg-slate-50 rounded group">
                      <p contenteditable="true" oninput="AURA.updateReference(${idx}, this.innerText)" class="flex-1 focus:outline-none">${ref}</p>
                      <button onclick="AURA.deleteReference(${idx})" class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs px-1">✕</button>
                    </div>
                  `).join('')}
                </div>
                <button onclick="AURA.addReferencePrompt()" class="mt-3 text-xs text-aura-600 hover:text-aura-800 font-bold flex items-center gap-1 no-print">
                  <i data-lucide="plus" class="w-3 h-3"></i> ${window.AURA && window.AURA.currentLang === 'en' ? 'Add Bibliographic Reference' : 'Adicionar Referência Bibliográfica'}
                </button>
              </div>

            </div>

          </div>

          <!-- RIGHT CONTEXT PANEL (ASSISTENTE IA, ANÁLISE, LOCALIZAR/SUBSTITUIR) -->
          <aside class="w-80 lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col" id="editor-right-panel">
            
            <!-- Panel Tabs -->
            <div class="flex items-center border-b border-slate-800 text-xs font-semibold bg-slate-950/60 p-1 gap-1">
              <button onclick="AURA.setRightTab('ai')" id="tab-btn-ai" class="flex-1 py-1.5 px-2 rounded text-center transition-all bg-aura-600 text-white flex items-center justify-center gap-1">
                <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> ${t('tab_ai')}
              </button>
              <button onclick="AURA.setRightTab('find_replace')" id="tab-btn-find_replace" class="flex-1 py-1.5 px-2 rounded text-center transition-all text-slate-400 hover:text-white flex items-center justify-center gap-1">
                <i data-lucide="replace" class="w-3.5 h-3.5"></i> ${t('tab_find')}
              </button>
              <button onclick="AURA.setRightTab('compliance')" id="tab-btn-compliance" class="flex-1 py-1.5 px-2 rounded text-center transition-all text-slate-400 hover:text-white flex items-center justify-center gap-1">
                <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> ${t('tab_compliance')}
              </button>
            </div>

            <!-- Tab 1: Assistente IA & Redação Acadêmica -->
            <div id="panel-tab-ai" class="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="font-bold text-slate-200 flex items-center gap-1.5">
                    <i data-lucide="pen-line" class="w-4 h-4 text-aura-400"></i> Ações de Redação Acadêmica
                  </span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">UTF-8</span>
                </div>
                
                <div class="grid grid-cols-2 gap-2">
                  <button onclick="AURA.runAIAssist('academic_tone')" class="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-left border border-slate-700/60 flex flex-col gap-1">
                    <span class="font-bold text-aura-300">Tornar Acadêmico</span>
                    <span class="text-[10px] text-slate-400">Eleva o rigor formal</span>
                  </button>
                  <button onclick="AURA.runAIAssist('paraphrase')" class="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-left border border-slate-700/60 flex flex-col gap-1">
                    <span class="font-bold text-indigo-300">Parafrasear</span>
                    <span class="text-[10px] text-slate-400">Gera 4 variações</span>
                  </button>
                  <button onclick="AURA.runAIAssist('concise')" class="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-left border border-slate-700/60 flex flex-col gap-1">
                    <span class="font-bold text-emerald-300">Resumir / Enxugar</span>
                    <span class="text-[10px] text-slate-400">Adequar a limites</span>
                  </button>
                  <button onclick="AURA.runAIAssist('alignment')" class="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-left border border-slate-700/60 flex flex-col gap-1">
                    <span class="font-bold text-amber-300">Alinhamento Lógico</span>
                    <span class="text-[10px] text-slate-400">Problema ↔ Método</span>
                  </button>
                </div>
              </div>

              <!-- Detector de Repetições e Sinônimos -->
              <div class="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-purple-300 flex items-center gap-1.5">
                    <i data-lucide="repeat" class="w-3.5 h-3.5"></i> Palavras Repetidas Detectadas
                  </span>
                  <button onclick="AURA.refreshRepeatedWords()" class="text-[10px] text-aura-400 hover:underline">Atualizar</button>
                </div>
                <div id="repeated-words-container" class="flex flex-col gap-1.5">
                  <!-- Gerado dinamicamente -->
                </div>
              </div>

              <!-- Verificador Ortográfico e Gramatical PT/EN -->
              <div class="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-rose-300 flex items-center gap-1.5">
                    <i data-lucide="spell-check" class="w-3.5 h-3.5"></i> Gramática & Estilo (PT / EN)
                  </span>
                  <select onchange="AURA.changeSpellLanguage(this.value)" class="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300">
                    <option value="pt">Português (BR)</option>
                    <option value="en">English (Academic)</option>
                  </select>
                </div>
                <div id="spell-issues-container" class="flex flex-col gap-1.5">
                  <!-- Gerado dinamicamente -->
                </div>
              </div>

              <!-- Live AI Suggestion Diff Box (Antes -> Depois) -->
              <div id="ai-diff-container" class="hidden bg-slate-950 rounded-xl p-3 border border-aura-500/40 flex flex-col gap-2">
                <div class="font-bold text-aura-400 flex items-center justify-between">
                  <span>Sugestão da IA (Antes → Depois)</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-aura-500/20 text-aura-300">Prévia</span>
                </div>
                <div class="p-2 rounded bg-rose-950/40 border border-rose-800/40 text-rose-200">
                  <div class="text-[10px] font-bold uppercase text-rose-400">Original:</div>
                  <div id="ai-diff-original" class="mt-0.5">...</div>
                </div>
                <div class="p-2 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-200">
                  <div class="text-[10px] font-bold uppercase text-emerald-400">Sugerido:</div>
                  <div id="ai-diff-suggested" class="mt-0.5">...</div>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <button onclick="AURA.acceptDiff()" class="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-center">
                    Aceitar Alteração
                  </button>
                  <button onclick="AURA.rejectDiff()" class="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                    Rejeitar
                  </button>
                </div>
              </div>

            </div>

            <!-- Tab 2: Localizar e Substituir (Find & Replace) -->
            <div id="panel-tab-find_replace" class="hidden flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
              <div class="font-bold text-slate-200 flex items-center gap-1.5">
                <i data-lucide="search" class="w-4 h-4 text-amber-400"></i> Localizar e Substituir em Lote
              </div>

              <div class="flex flex-col gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <div>
                  <label class="block text-slate-400 text-[11px] mb-1">Localizar termo:</label>
                  <input type="text" id="find-input" placeholder="Ex: através de, metodologias..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400">
                </div>

                <div>
                  <label class="block text-slate-400 text-[11px] mb-1">Substituir por:</label>
                  <input type="text" id="replace-input" placeholder="Ex: por meio de, métodos..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-emerald-400">
                </div>

                <div class="flex flex-col gap-1.5 text-slate-300 text-[11px]">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="find-opt-case" class="rounded bg-slate-900 border-slate-700 text-amber-500">
                    Diferenciar maiúsculas/minúsculas
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="find-opt-word" class="rounded bg-slate-900 border-slate-700 text-amber-500">
                    Apenas palavras inteiras
                  </label>
                </div>

                <div class="flex items-center gap-2 pt-2 border-t border-slate-700">
                  <button onclick="AURA.execFindAndReplace(false)" class="flex-1 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-medium text-center">
                    Substituir Próxima
                  </button>
                  <button onclick="AURA.execFindAndReplace(true)" class="flex-1 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-center">
                    Substituir Tudo
                  </button>
                </div>
              </div>

              <div id="find-replace-results" class="text-slate-400 text-center text-xs"></div>
            </div>

            <!-- Tab 3: Conformidade e Diagnóstico -->
            <div id="panel-tab-compliance" class="hidden flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-200 flex items-center gap-1.5">
                  <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i> Diagnóstico de Conformidade
                </span>
                <span id="panel-score-badge" class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">92%</span>
              </div>

              <div id="compliance-issues-list" class="flex flex-col gap-2">
                <!-- Inserido dinamicamente via RulesEngine -->
              </div>
            </div>

          </aside>

        </div>

      </div>
    `;
  }

  getFullDocumentText(doc) {
    if (!doc) return '';
    const parts = [
      doc.title || '',
      doc.abstract || '',
      (doc.sections || []).map(s => (s.title + ' ' + s.content)).join(' '),
      (doc.references || []).join(' ')
    ];
    return parts.join(' ');
  }
}

window.auraEditorView = new AuraEditorView();
