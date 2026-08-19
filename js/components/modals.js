/**
 * AURA — Modals Manager (Uploads, Novo Documento, Novo Edital, Exportação)
 */

class AuraModals {
  showNewDocModal() {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div class="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl flex flex-col gap-5">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="file-plus" class="w-5 h-5 text-aura-400"></i> Começar Novo Trabalho Científico
            </h3>
            <button onclick="AURA.closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>

          <div class="flex flex-col gap-3 text-xs">
            <div>
              <label class="block text-slate-300 font-medium mb-1">Título do Trabalho:</label>
              <input type="text" id="modal-new-title" placeholder="Ex: Análise da Eficiência de Modelos de Linguagem..." class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-medium mb-1">Tipo de Trabalho:</label>
                <select id="modal-new-type" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
                  ${window.AURA_WORK_TYPES.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-medium mb-1">Norma Base:</label>
                <select id="modal-new-standard" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
                  <option value="abnt">ABNT (Brasil)</option>
                  <option value="apa">APA 7th</option>
                  <option value="ieee">IEEE (2 Colunas)</option>
                  <option value="vancouver">Vancouver</option>
                  <option value="chicago">Chicago</option>
                  <option value="mla">MLA 9th</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-slate-300 font-medium mb-1">Autor(es):</label>
              <input type="text" id="modal-new-authors" placeholder="Seu nome completo e afiliação" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-aura-500">
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button onclick="AURA.closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">Cancelar</button>
            <button onclick="AURA.submitNewDoc()" class="px-5 py-2 rounded-lg bg-aura-600 hover:bg-aura-500 text-white text-xs font-bold shadow-lg shadow-aura-600/30">Criar Documento</button>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  showUploadModal(mode = 'format') {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div class="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl flex flex-col gap-5">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="file-up" class="w-5 h-5 text-indigo-400"></i> ${mode === 'notice' ? 'Importar Edital / Chamada' : 'Formatar Documento Existente'}
            </h3>
            <button onclick="AURA.closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>

          <!-- Drag and Drop Area -->
          <div 
            class="border-2 border-dashed border-slate-700 hover:border-aura-500 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 bg-slate-900/60 cursor-pointer transition-all"
            onclick="document.getElementById('file-upload-input').click()"
          >
            <div class="w-12 h-12 rounded-xl bg-aura-500/10 text-aura-400 flex items-center justify-center">
              <i data-lucide="upload-cloud" class="w-6 h-6"></i>
            </div>
            <div>
              <p class="text-sm font-bold text-white">Já possui seu arquivo?</p>
              <p class="text-xs text-slate-400 mt-1">Arraste seu arquivo aqui ou clique para selecionar do computador.</p>
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
            <label class="text-slate-400">Ou cole o texto diretamente abaixo:</label>
            <textarea id="modal-paste-text" rows="4" placeholder="Cole aqui o texto do seu trabalho ou edital..." class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-aura-500 font-sans"></textarea>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button onclick="AURA.closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">Cancelar</button>
            <button onclick="AURA.submitPastedText('${mode}')" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">Analisar com IA</button>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  showExportModal(currentDoc) {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div class="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl flex flex-col gap-5">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="download" class="w-5 h-5 text-emerald-400"></i> Exportar Trabalho Científico
            </h3>
            <button onclick="AURA.closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>

          <div class="flex flex-col gap-3 text-xs">
            <div onclick="AURA.downloadDocx()" class="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 flex items-center justify-between cursor-pointer group">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">DOCX</div>
                <div>
                  <div class="font-bold text-white group-hover:text-blue-300">Microsoft Word (.doc / .docx)</div>
                  <div class="text-[10px] text-slate-400">Formatação pronta em UTF-8 com sumário e seções</div>
                </div>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 group-hover:text-white"></i>
            </div>

            <div onclick="AURA.downloadPdf()" class="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 flex items-center justify-between cursor-pointer group">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-bold">PDF</div>
                <div>
                  <div class="font-bold text-white group-hover:text-red-300">Documento PDF Vetorial</div>
                  <div class="text-[10px] text-slate-400">Layout exato de impressão com réguas e margens</div>
                </div>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 group-hover:text-white"></i>
            </div>

            <div onclick="AURA.downloadComplianceReport()" class="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 flex items-center justify-between cursor-pointer group">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">REL</div>
                <div>
                  <div class="font-bold text-white group-hover:text-amber-300">Relatório de Conformidade do Edital</div>
                  <div class="text-[10px] text-slate-400">Checklist, elegibilidade e matriz de critérios</div>
                </div>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 group-hover:text-white"></i>
            </div>
          </div>

          <div class="flex items-center justify-end pt-2 border-t border-slate-800">
            <button onclick="AURA.closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">Fechar</button>
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
