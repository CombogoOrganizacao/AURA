import { describe, expect, it } from "vitest";

import type { Documento, FonteOriginal, NoConteudo } from "../../document/types";
import { documentoCompleto, IMAGENS } from "../../export/latex/__fixtures__/documento";
import { gerarProjetoTex, gerarTex } from "../../export/latex/document";
import { VERSAO_FORMATO_TEX } from "../../export/latex/markers";
import {
  decodificarUtf8,
  lerTex,
  TAMANHO_MAXIMO_TEX,
  type BlocoLido,
  type TexLido,
} from "./lerTex";

// Leitor do `.tex` (passo 6.2.4): o caminho de volta do que
// `export/latex/document.ts` escreve, e as regras de docs/latex-abntex.md §1.5.

function ler(tex: string, opcoes?: Parameters<typeof lerTex>[1]): TexLido {
  const resultado = lerTex(tex, opcoes);
  if (!resultado.ok) throw new Error(resultado.erro.mensagem);
  return resultado.tex;
}

// O que o leitor devolve para cada nó: figura e tabela sem `id` (o `.tex` não
// o guarda), parágrafo vazio não volta.
function esperado(content: readonly NoConteudo[]): BlocoLido[] {
  return content
    .filter((no) => !(no.type === "paragraph" && !no.content?.length))
    .map((no) => {
      if (no.type !== "figura" && no.type !== "tabela") return no;
      const semId: Partial<typeof no> = { ...no };
      delete semId.id;
      return semId as BlocoLido;
    });
}

function secoesEsperadas(documento: Documento) {
  return documento.sections.map((secao) => ({
    id: secao.id,
    nivel: secao.nivel,
    titulo: secao.titulo,
    content: esperado(secao.content),
  }));
}

function semPosicao<T extends { linha: number; arquivo: string }>(itens: readonly T[]) {
  return itens.map((item) => {
    const resto: Partial<T> = { ...item };
    delete resto.linha;
    delete resto.arquivo;
    return resto;
  });
}

// Linha (1-base) em que `trecho` aparece no texto.
function linhaDe(tex: string, trecho: string): number {
  const posicao = tex.indexOf(trecho);
  if (posicao < 0) throw new Error(`trecho não encontrado: ${trecho}`);
  return tex.slice(0, posicao).split("\n").length;
}

