import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Abreviatura, Documento, NoConteudo } from "../../document/types";
import { fromDocumento } from "./fromDocumento";

function documentoCom(content: NoConteudo[], abreviaturas: Abreviatura[] = []): Documento {
  const documento = novoDocumento();
  documento.metadados.abreviaturas = abreviaturas;
  documento.sections = [{ id: "s1", ordem: 0, nivel: 1, titulo: "Resultados", content }];
  return documento;
}

async function xmlDe(documento: Documento): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return zip.file("word/document.xml")!.async("string");
}

function figura(id: string, legenda = ""): NoConteudo {
  return { type: "figura", id, legenda, fonte: "", imagem: null };
}

function paragrafo(texto: string): NoConteudo {
  return { type: "paragraph", content: [{ type: "text", text: texto }] };
}

describe("listas de figuras, tabelas e abreviaturas no .docx (passo 3.6.4)", () => {
  // Campo `TOC \c "Figura"`, não entradas escritas pelo exportador — o Word
  // recolhe os campos `SEQ Figura` das legendas (3.6.3) e preenche a página.
  // Mesmo raciocínio do sumário em 3.6.2.
  it("a lista de figuras é um campo TOC de legendas, ligado ao rótulo Figura", async () => {
    const xml = await xmlDe(documentoCom([figura("f1", "Fluxo do processo")]));

    expect(xml).toContain("LISTA DE FIGURAS");
    expect(xml).toMatch(/<w:instrText[^>]*>TOC[^<]*\\c &quot;Figura&quot;/);
  });

  it("a lista de tabelas usa o rótulo Tabela, numa sequência própria", async () => {
    const xml = await xmlDe(
      documentoCom([{ type: "tabela", id: "t1", legenda: "Faixas", fonte: "", linhas: [] }]),
    );

    expect(xml).toContain("LISTA DE TABELAS");
    expect(xml).toMatch(/<w:instrText[^>]*>TOC[^<]*\\c &quot;Tabela&quot;/);
    expect(xml).not.toContain("LISTA DE FIGURAS");
  });

  // O elemento inteiro some quando não há do que fazer lista: uma "LISTA DE
  // FIGURAS" num trabalho sem figura é elemento fabricado.
  it("omite cada lista quando não há item do tipo", async () => {
    const xml = await xmlDe(documentoCom([paragrafo("Só texto.")]));

    expect(xml).not.toContain("LISTA DE FIGURAS");
    expect(xml).not.toContain("LISTA DE TABELAS");
    expect(xml).not.toContain("LISTA DE ABREVIATURAS");
  });

  it("a lista de abreviaturas sai em parágrafos, em ordem alfabética", async () => {
    const xml = await xmlDe(
      documentoCom(
        [paragrafo("Segundo o IBGE e a ABNT, os dados...")],
        [
          {
            id: "1",
            sigla: "IBGE",
            significado: "Instituto Brasileiro de Geografia e Estatística",
          },
          { id: "2", sigla: "ABNT", significado: "Associação Brasileira de Normas Técnicas" },
        ],
      ),
    );

    expect(xml).toContain("LISTA DE ABREVIATURAS E SIGLAS");
    expect(xml.indexOf("Associação Brasileira")).toBeLessThan(xml.indexOf("Instituto Brasileiro"));
  });

  // Não é campo do Word: não há nada no documento para ele recolher.
  it("a lista de abreviaturas não é campo — o significado sai escrito", async () => {
    const xml = await xmlDe(
      documentoCom(
        [paragrafo("A ABNT define.")],
        [{ id: "1", sigla: "ABNT", significado: "Associação Brasileira de Normas Técnicas" }],
      ),
    );

    expect(xml).toContain("Associação Brasileira de Normas Técnicas");
    expect(xml).not.toMatch(/SEQ Abreviatura/);
  });

  it("sigla cadastrada que não aparece no texto não entra na lista", async () => {
    const xml = await xmlDe(
      documentoCom(
        [paragrafo("Nenhuma sigla aqui.")],
        [{ id: "1", sigla: "ABNT", significado: "Associação Brasileira de Normas Técnicas" }],
      ),
    );

    expect(xml).not.toContain("LISTA DE ABREVIATURAS");
  });

  // Ordem canônica (docs/to-do.md 3.7.2): resumo, abstract, listas, sumário.
  it("as listas ficam entre o abstract e o sumário", async () => {
    const documento = documentoCom(
      [figura("f1", "Fluxo"), paragrafo("A ABNT define.")],
      [{ id: "1", sigla: "ABNT", significado: "Associação Brasileira de Normas Técnicas" }],
    );
    documento.metadados.resumo = "Este trabalho investiga X.";
    documento.metadados.abstract = "This work investigates X.";

    const xml = await xmlDe(documento);
    const posicoes = [
      "ABSTRACT",
      "LISTA DE FIGURAS",
      "LISTA DE ABREVIATURAS E SIGLAS",
      "SUMÁRIO",
    ].map((trecho) => xml.indexOf(trecho));

    for (const posicao of posicoes) expect(posicao).toBeGreaterThan(-1);
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });

  it("cada lista abre em página própria, sem quebra sobrando antes da primeira", async () => {
    const documento = documentoCom(
      [figura("f1", "Fluxo"), { type: "tabela", id: "t1", legenda: "F", fonte: "", linhas: [] }],
      [],
    );

    const xml = await xmlDe(documento);

    // Duas quebras: entre a lista de figuras e a de tabelas, e antes do
    // sumário (esta última é de `sections.ts`, desde 3.5.2).
    expect(xml.match(/<w:br w:type="page"\s*\/>/g) ?? []).toHaveLength(2);

    // Nenhuma ANTES da primeira lista: a seção OOXML já começa em página
    // nova, e uma quebra à frente dela deixaria uma folha em branco abrindo
    // os pré-textuais.
    expect(xml.search(/<w:br w:type="page"\s*\/>/)).toBeGreaterThan(
      xml.indexOf("LISTA DE FIGURAS"),
    );
  });
});
