/**
 * AURA — Dashboard View (Gestão de Meus Trabalhos, Presets e Submissões)
 */

class AuraDashboardView {
  render(container) {
    const projects = [
      {
        id: 'doc_demo_posdoc',
        title: 'Arquiteturas Híbridas de Aprendizado Profundo para Revisão Automatizada de Literatura Científica',
        type: 'Projeto de Pós-Doutorado',
        standard: 'ABNT',
        target: 'Edital FAPESP / CNPq 2026',
        score: 91,
        status: 'READY',
        updatedAt: 'Há 15 minutos'
      },
      {
        id: 'doc_2',
        title: 'Análise Comparativa de Algoritmos de Otimização em Redes Convolucionais',
        type: 'Artigo Científico',
        standard: 'IEEE',
        target: 'IEEE Transactions on AI',
        score: 84,
        status: 'IN_PROGRESS',
        updatedAt: 'Ontem'
      },
      {
        id: 'doc_3',
        title: 'Metodologias Ativas no Ensino Superior: Uma Revisão Sistemática',
        type: 'Dissertação de Mestrado',
        standard: 'ABNT',
        target: 'PPGCC / Seleção 2027',
        score: 72,
        status: 'NEEDS_REVIEW',
        updatedAt: '3 dias atrás'
      }
    ];

    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex flex-col gap-8">
        
        <!-- DASHBOARD HEADER -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-black text-white flex items-center gap-2">
              <i data-lucide="layout-grid" class="w-6 h-6 text-emerald-400"></i> Meus Trabalhos Acadêmicos
            </h2>
            <p class="text-xs text-slate-400">Gerencie seus artigos, teses, dissertações e projetos para editais.</p>
          </div>

          <div class="flex items-center gap-3">
            <button onclick="AURA.openNewDocModal()" class="px-4 py-2 rounded-xl bg-aura-600 hover:bg-aura-500 text-white text-xs font-bold shadow-lg shadow-aura-600/30 flex items-center gap-1.5 transition-all">
              <i data-lucide="plus" class="w-4 h-4"></i> Criar Novo Trabalho
            </button>
          </div>
        </div>

        <!-- PROJECTS GRID -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${projects.map(p => `
            <div class="glass-panel glass-card-hover rounded-2xl p-6 border border-slate-800 flex flex-col justify-between cursor-pointer" onclick="AURA.loadSampleDoc()">
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono font-bold">${p.standard}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${p.score >= 85 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
                    ${p.score}% Preparado
                  </span>
                </div>

                <h3 class="text-base font-bold text-white leading-snug hover:text-aura-300 transition-colors line-clamp-2">
                  ${p.title}
                </h3>

                <div class="flex flex-col gap-1 text-xs text-slate-400 mt-1">
                  <div><strong>Tipo:</strong> ${p.type}</div>
                  <div><strong>Destino:</strong> <span class="text-slate-300">${p.target}</span></div>
                </div>
              </div>

              <div class="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Editado ${p.updatedAt}</span>
                <span class="text-aura-400 font-semibold hover:underline">Abrir Editor →</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- PRESETS DE FORMATAÇÃO E NORMAS SALVAS -->
        <div class="glass-panel rounded-2xl p-6 border border-slate-800">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <i data-lucide="sliders" class="w-4 h-4 text-purple-400"></i> Meus Presets & Padrões Salvos
              </h3>
              <p class="text-xs text-slate-400">Modelos institucionais e configurações customizadas de formatação.</p>
            </div>
            <button onclick="AURA.createNewPreset()" class="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i> Novo Preset
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            ${(window.auraRulesEngine.presets || []).map(pr => `
              <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 flex flex-col justify-between gap-3">
                <div>
                  <div class="font-bold text-white text-xs">${pr.name}</div>
                  <div class="text-[10px] text-slate-400 mt-1">Norma base: ${pr.standardId.toUpperCase()}</div>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-slate-700 text-[10px] text-slate-400">
                  <span>Pronto para uso</span>
                  <button onclick="AURA.applyPreset('${pr.id}')" class="text-aura-400 font-bold hover:underline">Aplicar</button>
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
