import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { lerTex, type TexLido } from "./lerTex";

// `.tex` de fora do AURA (passo 6.2.5, docs/latex-abntex.md §1.6): o TCC que
// o aluno começou em LaTeX, sem marcador nenhum.

const TCC = readFileSync(new URL("./__fixtures__/tcc-abntex2.tex", import.meta.url), "utf8");

function ler(tex: string, chaves: string[] = ["freire"]): TexLido {
  const resultado = lerTex(tex, { chavesDeReferencia: new Set(chaves) });
  if (!resultado.ok) throw new Error(resultado.erro.mensagem);
  return resultado.tex;
}

const citacao = (modo: "indireta" | "direta_curta", pagina: string | null) => ({
  type: "citacao",
  attrs: { refId: "freire", modo, pagina, apud: null },
});

describe("TCC no modelo do abnTeX2", () => {
  const lido = ler(TCC);

  it("é de fora: sem id e sem versão", () => {
    expect(lido).toMatchObject({ origem: "externo", documentoId: null, versaoFormato: null });
  });

  it("traz os dados da capa, com acento à moda antiga e vários autores", () => {
    expect(lido.metadados).toMatchObject({
      titulo: "Educação e diálogo na escola pública",
      autores: ["Maria da Silva", "João Souza"],
      local: "Vitória",
      ano: 2025,
      orientador: "Profa. Dra. Ana Lima",
      instituicao: "Universidade Federal do Espírito Santo, Centro de Educação, Curso de Pedagogia",
      naturezaTrabalho:
        "Trabalho de Conclusão de Curso apresentado ao Curso de Pedagogia como requisito parcial.",
    });
  });

  it("traz resumo, abstract, palavras-chave, dedicatória, agradecimentos e epígrafe", () => {
    expect(lido.metadados).toMatchObject({
      resumo: "Este trabalho discute o diálogo na escola.",
      palavrasChave: ["educação", "diálogo", "escola"],
      abstract: "This work discusses dialogue at school.",
      keywords: ["education", "dialogue"],
      dedicatoria: "Aos meus pais.",
      agradecimentos: "Agradeço à orientadora.\nE à banca.",
      epigrafe: "“Ensinar exige risco.” (Paulo Freire)",
    });
  });

  it("monta as seções pelo nível: capítulo 1, seção 2, subseção 3", () => {
    expect(lido.secoes.map((secao) => [secao.id, secao.nivel, secao.titulo])).toEqual([
      [null, 1, "Introdução"],
      [null, 2, "Metodologia"],
      [null, 3, "Análise"],
      [null, 1, "Conclusão"],
    ]);
  });

  it("liga as citações à referência: indireta pela frase, direta pelas aspas", () => {
    expect(lido.secoes[0].content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "A escola é espaço de diálogo", marks: [citacao("indireta", null)] },
        { type: "text", text: ". Segundo Freire, " },
        { type: "text", text: "ensinar exige risco", marks: [citacao("direta_curta", "35")] },
        { type: "text", text: "." },
      ],
    });
  });

  it("lista vira um parágrafo por item, com a nota no lugar", () => {
    expect(lido.secoes[0].content.slice(1)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Os objetivos são:" }] },
      { type: "paragraph", content: [{ type: "text", text: "• compreender o diálogo;" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "• analisar a prática" },
          { type: "nota_rodape", texto: "Nota de rodapé." },
          { type: "text", text: "." },
        ],
      },
    ]);
  });

  it("tabela com cabeçalho, legenda e fonte; figura com o caminho da imagem", () => {
    const [, tabela, figura] = lido.secoes[1].content;
    expect(tabela).toEqual({
      type: "tabela",
      legenda: "Participantes por grupo",
      fonte: "Dados da pesquisa.",
      linhas: [
        {
          celulas: [
            { cabecalho: true, content: [{ type: "text", text: "Grupo" }] },
            { cabecalho: true, content: [{ type: "text", text: "Total" }] },
          ],
        },
        {
          celulas: [
            { cabecalho: false, content: [{ type: "text", text: "A" }] },
            { cabecalho: false, content: [{ type: "text", text: "12" }] },
          ],
        },
        {
          celulas: [
            { cabecalho: false, content: [{ type: "text", text: "B" }] },
            { cabecalho: false, content: [{ type: "text", text: "18" }] },
          ],
        },
      ],
    });
    expect(figura).toEqual({
      type: "figura",
      legenda: "Fluxo da pesquisa",
      fonte: "Elaborado pela autora.",
      imagem: null,
      caminho: "imagens/fluxo",
    });
  });

  it("citação longa com a referência do \\cite do fim, e fórmula sem o rótulo", () => {
    const [, , , longa, formula] = lido.secoes[1].content;
    expect(longa).toEqual({
      type: "citacao_longa",
      refId: "freire",
      pagina: "181",
      content: [
        {
          type: "text",
          text: "Citação longa de teste com mais de três linhas que a norma manda recuar",
        },
      ],
    });
    expect(formula).toEqual({ type: "formula", texto: "E = mc^2" });
  });

  it("acentos à moda antiga e formatação sem equivalente ficam como texto", () => {
    expect(lido.secoes[2].content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Texto com versalete e acentos á ção." }],
      },
    ]);
  });

  it("apêndices e anexos pelos ambientes do abnTeX2; referências derivadas somem", () => {
    expect(lido.apendices.map(({ titulo, content }) => [titulo, content])).toEqual([
      [
        "Questionário",
        [{ type: "paragraph", content: [{ type: "text", text: "Perguntas aplicadas." }] }],
      ],
    ]);
    expect(lido.anexos.map(({ titulo }) => titulo)).toEqual(["Lei de Diretrizes"]);
  });

  it("avisa o que não tem equivalente, com a linha", () => {
    const mensagens = lido.avisos.map((aviso) => aviso.mensagem);
    expect(mensagens).toEqual(
      expect.arrayContaining([
        "Coorientador(a) ainda não tem campo no AURA: não foi trazido.",
        expect.stringMatching(/não foram trazidos: siglas\. Cadastre as siglas/),
        "Lista (itemize) virou um parágrafo por item: o AURA ainda não tem lista.",
        expect.stringMatching(/^Uma referência cruzada \(\\ref\) virou o número fixo/),
        "\\textsc não tem equivalente no AURA: ficou o texto, sem essa formatação.",
        expect.stringMatching(/^\\cite\{freire\} virou citação direta, página 35/),
      ]),
    );
    const ref = lido.avisos.find((aviso) => aviso.mensagem.startsWith("Uma referência cruzada"))!;
    expect(ref.linha).toBe(
      TCC.split("\n").findIndex((linha) => linha.includes("Tabela~\\ref")) + 1,
    );
  });
});

