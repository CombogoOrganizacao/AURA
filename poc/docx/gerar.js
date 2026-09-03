/**
 * AURA — Exportador .docx com fidelidade ABNT (PoC v2)
 *
 * Lê documento-teste.json (JSON canônico) e emite saida.docx.
 *
 * Normas cobertas:
 *   NBR 14724 — apresentação de trabalhos acadêmicos
 *   NBR 6023  — referências
 *   NBR 10520 — citações
 *   NBR 6024  — numeração progressiva das seções
 *   NBR 6027  — sumário
 *   NBR 6028  — resumo
 *
 * Além de gerar o arquivo, roda uma passagem de VALIDAÇÃO e imprime as
 * divergências que dependem do conteúdo, e não da formatação — há regras que
 * o exportador não tem como corrigir sozinho.
 *
 * Uso: node gerar.js
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  PageBreak, Header, PageNumber, NumberFormat, TableOfContents,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  FootnoteReferenceRun, LevelFormat, convertMillimetersToTwip,
  SequentialIdentifier, TabStopType,
} = require("docx");

// ---------------------------------------------------------------------------
// Constantes ABNT (NBR 14724, seção 5)
// ---------------------------------------------------------------------------

const CM = (n) => convertMillimetersToTwip(n * 10);

const ABNT = {
  margem:        { top: CM(3), left: CM(3), bottom: CM(2), right: CM(2) },
  distanciaCabecalho: CM(2),          // número da página a 2 cm da borda
  fonte:         "Times New Roman",
  tamanhoCorpo:  24,                  // meio-pontos -> 12 pt
  tamanhoMenor:  20,                  // meio-pontos -> 10 pt
  espacamento15: 360,                 // 240 = simples; 360 = 1,5
  espacamento1:  240,
  recuoParagrafo: CM(1.25),
  recuoCitacao:   CM(4),
  paginaA4:      { width: CM(21), height: CM(29.7) },
  larguraUtil:   CM(16),              // 21 - 3 - 2
  // A NBR 14724 manda espaço simples em citação longa, notas, referências,
  // legendas e natureza do trabalho. Para o resumo a norma é omissa e cada
  // instituição decide; mantido 1,5 e exposto aqui como escolha explícita.
  resumoEspacoSimples: false,
};

const ENCHIMENTO = 7;

const doc = JSON.parse(fs.readFileSync(path.join(__dirname, "documento-teste.json"), "utf8"));

// ---------------------------------------------------------------------------
// Coletor de avisos de conformidade
// ---------------------------------------------------------------------------

const avisos = [];
const avisar = (norma, msg) => avisos.push(`[${norma}] ${msg}`);

// ---------------------------------------------------------------------------
// Notas de rodapé
// ---------------------------------------------------------------------------

const notasRodape = {};
let proximaNota = 1;

function registrarNota(texto) {
  const id = proximaNota++;
  notasRodape[id] = { children: [new Paragraph({ children: [new TextRun(texto)] })] };
  return id;
}

// ---------------------------------------------------------------------------
// Citações no texto — NBR 10520
// ---------------------------------------------------------------------------

const refsCitadas = new Set();

// Sistema autor-data. Citação direta curta (até três linhas) fica dentro do
// parágrafo, entre aspas duplas, com indicação de página.
function runsCitacao(no, tamanho) {
  if (no.refId) refsCitadas.add(no.refId);
  const sz = tamanho ? { size: tamanho } : {};

  if (no.modo === "direta_curta") {
    if (!/p\.\s*\d/.test(no.chamada || "")) {
      avisar("NBR 10520", `citação direta sem indicação de página: "${no.chamada}"`);
    }
    return [
      new TextRun({ text: `“${no.texto}”`, ...sz }),
      new TextRun({ text: ` (${no.chamada})`, ...sz }),
    ];
  }
  if (no.modo === "indireta") {
    return [new TextRun({ text: `(${no.chamada})`, ...sz })];
  }
  // Compatibilidade com o formato antigo: texto literal já parentetizado.
  avisar("NBR 10520", `nó de citação sem "modo" — tratado como texto literal: "${no.texto}"`);
  return [new TextRun({ text: no.texto, ...sz })];
}

// ---------------------------------------------------------------------------
// Nós inline -> TextRun[]
// ---------------------------------------------------------------------------

function montarInline(nos, tamanho = null) {
  const runs = [];
  for (const no of nos) {
    if (no.type === "text") {
      runs.push(new TextRun({
        text: no.text,
        bold: (no.marks || []).includes("strong"),
        italics: (no.marks || []).includes("em"),
        ...(tamanho ? { size: tamanho } : {}),
      }));
    } else if (no.type === "citacao") {
      runs.push(...runsCitacao(no, tamanho));
    } else if (no.type === "nota_rodape") {
      runs.push(new FootnoteReferenceRun(registrarNota(no.texto)));
    }
  }
  return runs;
}

// Remove notas de rodapé de um nó, para que o enchimento não registre a mesma
// nota várias vezes. (Correção do defeito 2.)
function semNotas(no) {
  if (no.type !== "paragrafo") return no;
  return { ...no, content: no.content.filter((n) => n.type !== "nota_rodape") };
}

// ---------------------------------------------------------------------------
// Nós de bloco -> Paragraph[] | Table[]
// ---------------------------------------------------------------------------

function paragrafoCorpo(children, extra = {}) {
  return new Paragraph({
    children,
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: ABNT.espacamento15 },
    indent: { firstLine: ABNT.recuoParagrafo },
    ...extra,
  });
}

// Legenda de ilustração/tabela: fonte menor, espaço simples, presa ao objeto
// (keepNext), com numeração por campo SEQ — é o que permite ao Word montar a
// lista de figuras/tabelas com o número de página correto.
function legendaComSeq(rotulo, titulo, alinhamento) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${rotulo} `, size: ABNT.tamanhoMenor }),
      new SequentialIdentifier(rotulo),
      new TextRun({ text: ` — ${titulo}`, size: ABNT.tamanhoMenor }),
    ],
    alignment: alinhamento,
    spacing: { line: ABNT.espacamento1 },
    keepNext: true,
  });
}

function fonteDe(texto, alinhamento) {
  return new Paragraph({
    children: [new TextRun({ text: `Fonte: ${texto}`, size: ABNT.tamanhoMenor })],
    alignment: alinhamento,
    spacing: { line: ABNT.espacamento1, after: 240 },
  });
}

function montarBloco(no) {
  switch (no.type) {
    case "paragrafo":
      return [paragrafoCorpo(montarInline(no.content))];

    case "citacao_longa": {
      // NBR 10520: mais de três linhas -> recuo de 4 cm, fonte menor,
      // espaçamento simples, sem aspas, com a chamada ao final.
      const runs = montarInline(no.content, ABNT.tamanhoMenor);
      if (no.chamada) {
        if (no.refId) refsCitadas.add(no.refId);
        runs.push(new TextRun({ text: ` (${no.chamada})`, size: ABNT.tamanhoMenor }));
      } else {
        avisar("NBR 10520", "citação longa sem chamada de autoria ao final");
      }
      return [new Paragraph({
        children: runs,
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: ABNT.espacamento1, before: 240, after: 240 },
        indent: { left: ABNT.recuoCitacao },
      })];
    }

    case "lista":
      return no.itens.map((item) => new Paragraph({
        children: [new TextRun(item)],
        spacing: { line: ABNT.espacamento15 },
        ...(no.ordenada
          ? { numbering: { reference: "lista-numerada", level: 0 } }
          : { bullet: { level: 0 } }),
      }));

    case "figura": {
      // Placeholder honesto: a PoC não testa imagem real, testa legenda e fonte.
      const moldura = new Paragraph({
        children: [new TextRun({ text: "[ espaço reservado para a imagem ]", italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { line: ABNT.espacamento1, before: 120, after: 120 },
        keepNext: true,
      });
      return [
        legendaComSeq("Figura", no.legenda, AlignmentType.CENTER),
        moldura,
        fonteDe(no.fonte, AlignmentType.CENTER),
      ];
    }

    case "tabela": {
      // Padrão IBGE adotado pela ABNT: laterais abertas, sem traços verticais.
      // Fecha em cima e embaixo; um fio separa o cabeçalho do corpo.
      const fio  = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
      const nada = { style: BorderStyle.NONE, size: 0, color: "auto" };
      const nCols = no.cabecalho.length;
      const largCol = Math.floor(ABNT.larguraUtil / nCols);
      const larguras = Array(nCols).fill(largCol);

      const celula = (texto, negrito, bordaInferior) => new TableCell({
        width: { size: largCol, type: WidthType.DXA },
        borders: {
          top: nada, left: nada, right: nada,
          bottom: bordaInferior ? fio : nada,
        },
        children: [new Paragraph({
          children: [new TextRun({ text: texto, bold: negrito, size: ABNT.tamanhoMenor })],
          spacing: { line: ABNT.espacamento1 },
        })],
      });

      const tabela = new Table({
        width: { size: largCol * nCols, type: WidthType.DXA },
        columnWidths: larguras,
        borders: { top: fio, bottom: fio, left: nada, right: nada,
                   insideHorizontal: nada, insideVertical: nada },
        rows: [
          new TableRow({
            tableHeader: true,   // repete o cabeçalho se a tabela quebrar página
            children: no.cabecalho.map((c) => celula(c, true, true)),
          }),
          ...no.linhas.map((l) =>
            new TableRow({ children: l.map((c) => celula(c, false, false)) })),
        ],
      });
      return [
        legendaComSeq("Tabela", no.legenda, AlignmentType.LEFT),
        tabela,
        fonteDe(no.fonte, AlignmentType.LEFT),
      ];
    }

    case "equacao":
      // Tabulações explícitas: centro em 8 cm, número alinhado à margem
      // direita. Sem isso o número cai na tabulação padrão do Word.
      return [new Paragraph({
        children: [new TextRun({ text: `\t${no.texto}\t(${no.numero})` })],
        alignment: AlignmentType.LEFT,
        tabStops: [
          { type: TabStopType.CENTER, position: Math.floor(ABNT.larguraUtil / 2) },
          { type: TabStopType.RIGHT,  position: ABNT.larguraUtil },
        ],
        spacing: { line: ABNT.espacamento15, before: 240, after: 240 },
      })];

    default:
      avisar("interno", `tipo de bloco desconhecido, ignorado: "${no.type}"`);
      return [];
  }
}

// ---------------------------------------------------------------------------
// Títulos — NBR 6024 / NBR 6027
// ---------------------------------------------------------------------------

function tituloSecao(secao) {
  const niveis = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
                  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5];
  return new Paragraph({
    text: secao.titulo,
    heading: niveis[secao.nivel - 1],
    pageBreakBefore: secao.nivel === 1 && secao.ordem > 1,
    keepNext: true,           // título não fica órfão no pé da página
    spacing: { before: 480, after: 240, line: ABNT.espacamento15 },
  });
}

// Título de elemento pré-textual: mesma tipografia da seção primária, mas SEM
// nível de estrutura — é o que o mantém fora do sumário (NBR 6027).
function tituloPreTextual(texto) {
  return new Paragraph({
    text: texto,
    style: "TituloPreTextual",
    keepNext: true,
  });
}

// ---------------------------------------------------------------------------
// VALIDAÇÃO — regras que dependem do conteúdo
// ---------------------------------------------------------------------------

function validar() {
  const md = doc.metadados;

  // --- NBR 6028: resumo ---
  const contar = (t) => (t || "").trim().split(/\s+/).filter(Boolean).length;
  const nResumo = contar(md.resumo);
  if (nResumo < 150 || nResumo > 500) {
    avisar("NBR 6028", `resumo com ${nResumo} palavras; a norma pede de 150 a 500 em trabalho acadêmico`);
  }
  if ((md.resumo || "").includes("\n")) {
    avisar("NBR 6028", "resumo deve ser parágrafo único, sem quebras de linha");
  }
  const nAbstract = contar(md.abstract);
  if (nAbstract < 150 || nAbstract > 500) {
    avisar("NBR 6028", `abstract com ${nAbstract} palavras; mesma faixa de 150 a 500`);
  }
  if (!md.palavrasChave || md.palavrasChave.length === 0) {
    avisar("NBR 6028", "resumo sem palavras-chave");
  }

  // --- NBR 6024: numeração progressiva ---
  const usados = [];
  for (const s of doc.sections) {
    const mm = /^(\d+(?:\.\d+)*)\s+(.*)$/.exec(s.titulo || "");
    if (!mm) {
      avisar("NBR 6024", `seção sem indicativo numérico: "${s.titulo}"`);
      continue;
    }
    const ind = mm[1], texto = mm[2];
    const nivelInd = ind.split(".").length;
    if (nivelInd !== s.nivel) {
      avisar("NBR 6024", `indicativo "${ind}" tem ${nivelInd} nível(is), mas o JSON declara nivel ${s.nivel}`);
    }
    if (nivelInd > 5) avisar("NBR 6024", `indicativo "${ind}" excede os cinco níveis previstos`);
    if (texto.trim().endsWith(".")) avisar("NBR 6024", `título "${texto}" não deve terminar em ponto`);
    usados.push(ind);
  }
  const vistos = {};
  for (const ind of usados) {
    const partes = ind.split(".").map(Number);
    const chave = partes.slice(0, -1).join(".") || "raiz";
    const esperado = (vistos[chave] || 0) + 1;
    if (partes[partes.length - 1] !== esperado) {
      const prefixo = chave === "raiz" ? "" : chave + ".";
      avisar("NBR 6024", `numeração fora de sequência: esperado ${prefixo}${esperado}, veio "${ind}"`);
    }
    vistos[chave] = partes[partes.length - 1];
  }

  // --- NBR 6023: referências ---
  const ids = new Set();
  for (const r of doc.referencias) {
    if (!r.id) avisar("NBR 6023", `referência sem "id", não pode ser ligada a citações: "${r.titulo}"`);
    else if (ids.has(r.id)) avisar("NBR 6023", `id de referência duplicado: "${r.id}"`);
    else ids.add(r.id);
    if (!r.autor || !r.titulo || !r.ano) {
      avisar("NBR 6023", `referência incompleta (autor/título/ano): "${r.titulo || r.id}"`);
    }
    if (r.tipo === "site" && (!r.url || !r.acesso)) {
      avisar("NBR 6023", `referência eletrônica sem "Disponível em" ou "Acesso em": "${r.titulo}"`);
    }
  }
  // --- NBR 10520: correspondência citação <-> referência ---
  for (const id of refsCitadas) {
    if (!ids.has(id)) avisar("NBR 10520", `citação aponta para refId inexistente: "${id}"`);
  }
  for (const id of ids) {
    if (!refsCitadas.has(id)) avisar("NBR 6023", `referência nunca citada no texto: "${id}"`);
  }

  // --- NBR 14724: elementos obrigatórios ---
  if (!md.folhaAprovacao) {
    avisar("NBR 14724", "folha de aprovação ausente; é elemento obrigatório em trabalho de conclusão");
  }
  for (const campo of ["instituicao", "curso", "titulo", "local", "ano", "naturezaTrabalho", "orientador"]) {
    if (!md[campo]) avisar("NBR 14724", `metadado obrigatório ausente: ${campo}`);
  }
  if ((md.autores || []).length === 0) avisar("NBR 14724", "trabalho sem autoria declarada");
}

// ---------------------------------------------------------------------------
// SEÇÃO 1 — Capa (não contada, sem numeração exibida)
// ---------------------------------------------------------------------------

const m = doc.metadados;
const linhaCentral = (texto, extra = {}) => new Paragraph({
  children: [new TextRun({ text: texto, ...extra })],
  alignment: AlignmentType.CENTER,
  spacing: { line: ABNT.espacamento15 },
});

// Todos os autores, não só o primeiro.
const linhasAutores = () => m.autores.map((a) => linhaCentral(a.toUpperCase()));

const capa = [
  linhaCentral(m.instituicao, { bold: true }),
  linhaCentral(m.curso),
  new Paragraph({ text: "", spacing: { after: 3000 } }),
  ...linhasAutores(),
  new Paragraph({ text: "", spacing: { after: 3000 } }),
  linhaCentral(m.titulo.toUpperCase(), { bold: true }),
  ...(m.subtitulo ? [linhaCentral(m.subtitulo)] : []),
  new Paragraph({ text: "", spacing: { after: 4000 } }),
  linhaCentral(m.local),
  linhaCentral(String(m.ano)),
];

// ---------------------------------------------------------------------------
// SEÇÃO 2 — Pré-textuais (contados a partir de 1, número NÃO exibido)
// ---------------------------------------------------------------------------

const espacoResumo = ABNT.resumoEspacoSimples ? ABNT.espacamento1 : ABNT.espacamento15;

const preTextuais = [
  // Folha de rosto — página 1 da contagem
  ...linhasAutores(),
  new Paragraph({ text: "", spacing: { after: 2400 } }),
  linhaCentral(m.titulo.toUpperCase(), { bold: true }),
  ...(m.subtitulo ? [linhaCentral(m.subtitulo)] : []),
  new Paragraph({ text: "", spacing: { after: 1200 } }),
  new Paragraph({
    children: [new TextRun({ text: m.naturezaTrabalho, size: ABNT.tamanhoMenor })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: ABNT.espacamento1 },
    indent: { left: CM(8) },
  }),
  new Paragraph({ text: "", spacing: { after: 600 } }),
  new Paragraph({
    children: [new TextRun({ text: `Orientador: ${m.orientador}`, size: ABNT.tamanhoMenor })],
    indent: { left: CM(8) },
    spacing: { line: ABNT.espacamento1 },
  }),
  new Paragraph({ text: "", spacing: { after: 2400 } }),
  linhaCentral(m.local),
  linhaCentral(String(m.ano)),

  // Resumo — NBR 6028: parágrafo único, sem recuo de primeira linha
  new Paragraph({ children: [new PageBreak()] }),
  tituloPreTextual("RESUMO"),
  new Paragraph({
    children: [new TextRun(m.resumo)],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: espacoResumo },
  }),
  new Paragraph({ text: "", spacing: { after: 240 } }),
  new Paragraph({
    children: [
      new TextRun({ text: "Palavras-chave: ", bold: true }),
      new TextRun(m.palavrasChave.join("; ") + "."),
    ],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: espacoResumo },
  }),

  // Abstract
  new Paragraph({ children: [new PageBreak()] }),
  tituloPreTextual("ABSTRACT"),
  new Paragraph({
    children: [new TextRun(m.abstract)],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: espacoResumo },
  }),
  new Paragraph({ text: "", spacing: { after: 240 } }),
  new Paragraph({
    children: [
      new TextRun({ text: "Keywords: ", bold: true }),
      new TextRun(m.keywords.join("; ") + "."),
    ],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: espacoResumo },
  }),

  // Listas de ilustrações e tabelas — campos TOC de legendas, com número de
  // página real, em vez de texto digitado.
  new Paragraph({ children: [new PageBreak()] }),
  tituloPreTextual("LISTA DE FIGURAS"),
  new TableOfContents("Lista de figuras", { hyperlink: true, captionLabelIncludingNumbers: "Figura" }),

  new Paragraph({ children: [new PageBreak()] }),
  tituloPreTextual("LISTA DE TABELAS"),
  new TableOfContents("Lista de tabelas", { hyperlink: true, captionLabelIncludingNumbers: "Tabela" }),

  // Sumário — NBR 6027: último pré-textual, só textuais e pós-textuais
  new Paragraph({ children: [new PageBreak()] }),
  tituloPreTextual("SUMÁRIO"),
  new TableOfContents("Sumário", { hyperlink: true, headingStyleRange: "1-5" }),
];

// ---------------------------------------------------------------------------
// SEÇÃO 3 — Corpo e pós-textuais (numeração continua, número EXIBIDO)
// ---------------------------------------------------------------------------

const corpo = [];

for (const secao of doc.sections) {
  corpo.push(tituloSecao(secao));
  for (const no of secao.content) {
    corpo.push(...montarBloco(no));
    // Enchimento: repete o parágrafo SEM as notas, para não registrar a mesma
    // nota várias vezes.
    if (no.type === "paragrafo") {
      const copia = semNotas(no);
      for (let i = 0; i < ENCHIMENTO; i++) corpo.push(...montarBloco(copia));
    }
  }
}

// ---------------------------------------------------------------------------
// Referências — NBR 6023
// ---------------------------------------------------------------------------

// Ordem alfabética pelo elemento de entrada (autoria).
const referenciasOrdenadas = [...doc.referencias].sort((a, b) =>
  (a.autor || "").localeCompare(b.autor || "", "pt-BR"));

// O destaque tipográfico vai no título, exceto em artigo de periódico, em que
// vai no nome do periódico.
function runsReferencia(ref) {
  const t = (s, extra = {}) => new TextRun({ text: s, ...extra });
  switch (ref.tipo) {
    case "artigo":
      return [
        t(`${ref.autor}. ${ref.titulo}. `),
        t(ref.periodico, { bold: true }),
        t(`, v. ${ref.volume}${ref.numero ? `, n. ${ref.numero}` : ""}, p. ${ref.paginas}, ${ref.ano}.`),
      ];
    case "site":
      return [
        t(`${ref.autor}. `),
        t(ref.titulo, { bold: true }),
        t(`. ${ref.local ? ref.local + ", " : ""}${ref.ano}. Disponível em: ${ref.url}. Acesso em: ${ref.acesso}.`),
      ];
    default: // livro
      return [
        t(`${ref.autor}. `),
        t(ref.titulo, { bold: true }),
        t(`. ${ref.edicao ? ref.edicao + ". " : ""}${ref.local}: ${ref.editora}, ${ref.ano}.`),
      ];
  }
}

corpo.push(new Paragraph({
  text: "REFERÊNCIAS", heading: HeadingLevel.HEADING_1,
  pageBreakBefore: true, alignment: AlignmentType.CENTER,
  keepNext: true, spacing: { after: 360 },
}));
for (const ref of referenciasOrdenadas) {
  // NBR 6023: à esquerda, espaço simples, separadas por linha em branco.
  corpo.push(new Paragraph({
    children: runsReferencia(ref),
    alignment: AlignmentType.LEFT,
    spacing: { line: ABNT.espacamento1, after: 240 },
  }));
}

// ---------------------------------------------------------------------------
// Apêndices e anexos
// ---------------------------------------------------------------------------

for (const ap of doc.apendices) {
  corpo.push(new Paragraph({
    text: `APÊNDICE ${ap.letra} — ${ap.titulo}`, heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true, alignment: AlignmentType.CENTER,
    keepNext: true, spacing: { after: 360 },
  }));
  for (const no of ap.content) corpo.push(...montarBloco(no));
}
for (const an of doc.anexos) {
  corpo.push(new Paragraph({
    text: `ANEXO ${an.letra} — ${an.titulo}`, heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true, alignment: AlignmentType.CENTER,
    keepNext: true, spacing: { after: 360 },
  }));
  for (const no of an.content) corpo.push(...montarBloco(no));
}

// ---------------------------------------------------------------------------
// Cabeçalho: número no canto superior direito (NBR 14724)
// ---------------------------------------------------------------------------

const cabecalhoComNumero = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ children: [PageNumber.CURRENT] })],
  })],
});

// ---------------------------------------------------------------------------
// Montagem do documento
// ---------------------------------------------------------------------------

const propriedadesPagina = {
  size: ABNT.paginaA4,
  margin: { ...ABNT.margem, header: ABNT.distanciaCabecalho },
};

const estiloTitulo = (extra) => ({
  run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, color: "000000", ...extra },
  paragraph: { spacing: { before: 360, after: 240, line: ABNT.espacamento15 } },
});

const documento = new Document({
  // Faz o Word atualizar os campos (sumário, listas, SEQ) ao abrir.
  features: { updateFields: true },
  footnotes: notasRodape,
  styles: {
    default: {
      document: {
        run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo },
        paragraph: { spacing: { line: ABNT.espacamento15 } },
      },
      // NBR 6024: cada nível com recurso gráfico distinto, usado de forma
      // consistente ao longo do trabalho.
      heading1: {
        run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, bold: true, allCaps: true, color: "000000" },
        paragraph: { spacing: { before: 480, after: 240, line: ABNT.espacamento15 } },
      },
      heading2: estiloTitulo({ bold: true }),
      heading3: estiloTitulo({ italics: true }),
      heading4: estiloTitulo({}),
      heading5: estiloTitulo({ italics: true, smallCaps: true }),
      footnoteText: {
        run: { font: ABNT.fonte, size: ABNT.tamanhoMenor },
        paragraph: { spacing: { line: ABNT.espacamento1 } },
      },
    },
    paragraphStyles: [{
      // Mesma aparência da seção primária, sem nível de estrutura: é o que
      // mantém os pré-textuais fora do sumário.
      id: "TituloPreTextual",
      name: "Titulo Pre-Textual",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, bold: true, color: "000000" },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 360, line: ABNT.espacamento15 } },
    }],
  },
  numbering: {
    config: [{
      reference: "lista-numerada",
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: CM(1.25), hanging: CM(0.5) } } },
      }],
    }],
  },
  sections: [
    // 1 — Capa: sem cabeçalho, fora da contagem
    {
      properties: { page: propriedadesPagina },
      children: capa,
    },
    // 2 — Pré-textuais: contagem REINICIA em 1, número não exibido
    {
      properties: {
        page: {
          ...propriedadesPagina,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      children: preTextuais,
    },
    // 3 — Corpo: contagem CONTINUA, número exibido
    {
      properties: { page: propriedadesPagina },
      headers: { default: cabecalhoComNumero },
      children: corpo,
    },
  ],
});

validar();

Packer.toBuffer(documento).then((buffer) => {
  fs.writeFileSync(path.join(__dirname, "saida.docx"), buffer);
  console.log("saida.docx gerado.");
  console.log(`Notas de rodapé registradas: ${proximaNota - 1}`);
  console.log("");
  if (avisos.length === 0) {
    console.log("Validação de conformidade: nenhuma divergência encontrada.");
  } else {
    console.log(`Validação de conformidade — ${avisos.length} divergência(s):`);
    for (const a of avisos) console.log("  · " + a);
  }
});
