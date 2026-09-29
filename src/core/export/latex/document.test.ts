import { describe, expect, it } from "vitest";

import { trechosDaCitacaoLonga, trechosDoInline } from "../../document/elements/trechos";
import type { NoCitacaoLonga, NoParagrafo } from "../../document/types";
import { documentoCompleto, FREIRE, IMAGENS } from "./__fixtures__/documento";
import { caminhoDaImagem, gerarTex } from "./document";

// Passo 6.2.1 — marcação do `.tex`. A compilação é `compila.test.ts`; aqui,
// que cada coisa sai com o comando certo e com o mesmo texto do `.docx`.

const tex = gerarTex(documentoCompleto(), IMAGENS);

describe("gerarTex — preâmbulo (docs/latex-abntex.md §4)", () => {
  it("classe abntex2 só no anverso, com caixa alta nos capítulos", () => {
    expect(tex).toContain(
      "\\documentclass[12pt,oneside,openany,a4paper,chapter=TITLE,english,brazil]{abntex2}",
    );
  });

  it("pdfLaTeX com UTF-8 e T1", () => {
    expect(tex).toContain("\\usepackage[utf8]{inputenc}");
    expect(tex).toContain("\\usepackage[T1]{fontenc}");
  });

  it("links sem cor, sem carregar o hyperref de novo (a classe já carrega)", () => {
    expect(tex).toContain("\\hypersetup{hidelinks}");
    expect(tex).not.toMatch(/\\usepackage(\[[^\]]*\])?\{hyperref\}/);
  });

  it("títulos em 12 pt e 18 pt entre título e texto, como o .docx (14724 §5.2.2)", () => {
    expect(tex).toContain("\\renewcommand{\\ABNTEXchapterfontsize}{\\normalsize}");
    expect(tex).toContain("\\setlength{\\beforechapskip}{0pt}");
    expect(tex).toContain("\\setlength{\\afterchapskip}{18pt}");
    expect(tex).toContain("\\setbeforesecskip{18pt}");
    expect(tex).toContain("\\setaftersubsecskip{18pt}");
  });

  it("recuo de 1,25 cm também no primeiro parágrafo, sem espaço entre parágrafos", () => {
    expect(tex).toContain("\\setlength{\\parindent}{1.25cm}");
    expect(tex).toContain("\\usepackage{indentfirst}");
    expect(tex).toContain("\\setlength{\\parskip}{0pt}");
  });

  it("filete da nota de 5 cm e cabeçalho só com o número da página", () => {
    expect(tex).toContain("\\hrule width 5cm");
    expect(tex).toContain("\\makeoddhead{abntheadings}{}{}{\\ABNTEXfontereduzida\\thepage}");
    expect(tex).toContain("\\makeheadrule{abntheadings}{0pt}{0pt}");
  });

  it("não usa abntex2cite nem biblatex: referências e chamadas são do AURA", () => {
    expect(tex).not.toContain("abntex2cite");
    expect(tex).not.toContain("biblatex");
    expect(tex).not.toContain("\\bibliography");
  });
});