describe("outros formatos de fora", () => {
  it("classe article: \\section é nível 1, e \\title/\\author/\\date dão os dados", () => {
    const lido = ler(
      [
        "\\documentclass{article}",
        "\\title{Um artigo}",
        "\\author{Ana \\and Bia}",
        "\\date{Março de 2024}",
        "\\begin{document}",
        "\\maketitle",
        "\\begin{abstract}",
        "Resumo curto.",
        "\\end{abstract}",
        "\\section{Um}",
        "Texto \\textbf{forte} e {\\itshape inclinado}.",
        "\\subsection{Um ponto um}",
        "Mais.",
        "\\appendix",
        "\\section{Extra}",
        "Anexado.",
        "\\end{document}",
      ].join("\n"),
    );
    expect(lido.metadados).toMatchObject({
      titulo: "Um artigo",
      autores: ["Ana", "Bia"],
      ano: 2024,
      abstract: "Resumo curto.",
    });
    expect(lido.secoes.map((secao) => [secao.nivel, secao.titulo])).toEqual([
      [1, "Um"],
      [2, "Um ponto um"],
    ]);
    expect(lido.secoes[0].content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Texto " },
          { type: "text", text: "forte", marks: [{ type: "negrito" }] },
          { type: "text", text: " e " },
          { type: "text", text: "inclinado", marks: [{ type: "italico" }] },
          { type: "text", text: "." },
        ],
      },
    ]);
    expect(lido.apendices.map((apendice) => apendice.titulo)).toEqual(["Extra"]);
  });

  it("lista numerada e aninhada, e descrição com rótulo em negrito", () => {
    const lido = ler(
      [
        "\\documentclass{article}",
        "\\begin{document}",
        "\\section{Listas}",
        "\\begin{enumerate}",
        "\\item Primeiro",
        "\\begin{itemize}\\item dentro\\end{itemize}",
        "\\item Segundo",
        "\\end{enumerate}",
        "\\begin{description}\\item[Termo] definição\\end{description}",
        "\\end{document}",
      ].join("\n"),
    );
    expect(lido.secoes[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "1. Primeiro" }] },
      { type: "paragraph", content: [{ type: "text", text: "– dentro" }] },
      { type: "paragraph", content: [{ type: "text", text: "2. Segundo" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Termo: ", marks: [{ type: "negrito" }] },
          { type: "text", text: "definição" },
        ],
      },
    ]);
  });

  it("\\cite de várias obras liga a primeira conhecida e avisa das outras", () => {
    const lido = ler(
      "\\documentclass{article}\n\\begin{document}\n\\section{A}\nTexto \\citeonline{silva,freire}.\n\\end{document}",
    );
    expect(lido.secoes[0].content[0]).toMatchObject({
      content: [{ text: "Texto", marks: [citacao("indireta", null)] }, { text: "." }],
    });
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toContain(
      "Citação de várias obras (silva, freire): só freire ficou ligada. Cite as outras à parte no AURA.",
    );
  });

  it("\\input de fora de sections/ é seguido no .zip, e o que sai da pasta, não", () => {
    const arquivos = new Map([
      ["capitulos/intro.tex", "\\chapter{Introdução}\nTexto.\n\\input{capitulos/sub}"],
      ["capitulos/sub.tex", "\\section{Sub}\nMais."],
    ]);
    const resultado = lerTex(
      "\\documentclass{abntex2}\n\\begin{document}\n\\textual\n\\include{capitulos/intro}\n\\input{../fora}\n\\end{document}",
      { lerArquivo: (caminho) => arquivos.get(caminho) ?? null },
    );
    if (!resultado.ok) throw new Error(resultado.erro.mensagem);
    expect(resultado.tex.secoes.map((secao) => secao.titulo)).toEqual(["Introdução", "Sub"]);
    expect(resultado.tex.secoes[1].arquivo).toBe("capitulos/sub.tex");
    expect(resultado.tex.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "\\input{../fora} não é seguido: o caminho sai da pasta do projeto.",
    ]);
  });

  it("\\input que inclui a si mesmo não entra em laço", () => {
    const resultado = lerTex(
      "\\documentclass{article}\n\\begin{document}\n\\input{a}\n\\end{document}",
      { lerArquivo: () => "\\section{A}\n\\input{a}" },
    );
    if (!resultado.ok) throw new Error(resultado.erro.mensagem);
    expect(resultado.tex.secoes.map((secao) => secao.titulo)).toEqual(["A"]);
    expect(resultado.tex.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "\\input{a} não é seguido: o arquivo inclui a si mesmo.",
    ]);
  });
});

