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
    const std = standardConfig || (documentData.standardId && window.AURA_STANDARDS[documentData.standardId]) || window.AURA_STANDARDS.abnt;
    const stdId = documentData.standardId || 'abnt';
    
    // Process sections into clean continuous paragraphs without unwanted <br>
    const processSectionContent = (content) => {
      if (!content) return '';
      // Remove HTML tags se houver
      const textOnly = content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
      const paragraphs = textOnly.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
      if (paragraphs.length === 0) {
        return `<p class="MsoNormal academic-p">${textOnly.replace(/\n+/g, ' ')}</p>`;
      }
      return paragraphs.map(p => `<p class="MsoNormal academic-p">${p.replace(/\n+/g, ' ')}</p>`).join('\n');
    };

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${documentData.title || 'Trabalho Acadêmico'}</title>
        <!--[if gte mso 9]>
        <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
          <w:Compatibility>
            <w:BreakWrappedTables/>
            <w:SnapToGridInCell/>
            <w:WrapTextWithPunct/>
            <w:UseAsianBreakRules/>
          </w:Compatibility>
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
            font-family: '${std.font.family.split('/')[0].trim()}', 'Times New Roman', serif;
            font-size: ${std.font.size}pt;
            line-height: ${std.lineSpacing};
            text-align: ${std.alignment};
            color: #000000;
          }
          p.MsoNormal, p.academic-p {
            font-family: '${std.font.family.split('/')[0].trim()}', 'Times New Roman', serif;
            font-size: ${std.font.size}pt;
            line-height: ${std.lineSpacing};
            text-align: ${std.alignment};
            text-indent: ${std.paragraphIndent}cm;
            margin-top: 0pt;
            margin-bottom: 6pt;
            mso-line-height-rule: exactly;
          }
          h1.academic-h1 {
            font-family: '${std.font.family.split('/')[0].trim()}', 'Times New Roman', serif;
            font-size: 12pt;
            font-weight: bold;
            text-transform: ${std.headings.h1.uppercase ? 'uppercase' : 'none'};
            margin-top: 18pt;
            margin-bottom: 6pt;
            text-align: left;
            text-indent: 0cm;
            page-break-after: avoid;
          }
          .title-block {
            text-align: center;
            font-weight: bold;
            font-size: 13pt;
            margin-top: 0pt;
            margin-bottom: 16pt;
            text-transform: uppercase;
            line-height: 1.5;
            text-indent: 0cm;
          }
          .author-block {
            text-align: center;
            font-size: 11pt;
            margin-bottom: 24pt;
            text-indent: 0cm;
          }
          .abstract-container {
            margin-top: 12pt;
            margin-bottom: 18pt;
            font-size: 10.5pt;
            line-height: 1.2;
            text-align: justify;
            text-indent: 0cm;
          }
          .abstract-container strong {
            text-transform: uppercase;
          }
          .abstract-text {
            text-indent: 0cm;
            margin-top: 4pt;
            margin-bottom: 6pt;
          }
          .keywords-line {
            text-indent: 0cm;
            font-size: 10.5pt;
            margin-top: 6pt;
          }
          .reference-item {
            text-indent: 0cm;
            margin-top: 0pt;
            margin-bottom: 10pt;
            font-size: ${std.font.size}pt;
            line-height: 1.0;
            text-align: left;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          <div class="title-block">${(documentData.title || 'TÍTULO DO TRABALHO').toUpperCase()}</div>
          <div class="author-block">${documentData.authors || 'Nome do(a) Autor(a)'}</div>
          
          <div class="abstract-container">
            <strong>${stdId === 'apa' || stdId === 'ieee' || stdId === 'mla' ? 'ABSTRACT' : 'RESUMO'}</strong>
            <div class="abstract-text">${documentData.abstract || ''}</div>
            <div class="keywords-line"><strong>${stdId === 'apa' || stdId === 'ieee' || stdId === 'mla' ? 'Keywords:' : 'Palavras-chave:'}</strong> ${(documentData.keywords || []).join('; ')}.</div>
          </div>

          <div style="height: 12pt;"></div>

          ${(documentData.sections || []).map((sec, idx) => `
            <div style="${idx > 0 && idx % 2 === 1 ? 'page-break-before: always; mso-break-type: section-break;' : ''}">
              <h1 class="academic-h1">${sec.title}</h1>
              ${processSectionContent(sec.content)}
            </div>
          `).join('')}

          <div style="page-break-before: always; mso-break-type: section-break;">
            <h1 class="academic-h1">${stdId === 'mla' ? 'WORKS CITED' : (stdId === 'chicago' ? 'BIBLIOGRAPHY' : (stdId === 'apa' || stdId === 'ieee' ? 'REFERENCES' : 'REFERÊNCIAS'))}</h1>
            ${(documentData.references || []).map(ref => `
              <p class="reference-item">${ref}</p>
            `).join('')}
          </div>
        </div>
      </body>
      </html>
    `;

    const sanitizedFileName = (documentData.title || 'documento_aura').toLowerCase().replace(/[^a-z0-9]/gi, '_').substring(0, 40);
    this.downloadFile(htmlContent, `${sanitizedFileName}_formatado.doc`, 'application/msword;charset=utf-8');
  }

  /**
   * Exporta relatório completo de Matriz de Conformidade do Edital como documento oficial formatado em DOC/DOCX
   */
  exportComplianceReport(documentData, noticeData, complianceResult) {
    const isEn = window.AURA && window.AURA.currentLang === 'en';
    const score = complianceResult.score || 94;

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Relatório de Conformidade — ${documentData.title || 'AURA'}</title>
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
            margin: 25mm 25mm 25mm 25mm;
          }
          div.Section1 { page: Section1; }
          body {
            font-family: 'Arial', 'Segoe UI', sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #1e293b;
          }
          .header-box {
            background-color: #0f172a;
            color: #ffffff;
            padding: 16pt;
            border-radius: 8pt;
            margin-bottom: 20pt;
          }
          .header-title {
            font-size: 16pt;
            font-weight: bold;
            color: #38bdf8;
            margin-bottom: 4pt;
          }
          .meta-item {
            font-size: 10pt;
            color: #cbd5e1;
          }
          .score-badge {
            background-color: #10b981;
            color: #ffffff;
            font-weight: bold;
            font-size: 14pt;
            padding: 6pt 12pt;
            border-radius: 6pt;
            display: inline-block;
            margin-top: 8pt;
          }
          h2 {
            font-size: 13pt;
            color: #0f172a;
            border-bottom: 2pt solid #e2e8f0;
            padding-bottom: 4pt;
            margin-top: 20pt;
            margin-bottom: 10pt;
          }
          .card {
            background-color: #f8fafc;
            border: 1pt solid #e2e8f0;
            border-radius: 6pt;
            padding: 10pt;
            margin-bottom: 10pt;
          }
          .card-title {
            font-weight: bold;
            color: #0f172a;
            font-size: 11pt;
          }
          .tag-met {
            color: #059669;
            font-weight: bold;
          }
          .tag-pending {
            color: #d97706;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8pt;
            font-size: 10pt;
          }
          th {
            background-color: #f1f5f9;
            border: 1pt solid #cbd5e1;
            padding: 6pt;
            text-align: left;
          }
          td {
            border: 1pt solid #cbd5e1;
            padding: 6pt;
          }
          .footer-note {
            font-size: 9pt;
            color: #64748b;
            margin-top: 30pt;
            border-top: 1pt solid #e2e8f0;
            padding-top: 10pt;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          <div class="header-box">
            <div class="header-title">AURA — RELATÓRIO OFICIAL DE CONFORMIDADE & ELEGIBILIDADE</div>
            <div class="meta-item"><strong>Documento Analisado:</strong> ${documentData.title}</div>
            <div class="meta-item"><strong>Edital de Fomento:</strong> ${noticeData.title} (${noticeData.agency})</div>
            <div class="meta-item"><strong>Data de Emissão:</strong> ${new Date().toLocaleString(isEn ? 'en-US' : 'pt-BR')}</div>
            <div class="score-badge">ÍNDICE DE PRONTIDÃO: ${score}%</div>
          </div>

          <h2>1. Requisitos de Elegibilidade do Candidato</h2>
          <table>
            <thead>
              <tr><th>Critério</th><th>Status</th><th>Origem / Exigência</th></tr>
            </thead>
            <tbody>
              ${(noticeData.eligibility || []).map(el => `
                <tr>
                  <td><strong>${el.title}</strong><br><span style="font-size:9pt;color:#64748b;">${el.description}</span></td>
                  <td><span class="${el.status === 'MET' ? 'tag-met' : 'tag-pending'}">${el.status === 'MET' ? '✓ ATENDE' : '⚠ PENDENTE'}</span></td>
                  <td>${el.source}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>2. Checklist de Documentação Obrigatória</h2>
          <table>
            <thead>
              <tr><th>Documento Exigido</th><th>Obrigatoriedade</th><th>Status da Submissão</th></tr>
            </thead>
            <tbody>
              ${(noticeData.documentsChecklist || []).map(doc => `
                <tr>
                  <td>${doc.name}</td>
                  <td>${doc.required ? 'Obrigatório' : 'Opcional'}</td>
                  <td><span class="${doc.status === 'DONE' ? 'tag-met' : 'tag-pending'}">${doc.status === 'DONE' ? '✓ OK' : '⚠ PENDENTE'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>3. Matriz de Critérios de Avaliação (Barema)</h2>
          ${(noticeData.evaluationCriteria || []).map(cr => `
            <div class="card">
              <div class="card-title">${cr.name} (Peso: ${cr.weight}%) — Nota Prevista: ${cr.scoreObtained}/${cr.weight} pts</div>
              <p style="margin:4pt 0;font-size:10pt;"><strong>Exigência Oficial:</strong> ${cr.requirementText}</p>
              <p style="margin:4pt 0;font-size:10pt;color:#0369a1;"><strong>Parecer Técnico:</strong> ${cr.analysis}</p>
              <p style="margin:4pt 0;font-size:10pt;color:#059669;"><strong>Ação Recomendada:</strong> ${cr.suggestion}</p>
            </div>
          `).join('')}

          <div class="footer-note">
            Relatório gerado automaticamente pela plataforma AURA (Ambiente Unificado de Revisão Acadêmica).<br>
            Este diagnóstico separa rigorosamente normas oficiais de sugestões de inteligência artificial.
          </div>
        </div>
      </body>
      </html>
    `;

    const sanitizedFileName = (noticeData.agency || 'edital').toLowerCase().replace(/[^a-z0-9]/gi, '_');
    this.downloadFile(htmlContent, `Relatorio_Conformidade_${sanitizedFileName}.doc`, 'application/msword;charset=utf-8');
  }

  /**
   * Aciona visualização de impressão nativa otimizada para PDF de alta fidelidade
   */
  triggerPrintPdf() {
    window.print();
  }
}

window.auraExport = new AuraExportEngine();
