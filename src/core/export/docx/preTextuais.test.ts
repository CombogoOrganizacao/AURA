import { Document, Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import type { Metadados } from "../../document/types";
import { montarPreTextuais, paragrafosAbstract, paragrafosResumo } from "./preTextuais";

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
async function documentXmlDe(paragrafos: readonly ReturnType<typeof paragrafosResumo>[number][]) {
  const documento = new Document({ sections: [{ properties: {}, children: [...paragrafos] }] });
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
      })
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
      criarMetadados({ resumo: "Este trabalho investiga X.", palavrasChave: [] })
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
      })
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

describe("montarPreTextuais", () => {
  const comOsDois = criarMetadados({
    resumo: "Este trabalho investiga X.",
    abstract: "This work investigates X.",
  });

  // `docx` serializa sem espaço antes do `/>`, mas o regex tolera os dois —
  // é detalhe de formatação da lib, não algo que este teste queira fixar.
  const QUEBRA_DE_PAGINA = /<w:br w:type="page"\s*\/>/g;

  it("separa resumo e abstract com quebra de página, sem quebra antes do primeiro", async () => {
    const xml = await documentXmlDe(montarPreTextuais(comOsDois));

    // Uma quebra só: entre os dois blocos. Uma antes do "RESUMO" deixaria
    // uma página em branco abrindo a seção.
    expect(xml.match(QUEBRA_DE_PAGINA) ?? []).toHaveLength(1);

    const posQuebra = xml.search(/<w:br w:type="page"\s*\/>/);
    expect(xml.indexOf("RESUMO")).toBeLessThan(posQuebra);
    expect(posQuebra).toBeLessThan(xml.indexOf("ABSTRACT"));
  });

  it("não abre com quebra de página quando só o abstract está preenchido", async () => {
    const xml = await documentXmlDe(
      montarPreTextuais(criarMetadados({ abstract: "This work investigates X." }))
    );

    expect(xml).toContain("ABSTRACT");
    expect(xml.match(QUEBRA_DE_PAGINA)).toBeNull();
  });

  it("devolve lista vazia quando não há resumo nem abstract", () => {
    expect(montarPreTextuais(criarMetadados())).toEqual([]);
  });
});