describe("fonte solta em figura e tabela (6.2.8)", () => {
  // O TCC real que motivou isto escrevia a fonte num grupo, sem `\legend`:
  // ela entrava como texto cru, `{ \textbf{Fonte:} Pessoa (2018).}`.
  const corpo = (dentro: string) =>
    [
      "\\documentclass{article}",
      "\\begin{document}",
      "\\section{S}",
      dentro,
      "\\end{document}",
    ].join("\n");

  it("grupo com \\textbf{Fonte:} dentro da figura vira a fonte", () => {
    const lido = ler(
      corpo(
        [
          "\\begin{figure}[h]",
          "\\centering",
          "\\caption{Cenário}",
          "\\includegraphics[width=\\textwidth]{img/vanet.png}",
          "\\label{fig:vanet}",
          "{ \\textbf{Fonte:} Pessoa (2018).}",
          "\\end{figure}",
        ].join("\n"),
      ),
    );
    expect(lido.secoes[0].content).toEqual([
      {
        type: "figura",
        legenda: "Cenário",
        fonte: "Pessoa (2018).",
        imagem: null,
        caminho: "img/vanet.png",
      },
    ]);
    expect(lido.avisos.map((aviso) => aviso.mensagem)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^Conteúdo não reconhecido/)]),
    );
  });

  it("{\\footnotesize Fonte: …} dentro da tabela vira a fonte", () => {
    const lido = ler(
      corpo(
        [
          "\\begin{table}",
          "\\caption{Canais}",
          "\\begin{tabular}{ll}",
          "Tipo & Propósito \\\\",
          "A & B \\\\",
          "\\end{tabular}",
          "{\\footnotesize Fonte: Adaptado de Arena et al. (2020).}",
          "\\end{table}",
        ].join("\n"),
      ),
    );
    expect(lido.secoes[0].content[0]).toMatchObject({
      type: "tabela",
      legenda: "Canais",
      fonte: "Adaptado de Arena et al. (2020).",
    });
    expect(lido.secoes[0].content).toHaveLength(1);
  });

  it("fonte em grupo logo depois da longtable", () => {
    const lido = ler(
      corpo(
        [
          "\\begin{longtable}{ll}",
          "\\caption{Cronograma} \\\\",
          "Atividade & Mês \\\\",
          "\\midrule",
          "Revisão & 1 \\\\",
          "\\end{longtable}",
          "{\\small \\textbf{Fonte:} Elaborado pelo autor.}",
          "",
          "Texto seguinte.",
        ].join("\n"),
      ),
    );
    expect(lido.secoes[0].content[0]).toMatchObject({
      type: "tabela",
      legenda: "Cronograma",
      fonte: "Elaborado pelo autor.",
    });
    expect(lido.secoes[0].content[1]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Texto seguinte." }],
    });
  });

  it("o que sobra e não é fonte entra como parágrafo lido, não cru", () => {
    const lido = ler(
      corpo(
        [
          "\\begin{figure}",
          "\\caption{X}",
          "\\fonte{Autor.}",
          "Nota \\textbf{importante} da figura.",
          "\\end{figure}",
        ].join("\n"),
      ),
    );
    expect(lido.secoes[0].content).toEqual([
      { type: "figura", legenda: "X", fonte: "Autor.", imagem: null },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Nota " },
          { type: "text", text: "importante", marks: [{ type: "negrito" }] },
          { type: "text", text: " da figura." },
        ],
      },
    ]);
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toContain(
      "Conteúdo não reconhecido dentro da figura: entrou como parágrafo logo depois dela.",
    );
  });
});

