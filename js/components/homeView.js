/**
 * AURA — Home View (Apresentação dos 4 Portais Principais)
 * 1. Começar um trabalho
 * 2. Formatar um documento
 * 3. Adequar a uma publicação
 * 4. Adequar a um edital
 */

class AuraHomeView {
  render(container) {
    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 lg:px-8 py-10 flex flex-col gap-12">
        
        <!-- HERO BANNER -->
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-aura-950/80 border border-slate-700/60 p-8 lg:p-12 shadow-2xl">
          <div class="absolute -right-20 -top-20 w-96 h-96 bg-aura-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -left-20 -bottom-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div class="relative z-10 max-w-3xl flex flex-col gap-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aura-500/10 border border-aura-500/30 text-aura-300 text-xs font-semibold w-fit">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Motor de Regras Acadêmicas & Editais Integrado
            </div>
            <h1 class="text-3xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              A inteligência definitiva para sua <span class="bg-gradient-to-r from-aura-400 via-indigo-300 to-sky-300 bg-clip-text text-transparent">produção e aprovação científica</span>.
            </h1>
            <p class="text-slate-300 text-base lg:text-lg font-light leading-relaxed">
              Escreva do zero, formate em ABNT/APA/IEEE ou prepare seu projeto para editais de pós-graduação, bolsas e financiamento com verificação automática de conformidade.
            </p>
            
            <!-- Flow Tagline -->
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
              <span class="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200">Pesquisa</span>
              <i data-lucide="arrow-right" class="w-3 h-3 text-slate-500"></i>
              <span class="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200">Escrita</span>
              <i data-lucide="arrow-right" class="w-3 h-3 text-slate-500"></i>
              <span class="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200">Formatação</span>
              <i data-lucide="arrow-right" class="w-3 h-3 text-slate-500"></i>
              <span class="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200">Adequação</span>
              <i data-lucide="arrow-right" class="w-3 h-3 text-slate-500"></i>
              <span class="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200">Verificação</span>
              <i data-lucide="arrow-right" class="w-3 h-3 text-slate-500"></i>
              <span class="px-2.5 py-1 rounded-md bg-aura-500/20 border border-aura-500/40 text-aura-300 font-bold">Submissão Aprovada</span>
            </div>
          </div>
        </div>

        <!-- 4 MAIN PATHS (OS 4 CAMINHOS CENTRAIS) -->
        <div>
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-xl font-bold text-white flex items-center gap-2">
                <i data-lucide="compass" class="w-5 h-5 text-aura-400"></i> Escolha seu objetivo acadêmico
              </h2>
              <p class="text-sm text-slate-400">Todos os caminhos utilizam o mesmo motor unificado de regras e estruturação.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <!-- Caminho 1: Começar um Trabalho -->
            <div onclick="AURA.openNewDocModal()" class="glass-panel glass-card-hover rounded-2xl p-6 flex flex-col justify-between cursor-pointer border border-slate-800 hover:border-aura-500/50 group relative">
              <div class="flex flex-col gap-4">
                <div class="w-12 h-12 rounded-xl bg-aura-500/10 border border-aura-500/30 flex items-center justify-center text-aura-400 group-hover:scale-110 group-hover:bg-aura-500 group-hover:text-white transition-all">
                  <i data-lucide="pen-tool" class="w-6 h-6"></i>
                </div>
                <div>
                  <div class="text-xs uppercase font-bold tracking-wider text-aura-400 mb-1">Criação do Zero</div>
                  <h3 class="text-lg font-bold text-white group-hover:text-aura-300 transition-colors">Começar um trabalho</h3>
                  <p class="text-xs text-slate-400 mt-2 leading-relaxed">
                    Escreva seu artigo, TCC, dissertação ou tese diretamente na plataforma com templates guiados e normas integradas.
                  </p>
                </div>
              </div>
              <div class="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-aura-400">
                <span>Criar documento</span>
                <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
              </div>
            </div>

            <!-- Caminho 2: Formatar um Documento -->
            <div onclick="AURA.openUploadModal('format')" class="glass-panel glass-card-hover rounded-2xl p-6 flex flex-col justify-between cursor-pointer border border-slate-800 hover:border-indigo-500/50 group relative">
              <div class="flex flex-col gap-4">
                <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                  <i data-lucide="file-up" class="w-6 h-6"></i>
                </div>
                <div>
                  <div class="text-xs uppercase font-bold tracking-wider text-indigo-400 mb-1">Upload & Diagnóstico</div>
                  <h3 class="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">Formatar um documento</h3>
                  <p class="text-xs text-slate-400 mt-2 leading-relaxed">
                    Envie seu DOCX, PDF ou texto existente. A IA detecta títulos, seções e citações, aplicando ABNT/APA em 1 clique.
                  </p>
                </div>
              </div>
              <div class="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-indigo-400">
                <span>Enviar arquivo</span>
                <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
              </div>
            </div>

            <!-- Caminho 3: Adequar a uma Publicação -->
            <div onclick="AURA.openPublicationModal()" class="glass-panel glass-card-hover rounded-2xl p-6 flex flex-col justify-between cursor-pointer border border-slate-800 hover:border-emerald-500/50 group relative">
              <div class="flex flex-col gap-4">
                <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <i data-lucide="newspaper" class="w-6 h-6"></i>
                </div>
                <div>
                  <div class="text-xs uppercase font-bold tracking-wider text-emerald-400 mb-1">Periódicos & Congressos</div>
                  <h3 class="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">Adequar a publicação</h3>
                  <p class="text-xs text-slate-400 mt-2 leading-relaxed">
                    Prepare seu paper para revistas e conferências (IEEE, SBC, Elsevier, Springer) com limites de páginas e referências.
                  </p>
                </div>
              </div>
              <div class="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>Selecionar evento</span>
                <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
              </div>
            </div>

            <!-- Caminho 4: Adequar a um Edital -->
            <div onclick="AURA.openNoticeModal()" class="glass-panel glass-card-hover rounded-2xl p-6 flex flex-col justify-between cursor-pointer border border-slate-800 hover:border-amber-500/50 group relative">
              <div class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider shadow-lg">
                Módulo Central
              </div>
              <div class="flex flex-col gap-4">
                <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                  <i data-lucide="graduation-cap" class="w-6 h-6"></i>
                </div>
                <div>
                  <div class="text-xs uppercase font-bold tracking-wider text-amber-400 mb-1">Mestrado, Doutorado & Bolsas</div>
                  <h3 class="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">Adequar a um edital</h3>
                  <p class="text-xs text-slate-400 mt-2 leading-relaxed">
                    Envie o edital em PDF/DOCX. O sistema extrai critérios de avaliação, checklist de documentos, cronograma e orçamento.
                  </p>
                </div>
              </div>
              <div class="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-amber-400">
                <span>Interpretar edital</span>
                <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
              </div>
            </div>

          </div>
        </div>

        <!-- QUICK ACCESS RECENT PROJECTS -->
        <div class="glass-panel rounded-2xl p-6 border border-slate-800">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="clock" class="w-4 h-4 text-slate-400"></i> Trabalho em Andamento Recente
            </h3>
            <button onclick="AURA.navigate('dashboard')" class="text-xs text-aura-400 hover:text-aura-300 font-medium">Ver todos os projetos →</button>
          </div>

          <div class="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-lg bg-aura-500/20 text-aura-400 flex items-center justify-center flex-shrink-0">
                <i data-lucide="file-text" class="w-5 h-5"></i>
              </div>
              <div>
                <h4 class="text-sm font-bold text-white hover:text-aura-300 cursor-pointer" onclick="AURA.loadSampleDoc()">
                  Arquiteturas Híbridas de Aprendizado Profundo para Revisão Automatizada de Literatura Científica
                </h4>
                <div class="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
                  <span class="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">ABNT</span>
                  <span>Projeto de Pós-Doutorado</span>
                  <span class="text-slate-500">•</span>
                  <span class="text-amber-400 flex items-center gap-1"><i data-lucide="bookmark" class="w-3 h-3"></i> Edital FAPESP/CNPq 2026</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-4 flex-shrink-0">
              <div class="text-right">
                <div class="text-xs text-slate-400">Conformidade</div>
                <div class="text-sm font-bold text-emerald-400">91% preparado</div>
              </div>
              <button onclick="AURA.loadSampleDoc()" class="px-4 py-2 rounded-lg bg-aura-600 hover:bg-aura-500 text-white text-xs font-semibold transition-all">
                Abrir no Editor
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
  }
}

window.auraHomeView = new AuraHomeView();
