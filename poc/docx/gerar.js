/**
 * AURA — Prova de conceito do exportador .docx
 *
 * Lê documento-teste.json (JSON canônico escrito à mão) e emite saida.docx.
 * Objetivo: provar que a fidelidade ABNT é alcançável em OOXML antes de
 * construir o editor.
 *
 * Foco principal: bloco 3.2 da lista de verificação — quebras de seção e
 * numeração de página. É o item de maior risco.
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
} = require("docx");

// ---------------------------------------------------------------------------
// Constantes ABNT
// ---------------------------------------------------------------------------

const CM = (n) => convertMillimetersToTwip(n * 10);

const ABNT = {
  margem:        { top: CM(3), left: CM(3), bottom: CM(2), right: CM(2) },
  distanciaCabecalho: CM(2),          // número da página a 2 cm da borda
  fonte:         "Times New Roman",
  tamanhoCorpo:  24,                  // meio-pontos — 12 pt
  tamanhoMenor:  20,                  // meio-pontos — 10 pt
  espacamento15: 360,                 // 240 = simples; 360 = 1,5
  espacamento1:  240,
  recuoParagrafo: CM(1.25),
  recuoCitacao:   CM(4),
  paginaA4:      { width: CM(21), height: CM(29.7) },
};

// Enchimento: repete parágrafos do corpo para o documento passar de 15 páginas.
// Existe só para dar volume — problemas de paginação não aparecem em 2 páginas.
const ENCHIMENTO = 7;

const doc = JSON.parse(fs.readFileSync(path.join(__dirname, "documento-teste.json"), "utf8"));

// ---------------------------------------------------------------------------
// Notas de rodapé: coletadas durante a montagem, registradas no Document
// ---------------------------------------------------------------------------

const notasRodape = {};
let proximaNota = 1;

function registrarNota(texto) {
  const id = proximaNota++;
  notasRodape[id] = { children: [new Paragraph({ children: [new TextRun(texto)] })] };
  return id;
}

// ---------------------------------------------------------------------------
// Nós inline — TextRun[]
// ---------------------------------------------------------------------------

function montarInline(nos) {
  const runs = [];
  for (const no of nos) {
    if (no.type === "text") {
      runs.push(new TextRun({
        text: no.text,
        bold: (no.marks || []).includes("strong"),
        italics: (no.marks || []).includes("em"),
      }));
    } else if (no.type === "citacao") {
      // Citação no texto ligada a uma referência pelo refId.
      runs.push(new TextRun({ text: no.texto }));
    } else if (no.type === "nota_rodape") {
      runs.push(new FootnoteReferenceRun(registrarNota(no.texto)));
    }
  }
  return runs;
}

// ---------------------------------------------------------------------------
// Nós de bloco — Paragraph[] | Table[]
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

function legenda(texto, alinhamento = AlignmentType.LEFT) {
  return new Paragraph({
    children: [new TextRun({ text: texto, size: ABNT.tamanhoMenor })],
    alignment: alinhamento,
    spacing: { line: ABNT.espacamento1 },
  });
}

function montarBloco(no) {
  switch (no.type) {
    case "paragrafo":
      return [paragrafoCorpo(montarInline(no.content))];

    case "citacao_longa":
      // Recuo 4 cm, fonte 10, espaçamento simples, sem aspas.
      return [new Paragraph({
        children: no.content.map((n) =>
          new TextRun({ text: n.text, size: ABNT.tamanhoMenor })),
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: ABNT.espacamento1, before: 240, after: 240 },
        indent: { left: ABNT.recuoCitacao },
      })];

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
        spacing: { line: ABNT.espacamento1, before: 240, after: 120 },
      });
      return [
        legenda(`Figura ${no.numero} – ${no.legenda}`, AlignmentType.CENTER),
        moldura,
        legenda(`Fonte: ${no.fonte}`, AlignmentType.CENTER),
      ];
    }

    case "tabela": {
      const borda = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
      const celula = (texto, negrito = false) => new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: texto, bold: negrito, size: ABNT.tamanhoMenor })],
          spacing: { line: ABNT.espacamento1 },
        })],
      });
      const tabela = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: borda, bottom: borda, left: borda, right: borda,
                   insideHorizontal: borda, insideVertical: borda },
        rows: [
          new TableRow({ children: no.cabecalho.map((c) => celula(c, true)) }),
          ...no.linhas.map((l) => new TableRow({ children: l.map((c) => celula(c)) })),
        ],
      });
      return [
        legenda(`Tabela ${no.numero} – ${no.legenda}`),
        tabela,
        legenda(`Fonte: ${no.fonte}`),
      ];
    }

    case "equacao":
      return [new Paragraph({
        children: [new TextRun({ text: `${no.texto}\t(${no.numero})` })],
        alignment: AlignmentType.CENTER,
        spacing: { line: ABNT.espacamento15, before: 240, after: 240 },
      })];

    default:
      return [];
  }
}

function tituloSecao(secao) {
  const niveis = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
  return new Paragraph({
    text: secao.titulo,
    heading: niveis[secao.nivel - 1],
    // Seção primária começa em nova página.
    pageBreakBefore: secao.nivel === 1 && secao.ordem > 1,
    spacing: { before: 480, after: 240, line: ABNT.espacamento15 },
  });
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

const capa = [
  linhaCentral(m.instituicao, { bold: true }),
  linhaCentral(m.curso),
  new Paragraph({ text: "", spacing: { after: 3000 } }),
  linhaCentral(m.autores[0].toUpperCase()),
  new Paragraph({ text: "", spacing: { after: 3000 } }),
  linhaCentral(m.titulo.toUpperCase(), { bold: true }),
  linhaCentral(m.subtitulo),
  new Paragraph({ text: "", spacing: { after: 4000 } }),
  linhaCentral(m.local),
  linhaCentral(String(m.ano)),
];

// ---------------------------------------------------------------------------
// SEÇÃO 2 — Pré-textuais (contados a partir de 1, número NÃO exibido)
// ---------------------------------------------------------------------------

const preTextuais = [
  // Folha de rosto — é a página 1 da contagem
  linhaCentral(m.autores[0].toUpperCase()),
  new Paragraph({ text: "", spacing: { after: 2400 } }),
  linhaCentral(m.titulo.toUpperCase(), { bold: true }),
  linhaCentral(m.subtitulo),
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

  // Resumo
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ text: "RESUMO", heading: HeadingLevel.HEADING_1,
                  alignment: AlignmentType.CENTER, spacing: { after: 360 } }),
  paragrafoCorpo([new TextRun(m.resumo)], { indent: { firstLine: 0 } }),
  new Paragraph({ text: "", spacing: { after: 240 } }),
  paragrafoCorpo([
    new TextRun({ text: "Palavras-chave: ", bold: true }),
    new TextRun(m.palavrasChave.join("; ") + "."),
  ], { indent: { firstLine: 0 } }),

  // Abstract
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ text: "ABSTRACT", heading: HeadingLevel.HEADING_1,
                  alignment: AlignmentType.CENTER, spacing: { after: 360 } }),
  paragrafoCorpo([new TextRun(m.abstract)], { indent: { firstLine: 0 } }),
  new Paragraph({ text: "", spacing: { after: 240 } }),
  paragrafoCorpo([
    new TextRun({ text: "Keywords: ", bold: true }),
    new TextRun(m.keywords.join("; ") + "."),
  ], { indent: { firstLine: 0 } }),

  // Lista de figuras e de tabelas
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ text: "LISTA DE FIGURAS", heading: HeadingLevel.HEADING_1,
                  alignment: AlignmentType.CENTER, spacing: { after: 360 } }),
  ...doc.listaFiguras.map((f) =>
    new Paragraph({ children: [new TextRun(`Figura ${f.numero} – ${f.titulo}`)],
                    spacing: { line: ABNT.espacamento15 } })),

  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ text: "LISTA DE TABELAS", heading: HeadingLevel.HEADING_1,
                  alignment: AlignmentType.CENTER, spacing: { after: 360 } }),
  ...doc.listaTabelas.map((t) =>
    new Paragraph({ children: [new TextRun(`Tabela ${t.numero} – ${t.titulo}`)],
                    spacing: { line: ABNT.espacamento15 } })),

  // Sumário — campo TOC do Word, não texto digitado
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ text: "SUMÁRIO", heading: HeadingLevel.HEADING_1,
                  alignment: AlignmentType.CENTER, spacing: { after: 360 } }),
  new TableOfContents("Sumário", { hyperlink: true, headingStyleRange: "1-3" }),
];

// ---------------------------------------------------------------------------
// SEÇÃO 3 — Corpo e pós-textuais (numeração continua, número EXIBIDO)
// ---------------------------------------------------------------------------

const corpo = [];

for (const secao of doc.sections) {
  corpo.push(tituloSecao(secao));
  for (const no of secao.content) {
    const blocos = montarBloco(no);
    corpo.push(...blocos);
    // Enchimento: repete apenas parágrafos comuns, para dar volume ao documento.
    if (no.type === "paragrafo") {
      for (let i = 0; i < ENCHIMENTO; i++) corpo.push(...montarBloco(no));
    }
  }
}

// Referências
corpo.push(new Paragraph({
  text: "REFERÊNCIAS", heading: HeadingLevel.HEADING_1,
  pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 360 },
}));
for (const ref of doc.referencias) {
  const texto = ref.tipo === "artigo"
    ? `${ref.autor}. ${ref.titulo}. ${ref.periodico}, v. ${ref.volume}, p. ${ref.paginas}, ${ref.ano}.`
    : `${ref.autor}. ${ref.titulo}. ${ref.local}: ${ref.editora}, ${ref.ano}.`;
  corpo.push(new Paragraph({
    children: [new TextRun(texto)],
    alignment: AlignmentType.LEFT,
    spacing: { line: ABNT.espacamento1, after: 240 },
  }));
}

// Apêndices e anexos
for (const ap of doc.apendices) {
  corpo.push(new Paragraph({
    text: `APÊNDICE ${ap.letra} – ${ap.titulo}`, heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 360 },
  }));
  for (const no of ap.content) corpo.push(...montarBloco(no));
}
for (const an of doc.anexos) {
  corpo.push(new Paragraph({
    text: `ANEXO ${an.letra} – ${an.titulo}`, heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 360 },
  }));
  for (const no of an.content) corpo.push(...montarBloco(no));
}

// ---------------------------------------------------------------------------
// Cabeçalho: número no canto superior direito
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

const documento = new Document({
  footnotes: notasRodape,
  styles: {
    default: {
      document: {
        run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo },
        paragraph: { spacing: { line: ABNT.espacamento15 } },
      },
      // Estilos NOMEADOS — é o que faz o painel de navegação do Word
      // enxergar a estrutura e o campo TOC funcionar.
      heading1: {
        run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, bold: true, color: "000000" },
        paragraph: { spacing: { before: 480, after: 240, line: ABNT.espacamento15 } },
      },
      heading2: {
        run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, bold: false, color: "000000" },
        paragraph: { spacing: { before: 360, after: 240, line: ABNT.espacamento15 } },
      },
      heading3: {
        run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, italics: true, color: "000000" },
        paragraph: { spacing: { before: 360, after: 240, line: ABNT.espacamento15 } },
      },
      footnoteText: {
        run: { font: ABNT.fonte, size: ABNT.tamanhoMenor },
        paragraph: { spacing: { line: ABNT.espacamento1 } },
      },
    },
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
    // 3 — Corpo: contagem CONTINUA (sem "start"), número exibido
    {
      properties: { page: propriedadesPagina },
      headers: { default: cabecalhoComNumero },
      children: corpo,
    },
  ],
});

Packer.toBuffer(documento).then((buffer) => {
  fs.writeFileSync(path.join(__dirname, "saida.docx"), buffer);
  console.log("saida.docx gerado.");
  console.log(`Notas de rodapé registradas: ${proximaNota - 1}`);
  console.log("Abra no Microsoft Word e confira a lista de verificação.");
  console.log("Atenção: o sumário aparece vazio até você clicar nele e");
  console.log("atualizar o campo (F9 ou botão direito → Atualizar campo).");
});
