/**
 * AURA — Notices View (Central de Editais, Chamadas de Pós-Graduação, Bolsas e Financiamento)
 * Apresenta:
 * - Central de Editais categorizada (Ciência & Pesquisa, Inovação & Tecnologia, Cultura & Artes, Internacional)
 * - Filtros por status (Abertos, Em Progresso, Fechados/Encerrados)
 * - Análise aprofundada: Requisitos do Candidato, Matriz de Avaliação e Checklist
 * - Criação de Projeto Direto formatado para a agência
 * - Orçamento com Drag-and-Drop, Edição Inline e Confirmação de Exclusão
 * - Cronograma com Edição Inline e Confirmação de Exclusão
 */

class AuraNoticesView {
  constructor() {
    this.currentCategory = 'all';
    this.currentStatus = 'all';
    this.searchTerm = '';
  }

  render(container, activeNotice, activeDoc) {
    const notice = activeNotice || window.AURA_SAMPLE_NOTICES[0];
    const doc = activeDoc || window.AURA_SAMPLE_DOCUMENTS[0];
    const t = (key) => window.AURA ? window.AURA.t(key) : key;
    const allNotices = window.AURA_SAMPLE_NOTICES || [];

    // Filtros de editais
    const filteredNotices = allNotices.filter(n => {
      const matchCat = this.currentCategory === 'all' || n.category === this.currentCategory;
      const matchStat = this.currentStatus === 'all' || n.status === this.currentStatus;
      const matchSearch = !this.searchTerm || n.title.toLowerCase().includes(this.searchTerm.toLowerCase()) || n.agency.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchCat && matchStat && matchSearch;
    });

    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
        
        <!-- TOP: CENTRAL DE EDITAIS EXPLORER & AGÊNCIAS -->
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 flex flex-col gap-5">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider">
                  <i data-lucide="compass" class="w-3.5 h-3.5 inline mr-1"></i> Central de Oportunidades & Fomento
                </span>
                <span class="text-xs text-slate-400 font-mono">Total: ${allNotices.length} editais mapeados</span>
              </div>
              <h2 class="text-xl sm:text-2xl font-black text-white mt-1.5">Editais Científicos, Tecnológicos e Internacionais</h2>
              <p class="text-xs text-slate-400 mt-0.5">Editais oficiais centralizados: CNPq, CAPES, FINEP, MCTI, FACEPE, 27 FAPs, Serrapilheira, EMBRAPII, BNDES, MinC, Horizon Europe, MSCA, DAAD, Fulbright e outros.</p>
            </div>

            <!-- Upload Custom Notice -->
            <button onclick="AURA.openNoticeUploadModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-2 shadow-lg transition-all self-start md:self-auto">
              <i data-lucide="file-up" class="w-4 h-4 text-amber-400"></i> Importar / Analisar Outro Edital (PDF/Texto)
            </button>
          </div>

          <!-- Filtros de Categoria e Status -->
          <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
            <!-- Categorias -->
            <div class="flex flex-wrap items-center gap-1.5 text-xs">
              <button onclick="window.auraNoticesView.setCategory('all')" class="px-3 py-1.5 rounded-lg font-bold transition-all ${this.currentCategory === 'all' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-300 hover:text-white'}">
                Todos
              </button>
              <button onclick="window.auraNoticesView.setCategory('ciencia_pesquisa')" class="px-3 py-1.5 rounded-lg font-bold transition-all ${this.currentCategory === 'ciencia_pesquisa' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-300 hover:text-white'}">
                🔬 Ciência & Pesquisa (CNPq / CAPES / FAPs / Serrapilheira)
              </button>
              <button onclick="window.auraNoticesView.setCategory('inovacao_tecnologia')" class="px-3 py-1.5 rounded-lg font-bold transition-all ${this.currentCategory === 'inovacao_tecnologia' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-300 hover:text-white'}">
                🚀 Inovação & Tecnologia (FINEP / EMBRAPII / BNDES)
              </button>
              <button onclick="window.auraNoticesView.setCategory('cultura_artes')" class="px-3 py-1.5 rounded-lg font-bold transition-all ${this.currentCategory === 'cultura_artes' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-300 hover:text-white'}">
                🎭 Cultura & Artes (MinC / CultBR)
              </button>
              <button onclick="window.auraNoticesView.setCategory('internacional')" class="px-3 py-1.5 rounded-lg font-bold transition-all ${this.currentCategory === 'internacional' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-300 hover:text-white'}">
                🌐 Internacional (Horizon / MSCA / DAAD / Fulbright)
              </button>
            </div>

            <!-- Status Tabs & Search -->
            <div class="flex items-center gap-2">
              <select onchange="window.auraNoticesView.setStatus(this.value)" class="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none">
                <option value="all" ${this.currentStatus === 'all' ? 'selected' : ''}>Todos os Status</option>
                <option value="open" ${this.currentStatus === 'open' ? 'selected' : ''}>🟢 Abertos (Inscrições Abertas)</option>
                <option value="in_progress" ${this.currentStatus === 'in_progress' ? 'selected' : ''}>🟡 Em Progresso / Análise</option>
                <option value="closed" ${this.currentStatus === 'closed' ? 'selected' : ''}>🔴 Fechados / Encerrados</option>
              </select>

              <input 
                type="text" 
                placeholder="Buscar por agência ou palavra-chave..." 
                value="${this.searchTerm}"
                oninput="window.auraNoticesView.setSearch(this.value)"
                class="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500 w-48 sm:w-64"
              />
            </div>
          </div>

          <!-- Grade de Editais Disponíveis -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-2">
            ${filteredNotices.map(n => {
              const isSelected = n.id === notice.id;
              const statusBadge = n.status === 'open' ? '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">Aberto</span>' : (n.status === 'in_progress' ? '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">Em Progresso</span>' : '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">Fechado</span>');
              return `
                <div class="p-4 rounded-xl transition-all border ${isSelected ? 'bg-amber-950/20 border-amber-500/80 shadow-lg ring-1 ring-amber-500/40' : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'} flex flex-col justify-between gap-3">
                  <div>
                    <div class="flex items-center justify-between gap-1.5">
                      <span class="text-[11px] font-bold text-amber-400 truncate max-w-[170px]">${n.agency}</span>
                      ${statusBadge}
                    </div>
                    <h4 class="text-xs font-bold text-white mt-1.5 line-clamp-2 leading-snug">${n.title}</h4>
                    <div class="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>Prazo: <strong>${n.deadline}</strong></span>
                      <span>•</span>
                      <span>Teto: <strong>R$ ${n.limits.maxBudget > 0 ? (n.limits.maxBudget/1000) + 'k' : 'N/A'}</strong></span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button onclick="AURA.selectNotice('${n.id}')" class="flex-1 py-1.5 rounded-lg ${isSelected ? 'bg-amber-500 text-slate-950 font-extrabold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'} text-xs flex items-center justify-center gap-1 transition-all">
                      <i data-lucide="eye" class="w-3.5 h-3.5"></i> ${isSelected ? 'Edital em Análise' : 'Analisar Edital'}
                    </button>
                    <button onclick="AURA.createProjectFromNotice('${n.id}')" title="Criar Projeto Já Formatado" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-md transition-all">
                      <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Criar Projeto
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- NOTICE DETAILS & ANALYSIS HEADER -->
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/90">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <i data-lucide="award" class="w-6 h-6 sm:w-7 sm:h-7"></i>
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">${notice.agency}</span>
                <span class="text-xs text-slate-400">Prazo de Submissão: <strong>${notice.deadline}</strong></span>
              </div>
              <h2 class="text-lg sm:text-xl font-extrabold text-white mt-1">${notice.title}</h2>
              <p class="text-xs text-slate-400 mt-1">Modalidade: ${notice.type} • Duração máxima: ${notice.limits.durationMonths} meses • Limite: até ${notice.limits.maxPages} páginas</p>
            </div>
          </div>

          <!-- Create Project Action Button -->
          <div class="flex items-center gap-2 sm:gap-3">
            <button onclick="AURA.createProjectFromNotice('${notice.id}')" class="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all">
              <i data-lucide="file-plus-2" class="w-4 h-4"></i> Criar Projeto deste Edital (Editor & Normas)
            </button>
          </div>
        </div>

        <!-- 4 KEY KPI CARDS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="glass-panel rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-400">Índice de Prontidão</div>
              <div class="text-2xl font-black text-emerald-400 mt-1">94%</div>
              <div class="text-[10px] text-slate-500 mt-0.5">Alinhamento aos critérios</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <i data-lucide="sparkles" class="w-5 h-5"></i>
            </div>
          </div>

          <div class="glass-panel rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-400">Requisitos do Candidato</div>
              <div class="text-2xl font-black text-amber-400 mt-1">${(notice.eligibility || []).filter(e => e.status === 'MET').length}/${(notice.eligibility || []).length}</div>
              <div class="text-[10px] text-amber-400/80 mt-0.5">Itens de elegibilidade</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <i data-lucide="user-check" class="w-5 h-5"></i>
            </div>
          </div>

          <div class="glass-panel rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-400">Documentação</div>
              <div class="text-2xl font-black text-aura-400 mt-1">${(notice.documentsChecklist || []).filter(d => d.status === 'DONE').length}/${(notice.documentsChecklist || []).length}</div>
              <div class="text-[10px] text-slate-500 mt-0.5">Obrigatórios no anexo</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-aura-500/10 text-aura-400 flex items-center justify-center">
              <i data-lucide="folder-check" class="w-5 h-5"></i>
            </div>
          </div>

          <div class="glass-panel rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-400">Teto Orçamentário</div>
              <div class="text-2xl font-black text-white mt-1">R$ ${(notice.limits.maxBudget > 0 ? (notice.limits.maxBudget/1000).toFixed(0) + 'k' : 'Sob Demanda')}</div>
              <div class="text-[10px] text-emerald-400 mt-0.5">Permitido pela agência</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <i data-lucide="dollar-sign" class="w-5 h-5"></i>
            </div>
          </div>
        </div>

        <!-- MAIN TABS OF EDITAL HUB -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- LEFT 2 COLS: CRITÉRIOS DE AVALIAÇÃO, CRONOGRAMA & ORÇAMENTO DRAGGABLE -->
          <div class="lg:col-span-2 flex flex-col gap-6">
            
            <!-- Matriz de Critérios de Avaliação -->
            <div class="glass-panel rounded-2xl p-6 border border-slate-800">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="target" class="w-4 h-4 text-aura-400"></i> Matriz de Critérios de Avaliação do Edital
                  </h3>
                  <p class="text-xs text-slate-400">Pontuação esperada segundo o barema oficial e sugestões da IA.</p>
                </div>
                <button onclick="AURA.exportComplianceReportDirect()" class="text-xs text-aura-400 hover:text-aura-300 font-semibold flex items-center gap-1">
                  <i data-lucide="file-text" class="w-3.5 h-3.5"></i> Baixar Relatório
                </button>
              </div>

              <div class="flex flex-col gap-4">
                ${(notice.evaluationCriteria || []).map(crit => `
                  <div class="bg-slate-800/40 rounded-xl p-4 border border-slate-700/60 flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full ${crit.status === 'STRONG' ? 'bg-emerald-400' : (crit.status === 'PARTIAL' ? 'bg-amber-400' : 'bg-rose-400')}"></span>
                        <h4 class="text-sm font-bold text-white">${crit.name}</h4>
                        <span class="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">Peso ${crit.weight}%</span>
                      </div>
                      <div class="text-sm font-black ${crit.status === 'STRONG' ? 'text-emerald-400' : (crit.status === 'PARTIAL' ? 'text-amber-400' : 'text-rose-400')}">
                        ${crit.scoreObtained}/${crit.weight} pts
                      </div>
                    </div>

                    <!-- Regra Oficial vs Parecer IA -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div class="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span class="text-[10px] font-bold uppercase text-amber-400 tracking-wider">Regra Oficial do Edital</span>
                        <p class="text-slate-300 mt-1 leading-relaxed">${crit.requirementText}</p>
                      </div>
                      <div class="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span class="text-[10px] font-bold uppercase text-aura-400 tracking-wider">Parecer & Orientação da IA</span>
                        <p class="text-slate-300 mt-1 leading-relaxed">${crit.suggestion}</p>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Cronograma de Execução do Projeto (Editável Inline & com Aviso de Exclusão) -->
            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="calendar" class="w-4 h-4 text-emerald-400"></i> Cronograma de Execução do Projeto
                  </h3>
                  <p class="text-xs text-slate-400">Edite as atividades diretamente nos campos de texto ou marque os meses de execução.</p>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-xs text-left">
                  <thead>
                    <tr class="border-b border-slate-700 text-slate-400">
                      <th class="p-3">Atividade / Meta</th>
                      <th class="p-3 text-center">M1-M4</th>
                      <th class="p-3 text-center">M5-M8</th>
                      <th class="p-3 text-center">M9-M12</th>
                      <th class="p-3 text-center">M13-M16</th>
                      <th class="p-3 text-center">M17-M20</th>
                      <th class="p-3 text-center">M21-M24</th>
                      <th class="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(doc.timeline || []).map((tItem, idx) => `
                      <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 group">
                        <td class="p-2 font-medium text-white">
                          <input 
                            type="text" 
                            value="${tItem.activity}" 
                            onchange="AURA.updateTimelineActivity(${idx}, this.value)"
                            class="w-full bg-slate-900/60 border border-slate-700/60 focus:border-emerald-500 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                          />
                        </td>
                        <td class="p-3 text-center"><input type="checkbox" ${tItem.m1 ? 'checked' : ''} onchange="AURA.toggleTimelineMonth(${idx}, 'm1')" class="rounded bg-slate-900 text-aura-500 cursor-pointer"></td>
                        <td class="p-3 text-center"><input type="checkbox" ${tItem.m2 ? 'checked' : ''} onchange="AURA.toggleTimelineMonth(${idx}, 'm2')" class="rounded bg-slate-900 text-aura-500 cursor-pointer"></td>
                        <td class="p-3 text-center"><input type="checkbox" ${tItem.m3 ? 'checked' : ''} onchange="AURA.toggleTimelineMonth(${idx}, 'm3')" class="rounded bg-slate-900 text-aura-500 cursor-pointer"></td>
                        <td class="p-3 text-center"><input type="checkbox" ${tItem.m4 ? 'checked' : ''} onchange="AURA.toggleTimelineMonth(${idx}, 'm4')" class="rounded bg-slate-900 text-aura-500 cursor-pointer"></td>
                        <td class="p-3 text-center"><input type="checkbox" ${tItem.m5 ? 'checked' : ''} onchange="AURA.toggleTimelineMonth(${idx}, 'm5')" class="rounded bg-slate-900 text-aura-500 cursor-pointer"></td>
                        <td class="p-3 text-center"><input type="checkbox" ${tItem.m6 ? 'checked' : ''} onchange="AURA.toggleTimelineMonth(${idx}, 'm6')" class="rounded bg-slate-900 text-aura-500 cursor-pointer"></td>
                        <td class="p-3 text-center">
                          <button onclick="AURA.confirmRemoveTimelineActivity(${idx})" title="Excluir atividade com confirmação" class="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5 inline"></i>
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Inline Quick Add Timeline Activity Form -->
              <div class="mt-3 pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2">
                <input type="text" id="inline-timeline-input" placeholder="Digite o nome da nova meta ou atividade do cronograma..." class="flex-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500">
                <button onclick="AURA.addTimelineActivityInline()" class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/20 whitespace-nowrap">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i> Adicionar Atividade
                </button>
              </div>
            </div>

            <!-- Módulo de Orçamento (Drag & Drop Reorder, Editável Inline & Aviso de Exclusão) -->
            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="calculator" class="w-4 h-4 text-indigo-400"></i> Orçamento Detalhado & Teto Permitido
                  </h3>
                  <p class="text-xs text-slate-400">Arraste para reordenar (Drag & Drop). Edite os campos diretamente ou adicione novos itens.</p>
                </div>
                <div class="text-xs font-bold text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800">
                  Total: R$ ${(doc.budget || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString('pt-BR')},00
                </div>
              </div>

              <div class="flex flex-col gap-2 text-xs" id="budget-items-list" ondragover="event.preventDefault()">
                ${(doc.budget || []).map((b, bIdx) => `
                  <div 
                    draggable="true" 
                    ondragstart="AURA.handleBudgetDragStart(event, ${bIdx})" 
                    ondragover="event.preventDefault()" 
                    ondrop="AURA.handleBudgetDrop(event, ${bIdx})"
                    class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 hover:border-indigo-500/60 transition-all group cursor-grab active:cursor-grabbing gap-3"
                  >
                    <div class="flex items-center gap-2 text-slate-400 cursor-grab">
                      <i data-lucide="grip-vertical" class="w-4 h-4 text-slate-500 group-hover:text-indigo-400"></i>
                    </div>

                    <!-- Categoria Editável -->
                    <div class="w-36">
                      <select onchange="AURA.updateBudgetItem(${bIdx}, 'category', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-indigo-300 font-bold focus:outline-none">
                        <option value="Custeio / Diárias" ${b.category === 'Custeio / Diárias' ? 'selected' : ''}>Custeio / Diárias</option>
                        <option value="Capital / Equipamentos" ${b.category === 'Capital / Equipamentos' ? 'selected' : ''}>Capital / Equipamentos</option>
                        <option value="Bolsas de Pesquisa" ${b.category === 'Bolsas de Pesquisa' ? 'selected' : ''}>Bolsas de Pesquisa</option>
                        <option value="Serviços de Terceiros" ${b.category === 'Serviços de Terceiros' ? 'selected' : ''}>Serviços de Terceiros</option>
                        <option value="Material de Consumo" ${b.category === 'Material de Consumo' ? 'selected' : ''}>Material de Consumo</option>
                      </select>
                    </div>

                    <!-- Descrição Editável -->
                    <div class="flex-1">
                      <input 
                        type="text" 
                        value="${b.item}" 
                        onchange="AURA.updateBudgetItem(${bIdx}, 'item', this.value)"
                        class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>

                    <!-- Valor Editável -->
                    <div class="w-28 flex items-center gap-1">
                      <span class="text-slate-400 text-xs font-mono">R$</span>
                      <input 
                        type="number" 
                        value="${b.amount}" 
                        onchange="AURA.updateBudgetItem(${bIdx}, 'amount', parseFloat(this.value))"
                        class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500 text-right"
                      />
                    </div>

                    <!-- Excluir com Confirmação -->
                    <div>
                      <button onclick="AURA.confirmRemoveBudgetItem(${bIdx})" class="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10" title="Excluir item com confirmação">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Inline Quick Add Budget Item Form -->
              <div class="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <div class="sm:col-span-3">
                  <select id="inline-budget-cat" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500">
                    <option value="Custeio / Diárias">Custeio / Diárias</option>
                    <option value="Capital / Equipamentos">Capital / Equipamentos</option>
                    <option value="Bolsas de Pesquisa">Bolsas de Pesquisa</option>
                    <option value="Serviços de Terceiros">Serviços de Terceiros</option>
                    <option value="Material de Consumo">Material de Consumo</option>
                  </select>
                </div>
                <div class="sm:col-span-5">
                  <input type="text" id="inline-budget-desc" placeholder="Descrição do item ou insumo de pesquisa..." class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500">
                </div>
                <div class="sm:col-span-2">
                  <input type="number" id="inline-budget-val" placeholder="R$ 1500" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono">
                </div>
                <div class="sm:col-span-2">
                  <button onclick="AURA.addBudgetItemInline()" class="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1 shadow-md shadow-indigo-600/20">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i> Adicionar
                  </button>
                </div>
              </div>
            </div>

          </div>

          <!-- RIGHT 1 COL: REQUISITOS DO CANDIDATO & CHECKLIST DE DOCUMENTOS -->
          <div class="flex flex-col gap-6">
            
            <!-- Requisitos do Candidato -->
            <div class="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col gap-4">
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <i data-lucide="user-check" class="w-4 h-4 text-emerald-400"></i> Requisitos do Candidato
              </h3>
              <p class="text-xs text-slate-400">Verificação automática de elegibilidade com base nas regras do edital.</p>

              <div class="flex flex-col gap-3">
                ${(notice.eligibility || []).map(el => `
                  <div class="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col gap-1.5">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-white text-xs">${el.title}</span>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${el.status === 'MET' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
                        ${el.status === 'MET' ? 'Atende ✓' : 'Pendente ⚠'}
                      </span>
                    </div>
                    <p class="text-xs text-slate-300 leading-relaxed">${el.description}</p>
                    <span class="text-[10px] text-slate-500 font-mono">Fonte: ${el.source}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Checklist de Documentação Obrigatória -->
            <div class="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col gap-4">
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <i data-lucide="folder-check" class="w-4 h-4 text-aura-400"></i> Checklist de Documentação
              </h3>
              <p class="text-xs text-slate-400">Documentos exigidos para submissão oficial na plataforma da agência.</p>

              <div class="flex flex-col gap-2 text-xs">
                ${(notice.documentsChecklist || []).map(docItem => `
                  <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
                    <div class="flex items-center gap-2">
                      <i data-lucide="${docItem.status === 'DONE' ? 'check-circle-2' : (docItem.status === 'PENDING' ? 'clock' : 'help-circle')}" class="w-4 h-4 ${docItem.status === 'DONE' ? 'text-emerald-400' : (docItem.status === 'PENDING' ? 'text-amber-400' : 'text-slate-500')}"></i>
                      <span class="text-slate-200 font-medium">${docItem.name}</span>
                    </div>
                    <span class="text-[10px] px-1.5 py-0.5 rounded ${docItem.required ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-700 text-slate-300'}">
                      ${docItem.required ? 'Obrigatório' : 'Opcional'}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>

        </div>

      </div>
    `;
    lucide.createIcons();
  }

  setCategory(cat) {
    this.currentCategory = cat;
    if (window.AURA) window.AURA.navigate('notices');
  }

  setStatus(stat) {
    this.currentStatus = stat;
    if (window.AURA) window.AURA.navigate('notices');
  }

  setSearch(query) {
    this.searchTerm = query;
    if (window.AURA) window.AURA.navigate('notices');
  }
}

window.auraNoticesView = new AuraNoticesView();

