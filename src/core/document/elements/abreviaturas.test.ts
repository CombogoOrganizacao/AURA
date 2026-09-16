import { describe, expect, it } from "vitest";

import { novoDocumento } from "../factory";
import type { Abreviatura, Metadados, NoConteudo, Secao } from "../types";
import { gerarListaDeAbreviaturas, siglaAparece } from "./abreviaturas";

function metadadosCom(abreviaturas: Abreviatura[]): Metadados {
  return { ...novoDocumento().metadados, abreviaturas };
}

function abreviatura(sigla: string, significado = `Significado de ${sigla}`): Abreviatura {
  return { id: sigla.toLowerCase(), sigla, significado };
}

function secaoCom(...textos: string[]): Secao {
  const content: NoConteudo[] = textos.map((texto) => ({
    type: "paragraph",
    content: [{ type: "text", text: texto }],
  }));
  return { id: "s1", ordem: 0, nivel: 1, titulo: "", content };
}

describe("gerarListaDeAbreviaturas (passo 3.6.4)", () => {
  it("sai em ordem alfabética, não na ordem de cadastro", () => {
    const sections = [secaoCom("Usamos CAPES, ABNT e IBGE neste trabalho.")];
    const metadados = metadadosCom([
      abreviatura("IBGE"),
      abreviatura("ABNT"),
      abreviatura("CAPES"),
    ]);

    expect(gerarListaDeAbreviaturas(metadados, sections).map((a) => a.sigla)).toEqual([
      "ABNT",
      "CAPES",
      "IBGE",
    ]);
  });

  // Colação pt-BR: "Á" fica junto de "A", não no fim da tabela ASCII.
  it("ordena com colação pt-BR, não por código de caractere", () => {
    const sections = [secaoCom("ÁGU, ABC e AZU aparecem aqui.")];
    const metadados = metadadosCom([abreviatura("AZU"), abreviatura("ÁGU"), abreviatura("ABC")]);

    expect(gerarListaDeAbreviaturas(metadados, sections).map((a) => a.sigla)).toEqual([
      "ABC",
      "ÁGU",
      "AZU",
    ]);
  });

  // É o que faz a lista "acompanhar inserção e remoção" também aqui: a norma
  // pede a relação das abreviaturas UTILIZADAS no texto.
  it("só entra a sigla que aparece no texto", () => {
    const sections = [secaoCom("Só a ABNT é citada neste parágrafo.")];
    const metadados = metadadosCom([abreviatura("ABNT"), abreviatura("IBGE")]);

    expect(gerarListaDeAbreviaturas(metadados, sections).map((a) => a.sigla)).toEqual(["ABNT"]);
  });

  it("remover a menção do texto tira a sigla da lista, sem mexer no cadastro", () => {
    const metadados = metadadosCom([abreviatura("ABNT")]);

    expect(gerarListaDeAbreviaturas(metadados, [secaoCom("Conforme a ABNT.")])).toHaveLength(1);
    expect(gerarListaDeAbreviaturas(metadados, [secaoCom("Conforme a norma.")])).toHaveLength(0);
    // O cadastro continua intacto — desaparecer da lista não apaga o que a
    // pessoa escreveu (mesmo princípio de `ElementoOpcional.ativo`).
    expect(metadados.abreviaturas).toHaveLength(1);
  });

  it("cadastro pela metade não entra: sem sigla ou sem significado", () => {
    const sections = [secaoCom("ABNT e IBGE.")];
    const metadados = metadadosCom([
      { id: "1", sigla: "ABNT", significado: "   " },
      { id: "2", sigla: "  ", significado: "Instituto qualquer" },
      abreviatura("IBGE"),
    ]);

    expect(gerarListaDeAbreviaturas(metadados, sections).map((a) => a.sigla)).toEqual(["IBGE"]);
  });

  it("documento sem abreviaturas cadastradas devolve lista vazia", () => {
    expect(gerarListaDeAbreviaturas(novoDocumento().metadados, [secaoCom("Texto.")])).toEqual([]);
  });
});

describe("siglaAparece — busca determinística, sem IA", () => {
  it("casa a sigla como palavra inteira", () => {
    expect(siglaAparece("ABNT", [secaoCom("Conforme a ABNT, o trabalho...")])).toBe(true);
  });

  // `\b` do JS trata letra acentuada como fronteira; por isso as fronteiras
  // usam `\p{L}`/`\p{N}` com a flag `u`.
  it("não casa dentro de outra palavra, nem com acento na fronteira", () => {
    expect(siglaAparece("CAPES", [secaoCom("A palavra CAPESÇ não é a sigla.")])).toBe(false);
    expect(siglaAparece("USP", [secaoCom("Ele é USPiano.")])).toBe(false);
  });

  it("casa encostada em pontuação, parêntese e fim de frase", () => {
    expect(siglaAparece("ABNT", [secaoCom("Segundo a (ABNT), sim.")])).toBe(true);
    expect(siglaAparece("ABNT", [secaoCom("Publicado pela ABNT.")])).toBe(true);
  });

  // Uma sigla é definida pela grafia em caixa alta: ignorar caixa faria "ELE"
  // casar com o pronome "ele" em qualquer parágrafo.
  it("é sensível a maiúsculas e minúsculas", () => {
    expect(siglaAparece("ELE", [secaoCom("Ele foi ao mercado.")])).toBe(false);
  });

  it("acha a sigla no título da seção, na legenda e dentro de uma célula", () => {
    const noTitulo: Secao = { id: "s", ordem: 0, nivel: 1, titulo: "Dados do IBGE", content: [] };
    expect(siglaAparece("IBGE", [noTitulo])).toBe(true);

    const naLegenda: Secao = {
      id: "s",
      ordem: 0,
      nivel: 1,
      titulo: "",
      content: [{ type: "figura", id: "f", legenda: "Mapa do IBGE", fonte: "", imagem: null }],
    };
    expect(siglaAparece("IBGE", [naLegenda])).toBe(true);

    const naCelula: Secao = {
      id: "s",
      ordem: 0,
      nivel: 1,
      titulo: "",
      content: [
        {
          type: "tabela",
          id: "t",
          legenda: "",
          fonte: "",
          linhas: [{ celulas: [{ cabecalho: true, content: [{ type: "text", text: "IBGE" }] }] }],
        },
      ],
    };
    expect(siglaAparece("IBGE", [naCelula])).toBe(true);
  });

  it("sigla com ponto é procurada como literal, não como metacaractere", () => {
    expect(siglaAparece("p.ex.", [secaoCom("Ver p.ex. o anexo.")])).toBe(true);
    expect(siglaAparece("p.ex.", [secaoCom("Ver pXexY o anexo.")])).toBe(false);
  });

  it("sigla em branco nunca aparece", () => {
    expect(siglaAparece("   ", [secaoCom("Qualquer texto.")])).toBe(false);
  });
});