describe("lerTex: volta do que o AURA exporta", () => {
  const documento = documentoCompleto();
  const tex = gerarTex(documento, IMAGENS);
  const lido = ler(tex);

  it("lê o id do documento e a versão do formato", () => {
    expect(lido.documentoId).toBe(documento.id);
    expect(lido.versaoFormato).toBe(VERSAO_FORMATO_TEX);
  });

  it("devolve cada seção com o id, o nível, o título e o conteúdo", () => {
    expect(semPosicao(lido.secoes)).toEqual(secoesEsperadas(documento));
  });

  it("devolve apêndices e anexos sem o rótulo, que é derivado", () => {
    expect(semPosicao(lido.apendices)).toEqual([
      { id: "ap1", titulo: "Questionário", content: esperado(documento.apendices[0].content) },
    ]);
    expect(semPosicao(lido.anexos)).toEqual([
      { id: "an1", titulo: "Lei & decreto", content: esperado(documento.anexos[0].content) },
    ]);
  });

  it("devolve os metadados do bloco, campo a campo", () => {
    const m = documento.metadados;
    expect(lido.metadados).toEqual({
      titulo: m.titulo,
      subtitulo: m.subtitulo,
      autores: m.autores,
      instituicao: m.instituicao,
      orientador: m.orientador,
      local: m.local,
      ano: m.ano,
      naturezaTrabalho: m.naturezaTrabalho,
      resumo: m.resumo,
      palavrasChave: m.palavrasChave,
      abstract: m.abstract,
      keywords: m.keywords,
      dedicatoria: m.dedicatoria!.texto,
      agradecimentos: m.agradecimentos!.texto,
      epigrafe: m.epigrafe!.texto,
    });
  });

  it("lista as chamadas como estavam no arquivo, para o relatório", () => {
    expect(lido.chamadas.map(({ citacao, texto }) => ({ citacao, texto }))).toEqual([
      { citacao: { refId: "freire", pagina: "35", apud: null }, texto: "(Freire, 1987, p. 35)" },
      { citacao: { refId: "freire", pagina: null, apud: null }, texto: "(Freire, 1987)" },
      { citacao: { refId: "freire", pagina: "181" }, texto: "(Freire, 1987, p. 181)" },
    ]);
  });

  it("não gera aviso num arquivo que ninguém editou", () => {
    expect(lido.avisos).toEqual([]);
  });

  it("lê o projeto do .zip seguindo o \\input de sections/", () => {
    const projeto = gerarProjetoTex(documento, IMAGENS);
    const arquivos = new Map(projeto.secoes.map((arquivo) => [arquivo.caminho, arquivo.conteudo]));
    const doZip = ler(projeto.main, { lerArquivo: (caminho) => arquivos.get(caminho) ?? null });
    expect(semPosicao(doZip.secoes)).toEqual(secoesEsperadas(documento));
    expect(doZip.avisos).toEqual([]);
    // A linha do aviso é a do arquivo do capítulo.
    expect(doZip.secoes[0].arquivo).toBe(projeto.secoes[0].caminho);
  });

  it("volta com a mesma citação com apud", () => {
    const comApud = documentoCompleto();
    const apud: FonteOriginal = {
      author: [{ family: "Silva", given: "Ana" }],
      issued: { "date-parts": [[1970]] },
      pagina: "12",
    };
    comApud.sections = [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "Um",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "citado por outro {x}",
                marks: [
                  {
                    type: "citacao",
                    attrs: { refId: "freire", modo: "indireta", pagina: "3", apud },
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    expect(semPosicao(ler(gerarTex(comApud)).secoes)).toEqual(secoesEsperadas(comApud));
  });
});

describe("lerTex: escape de volta", () => {
  // O inverso de `escaparLatex()`, caractere por caractere.
  const DIFICEIS = [
    "& % $ # _ { } ~ ^ \\ `",
    "a--b a---b ``x'' <<y>> ,,z !`?`",
    "α ≤ β → ∞ − ∑",
    "emoji 😀 e 中文",
    "aspas “curvas” e ‘simples’, travessão — e reticências…",
    "\\textbf{não é comando} $x$ %comentário",
  ];

  it.each(DIFICEIS)("devolve o mesmo texto: %s", (texto) => {
    const documento = documentoCompleto();
    documento.sections = [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: texto,
        content: [{ type: "paragraph", content: [{ type: "text", text: texto }] }],
      },
    ];
    const lido = ler(gerarTex(documento));
    expect(semPosicao(lido.secoes)).toEqual(secoesEsperadas(documento));
    expect(lido.avisos).toEqual([]);
  });

  it("espaço repetido volta como um só, como o LaTeX imprime", () => {
    const documento = documentoCompleto();
    documento.sections = [
      {
        id: "s1",
        ordem: 0,
        nivel: 1,
        titulo: "T",
        content: [{ type: "paragraph", content: [{ type: "text", text: "a  b" }] }],
      },
    ];
    expect(ler(gerarTex(documento)).secoes[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "a b" }] },
    ]);
  });
});

describe("lerTex: arquivo hostil não trava a aba", () => {
  const tex = gerarTex(documentoCompleto(), IMAGENS);
  const comParagrafo = (paragrafo: string) => tex.replace("Perguntas aplicadas.", paragrafo);

  // Cada caso seria quadrático (ou estouraria a pilha) com a busca ingênua.
  it.each([
    ["chaves sem fechamento", "{".repeat(200_000)],
    ["chaves aninhadas", `${"{".repeat(100_000)}x${"}".repeat(100_000)}`],
    ["ambientes sem \\end", "\\begin{x}\n\n".repeat(50_000)],
    ["opcionais sem fechamento", "\\foo[".repeat(50_000)],
    ["cifrões sem par", "$ ".repeat(100_000)],
    [
      "ambientes aninhados",
      `${"\\begin{center}".repeat(20_000)}x${"\\end{center}".repeat(20_000)}`,
    ],
    [
      "listas aninhadas",
      `${"\\begin{itemize}\\item ".repeat(5_000)}x${"\\end{itemize}".repeat(5_000)}`,
    ],
    ["itens demais", `\\begin{itemize}${"\\item a ".repeat(50_000)}\\end{itemize}`],
    ["células demais", `\\begin{tabular}{c}${"a & ".repeat(50_000)}\\end{tabular}`],
  ])("%s", (_nome, paragrafo) => {
    const inicio = performance.now();
    const resultado = lerTex(comParagrafo(paragrafo));
    expect(resultado.ok).toBe(true);
    expect(performance.now() - inicio).toBeLessThan(5_000);
  });

  it("chaves aninhadas demais entram como texto, com aviso", () => {
    const lido = ler(comParagrafo(`${"{".repeat(100)}x${"}".repeat(100)}`));
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "Chaves aninhadas demais: o trecho entrou como texto.",
    ]);
  });

  it("recusa texto acima de 10 MB", () => {
    expect(lerTex(`${tex}${"%".repeat(TAMANHO_MAXIMO_TEX)}`)).toMatchObject({
      ok: false,
      erro: { codigo: "grande-demais" },
    });
  });
});