describe("gerarTex — ordem das partes", () => {
  it("pré-textuais, \\textual, corpo, \\postextual, pós-textuais", () => {
    const posicoes = [
      "\\begin{capa}",
      "\\imprimirfolhaderosto",
      "\\begin{folhadeaprovacao}",
      "\\pretextualchapter{RESUMO}",
      "\\tableofcontents*",
      "\\textual",
      "\\chapter[",
      "\\postextual",
      "\\pretextualchapter{REFERÊNCIAS}",
      "\\pretextualchapter{APÊNDICE A — QUESTIONÁRIO}",
      "\\pretextualchapter{ANEXO A — LEI \\& DECRETO}",
    ].map((trecho) => tex.indexOf(trecho));
    for (const posicao of posicoes) expect(posicao).toBeGreaterThan(-1);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  it("página nova depois do sumário, antes do \\textual: o sumário não sai numerado", () => {
    expect(tex).toMatch(/\\tableofcontents\*\n\\cleardoublepage\n\n\\textual/);
  });
});

describe("gerarTex — citações com o mesmo texto do .docx", () => {
  const introducao = documentoCompleto().sections[0].content[0] as NoParagrafo;
  const chamadas = trechosDoInline(introducao.content, [FREIRE])
    .filter((trecho) => trecho.papel === "chamada")
    .map((trecho) => trecho.texto);

  it("citação direta curta: atributos, excerto com aspas e a chamada do AURA", () => {
    expect(chamadas[0]).toBe(" (Freire, 1987, p. 35)");
    expect(tex).toContain(
      `\\auracite[modo={direta_curta}, pagina={35}]{freire}{“ensinar exige risco”}{${chamadas[0]}}`,
    );
  });

  it("citação indireta: sem aspas e sem página", () => {
    expect(tex).toContain(
      `\\auracite[modo={indireta}]{freire}{A educação é prática da liberdade}{${chamadas[1]}}`,
    );
  });

  it("citação longa no ambiente próprio, com a chamada separada", () => {
    const longa = documentoCompleto().sections[1].content[0] as NoCitacaoLonga;
    const chamada = trechosDaCitacaoLonga(longa, [FREIRE]).at(-1)!.texto;
    expect(tex).toContain("\\begin{auracitacaolonga}[pagina={181}]{freire}");
    expect(tex).toContain(`\\aurachamada{${chamada}}\n\\end{auracitacaolonga}`);
  });

  it("nota de rodapé no lugar do expoente, com o texto escapado", () => {
    expect(tex).toContain("importa\\footnote{Nota com 50\\% de teste.}.");
  });
});

describe("gerarTex — texto do aluno escapado", () => {
  it("caracteres especiais no parágrafo", () => {
    expect(tex).toContain(
      "fonte 12 \\& espaço 1,5 (100\\% dos casos, custo R\\$ 0, item \\#1, x\\_1 \\{y\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}).",
    );
  });

  it("negrito e itálico do aluno", () => {
    expect(tex).toContain("\\textit{termo}");
    expect(tex).toContain("\\textbf{destaque}");
  });

  it("títulos de seção escapados, capítulo em caixa alta também no sumário", () => {
    expect(tex).toContain("\\section{Objetivos \\& métodos}");
    expect(tex).toContain(
      "\\chapter[\\texorpdfstring{\\protect\\MakeUppercase{Introdução}}{Introdução}]{Introdução}",
    );
  });
});

describe("gerarTex — fórmula, figura e tabela", () => {
  it("fórmula válida entra como LaTeX; inválida sai como texto e não quebra a compilação", () => {
    expect(tex).toContain("\\[\nx = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n\\]");
    expect(tex).toContain("\\texttt{\\textbackslash{}frac\\{1\\}\\{}");
  });

  it("figura com imagem: caminho em figuras/ e o mesmo tamanho do .docx", () => {
    expect(caminhoDaImagem("img1", "png")).toBe("figuras/img1.png");
    // 400 × 200 px a 96 dpi cabe na largura útil: 300 × 150 pt.
    expect(tex).toContain("\\includegraphics[width=300pt,height=150pt]{figuras/img1.png}");
    expect(tex).toContain("\\caption{Fluxo do processo}");
    expect(tex).toContain("\\aurafonte{Fonte: Elaborado pela autora}");
  });

  it("figura sem imagem: o mesmo aviso do .docx", () => {
    expect(tex).toContain("[ espaço reservado para a imagem ]");
  });

  it("tabela IBGE: três traços, cabeçalho em negrito repetido na página seguinte", () => {
    const inicio = tex.indexOf("\\begin{longtable}");
    const tabela = tex.slice(inicio, tex.indexOf("\\end{longtable}"));
    expect(tabela).toContain("\\caption{Resultados por grupo}");
    expect(tabela).toContain("\\toprule\n\\textbf{Grupo} & \\textbf{Total (\\%)} \\\\\n\\midrule\n\\endfirsthead");
    expect(tabela).toContain("\\endfirsthead\n\\toprule\n\\textbf{Grupo} & \\textbf{Total (\\%)} \\\\\n\\midrule\n\\endhead");
    expect(tabela).toContain("\\bottomrule\n\\endlastfoot");
    expect(tabela).not.toContain("|");
  });
});

describe("gerarTex — pré e pós-textuais", () => {
  it("natureza recuada do meio da mancha à direita, em espaço simples", () => {
    expect(tex).toContain(
      "\\noindent\\hfill\\begin{minipage}[t]{.5\\textwidth}\\auraespacosimples Trabalho de Conclusão",
    );
  });

  it("palavras-chave separadas por ponto e vírgula e finalizadas por ponto", () => {
    expect(tex).toContain("\\textbf{Palavras-chave:} formatação; normas técnicas; LaTeX.");
  });

  it("referência com o título em negrito, e no sumário", () => {
    expect(tex).toContain("FREIRE, Paulo. \\textbf{Pedagogia do oprimido}.");
    expect(tex).toContain("\\addcontentsline{toc}{chapter}{REFERÊNCIAS}");
  });

  it("título de apêndice sem a caixa alta da classe, como o .docx", () => {
    expect(tex).toMatch(/\\postextual\n\\setboolean\{ABNTEXupperchapter\}\{false\}/);
  });
});