describe("referência cruzada vira o número (6.2.9)", () => {
  const tex = [
    "\\documentclass{abntex2}",
    "\\begin{document}",
    "\\chapter{Introdução}",
    "\\label{cap:intro}",
    "Ver a Figura~\\ref{fig:b}, a Tabela \\ref{tab:a} e a \\autoref{fig:a}.",
    "\\section{Detalhe}\\label{sec:detalhe}",
    "\\begin{figure}\\caption{A}\\label{fig:a}\\end{figure}",
    "\\begin{table}\\caption{T}\\label{tab:a}\\begin{tabular}{l}x\\\\\\end{tabular}\\end{table}",
    "\\begin{figure}\\label{fig:b}\\caption{B}\\end{figure}",
    "\\begin{equation}E=mc^2\\label{eq:e}\\end{equation}",
    "\\chapter{Método}",
    "Como na Seção~\\ref{sec:detalhe} e no Capítulo \\ref{cap:intro}; \\ref{eq:e} e \\ref{nada}.",
    "\\begin{longtable}{l}\\caption{Longa}\\label{tab:longa}\\\\ y \\\\\\end{longtable}",
    "Ver \\cref{tab:longa}.",
    "\\end{document}",
  ].join("\n");
  const lido = ler(tex);
  const texto = (secao: number, bloco = 0) =>
    (lido.secoes[secao].content[bloco] as { content: { text: string }[] }).content
      .map((no) => no.text)
      .join("");

  it("figura, tabela e seção viram o número que o AURA dá", () => {
    expect(texto(0)).toBe("Ver a Figura 2, a Tabela 1 e a Figura 1.");
    expect(texto(2)).toBe("Como na Seção 1.1 e no Capítulo 1; \\ref{eq:e} e \\ref{nada}.");
    expect(texto(2, 2)).toBe("Ver Tabela 2.");
  });

  it("um aviso para as resolvidas; um por ocorrência das que ficaram como texto", () => {
    const mensagens = lido.avisos.map((aviso) => aviso.mensagem);
    expect(mensagens).toContain(
      "6 referências cruzadas (\\ref) viraram o número fixo: se mudar a ordem das figuras, tabelas ou seções, confira.",
    );
    expect(
      mensagens.filter((mensagem) => mensagem.startsWith("Referência cruzada (\\ref) sem")),
    ).toHaveLength(2);
  });
});

describe("fórmula no meio da frase (6.2.11)", () => {
  it("$…$ e \\(…\\) viram fórmula inline; $ sem fechamento fica como texto", () => {
    const lido = ler(
      [
        "\\documentclass{article}",
        "\\begin{document}",
        "\\section{S}",
        "Por $PDR=\\left(\\sum P_{r}/\\sum P_{e}\\right)\\times100\\%$ e \\(a+b\\). Custa 5 $ só.",
        "\\end{document}",
      ].join("\n"),
    );
    expect(lido.secoes[0].content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Por " },
          {
            type: "formula_inline",
            texto: "PDR=\\left(\\sum P_{r}/\\sum P_{e}\\right)\\times100\\%",
          },
          { type: "text", text: " e " },
          { type: "formula_inline", texto: "a+b" },
          { type: "text", text: ". Custa 5 $ só." },
        ],
      },
    ]);
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "Fórmula ($…$) sem fechamento: entrou como texto.",
    ]);
  });
});
