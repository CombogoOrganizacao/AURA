import { describe, expect, it } from "vitest";

import { documentoCompleto, IMAGENS } from "./__fixtures__/documento";
import { gerarTex } from "./document";
import { blocoDeMetadados, MACRO, VERSAO_FORMATO_TEX } from "./markers";

// Passo 6.2.2 — marcadores que a reimportação (6.2.4) lê. Regras em
// docs/latex-abntex.md §1.5.

const documento = documentoCompleto();
documento.metadados.autores = ["Fulana de Tal", "Beltrana Souza"];
documento.metadados.agradecimentos = { ativo: true, texto: "Agradeço à banca.\nE à família." };
const tex = gerarTex(documento, IMAGENS);
const linhas = tex.split("\n");

function blocoDoArquivo(): string {
  const inicio = tex.indexOf("% AURA-METADADOS: início");
  const fim = tex.indexOf("% AURA-METADADOS: fim");
  expect(inicio).toBeGreaterThan(-1);
  expect(fim).toBeGreaterThan(inicio);
  return tex.slice(inicio, fim);
}

describe("marcadores — identidade do arquivo", () => {
  it("a primeira linha é AURA-DOCUMENTO, com o id do documento e a versão do formato", () => {
    expect(linhas[0]).toBe(`% AURA-DOCUMENTO: ${documento.id} v${VERSAO_FORMATO_TEX}`);
  });
});

describe("marcadores — seções, apêndices e anexos", () => {
  it("um AURA-SECTION por seção, com o id real, logo antes do comando de título", () => {
    const marcadores = linhas.filter((linha) => linha.startsWith("% AURA-SECTION: "));
    expect(marcadores).toEqual(documento.sections.map((secao) => `% AURA-SECTION: ${secao.id}`));
    for (const secao of documento.sections) {
      const posicao = linhas.indexOf(`% AURA-SECTION: ${secao.id}`);
      expect(linhas[posicao + 1]).toMatch(/^\\(chapter|section|subsection)[[{]/);
    }
  });

  it("um marcador por apêndice e por anexo, com o id real, logo antes do título", () => {
    const apendice = linhas.indexOf("% AURA-APENDICE: ap1");
    const anexo = linhas.indexOf("% AURA-ANEXO: an1");
    expect(apendice).toBeGreaterThan(-1);
    expect(anexo).toBeGreaterThan(apendice);
    expect(linhas[apendice + 1]).toMatch(/^\\pretextualchapter\{/);
    expect(linhas[anexo + 1]).toMatch(/^\\pretextualchapter\{/);
  });

  it("id duplicado no documento sai duplicado: quem resolve é a reimportação (§1.5)", () => {
    const copia = documentoCompleto();
    copia.sections.push({ ...copia.sections[0], ordem: 99 });
    const marcadores = gerarTex(copia).split("\n").filter((linha) => linha === `% AURA-SECTION: ${copia.sections[0].id}`);
    expect(marcadores).toHaveLength(2);
  });
});

describe("marcadores — bloco de metadados", () => {
  it("fica no preâmbulo, antes do \\begin{document}", () => {
    expect(tex.indexOf("% AURA-METADADOS: fim")).toBeLessThan(tex.indexOf("\\begin{document}"));
  });

  it("define um comando por campo, e só uma vez", () => {
    const bloco = blocoDoArquivo();
    for (const macro of Object.values(MACRO)) {
      expect(bloco.split(`\\newcommand{${macro}}`)).toHaveLength(2);
    }
  });

  it("os valores saem escapados, com os autores e os parágrafos separados", () => {
    const bloco = blocoDoArquivo();
    expect(bloco).toContain("\\newcommand{\\aurasubtitulo}{um estudo \\& 100\\% de teste}");
    expect(bloco).toContain("\\newcommand{\\auraautores}{Fulana de Tal \\\\ Beltrana Souza}");
    expect(bloco).toContain("\\newcommand{\\auraano}{2026}");
    expect(bloco).toContain("\\newcommand{\\auraagradecimentos}{Agradeço à banca.\\par\nE à família.}");
    expect(bloco).toContain("\\newcommand{\\aurakeywords}{formatting; technical standards}");
  });

  it("elemento opcional desligado sai com o comando vazio", () => {
    const semDedicatoria = documentoCompleto();
    semDedicatoria.metadados.dedicatoria = { ativo: false, texto: "A quem ensina." };
    expect(blocoDeMetadados(semDedicatoria.metadados)).toContain("\\newcommand{\\auradedicatoria}{}");
  });
});

describe("marcadores — o corpo usa os comandos do bloco", () => {
  const corpo = tex.slice(tex.indexOf("\\begin{document}"));

  it("capa e folha de rosto: título, subtítulo, autores, orientador, local e ano", () => {
    expect(corpo).toContain("\\MakeUppercase{\\auratitulo: \\aurasubtitulo}");
    expect(corpo).toContain("\\MakeUppercase{\\auraautores}");
    expect(corpo).toContain("Orientador: \\auraorientador");
    expect(corpo).toContain("\\textbf{\\aurainstituicao}");
    expect(corpo).toContain("{\\centering \\auralocal\\par}");
    expect(corpo).toContain("{\\centering \\auraano\\par}");
  });

  it("uma linha de autores só, mesmo com dois autores", () => {
    const capa = corpo.slice(corpo.indexOf("\\begin{capa}"), corpo.indexOf("\\end{capa}"));
    expect(capa.split("\\auraautores")).toHaveLength(2);
    expect(capa).not.toContain("Beltrana");
  });

  it("resumo, abstract, dedicatória, agradecimentos e epígrafe", () => {
    for (const macro of [
      MACRO.resumo,
      MACRO.abstract,
      MACRO.keywords,
      MACRO.dedicatoria,
      MACRO.agradecimentos,
      MACRO.epigrafe,
    ]) {
      expect(corpo).toContain(macro);
    }
    expect(corpo).not.toContain("Resumo do trabalho");
    expect(corpo).not.toContain("Agradeço à banca");
  });
});
