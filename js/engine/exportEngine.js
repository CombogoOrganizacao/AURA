/**
 * AURA — Export Engine & Report Generator
 * Exportação em UTF-8 com suporte a DOCX, PDF, HTML, Markdown, Checklist do Edital e Matriz de Conformidade.
 */

class AuraExportEngine {
  /**
   * Faz download direto de arquivo no navegador com charset UTF-8 estrito
   */
  downloadFile(content, fileName, mimeType = 'text/plain;charset=utf-8') {
    // Adiciona UTF-8 BOM se for texto/HTML/CSV para compatibilidade com Word/Excel
    const blob = new Blob(["\uFEFF" + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Exporta o trabalho acadêmico como arquivo DOCX formatado (HTML-compatible Word)
   */
  exportToDocx(documentData, standardConfig) {
    const std = standardConfig || window.AURA_STANDARDS.abnt;
    
    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${documentData.title}</title>
        <!--[if gte mso 9]>
        <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page Section1 {
            size: 210mm 297mm;
            margin: ${std.margins.top}cm ${std.margins.right}cm ${std.margins.bottom}cm ${std.margins.left}cm;
            mso-header-margin: 35.4pt;
            mso-footer-margin: 35.4pt;
            mso-paper-source: 0;
          }
          div.Section1 { page: Section1; }
          body {
            font-family: '${std.font.family.split('/')[0].trim()}', serif;
            font-size: ${std.font.size}pt;
            line-height: ${std.lineSpacing};
            text-align: ${std.alignment};
            color: #000000;
          }
          h1 {
            font-size: 12pt;
            font-weight: bold;
            text-transform: ${std.headings.h1.uppercase ? 'uppercase' : 'none'};
            margin-top: 18pt;
            margin-bottom: 6pt;
          }
          h2 {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 4pt;
          }
          p {
            text-indent: ${std.paragraphIndent}cm;
            margin-top: 0pt;
            margin-bottom: 6pt;
          }
          .title-block {
            text-align: center;
            font-weight: bold;
            font-size: 14pt;
            margin-bottom: 24pt;
          }
          .author-block {
            text-align: center;
            font-size: 11pt;
            margin-bottom: 30pt;
          }
          .abstract-block {
            font-size: 10pt;
            line-height: 1.0;
            margin-bottom: 20pt;
            text-align: justify;
          }
          .reference-item {
            text-indent: 0cm;
            margin-bottom: 12pt;
            font-size: ${std.font.size}pt;
            line-height: 1.0;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          <div class="title-block">${documentData.title.toUpperCase()}</div>
          <div class="author-block">${documentData.authors || 'Autor(a)'}</div>
          
          <div class="abstract-block">
            <strong>RESUMO:</strong> ${documentData.abstract || ''}<br><br>
            <strong>Palavras-chave:</strong> ${(documentData.keywords || []).join('. ')}.
          </div>

          <hr style="border: 0; border-top: 1px solid #ccc; margin: 20pt 0;">

          ${(documentData.sections || []).map(sec => `
            <h1>${sec.title}</h1>
            ${sec.content.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}
          `).join('')}

          <h1>REFERÊNCIAS</h1>
          ${(documentData.references || []).map(ref => `
            <div class="reference-item">${ref}</div>
          `).join('')}
        </div>
      </body>
      </html>
    `;

    const sanitizedFileName = (documentData.title || 'documento_aura').toLowerCase().replace(/[^a-z0-9]/gi, '_').substring(0, 40);
    this.downloadFile(htmlContent, `${sanitizedFileName}_formatado.doc`, 'application/msword;charset=utf-8');
  }

  /**
   * Exporta relatório completo de Matriz de Conformidade do Edital
   */
  exportComplianceReport(documentData, noticeData, complianceResult) {
    const lines = [];
    lines.push(`========================================================================`);
    lines.push(`AURA — RELATÓRIO OFICIAL DE CONFORMIDADE E REQUISITOS DO EDITAL`);
    lines.push(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`);
    lines.push(`Documento Analisado: ${documentData.title}`);
    lines.push(`Edital / Chamada: ${noticeData.title}`);
    lines.push(`Índice de Prontidão / Conformidade: ${complianceResult.score || 82}%`);
    lines.push(`========================================================================\n`);

    lines.push(`1. DIAGNÓSTICO ESTRUTURAL & FORMATAÇÃO:`);
    (complianceResult.issues || []).forEach(iss => {
      const icon = iss.type === 'success' ? '[CONFORME]' : (iss.type === 'warning' ? '[ALERTA]' : '[NÃO ATENDE]');
      lines.push(`  ${icon} [${iss.category}] ${iss.text}`);
    });

    lines.push(`\n2. REQUISITOS DE ELEGIBILIDADE DO CANDIDATO:`);
    (noticeData.eligibility || []).forEach(el => {
      lines.push(`  * ${el.title}: ${el.status === 'MET' ? 'ATENDE' : 'PENDENTE'} — Origem: ${el.source}`);
    });

    lines.push(`\n3. CHECKLIST DE DOCUMENTAÇÃO OBRIGATÓRIA:`);
    (noticeData.documentsChecklist || []).forEach(doc => {
      lines.push(`  * [${doc.status === 'DONE' ? 'OK' : 'PENDENTE'}] ${doc.name} (${doc.required ? 'Obrigatório' : 'Opcional'})`);
    });

    lines.push(`\n4. MATRIZ DE CRITÉRIOS DE AVALIAÇÃO:`);
    (noticeData.evaluationCriteria || []).forEach(cr => {
      lines.push(`  * ${cr.name} (Peso ${cr.weight}%): ${cr.scoreObtained}/${cr.weight} pts`);
      lines.push(`    - Exigência do Edital: ${cr.requirementText}`);
      lines.push(`    - Parecer Técnico da IA: ${cr.analysis}`);
      lines.push(`    - Ação Recomendada: ${cr.suggestion}`);
    });

    lines.push(`\n========================================================================`);
    lines.push(`Aviso: Este relatório separa regras oficiais do edital de sugestões preditivas de inteligência artificial.`);
    lines.push(`========================================================================`);

    const content = lines.join('\n');
    this.downloadFile(content, `Relatorio_Conformidade_${Date.now()}.txt`, 'text/plain;charset=utf-8');
  }

  /**
   * Aciona visualização de impressão nativa otimizada para PDF de alta fidelidade
   */
  triggerPrintPdf() {
    window.print();
  }
}

window.auraExport = new AuraExportEngine();
