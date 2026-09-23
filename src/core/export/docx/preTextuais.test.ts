import { Document, Packer, type FileChild } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento, Metadados } from "../../document/types";
import { fromDocumento } from "./fromDocumento";
import { paragrafosAbstract, paragrafosResumo } from "./preTextuais";

function criarMetadados(overrides: Partial<Metadados> = {}): Metadados {
  return {
    tipo: "tcc",
    norma: "abnt",
    titulo: "A formatação de trabalhos acadêmicos",
    autores: ["Maria da Silva"],
    instituicao: "Universidade Católica de Pernambuco",
    curso: "Ciência da Computação",
    orientador: "João Souza",
    local: "Recife",
    ano: 2026,
    naturezaTrabalho: "",
    resumo: "",
    palavrasChave: [],
    abstract: "",
    keywords: [],
    ...overrides,
  };
}

// Mesmo padrão de `fromDocumento.test.ts`/`sections.test.ts`: inspeciona o
// XML de verdade, gerado pelo `Packer`, em vez de reimplementar por conta
// própria como a lib `docx` guarda texto em `Paragraph`/`TextRun`.
// `FileChild`, não `Paragraph`: desde o passo 3.6.4 um bloco pré-textual
// pode conter um campo `TableOfContents` (a lista de figuras), que não é
// parágrafo.
async function documentXmlDe(filhos: readonly FileChild[]) {
  const documento = new Document({ sections: [{ properties: {}, children: [...filhos] }] });
  const buffer = await Packer.toBuffer(documento);
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("word/document.xml")!.async("string");
}

// O rótulo vai num run em negrito e os termos em outro (porte da PoC), então
// "Palavras-chave: a; b." nunca aparece como um `<w:t>` só — o rótulo e a
// lista são procurados separadamente.
function temRotuloEmNegrito(xml: string, rotulo: string): boolean {
  const posRotulo = xml.indexOf(`${rotulo}: `);
  if (posRotulo === -1) return false;
  const run = xml.slice(xml.lastIndexOf("<w:r>", posRotulo), posRotulo);
  return run.includes("<w:b />") || run.includes("<w:b/>");
}

describe("paragrafosResumo", () => {
  it("omite tudo quando o resumo está vazio", () => {
    expect(paragrafosResumo(criarMetadados())).toEqual([]);
  });

  it("monta título, corpo e palavras-chave separadas por ponto e vírgula, nesta ordem", async () => {
    const paragrafos = paragrafosResumo(
      criarMetadados({
        resumo: "Este trabalho investiga X.",
        palavrasChave: ["Educação", "Tecnologia", "Ensino remoto"],
      }),
    );

    const xml = await documentXmlDe(paragrafos);
    const posTitulo = xml.indexOf("RESUMO");
    const posCorpo = xml.indexOf("Este trabalho investiga X.");
    const posTermos = xml.indexOf("Educação; Tecnologia; Ensino remoto.");

    expect(posTitulo).toBeGreaterThan(-1);
    expect(posCorpo).toBeGreaterThan(-1);
    expect(posTermos).toBeGreaterThan(-1);
    expect(posTitulo).toBeLessThan(posCorpo);
    expect(posCorpo).toBeLessThan(posTermos);
    // Rótulo em negrito, em run próprio — igual à PoC congelada.
    expect(temRotuloEmNegrito(xml, "Palavras-chave")).toBe(true);
  });

  it("omite a linha de palavras-chave quando o array está vazio", async () => {
    const paragrafos = paragrafosResumo(
      criarMetadados({ resumo: "Este trabalho investiga X.", palavrasChave: [] }),
    );

    const xml = await documentXmlDe(paragrafos);
    expect(xml).not.toContain("Palavras-chave");
  });
});

