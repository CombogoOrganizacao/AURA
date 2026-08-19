/**
 * AURA — Modals Manager (Uploads, Novo Documento, Novo Edital, Exportação)
 */

class AuraModals {
  showNewDocModal() {
    const container = document.getElementById('modal-container');
    const t = (key) => window.AURA ? window.AURA.t(key) : key;

    container.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div class="glass-panel w-full max-w-lg rounded-2xl p-5 sm:p-6 border border-slate-700 shadow-2xl flex flex-col gap-5">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="file-plus" class="w-5 h-5 text-aura-400"></i> ${t('new_doc_title')}
            </h3>
            <button onclick="AURA.closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>

          <div class="flex flex-col gap-3 text-xs">
            <div>
              <label class="block text-slate-300 font-medium mb-1">${t('doc_title_label')}</label>
              <input type="text" id="modal-new-title" placeholder="${t('doc_title_placeholder')}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-medium mb-1">${t('doc_type_label')}</label>
                <select id="modal-new-type" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
                  ${window.AURA_WORK_TYPES.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-medium mb-1">${t('doc_standard_label')}</label>
                <select id="modal-new-standard" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
                  <option value="abnt">ABNT (Brasil)</option>
                  <option value="apa">APA 7th (Internacional)</option>
                  <option value="ieee">IEEE (2 Colunas)</option>
                  <option value="vancouver">Vancouver (Medicina)</option>
                  <option value="chicago">Chicago 17th</option>
                  <option value="mla">MLA 9th</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-slate-300 font-medium mb-1">${t('doc_authors_label')}</label>
              <input type="text" id="modal-new-authors" placeholder="${t('doc_authors_placeholder')}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button onclick="AURA.closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">${t('cancel')}</button>
            <button onclick="AURA.submitNewDoc()" class="px-5 py-2 rounded-lg bg-aura-600 hover:bg-aura-500 text-white text-xs font-bold shadow-lg shadow-aura-600/30">${t('create_doc_btn')}</button>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  showUploadModal(mode = 'format') {
    const container = document.getElementById('modal-container');
    const t = (key) => window.AURA ? window.AURA.t(key) : key;

    container.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div class="glass-panel w-full max-w-lg rounded-2xl p-5 sm:p-6 border border-slate-700 shadow-2xl flex flex-col gap-5">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="file-up" class="w-5 h-5 text-indigo-400"></i> ${mode === 'notice' ? (window.AURA && window.AURA.currentLang === 'en' ? 'Import Call / Grant Guidelines' : 'Importar Edital / Chamada') : (window.AURA && window.AURA.currentLang === 'en' ? 'Format Existing Document' : 'Formatar Documento Existente')}
            </h3>
            <button onclick="AURA.closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>

          <!-- Drag and Drop Area -->
          <div 
            class="border-2 border-dashed border-slate-700 hover:border-aura-500 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-3 bg-slate-900/60 cursor-pointer transition-all"
            onclick="document.getElementById('file-upload-input').click()"
          >
            <div class="w-12 h-12 rounded-xl bg-aura-500/10 text-aura-400 flex items-center justify-center">
              <i data-lucide="upload-cloud" class="w-6 h-6"></i>
            </div>
            <div>
              <p class="text-sm font-bold text-white">${t('upload_file_title')}</p>
              <p class="text-xs text-slate-400 mt-1">${t('upload_file_sub')}</p>
            </div>
            <div class="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <span class="px-2 py-0.5 rounded bg-slate-800">DOCX</span>
              <span class="px-2 py-0.5 rounded bg-slate-800">PDF</span>
              <span class="px-2 py-0.5 rounded bg-slate-800">ODT</span>
              <span class="px-2 py-0.5 rounded bg-slate-800">TXT (UTF-8)</span>
            </div>
            <input type="file" id="file-upload-input" class="hidden" onchange="AURA.handleFileUpload(this, '${mode}')">
          </div>

          <!-- Paste Raw Text Option -->
          <div class="flex flex-col gap-1 text-xs">
            <label class="text-slate-400">${t('paste_text_label')}</label>
            <textarea id="modal-paste-text" rows="4" placeholder="${t('paste_text_placeholder')}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-aura-500 font-sans"></textarea>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button onclick="AURA.closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">${t('cancel')}</button>
            <button onclick="AURA.submitPastedText('${mode}')" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">${window.AURA && window.AURA.currentLang === 'en' ? 'Analyze with AI' : 'Analisar com IA'}</button>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  showExportModal(currentDoc) {
    const container = document.getElementById('modal-container');
    const isEn = window.AURA && window.AURA.currentLang === 'en';

    container.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div class="glass-panel w-full max-w-md rounded-2xl p-5 sm:p-6 border border-slate-700 shadow-2xl flex flex-col gap-5">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="download" class="w-5 h-5 text-emerald-400"></i> ${isEn ? 'Export Scientific Work' : 'Exportar Trabalho Científico'}
            </h3>
            <button onclick="AURA.closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>

          <div class="flex flex-col gap-3 text-xs">
            <div onclick="AURA.downloadDocx()" class="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 flex items-center justify-between cursor-pointer group">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">DOCX</div>
                <div>
                  <div class="font-bold text-white group-hover:text-blue-300">${isEn ? 'Microsoft Word (.docx)' : 'Microsoft Word (.docx)'}</div>
                  <div class="text-[10px] text-slate-400">${isEn ? 'Ready in UTF-8 with TOC and headings' : 'Formatação pronta em UTF-8 com sumário e seções'}</div>
                </div>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 group-hover:text-white"></i>
            </div>

            <div onclick="AURA.downloadPdf()" class="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 flex items-center justify-between cursor-pointer group">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-bold">PDF</div>
                <div>
                  <div class="font-bold text-white group-hover:text-red-300">${isEn ? 'Vector PDF Document' : 'Documento PDF Vetorial'}</div>
                  <div class="text-[10px] text-slate-400">${isEn ? 'Exact print layout with standards margins' : 'Layout exato de impressão com réguas e margens'}</div>
                </div>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 group-hover:text-white"></i>
            </div>

            <div onclick="AURA.downloadComplianceReport()" class="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 flex items-center justify-between cursor-pointer group">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">REL</div>
                <div>
                  <div class="font-bold text-white group-hover:text-amber-300">${isEn ? 'Call Compliance Audit Report' : 'Relatório de Conformidade do Edital'}</div>
                  <div class="text-[10px] text-slate-400">${isEn ? 'Checklist, eligibility and scoring matrix' : 'Checklist, elegibilidade e matriz de critérios'}</div>
                </div>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 group-hover:text-white"></i>
            </div>
          </div>

          <div class="flex items-center justify-end pt-2 border-t border-slate-800">
            <button onclick="AURA.closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">${t('cancel')}</button>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  showPresetModal(preset = null) {
    const container = document.getElementById('modal-container');
    const isEn = window.AURA && window.AURA.currentLang === 'en';
    const isEditing = !!preset;
    const p = preset || {
      id: '',
      name: '',
      standardId: 'abnt',
      fontFamily: 'Arial',
      fontSize: 12,
      lineSpacing: 1.5,
      margins: { top: 3.0, left: 3.0, bottom: 2.0, right: 2.0 }
    };

    container.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div class="glass-panel w-full max-w-lg rounded-2xl p-5 sm:p-6 border border-slate-700 shadow-2xl flex flex-col gap-5">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="sliders" class="w-5 h-5 text-purple-400"></i> ${isEditing ? (isEn ? 'Edit Formatting Preset' : 'Editar Preset de Formatação') : (isEn ? 'Create Custom Preset' : 'Criar Novo Preset de Formatação')}
            </h3>
            <button onclick="AURA.closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>

          <div class="flex flex-col gap-3 text-xs">
            <div>
              <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Preset Name:' : 'Nome do Preset / Padrão:'}</label>
              <input type="text" id="modal-preset-name" value="${p.name || ''}" placeholder="${isEn ? 'Ex: PPGCC Standard ABNT 2026' : 'Ex: Padrão PPGCC / Dissertação UNICAP'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Base Standard:' : 'Norma de Referência:'}</label>
                <select id="modal-preset-standard" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
                  <option value="abnt" ${p.standardId === 'abnt' ? 'selected' : ''}>ABNT (Brasil)</option>
                  <option value="apa" ${p.standardId === 'apa' ? 'selected' : ''}>APA 7th (Internacional)</option>
                  <option value="ieee" ${p.standardId === 'ieee' ? 'selected' : ''}>IEEE (2 Colunas)</option>
                  <option value="vancouver" ${p.standardId === 'vancouver' ? 'selected' : ''}>Vancouver (Medicina)</option>
                  <option value="chicago" ${p.standardId === 'chicago' ? 'selected' : ''}>Chicago 17th</option>
                  <option value="mla" ${p.standardId === 'mla' ? 'selected' : ''}>MLA 9th</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Typography Family:' : 'Família Tipográfica:'}</label>
                <select id="modal-preset-font" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
                  <option value="Times New Roman" ${p.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman (Serif)</option>
                  <option value="Arial" ${p.fontFamily === 'Arial' ? 'selected' : ''}>Arial (Sans-serif)</option>
                  <option value="Calibri" ${p.fontFamily === 'Calibri' ? 'selected' : ''}>Calibri</option>
                  <option value="Helvetica" ${p.fontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Font Size (pt):' : 'Tamanho do Corpo (pt):'}</label>
                <input type="number" id="modal-preset-size" value="${p.fontSize || 12}" min="8" max="18" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
              </div>

              <div>
                <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Line Spacing:' : 'Espaçamento Entrelinhas:'}</label>
                <select id="modal-preset-spacing" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
                  <option value="1.0" ${p.lineSpacing === 1.0 ? 'selected' : ''}>1.0 (Simples)</option>
                  <option value="1.15" ${p.lineSpacing === 1.15 ? 'selected' : ''}>1.15 (IEEE)</option>
                  <option value="1.5" ${p.lineSpacing === 1.5 ? 'selected' : ''}>1.5 (ABNT Padrão)</option>
                  <option value="2.0" ${p.lineSpacing === 2.0 ? 'selected' : ''}>2.0 (APA Duplo)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Margins (cm) — Top / Left / Bottom / Right:' : 'Margens da Página (cm) — Sup / Esq / Inf / Dir:'}</label>
              <div class="grid grid-cols-4 gap-2">
                <input type="number" step="0.1" id="modal-preset-mtop" value="${(p.margins && p.margins.top) || 3.0}" class="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-center">
                <input type="number" step="0.1" id="modal-preset-mleft" value="${(p.margins && p.margins.left) || 3.0}" class="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-center">
                <input type="number" step="0.1" id="modal-preset-mbottom" value="${(p.margins && p.margins.bottom) || 2.0}" class="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-center">
                <input type="number" step="0.1" id="modal-preset-mright" value="${(p.margins && p.margins.right) || 2.0}" class="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-center">
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-slate-800">
            ${isEditing ? `
              <button onclick="AURA.deletePreset('${p.id}')" class="text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> ${isEn ? 'Delete' : 'Excluir Preset'}
              </button>
            ` : '<div></div>'}

            <div class="flex items-center gap-2">
              <button onclick="AURA.closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">${isEn ? 'Cancel' : 'Cancelar'}</button>
              <button onclick="AURA.savePresetFromModal('${p.id || ''}')" class="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30">${isEn ? 'Save Preset' : 'Salvar Preset'}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  showImageModal() {
    const container = document.getElementById('modal-container');
    const isEn = window.AURA && window.AURA.currentLang === 'en';

    container.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div class="glass-panel w-full max-w-md rounded-2xl p-5 sm:p-6 border border-slate-700 shadow-2xl flex flex-col gap-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="image" class="w-5 h-5 text-emerald-400"></i> ${isEn ? 'Insert Figure / Image (Standard Format)' : 'Inserir Figura / Imagem Acadêmica'}
            </h3>
            <button onclick="AURA.closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>

          <div class="flex flex-col gap-3 text-xs">
            <div>
              <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Figure Caption / Title (e.g., Figura 1 — ...):' : 'Título da Figura (ex: Figura 1 — Arquitetura da Rede):'}</label>
              <input type="text" id="modal-img-title" placeholder="Figura 1 — Diagrama esquemático do fluxo experimental" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
            </div>

            <div>
              <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Image URL or Local Upload:' : 'URL da Imagem ou Selecionar do Computador:'}</label>
              <div class="flex gap-2">
                <input type="text" id="modal-img-url" placeholder="https://images.unsplash.com/... ou selecione o arquivo" class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs">
                <button onclick="document.getElementById('modal-img-file').click()" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1 border border-slate-700 whitespace-nowrap">
                  <i data-lucide="upload" class="w-3.5 h-3.5"></i> ${isEn ? 'Browse' : 'Arquivo'}
                </button>
                <input type="file" id="modal-img-file" accept="image/*" class="hidden" onchange="AURA.handleImageFileSelect(this)">
              </div>
            </div>

            <div>
              <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Source / Attribution (Mandatory in ABNT/APA):' : 'Fonte (Obrigatório segundo ABNT / APA):'}</label>
              <input type="text" id="modal-img-source" placeholder="Fonte: Elaborado pelos autores (2026)." class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button onclick="AURA.closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">${isEn ? 'Cancel' : 'Cancelar'}</button>
            <button onclick="AURA.confirmInsertImage()" class="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30">${isEn ? 'Insert Figure' : 'Inserir Figura'}</button>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  showCitationModal(type = 'direct') {
    const container = document.getElementById('modal-container');
    const isEn = window.AURA && window.AURA.currentLang === 'en';

    let typeTitle = isEn ? 'Short Direct Citation' : 'Citação Direta Curta';
    if (type === 'indirect') typeTitle = isEn ? 'Indirect Citation / Paraphrase' : 'Citação Indireta (Paráfrase)';
    if (type === 'apud') typeTitle = isEn ? 'Citation of Citation (Apud)' : 'Citação de Citação (Apud)';

    container.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div class="glass-panel w-full max-w-md rounded-2xl p-5 sm:p-6 border border-slate-700 shadow-2xl flex flex-col gap-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="bookmark" class="w-5 h-5 text-indigo-400"></i> ${typeTitle}
            </h3>
            <button onclick="AURA.closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>

          <div class="flex flex-col gap-3 text-xs">
            <div>
              <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Author(s) Surname (e.g. SILVA or SILVA; SOUZA):' : 'Sobrenome do(s) Autor(es) (ex: SILVA ou SILVA; SANTOS):'}</label>
              <input type="text" id="modal-cit-author" placeholder="SILVA" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Year of Publication:' : 'Ano de Publicação:'}</label>
                <input type="number" id="modal-cit-year" placeholder="2024" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
              </div>

              <div>
                <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Page (optional):' : 'Página (ex: 45):'}</label>
                <input type="text" id="modal-cit-page" placeholder="45" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
              </div>
            </div>

            ${type === 'apud' ? `
              <div>
                <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Original Author cited (Apud ...):' : 'Autor Original Citado (Apud ...):'}</label>
                <input type="text" id="modal-cit-apud" placeholder="SOUZA, 1998, p. 12" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
              </div>
            ` : ''}

            ${type === 'direct' ? `
              <div>
                <label class="block text-slate-300 font-medium mb-1">${isEn ? 'Quoted Text (up to 3 lines):' : 'Texto Citado (até 3 linhas):'}</label>
                <textarea id="modal-cit-text" rows="3" placeholder="Insira o trecho textual exato..." class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"></textarea>
              </div>
            ` : ''}
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button onclick="AURA.closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">${isEn ? 'Cancel' : 'Cancelar'}</button>
            <button onclick="AURA.confirmInsertCitation('${type}')" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30">${isEn ? 'Insert Citation' : 'Inserir Citação'}</button>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  close() {
    document.getElementById('modal-container').innerHTML = '';
  }
}

window.auraModals = new AuraModals();
