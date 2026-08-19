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
    const openDocs = (window.AURA && window.AURA.openDocuments) || [currentDoc];
    const stats = window.auraLanguage ? window.auraLanguage.calculateStats(this.getFullDocumentText(currentDoc)) : { words: 0, charsWithSpaces: 0, estimatedPages: 0 };
    const t = (key) => window.AURA ? window.AURA.t(key) : key;

    container.innerHTML = `
      <div class="flex-1 flex flex-col min-h-[calc(100vh-61px)] bg-slate-950">
        
        <!-- EDITOR TOP TOOLBAR (Header, Ferramentas & Abas de Documentos - FIXO) -->
        <div class="editor-sticky-toolbar bg-slate-900 border-b border-slate-800 shadow-md">
          
          <!-- Toolbar Principal de Formatação -->
          <div class="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 text-xs z-40 whitespace-nowrap overflow-x-auto relative border-b border-slate-800/80">
            <!-- History & Basic Formatting -->
            <div class="flex items-center gap-1 flex-shrink-0">
              <!-- Undo / Redo -->
              <button onclick="AURA.undo()" title="Desfazer (Ctrl+Z)" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 font-medium">
                <i data-lucide="undo-2" class="w-4 h-4 text-aura-400"></i>
                <span class="hidden sm:inline">Desfazer</span>
              </button>
              <button onclick="AURA.redo()" title="Refazer (Ctrl+Y)" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 font-medium">
                <i data-lucide="redo-2" class="w-4 h-4 text-aura-400"></i>
                <span class="hidden sm:inline">Refazer</span>
              </button>
              <div class="h-4 w-px bg-slate-700 mx-1"></div>

              <!-- Seleção de Fontes Oficiais Acadêmicas -->
              <div class="flex items-center gap-1">
                <select onchange="AURA.changeDocFont(this.value)" id="editor-font-select" class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-medium focus:outline-none focus:border-aura-500">
                  <option value="Times New Roman" selected>Times New Roman (ABNT / APA / IEEE)</option>
                  <option value="Arial">Arial (ABNT / Vancouver)</option>
                  <option value="Calibri">Calibri (APA 7th)</option>
                  <option value="Georgia">Georgia (Chicago 17th)</option>
                  <option value="Helvetica">Helvetica (Vancouver)</option>
                </select>

                <!-- Botão Circular de Cores & Color Picker com Preservação de Seleção -->
                <div class="relative flex items-center justify-center ml-0.5" title="Cor do Texto Selecionado">
                  <button 
                    type="button" 
                    onclick="AURA.triggerColorPicker()" 
                    onmousedown="AURA.saveCurrentSelection()"
                    class="w-6 h-6 rounded-full border-2 border-slate-600 hover:border-aura-400 cursor-pointer flex items-center justify-center overflow-hidden bg-gradient-to-tr from-rose-500 via-amber-400 to-sky-400 shadow-sm transition-all hover:scale-105"
                  >
                  </button>
                  <input 
                    type="color" 
                    id="editor-text-color" 
                    value="#000000" 
                    onchange="AURA.applyTextColor(this.value)" 
                    class="opacity-0 w-0 h-0 absolute pointer-events-none"
                  />
                </div>

                <!-- Botão Ciclo de Alinhamento (Justificado, Esquerda, Centralizado, Direita) -->
                <button 
                  id="btn-alignment-cycle"
                  onclick="AURA.cycleTextAlignment()" 
                  title="Alinhamento: Justificado / Esquerda / Centralizado / Direita" 
                  class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all"
                >
                  <i data-lucide="align-justify" class="w-4 h-4 text-slate-300" id="alignment-icon"></i>
                </button>
              </div>
              <div class="h-4 w-px bg-slate-700 mx-1"></div>

              <button onclick="AURA.execCommand('bold')" title="Negrito (Ctrl+B)" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"><i data-lucide="bold" class="w-4 h-4"></i></button>
              <button onclick="AURA.execCommand('italic')" title="Itálico (Ctrl+I)" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"><i data-lucide="italic" class="w-4 h-4"></i></button>
              <button onclick="AURA.execCommand('underline')" title="Sublinhado (Ctrl+U)" class="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"><i data-lucide="underline" class="w-4 h-4"></i></button>
              <div class="h-4 w-px bg-slate-700 mx-1"></div>

              <!-- Intuitive Citation Selector Dropdown (Fixed z-index) -->
              <div class="relative inline-block text-left z-50">
                <button onclick="AURA.toggleCitationMenu()" id="btn-citation-dropdown" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 font-medium border border-slate-700 shadow-sm">
                  <i data-lucide="bookmark" class="w-3.5 h-3.5 text-indigo-400"></i>
                  <span>Citação</span>
                  <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400"></i>
                </button>
                <div id="citation-dropdown-menu" class="hidden absolute left-0 top-full mt-1.5 w-60 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-[100] py-1.5 flex flex-col gap-1 text-xs backdrop-blur-xl">
                  <button onclick="AURA.insertDirectCitation()" class="px-3 py-2 text-left text-slate-200 hover:bg-slate-800 hover:text-white flex flex-col">
                    <span class="font-bold text-indigo-300">Citação Direta Curta</span>
                    <span class="text-[10px] text-slate-400">Até 3 linhas entre aspas ("...")</span>
                  </button>
                  <button onclick="AURA.insertLongQuote()" class="px-3 py-2 text-left text-slate-200 hover:bg-slate-800 hover:text-white flex flex-col">
                    <span class="font-bold text-aura-300">Citação Direta Longa</span>
                    <span class="text-[10px] text-slate-400">+3 linhas, recuo 4cm e corpo 10pt</span>
                  </button>
                  <button onclick="AURA.insertIndirectCitation()" class="px-3 py-2 text-left text-slate-200 hover:bg-slate-800 hover:text-white flex flex-col">
                    <span class="font-bold text-emerald-300">Citação Indireta / Paráfrase</span>
                    <span class="text-[10px] text-slate-400">Ideia com autor (Autor, Ano)</span>
                  </button>
                  <button onclick="AURA.insertApudCitation()" class="px-3 py-2 text-left text-slate-200 hover:bg-slate-800 hover:text-white flex flex-col">
                    <span class="font-bold text-amber-300">Citação de Outro Autor (Apud)</span>
                    <span class="text-[10px] text-slate-400">Citação de citação (Silva apud Souza)</span>
                  </button>
                </div>
              </div>

              <button onclick="AURA.insertImageModal()" title="Inserir Imagem / Figura com Legenda ABNT" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1">
                <i data-lucide="image" class="w-3.5 h-3.5 text-emerald-400"></i> <span class="hidden sm:inline">Figura</span>
              </button>
              <button onclick="AURA.insertTable()" title="Inserir Tabela Acadêmica com Fonte" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1">
                <i data-lucide="table" class="w-3.5 h-3.5 text-blue-400"></i> <span class="hidden sm:inline">Tabela</span>
              </button>
              <button onclick="AURA.openHeaderFooterModal()" title="Configurar Numeração, Cabeçalho e Rodapé" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1">
                <i data-lucide="layout-template" class="w-3.5 h-3.5 text-purple-400"></i> <span class="hidden sm:inline">Cabeçalho/Rodapé</span>
              </button>
              <!-- Botão de Histórico de Edições -->
              <button onclick="AURA.openHistoryModal()" title="Histórico de Edições e Versões Salvas" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white flex items-center gap-1 border border-indigo-500/30 shadow-sm">
                <i data-lucide="history" class="w-3.5 h-3.5 text-indigo-400"></i> <span class="hidden sm:inline">Histórico</span>
              </button>
            </div>

            <!-- Standard Selector & Export Action -->
            <div class="flex items-center gap-2 sm:gap-3 text-slate-400 flex-shrink-0">
              <!-- Mobile Drawer Toggle: Estrutura -->
              <button onclick="AURA.toggleMobileDrawer('left')" class="md:hidden p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 text-[11px]" title="Ver Estrutura do Trabalho">
                <i data-lucide="list-tree" class="w-4 h-4 text-aura-400"></i>
                <span>Estrutura</span>
              </button>

              <!-- Mobile Drawer Toggle: IA / Conformidade -->
              <button onclick="AURA.toggleMobileDrawer('right')" class="md:hidden p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white flex items-center gap-1 text-[11px]" title="Ver Assistente IA e Conformidade">
                <i data-lucide="sparkles" class="w-4 h-4 text-purple-400"></i>
                <span>IA</span>
              </button>

              <div class="flex items-center gap-1.5">
                <span class="text-slate-400 hidden sm:inline">${t('standard')}:</span>
                <select onchange="AURA.changeDocumentStandard(this.value)" class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-medium focus:outline-none focus:border-aura-500">
                  <option value="abnt" ${stdId === 'abnt' ? 'selected' : ''}>ABNT (Brasil)</option>
                  <option value="apa" ${stdId === 'apa' ? 'selected' : ''}>APA 7th (Internacional)</option>
                  <option value="ieee" ${stdId === 'ieee' ? 'selected' : ''}>IEEE (2 Colunas)</option>
                  <option value="vancouver" ${stdId === 'vancouver' ? 'selected' : ''}>Vancouver (Medicina)</option>
                  <option value="chicago" ${stdId === 'chicago' ? 'selected' : ''}>Chicago 17th (Humanas)</option>
                  <option value="mla" ${stdId === 'mla' ? 'selected' : ''}>MLA 9th (Letras)</option>
                </select>
              </div>

              <!-- Export Button -->
              <button onclick="AURA.openExportModal()" class="px-2.5 sm:px-3 py-1 rounded bg-aura-600 hover:bg-aura-500 text-white font-semibold flex items-center gap-1 transition-all shadow-md shadow-aura-600/30">
                <i data-lucide="download" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">${t('export')}</span>
              </button>
            </div>
          </div>

          <!-- ABAS DE TRABALHOS ABERTOS (DRAGGABLE MULTI-DOCUMENT TABS) -->
          <div class="px-3 sm:px-4 py-1.5 bg-slate-950 flex items-center gap-1.5 overflow-x-auto text-xs border-t border-slate-800/40 select-none">
            <span class="text-[10px] text-slate-500 uppercase tracking-wider font-bold mr-1 flex items-center gap-1">
              <i data-lucide="files" class="w-3 h-3 text-slate-400"></i> Abas:
            </span>
            ${openDocs.map((doc, dIdx) => {
              const isActive = doc.id === currentDoc.id;
              return `
                <div 
                  draggable="true"
                  ondragstart="AURA.handleTabDragStart(event, ${dIdx})"
                  ondragover="event.preventDefault()"
                  ondrop="AURA.handleTabDrop(event, ${dIdx})"
                  onclick="AURA.openDocument('${doc.id}')"
                  class="group flex items-center gap-2 px-3 py-1 rounded-t-lg transition-all cursor-pointer border ${isActive ? 'bg-slate-900 border-slate-700 text-white font-bold border-b-transparent shadow-sm' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}"
                  title="${doc.title}"
                >
                  <i data-lucide="file-text" class="w-3.5 h-3.5 ${isActive ? 'text-aura-400' : 'text-slate-500'}"></i>
                  <span class="truncate max-w-[140px] sm:max-w-[200px] text-[11px]">${doc.title || 'Documento sem título'}</span>
                  <button 
                    onclick="AURA.closeDocumentTab(event, '${doc.id}')"
                    class="opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded p-0.5 text-slate-400 hover:text-rose-400 transition-opacity"
                    title="Fechar Aba"
                  >
                    <i data-lucide="x" class="w-3 h-3"></i>
                  </button>
                </div>
              `;
            }).join('')}
            <button onclick="AURA.openNewDocModal()" title="Novo Trabalho" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all ml-1">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
          </div>

        </div>

        <!-- WORKSPACE (SIDEBAR + MAIN CANVAS + CONTEXT PANEL) -->
        <div class="flex-1 flex flex-col md:flex-row relative">
          
          <!-- MOBILE BACKDROP -->
          <div id="editor-mobile-backdrop" onclick="AURA.closeMobileDrawers()" class="hidden drawer-backdrop md:hidden"></div>

          <!-- LEFT SIDEBAR: STRUCTURE TREE (ESTRUTURA DO TRABALHO - FIXO NO DESKTOP, DRAWER NO MOBILE) -->
          <aside id="editor-left-sidebar" class="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 editor-sticky-sidebar editor-drawer-mobile editor-drawer-left">
            <div>
              <div class="p-3 border-b border-slate-800 flex items-center justify-between">
                <span class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <i data-lucide="list-tree" class="w-4 h-4 text-aura-400"></i> ${t('structure_title')}
                </span>
                <div class="flex items-center gap-1">
                  <button onclick="AURA.addSection()" title="Adicionar Seção" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-aura-400">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                  </button>
                  <button onclick="AURA.closeMobileDrawers()" class="md:hidden p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white">
                    <i data-lucide="x" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>

              <!-- Quick Action: Auto-Format 1-Click (Próximo da estrutura do trabalho) -->
              <div class="p-2.5 border-b border-slate-800 bg-slate-900/90">
                <button onclick="AURA.applyAutomaticFormat()" class="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 transition-all">
                  <i data-lucide="wand-2" class="w-3.5 h-3.5"></i> ${t('auto_format_btn')}
                </button>
              </div>
            </div>

            <!-- Sections List: Títulos Idênticos aos da Folha -->
            <div class="p-2 flex flex-col gap-1 text-xs flex-1" id="editor-section-tree">
              <!-- Elementos Pré-Textuais -->
              <div class="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">${t('pre_textual')}</div>
              <div onclick="AURA.scrollToElement('doc-pretextual')" class="tree-item px-2.5 py-1.5 rounded bg-slate-800/40 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer flex items-center gap-2">
                <i data-lucide="file" class="w-3.5 h-3.5 text-slate-400"></i> 
                <span class="truncate" id="sidebar-title-display">${currentDoc.title || 'Título & Autoria'}</span>
              </div>
              <div onclick="AURA.scrollToElement('doc-abstract')" class="tree-item px-2.5 py-1.5 rounded bg-slate-800/40 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer flex items-center gap-2">
                <i data-lucide="align-left" class="w-3.5 h-3.5 text-indigo-400"></i> 
                <span>${stdId === 'apa' || stdId === 'ieee' || stdId === 'mla' ? 'Abstract' : 'Resumo'}</span>
              </div>

              <!-- Elementos Textuais (Seções Dinâmicas Sincronizadas) -->
              <div class="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">${t('textual')}</div>
              ${(currentDoc.sections || []).map((sec, idx) => `
                <div onclick="AURA.scrollToSection('${sec.id}')" class="tree-item px-2.5 py-1.5 rounded bg-slate-800/60 text-slate-200 hover:bg-aura-900/30 hover:text-aura-300 cursor-pointer flex items-center justify-between group">
                  <span class="truncate" id="sidebar-sec-${sec.id}">${sec.title}</span>
                  <button onclick="event.stopPropagation(); AURA.deleteSection('${sec.id}')" class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                  </button>
                </div>
              `).join('')}

              <!-- Elementos Pós-Textuais -->
              <div class="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">${t('post_textual')}</div>
              <div onclick="AURA.scrollToElement('doc-references')" class="tree-item px-2.5 py-1.5 rounded bg-slate-800/40 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer flex items-center gap-2">
                <i data-lucide="book-marked" class="w-3.5 h-3.5 text-amber-400"></i> 
                <span>${stdId === 'mla' ? 'Works Cited' : (stdId === 'chicago' ? 'Bibliography' : (stdId === 'apa' || stdId === 'ieee' ? 'References' : 'Referências'))}</span>
                <span class="text-[10px] text-slate-400">(${(currentDoc.references || []).length})</span>
              </div>
            </div>
          </aside>

          <!-- CENTER: CANVAS COM FOLHAS ACADÊMICAS REAIS A4 (ESTILO WORD / GOOGLE DOCS) -->
          <div class="flex-1 academic-page-container overflow-y-auto p-4 sm:p-6 lg:p-10 flex flex-col items-center pb-28" id="editor-sheet-container">
            
            <div id="academic-sheets-wrapper" class="w-full max-w-[210mm] flex flex-col items-center transition-all">
              
              <!-- FOLHA A4 - PÁGINA 1 (PRÉ-TEXTUAL & INTRODUÇÃO) -->
              <div class="academic-page-sheet sheet-standard-${stdId}" id="academic-sheet-1" data-page="1">
                <!-- Cabeçalho de Página e Numeração Conforme Configuração -->
                <div class="flex items-center justify-between text-[10pt] font-mono text-slate-500 mb-6 pb-2 border-b border-slate-200 select-none">
                  <div class="text-left font-sans text-xs text-slate-400 uppercase tracking-wider">
                    ${(currentDoc.pageConfig && currentDoc.pageConfig.headerText) || ''}
                  </div>
                  <div class="text-right font-mono font-bold text-slate-500">
                    ${this.formatPageNumber(currentDoc.pageConfig, 1)}
                  </div>
                </div>

                <!-- BLOCO PRÉ-TEXTUAL -->
                <div id="doc-pretextual" class="mb-6">
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
                    class="text-center text-sm font-medium mb-6 text-slate-700 focus:outline-none focus:ring-1 focus:ring-aura-500 rounded p-1"
                  >${currentDoc.authors || 'Nome do(a) Autor(a) — Instituição / Programa de Pós-Graduação'}</div>

                  <!-- Resumo -->
                  <div id="doc-abstract" class="bg-slate-50 p-4 rounded border border-slate-200 text-justify text-sm leading-relaxed mb-4">
                    <div class="font-bold text-xs uppercase mb-1">${stdId === 'apa' || stdId === 'ieee' || stdId === 'mla' ? 'ABSTRACT' : 'RESUMO'}</div>
                    <div 
                      contenteditable="true" 
                      id="doc-abstract-input"
                      oninput="AURA.updateDocAbstract(this.innerText)"
                      class="focus:outline-none focus:bg-white p-1 rounded"
                    >${currentDoc.abstract || 'Insira aqui o resumo do seu trabalho de acordo com a norma selecionada...'}</div>
                    
                    <div class="mt-3 text-xs font-bold">
                      ${stdId === 'apa' || stdId === 'ieee' || stdId === 'mla' ? 'Keywords:' : 'Palavras-chave:'} 
                      <span 
                        contenteditable="true" 
                        id="doc-keywords-input"
                        oninput="AURA.updateDocKeywords(this.innerText)"
                        class="font-normal font-sans focus:outline-none"
                      >${(currentDoc.keywords || []).join('; ')}</span>.
                    </div>
                  </div>
                </div>

                <!-- Seção 1: Introdução / Contexto Inicial -->
                ${currentDoc.sections && currentDoc.sections[0] ? `
                  <section id="section-${currentDoc.sections[0].id}" class="academic-section-block">
                    <h2 
                      contenteditable="true" 
                      oninput="AURA.updateSectionTitle('${currentDoc.sections[0].id}', this.innerText)"
                      class="academic-heading-1 focus:outline-none focus:ring-1 focus:ring-aura-500 rounded"
                    >${currentDoc.sections[0].title}</h2>
                    <div 
                      contenteditable="true" 
                      id="content-${currentDoc.sections[0].id}"
                      oninput="AURA.updateSectionContent('${currentDoc.sections[0].id}', this.innerHTML)"
                      class="academic-section-content text-justify focus:outline-none focus:bg-slate-50/50 p-1 rounded min-h-[60px]"
                    >${currentDoc.sections[0].content.replace(/\n\n/g, '</p><p class="academic-paragraph">').replace(/^/, '<p class="academic-paragraph">') + '</p>'}</div>
                  </section>
                ` : ''}

                <!-- Rodapé da Folha 1 (Editável diretamente na folha) -->
                <div class="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-[8.5pt] text-slate-400">
                  <div 
                    contenteditable="true" 
                    id="doc-footer-input-1"
                    oninput="AURA.updateDocFooterDirect(this.innerText)"
                    title="Clique para editar o rodapé do trabalho"
                    class="focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-aura-400 rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-50/80 cursor-text min-w-[120px]"
                  >${(currentDoc.pageConfig && currentDoc.pageConfig.footerText) || 'Insira uma nota de rodapé ou afiliação...'}</div>
                  <div class="text-[8pt] text-slate-300 uppercase select-none">${stdId.toUpperCase()} • PÁG. 1</div>
                </div>
              </div>

              <!-- FOLHA A4 - PÁGINA 2 (CORPO PRINCIPAL / METODOLOGIA / RESULTADOS) -->
              <div class="academic-page-sheet sheet-standard-${stdId}" id="academic-sheet-2" data-page="2">
                <!-- Cabeçalho de Página e Numeração (Editável diretamente na folha) -->
                <div class="flex items-center justify-between text-[10pt] font-mono text-slate-500 mb-6 pb-2 border-b border-slate-200">
                  <div 
                    contenteditable="true" 
                    id="doc-header-input-2"
                    oninput="AURA.updateDocHeaderDirect(this.innerText)"
                    title="Clique para editar o cabeçalho superior"
                    class="text-left font-sans text-xs text-slate-500 uppercase tracking-wider focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-aura-400 rounded px-1.5 py-0.5 hover:bg-slate-50/80 cursor-text min-w-[180px]"
                  >
                    ${(currentDoc.pageConfig && currentDoc.pageConfig.headerText) || currentDoc.title || 'Título Curto do Trabalho / Cabeçalho Superior'}
                  </div>
                  <div class="text-right font-mono font-bold text-slate-500 select-none">
                    ${this.formatPageNumber(currentDoc.pageConfig, 2)}
                  </div>
                </div>

                <!-- Seções do Meio -->
                <div class="document-body-content flex flex-col gap-6" id="doc-sections-container">
                  ${(currentDoc.sections || []).slice(1).map((sec, idx) => `
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

                <!-- Rodapé da Folha 2 (Editável diretamente na folha) -->
                <div class="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-[8.5pt] text-slate-400">
                  <div 
                    contenteditable="true" 
                    id="doc-footer-input-2"
                    oninput="AURA.updateDocFooterDirect(this.innerText)"
                    title="Clique para editar o rodapé do trabalho"
                    class="focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-aura-400 rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-50/80 cursor-text min-w-[120px]"
                  >${(currentDoc.pageConfig && currentDoc.pageConfig.footerText) || ''}</div>
                  <div class="text-[8pt] text-slate-300 uppercase select-none">${stdId.toUpperCase()} • PÁG. 2</div>
                </div>
              </div>

              <!-- FOLHA A4 - PÁGINA 3 (ELEMENTOS PÓS-TEXTUAIS & REFERÊNCIAS BIBLIOGRÁFICAS) -->
              <div class="academic-page-sheet sheet-standard-${stdId}" id="academic-sheet-3" data-page="3">
                <!-- Cabeçalho de Página e Numeração (Editável diretamente na folha) -->
                <div class="flex items-center justify-between text-[10pt] font-mono text-slate-500 mb-6 pb-2 border-b border-slate-200">
                  <div 
                    contenteditable="true" 
                    id="doc-header-input-3"
                    oninput="AURA.updateDocHeaderDirect(this.innerText)"
                    title="Clique para editar o cabeçalho superior"
                    class="text-left font-sans text-xs text-slate-500 uppercase tracking-wider focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-aura-400 rounded px-1.5 py-0.5 hover:bg-slate-50/80 cursor-text min-w-[180px]"
                  >
                    ${(currentDoc.pageConfig && currentDoc.pageConfig.headerText) || currentDoc.title || 'Título Curto do Trabalho / Cabeçalho Superior'}
                  </div>
                  <div class="text-right font-mono font-bold text-slate-500 select-none">
                    ${this.formatPageNumber(currentDoc.pageConfig, 3)}
                  </div>
                </div>

                <!-- Referências -->
                <div id="doc-references" class="flex-1">
                  <h2 class="academic-heading-1 text-center font-bold uppercase mb-4">
                    ${stdId === 'mla' ? 'WORKS CITED' : (stdId === 'chicago' ? 'BIBLIOGRAPHY' : (stdId === 'apa' || stdId === 'ieee' ? 'REFERENCES' : 'REFERÊNCIAS'))}
                  </h2>
                  <div id="doc-references-list" class="flex flex-col gap-3 text-xs">
                    ${(currentDoc.references || []).map((ref, idx) => `
                      <div class="flex items-start justify-between gap-2 p-1.5 hover:bg-slate-50 rounded group">
                        <p contenteditable="true" oninput="AURA.updateReference(${idx}, this.innerText)" class="flex-1 focus:outline-none">${ref}</p>
                        <button onclick="AURA.deleteReference(${idx})" class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs px-1">✕</button>
                      </div>
                    `).join('')}
                  </div>
                  <button onclick="AURA.addReferencePrompt()" class="mt-4 text-xs text-aura-600 hover:text-aura-800 font-bold flex items-center gap-1 no-print">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i> ${window.AURA && window.AURA.currentLang === 'en' ? 'Add Bibliographic Reference' : 'Adicionar Referência Bibliográfica'}
                  </button>
                </div>

                <!-- Rodapé da Folha 3 -->
                <div class="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-[8.5pt] text-slate-400 select-none">
                  <div>${(currentDoc.pageConfig && currentDoc.pageConfig.footerText) || ''}</div>
                  <div class="text-[8pt] text-slate-300 uppercase">${stdId.toUpperCase()} • PÁG. 3</div>
                </div>
              </div>

            </div>

            <!-- FLOATING STATS PILL & ZOOM / AUDIO CONTROLS (CENTRALIZADO COM A PÁGINA) -->
            <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-2xl px-4 py-2 flex items-center gap-3 text-xs text-slate-300 animate-fade-in no-print max-w-[95vw] overflow-x-auto">
              <!-- Auto-Save Status Indicator -->
              <div class="flex items-center gap-1.5 font-medium text-[11px] text-emerald-400" id="auto-save-badge" title="Salvamento automático local ativo">
                <i data-lucide="check" class="w-3.5 h-3.5" id="auto-save-icon"></i>
                <span class="hidden sm:inline" id="auto-save-text">Salvo</span>
              </div>

              <div class="h-4 w-px bg-slate-700 hidden sm:block"></div>

              <!-- Métricas Reais -->
              <div class="flex items-center gap-2 font-mono">
                <span class="flex items-center gap-1">
                  <strong id="float-stat-words" class="text-white font-bold">${stats.words}</strong> pal.
                </span>
                <span class="text-slate-600">•</span>
                <span class="flex items-center gap-1">
                  <strong id="float-stat-chars" class="text-white font-bold">${stats.charsWithSpaces}</strong> car.
                </span>
                <span class="text-slate-600">•</span>
                <span class="flex items-center gap-1">
                  <strong id="float-stat-pages" class="text-white font-bold">~${stats.estimatedPages}</strong> pág.
                </span>
              </div>

              <div class="h-4 w-px bg-slate-700"></div>

              <!-- Botões de Zoom (+ / -) -->
              <div class="flex items-center gap-1">
                <button onclick="AURA.adjustSheetZoom(-0.1)" title="Diminuir Zoom / Tamanho (-)" class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm transition-all">
                  -
                </button>
                <span id="sheet-zoom-level" class="text-[10px] font-mono text-slate-400 w-8 text-center">100%</span>
                <button onclick="AURA.adjustSheetZoom(0.1)" title="Aumentar Zoom / Tamanho (+)" class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm transition-all">
                  +
                </button>
              </div>

              <div class="h-4 w-px bg-slate-700"></div>

              <!-- Botão de Acessibilidade: Leitura em Voz Didática Feminina (Apenas Ícone Profissional) -->
              <button onclick="AURA.toggleSpeechPresentation()" id="btn-speech-read" title="Apresentação Oral com Voz Didática" class="p-2 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/50 flex items-center justify-center font-bold transition-all shadow-md">
                <i data-lucide="volume-2" class="w-4 h-4 text-purple-300" id="speech-icon"></i>
              </button>
            </div>

          </div>

          <!-- RIGHT CONTEXT PANEL (ASSISTENTE IA, ANÁLISE, LOCALIZAR/SUBSTITUIR - FIXO NO DESKTOP, DRAWER NO MOBILE) -->
          <aside class="w-full md:w-80 lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 editor-sticky-sidebar editor-drawer-mobile editor-drawer-right" id="editor-right-panel">
            
            <!-- Mobile Close Header -->
            <div class="md:hidden p-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span class="text-xs font-bold text-white flex items-center gap-1.5">
                <i data-lucide="sparkles" class="w-4 h-4 text-purple-400"></i> Assistente IA & Conformidade
              </span>
              <button onclick="AURA.closeMobileDrawers()" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>

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
                    <span class="text-[10px] text-slate-400">Preserva citações</span>
                  </button>
                  <button onclick="AURA.runAIAssist('concise')" class="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-left border border-slate-700/60 flex flex-col gap-1">
                    <span class="font-bold text-emerald-300">Resumir / Enxugar</span>
                    <span class="text-[10px] text-slate-400">Adequar a limites</span>
                  </button>
                  <button onclick="AURA.runAIAssist('thesis_to_paper')" class="p-2 rounded bg-gradient-to-br from-indigo-950/80 to-purple-950/80 hover:from-indigo-900 hover:to-purple-900 text-slate-200 text-left border border-indigo-500/50 flex flex-col gap-1 shadow-md">
                    <span class="font-bold text-indigo-300 flex items-center gap-1">
                      <i data-lucide="book-open-check" class="w-3.5 h-3.5 text-indigo-400"></i> Tese/Dissertação → Artigo
                    </span>
                    <span class="text-[10px] text-slate-300">Condensa em artigo IMRaD</span>
                  </button>
                </div>
              </div>

              <!-- Detector de Repetições e Sinônimos (Retrátil com Toggle) -->
              <div class="bg-slate-800/60 rounded-xl border border-slate-700/60 flex flex-col overflow-hidden">
                <div class="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/80 transition-colors" onclick="AURA.toggleRepeatedWordsBox()">
                  <span class="font-bold text-purple-300 flex items-center gap-1.5 select-none">
                    <i data-lucide="repeat" class="w-3.5 h-3.5"></i> Palavras Repetidas Detectadas
                  </span>
                  <div class="flex items-center gap-2">
                    <button onclick="event.stopPropagation(); AURA.refreshRepeatedWords(true)" class="text-[10px] text-aura-400 hover:underline">Atualizar</button>
                    <i data-lucide="chevron-down" class="w-4 h-4 text-purple-400 transition-transform duration-200" id="repeated-words-chevron"></i>
                  </div>
                </div>
                <div id="repeated-words-container" class="p-3 pt-0 flex flex-col gap-1.5">
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

              <!-- Live AI Suggestion Diff Box -->
              <div id="ai-diff-container" class="hidden bg-slate-950 rounded-xl p-3 border border-aura-500/40 flex flex-col gap-2">
                <div class="font-bold text-aura-400 flex items-center justify-between">
                  <span>Sugestão da IA</span>
                  <div class="flex items-center gap-1">
                    <button onclick="AURA.undo()" title="Desfazer" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white">
                      <i data-lucide="undo-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="AURA.redo()" title="Refazer" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white">
                      <i data-lucide="redo-2" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </div>
                <div class="p-2 rounded bg-rose-950/40 border border-rose-800/40 text-rose-200">
                  <div class="text-[10px] font-bold uppercase text-rose-400">Original:</div>
                  <div id="ai-diff-original" class="mt-0.5 max-h-24 overflow-y-auto">...</div>
                </div>
                <div class="p-2 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-200">
                  <div class="text-[10px] font-bold uppercase text-emerald-400">Sugerido:</div>
                  <div id="ai-diff-suggested" class="mt-0.5 max-h-24 overflow-y-auto">...</div>
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
              <div class="font-bold text-slate-200 flex items-center justify-between">
                <span class="flex items-center gap-1.5">
                  <i data-lucide="search" class="w-4 h-4 text-amber-400"></i> Localizar e Substituir
                </span>
                <span id="find-counter-badge" class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-mono hidden">0/0</span>
              </div>

              <div class="flex flex-col gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-slate-400 text-[11px]">Localizar termo:</label>
                    <div class="flex items-center gap-1">
                      <button onclick="AURA.findPrevMatch()" title="Ocorrência Anterior (Shift+F3)" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                        <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
                      </button>
                      <button onclick="AURA.findNextMatch()" title="Próxima Ocorrência (F3)" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                        <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                      </button>
                    </div>
                  </div>
                  <input type="text" id="find-input" oninput="AURA.onFindInputChange(this.value)" placeholder="Digite o termo para destacar na folha..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400">
                </div>

                <div>
                  <label class="block text-slate-400 text-[11px] mb-1">Substituir por:</label>
                  <input type="text" id="replace-input" placeholder="Novo texto substituto..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-emerald-400">
                </div>

                <div class="flex flex-col gap-1.5 text-slate-300 text-[11px]">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="find-opt-case" onchange="AURA.onFindInputChange(document.getElementById('find-input').value)" class="rounded bg-slate-900 border-slate-700 text-amber-500">
                    Diferenciar maiúsculas/minúsculas
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="find-opt-word" onchange="AURA.onFindInputChange(document.getElementById('find-input').value)" class="rounded bg-slate-900 border-slate-700 text-amber-500">
                    Apenas palavras inteiras
                  </label>
                </div>

                <div class="flex items-center gap-2 pt-2 border-t border-slate-700">
                  <button onclick="AURA.execFindAndReplace(false)" class="flex-1 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-medium text-center">
                    Substituir Esta
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

  formatPageNumber(cfg = {}, pageNum = 1) {
    if (!cfg) return `Pág. ${pageNum}`;
    const startFrom = cfg.startPageNumber || 1;
    if (pageNum < startFrom) return '';
    if (cfg.applyOnlyOdd && pageNum % 2 === 0) return '';

    const format = cfg.numFormat || 'arabic';
    if (format === 'roman') {
      const romanNums = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
      return romanNums[pageNum] || `${pageNum}`;
    }
    if (format === 'roman_upper') {
      const romanNums = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
      return romanNums[pageNum] || `${pageNum}`;
    }
    return `Pág. ${pageNum}`;
  }

  getFullDocumentText(doc) {
    if (!doc) return '';
    const parts = [
      doc.title || '',
      doc.authors || '',
      doc.abstract || '',
      (doc.keywords || []).join(' '),
      ...(doc.sections || []).map(s => (s.title || '') + ' ' + (s.content || '')),
      ...(doc.references || [])
    ];
    return parts.join('\n\n');
  }
}

window.auraEditorView = new AuraEditorView();