describe("paragrafosAbstract", () => {
  it("omite tudo quando o abstract está vazio — mesmo com keywords preenchidas", () => {
    expect(paragrafosAbstract(criarMetadados({ keywords: ["education"] }))).toEqual([]);
  });

  it("monta título, corpo e keywords separadas por ponto e vírgula, nesta ordem", async () => {
    const paragrafos = paragrafosAbstract(
      criarMetadados({
        abstract: "This work investigates X.",
        keywords: ["Education", "Technology"],
      }),
    );

    const xml = await documentXmlDe(paragrafos);
    const posTitulo = xml.indexOf("ABSTRACT");
    const posCorpo = xml.indexOf("This work investigates X.");
    const posTermos = xml.indexOf("Education; Technology.");

    expect(posTitulo).toBeGreaterThan(-1);
    expect(posCorpo).toBeGreaterThan(-1);
    expect(posTermos).toBeGreaterThan(-1);
    expect(posTitulo).toBeLessThan(posCorpo);
    expect(posCorpo).toBeLessThan(posTermos);
    expect(temRotuloEmNegrito(xml, "Keywords")).toBe(true);
  });
});

// Os pré-textuais deixaram de ter um `montarPreTextuais()` próprio no passo
// 3.7.2: a composição passou a ser dirigida por `ORDEM_CANONICA`
// (src/core/document/order.ts), dentro de `fromDocumento()`. Estes testes
// passaram a ir por lá — testam a montagem de verdade, não uma segunda
// montagem que só existe no teste.
//
// Por isso as asserções são de ORDEM RELATIVA, e não de contagem de quebras:
// a seção pré-textual agora tem também a folha de rosto abrindo e o sumário
// fechando, e contar quebras amarraria o teste a quantos elementos existem
// em vez de à ordem entre eles, que é o que o passo promete.
function documentoCom(metadados: Metadados): Documento {
  return { ...novoDocumento(), metadados };
}

async function xmlDoDocumento(metadados: Metadados): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documentoCom(metadados))));
  return zip.file("word/document.xml")!.async("string");
}

describe("ordem canônica dos pré-textuais (passo 3.7.2)", () => {
  const comOsDois = criarMetadados({
    resumo: "Este trabalho investiga X.",
    abstract: "This work investigates X.",
  });

  // `docx` serializa sem espaço antes do `/>`, mas o regex tolera os dois —
  // é detalhe de formatação da lib, não algo que este teste queira fixar.
  const QUEBRA_DE_PAGINA = /<w:br w:type="page"\s*\/>/;

  it("resumo vem antes do abstract, com quebra de página entre os dois", async () => {
    const xml = await xmlDoDocumento(comOsDois);

    const posResumo = xml.indexOf("RESUMO");
    const posAbstract = xml.indexOf("ABSTRACT");
    expect(posResumo).toBeLessThan(posAbstract);

    const entre = xml.slice(posResumo, posAbstract);
    expect(entre).toMatch(QUEBRA_DE_PAGINA);
  });

  it("a seção pré-textual não abre com quebra de página", async () => {
    const xml = await xmlDoDocumento(comOsDois);

    // A folha de rosto é o primeiro elemento da seção, e a seção OOXML já
    // começa numa página nova: uma quebra antes dela deixaria uma folha em
    // branco. `naturezaTrabalho` é o texto que só existe na folha de rosto.
    const posFolhaDeRosto = xml.indexOf(comOsDois.naturezaTrabalho || comOsDois.orientador);
    const posPrimeiraQuebra = xml.search(QUEBRA_DE_PAGINA);

    expect(posFolhaDeRosto).toBeGreaterThan(-1);
    expect(posPrimeiraQuebra).toBeGreaterThan(posFolhaDeRosto);
  });

  it("documento sem resumo nem abstract não fabrica os títulos", async () => {
    const xml = await xmlDoDocumento(criarMetadados());

    expect(xml).not.toContain("RESUMO");
    expect(xml).not.toContain("ABSTRACT");
  });

  // Passo 3.5.3 — os opcionais entram antes do resumo, na ordem da norma.
  it("põe dedicatória, agradecimentos e epígrafe antes do resumo e do abstract", async () => {
    const xml = await xmlDoDocumento(
      criarMetadados({
        dedicatoria: { ativo: true, texto: "À minha família." },
        agradecimentos: { ativo: true, texto: "Ao meu orientador." },
        epigrafe: { ativo: true, texto: "Uma citação." },
        resumo: "Este trabalho investiga X.",
        abstract: "This work investigates X.",
      }),
    );

    const posicoes = [
      "À minha família.",
      "AGRADECIMENTOS",
      "Uma citação.",
      "RESUMO",
      "ABSTRACT",
      "SUMÁRIO",
    ].map((trecho) => xml.indexOf(trecho));

    for (const posicao of posicoes) expect(posicao).toBeGreaterThan(-1);
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });

  it("recua dedicatória e epígrafe a partir do meio da mancha; agradecimentos não", async () => {
    const xml = await xmlDoDocumento(
      criarMetadados({
        dedicatoria: { ativo: true, texto: "À minha família." },
        agradecimentos: { ativo: true, texto: "Ao meu orientador." },
      }),
    );

    // `larguraUtil` (16 cm) / 2 = 4535 twips — o mesmo número que `CM(8)`
    // produz em `poc/docx/gerar.js` na nota da folha de rosto, conferido.
    // Derivar da largura útil em vez de repetir o 8 é o que mantém os dois
    // ligados se a margem mudar.
    const paragrafoDedicatoria = xml.slice(
      xml.lastIndexOf("<w:p>", xml.indexOf("À minha família.")),
      xml.indexOf("À minha família."),
    );
    expect(paragrafoDedicatoria).toContain('w:left="4535"');

    const paragrafoAgradecimento = xml.slice(
      xml.lastIndexOf("<w:p>", xml.indexOf("Ao meu orientador.")),
      xml.indexOf("Ao meu orientador."),
    );
    expect(paragrafoAgradecimento).not.toContain('w:left="4535"');
  });
});