describe("lerTex: recusas", () => {
  const tex = gerarTex(documentoCompleto(), IMAGENS);

  it("arquivo sem a linha de identidade é de fora: lido, sem id (§1.6)", () => {
    const lido = ler("\\documentclass{article}\n\\begin{document}\nOi\n\\end{document}\n");
    expect(lido).toMatchObject({ origem: "externo", documentoId: null, versaoFormato: null });
  });

  it("capítulo solto, sem \\begin{document}, é recusado com mensagem clara", () => {
    const resultado = lerTex("\\chapter{Introdução}\nTexto.\n");
    expect(resultado).toMatchObject({ ok: false, erro: { codigo: "sem-documento" } });
    if (!resultado.ok) expect(resultado.erro.mensagem).toMatch(/capítulo solto/);
  });

  it("recusa versão de formato mais nova e pede para atualizar", () => {
    const resultado = lerTex(tex.replace(/ v\d+\n/, ` v${VERSAO_FORMATO_TEX + 1}\n`));
    expect(resultado).toMatchObject({ ok: false, erro: { codigo: "versao-nova" } });
    if (!resultado.ok) expect(resultado.erro.mensagem).toMatch(/Atualize a página/);
  });

  it("recusa arquivo sem \\begin{document}", () => {
    expect(lerTex(tex.replace("\\begin{document}", ""))).toMatchObject({
      ok: false,
      erro: { codigo: "sem-documento" },
    });
  });

  it("recusa bytes que não são UTF-8", () => {
    expect(decodificarUtf8(Uint8Array.from([0x25, 0xe9, 0x0a]))).toMatchObject({
      ok: false,
      erro: { codigo: "nao-utf8" },
    });
    expect(decodificarUtf8(new TextEncoder().encode("ação"))).toEqual({ ok: true, texto: "ação" });
  });

  it("aceita CRLF e BOM, que editores no Windows acrescentam", () => {
    const lido = ler(`\uFEFF${tex.replace(/\n/g, "\r\n")}`);
    expect(semPosicao(lido.secoes)).toEqual(secoesEsperadas(documentoCompleto()));
  });
});

