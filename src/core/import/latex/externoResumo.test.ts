import { describe, expect, it } from "vitest";

import { lerTex, type TexLido } from "./lerTex";

// Passo 8.3.1: resumo, abstract e palavras-chave fora do começo do `.tex` de
// fora (docs/to-do-correcoes.md §8.3). O caso de partida é o do template de
// Robótica, visto no PDF de 16/10/2026.

function ler(tex: string): TexLido {
  const resultado = lerTex(tex, { chavesDeReferencia: new Set<string>() });
  if (!resultado.ok) throw new Error(resultado.erro.mensagem);
  return resultado.tex;
}

const mensagens = (lido: TexLido) => lido.avisos.map((aviso) => aviso.mensagem);

const classePadrao = (...linhas: string[]) =>
  ["\\documentclass{article}", "\\begin{document}", ...linhas, "\\end{document}"].join("\n");

const emPortugues = (...linhas: string[]) =>
  [
    "\\documentclass[12pt]{article}",
    "\\usepackage[brazil]{babel}",
    "\\begin{document}",
    ...linhas,
    "\\end{document}",
  ].join("\n");

// O trecho do PDF: o abstract vem depois de `\section{Equipe}`, com o rótulo
// embrulhado em comandos que o AURA não conhece.
const ROBOTICA = emPortugues(
  "\\section{Equipe}",
  "Caio Porto Maia.",
  "\\begin{abstract}",
  "Este projeto propõe um sistema de monitoramento noturno.",
  "\\\\\\textbf{\\keyword{Palavras-chave:}} Inteligência Artificial; Visão Computacional; YOLO; Monitoramento; AWS; Detecção de Pessoas.",
  "\\end{abstract}",
  "\\section{Introdução}",
  "Texto.",
);

describe("resumo e palavras-chave fora do começo", () => {
  it("o abstract do corpo, em português, vai para Resumo e os seis termos para palavrasChave", () => {
    const lido = ler(ROBOTICA);
    expect(lido.metadados).toMatchObject({
      resumo: "Este projeto propõe um sistema de monitoramento noturno.",
      palavrasChave: [
        "Inteligência Artificial",
        "Visão Computacional",
        "YOLO",
        "Monitoramento",
        "AWS",
        "Detecção de Pessoas",
      ],
    });
    expect(lido.metadados).not.toHaveProperty("abstract");
    expect(lido.secoes.map((secao) => secao.titulo)).toEqual(["Equipe", "Introdução"]);
    const corpo = JSON.stringify(lido.secoes);
    expect(corpo).not.toContain("begin");
    expect(corpo).not.toContain("Palavras-chave");
    expect(mensagens(lido)).toContain(
      "\\begin{abstract} no meio do texto: foi para os campos Resumo e Palavras-chave.",
    );
  });

  it("o aviso aponta a linha do ambiente", () => {
    const aviso = ler(ROBOTICA).avisos.find((a) => a.mensagem.startsWith("\\begin{abstract}"))!;
    const linha = ROBOTICA.split("\n").findIndex((l) => l.includes("begin{abstract}")) + 1;
    expect(aviso.linha).toBe(linha);
  });

  it("sem idioma declarado, o abstract é o Abstract", () => {
    const lido = ler(
      classePadrao(
        "\\section{Um}",
        "\\begin{abstract}",
        "Short text.",
        "",
        "Keywords: robots; vision.",
        "\\end{abstract}",
      ),
    );
    expect(lido.metadados).toMatchObject({ abstract: "Short text.", keywords: ["robots", "vision"] });
    expect(lido.metadados).not.toHaveProperty("resumo");
  });

  it("o rótulo em inglês leva ao Abstract mesmo com o babel em português", () => {
    const lido = ler(
      emPortugues("\\begin{abstract}", "Short text. Keywords: robots; vision.", "\\end{abstract}"),
    );
    expect(lido.metadados).toMatchObject({ abstract: "Short text.", keywords: ["robots", "vision"] });
  });

  it("com um resumo no arquivo, o abstract é o em inglês", () => {
    const lido = ler(
      emPortugues(
        "\\section{Um}",
        "\\begin{resumo}Texto em português.\\end{resumo}",
        "\\begin{abstract}Text in English.\\end{abstract}",
      ),
    );
    expect(lido.metadados).toMatchObject({
      resumo: "Texto em português.",
      abstract: "Text in English.",
    });
  });

  it("acha o rótulo no meio do parágrafo, depois de \\par, \\newline ou \\\\, mesmo sem dois-pontos", () => {
    for (const quebra of ["\\par", "\\newline", "\\\\"]) {
      const lido = ler(
        emPortugues(
          "\\begin{abstract}",
          `Texto do resumo. ${quebra} Palavras-chave A; B; C.`,
          "\\end{abstract}",
        ),
      );
      expect(lido.metadados).toMatchObject({
        resumo: "Texto do resumo.",
        palavrasChave: ["A", "B", "C"],
      });
    }
  });

  it("não confunde uma menção às palavras-chave, no meio da frase, com o rótulo", () => {
    const lido = ler(
      emPortugues(
        "\\begin{abstract}",
        "As palavras-chave do trabalho aparecem no texto.",
        "\\end{abstract}",
      ),
    );
    expect(lido.metadados).toMatchObject({
      resumo: "As palavras-chave do trabalho aparecem no texto.",
    });
    expect(lido.metadados).not.toHaveProperty("palavrasChave");
  });

  it("palavras-chave em ambiente ou comando à parte vão para o campo, sem tocar o resumo", () => {
    const comAmbiente = ler(
      emPortugues("\\section{Um}", "\\begin{keywords}", "robôs \\and visão", "\\end{keywords}"),
    );
    expect(comAmbiente.metadados).toEqual({ palavrasChave: ["robôs", "visão"] });

    const comComando = ler(emPortugues("\\section{Um}", "\\keywords{robôs; visão}", "Texto."));
    expect(comComando.metadados).toEqual({ palavrasChave: ["robôs", "visão"] });
    expect(comComando.secoes[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Texto." }] },
    ]);
    expect(mensagens(comComando)).toContain(
      "\\keywords no meio do texto: foi para o campo Palavras-chave.",
    );
  });

  it("IEEEkeywords é o Keywords", () => {
    const lido = ler(
      classePadrao(
        "\\section{Um}",
        "\\begin{IEEEkeywords}",
        "robots, vision",
        "\\end{IEEEkeywords}",
      ),
    );
    expect(lido.metadados).toEqual({ keywords: ["robots", "vision"] });
  });

  it("ambiente vazio avisa e não apaga o campo que já veio antes do texto", () => {
    const lido = ler(
      emPortugues(
        "\\begin{abstract}Resumo de verdade.\\end{abstract}",
        "\\section{Um}",
        "\\begin{keywords}\\end{keywords}",
      ),
    );
    expect(lido.metadados).toMatchObject({ resumo: "Resumo de verdade." });
    expect(mensagens(lido)).toContain(
      "\\begin{keywords} no meio do texto estava vazio: não foi trazido.",
    );
  });
});
