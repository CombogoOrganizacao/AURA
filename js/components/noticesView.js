/**
 * AURA — Notices View (Central de Editais, Chamadas de Pós-Graduação, Bolsas e Financiamento)
 * Apresenta:
 * - Leitor de Editais com extração de regras
 * - Painel de Elegibilidade (Atende / Parcial / Não Atende com origem no edital)
 * - Matriz de Critérios de Avaliação (ex: 82/100) com separação estrita Regra vs Interpretação IA
 * - Checklist de Documentação Obrigatória
 * - Cronograma Interativo (M1..M6)
 * - Módulo de Orçamento com comparação com teto do edital
 */

class AuraNoticesView {
  render(container, activeNotice, activeDoc) {
    const notice = activeNotice || window.AURA_SAMPLE_NOTICES[0];
    const doc = activeDoc || window.AURA_SAMPLE_DOCUMENTS[0];
    const t = (key) => window.AURA ? window.AURA.t(key) : key;

    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
        
        <!-- NOTICE HEADER CARD -->
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <i data-lucide="award" class="w-6 h-6 sm:w-7 sm:h-7"></i>
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">${notice.agency}</span>
                <span class="text-xs text-slate-400">${t('notice_deadline')} <strong>${notice.deadline}</strong></span>
              </div>
              <h2 class="text-lg sm:text-xl font-extrabold text-white mt-1">${notice.title}</h2>
              <p class="text-xs text-slate-400 mt-1">${t('notice_modality')} ${notice.type} • ${t('notice_duration')} ${notice.limits.durationMonths} ${t('notice_months')}</p>
            </div>
          </div>

          <!-- Quick Actions on Notice -->
          <div class="flex flex-wrap items-center gap-2 sm:gap-3">
            <button onclick="AURA.openNoticeUploadModal()" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-all">
              <i data-lucide="file-up" class="w-4 h-4 text-amber-400"></i> ${t('notice_btn_analyze')}
            </button>
            <button onclick="AURA.createProjectFromNotice('${notice.id}')" class="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all">
              <i data-lucide="plus-circle" class="w-4 h-4"></i> ${t('notice_btn_create_proj')}
            </button>
          </div>
        </div>

        <!-- 4 KEY KPI CARDS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div class="glass-panel rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-400">${t('kpi_readiness')}</div>
              <div class="text-2xl font-black text-emerald-400 mt-1">91%</div>
              <div class="text-[10px] text-slate-500 mt-0.5">${t('kpi_readiness_sub')}</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <i data-lucide="sparkles" class="w-5 h-5"></i>
            </div>
          </div>

          <div class="glass-panel rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-400">${t('kpi_requirements')}</div>
              <div class="text-2xl font-black text-amber-400 mt-1">3/4</div>
              <div class="text-[10px] text-amber-400/80 mt-0.5">${t('kpi_requirements_sub')}</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <i data-lucide="user-check" class="w-5 h-5"></i>
            </div>
          </div>

          <div class="glass-panel rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-400">${t('kpi_documentation')}</div>
              <div class="text-2xl font-black text-aura-400 mt-1">4/6</div>
              <div class="text-[10px] text-slate-500 mt-0.5">${t('kpi_documentation_sub')}</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-aura-500/10 text-aura-400 flex items-center justify-center">
              <i data-lucide="folder-check" class="w-5 h-5"></i>
            </div>
          </div>

          <div class="glass-panel rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-400">${t('kpi_budget')}</div>
              <div class="text-2xl font-black text-white mt-1">R$ 94k <span class="text-xs font-normal text-slate-400">/ 120k</span></div>
              <div class="text-[10px] text-emerald-400 mt-0.5">${t('kpi_budget_sub')}</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <i data-lucide="dollar-sign" class="w-5 h-5"></i>
            </div>
          </div>

        </div>

        <!-- MAIN TABS OF EDITAL HUB -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- LEFT 2 COLS: CRITÉRIOS DE AVALIAÇÃO & MATRIZ DE CONFORMIDADE -->
          <div class="lg:col-span-2 flex flex-col gap-6">
            
            <!-- Critérios de Avaliação -->
            <div class="glass-panel rounded-2xl p-6 border border-slate-800">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="target" class="w-4 h-4 text-aura-400"></i> ${t('eval_matrix_title')}
                  </h3>
                  <p class="text-xs text-slate-400">${t('eval_matrix_desc')}</p>
                </div>
                <button onclick="AURA.exportComplianceReportDirect()" class="text-xs text-aura-400 hover:text-aura-300 font-semibold flex items-center gap-1">
                  <i data-lucide="file-text" class="w-3.5 h-3.5"></i> ${t('download_report')}
                </button>
              </div>

              <div class="flex flex-col gap-4">
                ${(notice.evaluationCriteria || []).map(crit => `
                  <div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700/60 flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full ${crit.status === 'STRONG' ? 'bg-emerald-400' : (crit.status === 'PARTIAL' ? 'bg-amber-400' : 'bg-rose-400')}"></span>
                        <h4 class="text-sm font-bold text-white">${crit.name}</h4>
                        <span class="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">${t('weight')} ${crit.weight}%</span>
                      </div>
                      <div class="text-sm font-black ${crit.status === 'STRONG' ? 'text-emerald-400' : (crit.status === 'PARTIAL' ? 'text-amber-400' : 'text-rose-400')}">
                        ${crit.scoreObtained}/${crit.weight} pts
                      </div>
                    </div>

                    <!-- Regra Oficial vs Parecer IA -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div class="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span class="text-[10px] font-bold uppercase text-amber-400 tracking-wider">${t('official_rule')}</span>
                        <p class="text-slate-300 mt-1 leading-relaxed">${crit.requirementText}</p>
                      </div>
                      <div class="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span class="text-[10px] font-bold uppercase text-aura-400 tracking-wider">${t('ai_feedback')}</span>
                        <p class="text-slate-300 mt-1 leading-relaxed">${crit.suggestion}</p>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Cronograma Inteligente -->
            <div class="glass-panel rounded-2xl p-6 border border-slate-800">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="calendar" class="w-4 h-4 text-emerald-400"></i> Cronograma de Execução do Projeto
                  </h3>
                  <p class="text-xs text-slate-400">Distribuição temporal das atividades em conformidade com o edital.</p>
                </div>
                <button onclick="AURA.addTimelineActivity()" class="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nova Atividade
                </button>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-xs text-left text-slate-300 border-collapse">
                  <thead class="bg-slate-800 text-slate-200 uppercase font-bold text-[10px]">
                    <tr>
                      <th class="p-3">Atividade / Meta</th>
                      <th class="p-3 text-center">M1-M4</th>
                      <th class="p-3 text-center">M5-M8</th>
                      <th class="p-3 text-center">M9-M12</th>
                      <th class="p-3 text-center">M13-M16</th>
                      <th class="p-3 text-center">M17-M20</th>
                      <th class="p-3 text-center">M21-M24</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    ${(doc.timeline || []).map((t, idx) => `
                      <tr class="hover:bg-slate-800/40">
                        <td class="p-3 font-medium text-white">${t.activity}</td>
                        <td class="p-3 text-center"><input type="checkbox" ${t.m1 ? 'checked' : ''} class="rounded bg-slate-900 text-aura-500"></td>
                        <td class="p-3 text-center"><input type="checkbox" ${t.m2 ? 'checked' : ''} class="rounded bg-slate-900 text-aura-500"></td>
                        <td class="p-3 text-center"><input type="checkbox" ${t.m3 ? 'checked' : ''} class="rounded bg-slate-900 text-aura-500"></td>
                        <td class="p-3 text-center"><input type="checkbox" ${t.m4 ? 'checked' : ''} class="rounded bg-slate-900 text-aura-500"></td>
                        <td class="p-3 text-center"><input type="checkbox" ${t.m5 ? 'checked' : ''} class="rounded bg-slate-900 text-aura-500"></td>
                        <td class="p-3 text-center"><input type="checkbox" ${t.m6 ? 'checked' : ''} class="rounded bg-slate-900 text-aura-500"></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Módulo de Orçamento -->
            <div class="glass-panel rounded-2xl p-6 border border-slate-800">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="calculator" class="w-4 h-4 text-indigo-400"></i> Orçamento Detalhado & Teto Permitido
                  </h3>
                  <p class="text-xs text-slate-400">Limite do Edital: R$ ${notice.limits.maxBudget.toLocaleString('pt-BR')},00</p>
                </div>
                <button onclick="AURA.addBudgetItem()" class="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i> Adicionar Item
                </button>
              </div>

              <div class="flex flex-col gap-2 text-xs">
                ${(doc.budget || []).map(b => `
                  <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div>
                      <span class="font-bold text-white">${b.category}:</span>
                      <span class="text-slate-300 ml-1">${b.item}</span>
                    </div>
                    <span class="font-mono font-bold text-emerald-400">R$ ${b.amount.toLocaleString('pt-BR')},00</span>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>

          <!-- RIGHT 1 COL: ELEGIBILIDADE & CHECKLIST DE DOCUMENTOS -->
          <div class="flex flex-col gap-6">
            
            <!-- Elegibilidade do Candidato -->
            <div class="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col gap-4">
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <i data-lucide="user-check" class="w-4 h-4 text-emerald-400"></i> Requisitos do Candidato
              </h3>
              <p class="text-xs text-slate-400">Verificação automática de elegibilidade com base no edital.</p>

              <div class="flex flex-col gap-3">
                ${(notice.eligibility || []).map(el => `
                  <div class="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col gap-1.5">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-white text-xs">${el.title}</span>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${el.status === 'MET' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
                        ${el.status === 'MET' ? 'Atende ✓' : 'Pendente ⚠'}
                      </span>
                    </div>
                    <p class="text-xs text-slate-300">${el.description}</p>
                    <span class="text-[10px] text-slate-500">Origem: ${el.source}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Checklist de Documentação Obrigatória -->
            <div class="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col gap-4">
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <i data-lucide="folder-check" class="w-4 h-4 text-aura-400"></i> Checklist de Documentos
              </h3>
              <p class="text-xs text-slate-400">Arquivos e anexos exigidos para a submissão.</p>

              <div class="flex flex-col gap-2.5">
                ${(notice.documentsChecklist || []).map(docItem => `
                  <div class="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
                    <div class="flex items-center gap-2.5">
                      <input type="checkbox" ${docItem.status === 'DONE' ? 'checked' : ''} class="rounded bg-slate-900 text-aura-500">
                      <div>
                        <div class="font-bold text-white">${docItem.name}</div>
                        <div class="text-[10px] text-slate-400">${docItem.required ? 'Obrigatório' : 'Opcional'} • ${docItem.source}</div>
                      </div>
                    </div>
                    <span class="text-xs ${docItem.status === 'DONE' ? 'text-emerald-400 font-bold' : 'text-slate-500'}">
                      ${docItem.status === 'DONE' ? 'Pronto' : 'Pendente'}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>

        </div>

      </div>
    `;
  }
}

window.auraNoticesView = new AuraNoticesView();