// Passo 4B.3 — folha de aprovação (NBR 14724:2024 §4.2.1.3).
describe("folha de aprovação no .docx (passo 4B.3)", () => {
  const banca = [
    { id: "b1", nome: "João Souza", titulacao: "Doutor em Computação", instituicao: "UNICAP" },
    { id: "b2", nome: "Ana Lima", titulacao: "Mestra em Educação", instituicao: "UFPE" },
  ];

  it("sai depois da folha de rosto, com página própria, e antes da dedicatória", async () => {
    const xml = await xmlDoDocumento(
      criarMetadados({
        naturezaTrabalho: "Trabalho de Conclusão de Curso.",
        bancaExaminadora: banca,
        dedicatoria: { ativo: true, texto: "À minha família." },
      }),
    );

    const rosto = xml.indexOf("Orientador: João Souza");
    const data = xml.indexOf("Data de aprovação:");
    const dedicatoria = xml.indexOf("À minha família.");
    expect(rosto).toBeGreaterThan(-1);
    expect(data).toBeGreaterThan(rosto);
    expect(dedicatoria).toBeGreaterThan(data);
    expect(xml.slice(rosto, data)).toMatch(/<w:br w:type="page"\s*\/>/);
  });

  it("recua a natureza a partir do meio da mancha, como na folha de rosto (§5.2)", async () => {
    const xml = await xmlDoDocumento(
      criarMetadados({ naturezaTrabalho: "Natureza do trabalho.", bancaExaminadora: banca }),
    );

    // A natureza aparece duas vezes: folha de rosto e folha de aprovação.
    const segunda = xml.indexOf("Natureza do trabalho.", xml.indexOf("Natureza do trabalho.") + 1);
    expect(segunda).toBeGreaterThan(-1);
    const paragrafo = xml.slice(xml.lastIndexOf("<w:p>", segunda), segunda);
    expect(paragrafo).toContain('w:left="4535"');
  });

  it("uma linha de assinatura por membro, cada uma com espaço acima", async () => {
    const xml = await xmlDoDocumento(criarMetadados({ bancaExaminadora: banca }));
    const assinaturas = xml.match(/>_{20,}<\/w:t>/g) ?? [];
    expect(assinaturas).toHaveLength(2);
    expect(xml.indexOf("Ana Lima")).toBeGreaterThan(
      xml.indexOf("João Souza", xml.indexOf("Data de aprovação:")),
    );
  });

  it("sem banca, não sai nada", async () => {
    const xml = await xmlDoDocumento(criarMetadados());
    expect(xml).not.toContain("Data de aprovação:");
  });
});