describe("lerTex: edição feita fora do AURA (§1.5)", () => {
  const documento = documentoCompleto();
  const tex = gerarTex(documento, IMAGENS);

  it("a edição de um parágrafo volta na seção certa", () => {
    const editado = tex.replace(
      "Perguntas aplicadas.",
      "Perguntas aplicadas e \\textit{revisadas}.",
    );
    const lido = ler(editado);
    expect(lido.apendices[0].content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Perguntas aplicadas e " },
          { type: "text", text: "revisadas", marks: [{ type: "italico" }] },
          { type: "text", text: "." },
        ],
      },
    ]);
    expect(semPosicao(lido.secoes)).toEqual(secoesEsperadas(documento));
  });

  it("parágrafo quebrado em várias linhas volta como um só, e linha em branco separa", () => {
    const editado = tex.replace(
      "Perguntas aplicadas.",
      "Primeira linha\ncontinua aqui. % comentário do aluno\n\nSegundo parágrafo.",
    );
    const lido = ler(editado);
    expect(lido.apendices[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Primeira linha continua aqui." }] },
      { type: "paragraph", content: [{ type: "text", text: "Segundo parágrafo." }] },
    ]);
  });

  it("comando desconhecido vira texto literal no lugar, com aviso e a linha", () => {
    const editado = tex.replace("Perguntas aplicadas.", "Perguntas \\hl{aplicadas}.");
    const lido = ler(editado);
    expect(lido.apendices[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Perguntas \\hl{aplicadas}." }] },
    ]);
    expect(lido.avisos).toEqual([
      {
        arquivo: "main.tex",
        linha: linhaDe(editado, "\\hl{"),
        mensagem: "Comando \\hl não reconhecido: entrou como texto.",
      },
    ]);
  });

  it("ambiente desconhecido vira parágrafo literal, com aviso", () => {
    const editado = tex.replace(
      "Perguntas aplicadas.",
      "Perguntas aplicadas.\n\n\\begin{tikzpicture}\n\\draw (0,0);\n\\end{tikzpicture}",
    );
    const lido = ler(editado);
    expect(lido.apendices[0].content[1]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "\\begin{tikzpicture} \\draw (0,0); \\end{tikzpicture}" }],
    });
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "Ambiente tikzpicture não reconhecido: entrou como texto.",
    ]);
  });

  it("seção nova sem marcador entra com id nulo", () => {
    const editado = tex.replace(
      "% AURA-SECTION: s-dev",
      "\\section{Seção escrita no Overleaf}\n\nTexto novo.\n\n% AURA-SECTION: s-dev",
    );
    const lido = ler(editado);
    expect(lido.secoes.map((secao) => [secao.id, secao.nivel, secao.titulo])).toEqual([
      ["s-intro", 1, "Introdução"],
      ["s-obj", 2, "Objetivos & métodos"],
      [null, 2, "Seção escrita no Overleaf"],
      ["s-dev", 1, "Desenvolvimento"],
    ]);
    expect(lido.secoes[2].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Texto novo." }] },
    ]);
    expect(lido.avisos).toEqual([]);
  });

  it("marcador apagado com o título mantido: seção nova, sem perder o texto", () => {
    const lido = ler(tex.replace("% AURA-SECTION: s-obj\n", ""));
    expect(lido.secoes[1]).toMatchObject({ id: null, titulo: "Objetivos & métodos" });
    expect(lido.secoes[1].content).toEqual(esperado(documento.sections[1].content));
  });

  it("título editado mantém o id pelo marcador", () => {
    const editado = tex.replace(
      "\\chapter[\\texorpdfstring{\\protect\\MakeUppercase{Desenvolvimento}}{Desenvolvimento}]{Desenvolvimento}",
      "\\chapter{Desenvolvimento e análise}",
    );
    expect(ler(editado).secoes[2]).toMatchObject({
      id: "s-dev",
      titulo: "Desenvolvimento e análise",
    });
  });

  it("seção removida no Overleaf não volta", () => {
    const inicio = tex.indexOf("% AURA-SECTION: s-obj");
    const fim = tex.indexOf("% AURA-SECTION: s-dev");
    const lido = ler(tex.slice(0, inicio) + tex.slice(fim));
    expect(lido.secoes.map((secao) => secao.id)).toEqual(["s-intro", "s-dev"]);
  });

  it("marcador duplicado: a primeira ocorrência fica com o id, a outra vira nova", () => {
    const editado = tex.replace(
      "% AURA-SECTION: s-dev",
      "% AURA-SECTION: s-intro\n\\section{Cópia}\n\nTexto.\n\n% AURA-SECTION: s-dev",
    );
    const lido = ler(editado);
    expect(lido.secoes.map((secao) => secao.id)).toEqual(["s-intro", "s-obj", null, "s-dev"]);
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "Marcador repetido (s-intro): “Cópia” voltou como seção nova.",
    ]);
  });

  it("\\subsubsection vira nível 3, com aviso", () => {
    const editado = tex.replace(
      "% AURA-SECTION: s-dev",
      "\\subsubsection{Fundo}\n\n% AURA-SECTION: s-dev",
    );
    const lido = ler(editado);
    expect(lido.secoes[2]).toMatchObject({ id: null, nivel: 3, titulo: "Fundo" });
    expect(lido.avisos[0].mensagem).toMatch(/três níveis/);
  });

  it("\\cite com chave conhecida vira citação indireta sobre a frase anterior", () => {
    const editado = tex.replace(
      "Perguntas aplicadas.",
      "Primeira frase. A escola é lugar de diálogo \\cite[p. 35]{freire}. Fim.",
    );
    const lido = ler(editado, { chavesDeReferencia: new Set(["freire"]) });
    expect(lido.apendices[0].content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Primeira frase. " },
          {
            type: "text",
            text: "A escola é lugar de diálogo",
            marks: [
              {
                type: "citacao",
                attrs: { refId: "freire", modo: "indireta", pagina: "35", apud: null },
              },
            ],
          },
          { type: "text", text: ". Fim." },
        ],
      },
    ]);
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "\\cite{freire} virou citação indireta, página 35, sobre o trecho antes dele. Confira o trecho e o modo.",
    ]);
  });

  it("\\cite com chave desconhecida fica como texto, com aviso", () => {
    const editado = tex.replace("Perguntas aplicadas.", "Texto \\cite{outro}.");
    const lido = ler(editado, { chavesDeReferencia: new Set(["freire"]) });
    expect(lido.apendices[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Texto \\cite{outro}." }] },
    ]);
    expect(lido.avisos[0].mensagem).toMatch(/não está nas referências/);
  });

  it("matemática inline, \\newcommand e \\input no corpo ficam como texto, com aviso", () => {
    const editado = tex.replace(
      "Perguntas aplicadas.",
      "Seja $x^2$ o valor. \\newcommand{\\foo}{bar} Veja.\n\n\\input{extra}",
    );
    const lido = ler(editado);
    expect(lido.apendices[0].content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Seja $x^2$ o valor. \\newcommand{\\foo}{bar} Veja." }],
      },
      { type: "paragraph", content: [{ type: "text", text: "\\input{extra}" }] },
    ]);
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "Matemática no meio do texto ($…$) não existe no AURA: entrou como texto. Use um bloco de fórmula.",
      "\\newcommand no texto não é expandido: entrou como texto.",
      "\\input no meio do texto não é seguido: entrou como texto.",
    ]);
  });

  it("\\input de fora de sections/ não é seguido, com aviso", () => {
    const projeto = gerarProjetoTex(documento, IMAGENS);
    const main = projeto.main.replace(/\\input\{sections\/01-[^}]+\}/, "\\input{../segredo}");
    const arquivos = new Map(projeto.secoes.map((arquivo) => [arquivo.caminho, arquivo.conteudo]));
    const pedidos: string[] = [];
    const lido = ler(main, {
      lerArquivo: (caminho) => {
        pedidos.push(caminho);
        return arquivos.get(caminho) ?? null;
      },
    });
    expect(pedidos).toEqual([projeto.secoes[1].caminho]);
    expect(lido.secoes.map((secao) => secao.id)).toEqual(["s-dev"]);
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "\\input{../segredo} não é seguido: só os arquivos de sections/ que o AURA escreve são lidos.",
    ]);
  });

  it("chamada editada à mão volta como estava, para o relatório avisar", () => {
    const lido = ler(tex.replace("{ (Freire, 1987)}", "{ (FREIRE, 1987)}"));
    expect(lido.chamadas[1].texto).toBe("(FREIRE, 1987)");
    // O texto da citação não muda: a chamada é descartada.
    expect(semPosicao(lido.secoes)).toEqual(secoesEsperadas(documento));
  });

  it("resumo editado no bloco de metadados volta", () => {
    const lido = ler(
      tex.replace(
        "\\newcommand{\\auraresumo}{Resumo do trabalho, em um parágrafo só, sobre a ABNT e o LaTeX.}",
        "\\newcommand{\\auraresumo}{Resumo novo, com 30\\% a mais.}",
      ),
    );
    expect(lido.metadados?.resumo).toBe("Resumo novo, com 30% a mais.");
  });

  it("opcional com dois parágrafos e dois autores voltam separados", () => {
    const outro = documentoCompleto();
    outro.metadados.autores = ["Ana", "Bia"];
    outro.metadados.agradecimentos = { ativo: true, texto: "Primeiro.\nSegundo." };
    const lido = ler(gerarTex(outro));
    expect(lido.metadados?.autores).toEqual(["Ana", "Bia"]);
    expect(lido.metadados?.agradecimentos).toBe("Primeiro.\nSegundo.");
  });

  it("figura e tabela de apêndice, que o .tex não exporta, voltam como marca de posição", () => {
    const comFigura = documentoCompleto();
    comFigura.apendices[0].content.push({
      type: "figura",
      id: "fa",
      legenda: "X",
      fonte: "",
      imagem: null,
    });
    const lido = ler(gerarTex(comFigura));
    expect(lido.apendices[0].content.at(-1)).toEqual({ type: "nao_exportado", tipo: "figura" });
  });

  it("apêndice novo sem marcador entra como apêndice pelo rótulo, com aviso", () => {
    const editado = tex.replace(
      "% AURA-ANEXO: an1",
      "\\pretextualchapter{APÊNDICE B --- Roteiro}\n\nPerguntas.\n\n% AURA-ANEXO: an1",
    );
    const lido = ler(editado);
    expect(semPosicao(lido.apendices).map(({ id, titulo }) => [id, titulo])).toEqual([
      ["ap1", "Questionário"],
      [null, "Roteiro"],
    ]);
    expect(lido.anexos.map((anexo) => anexo.id)).toEqual(["an1"]);
    expect(lido.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "“APÊNDICE B — Roteiro” sem marcador: entra como apêndice novo.",
    ]);
  });

  it("imagem por caminho de fora de figuras/ volta como caminho, para o .zip resolver", () => {
    const lido = ler(tex.replace("{figuras/img1.png}", "{imagens/foto.png}"));
    expect(lido.secoes[2].content[0]).toMatchObject({
      type: "figura",
      imagem: null,
      caminho: "imagens/foto.png",
    });
  });
});
