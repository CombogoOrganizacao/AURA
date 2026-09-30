import { describe, expect, it } from "vitest";

import type { Documento } from "../../document/types";
import { documentoCompleto, IMAGENS } from "../../export/latex/__fixtures__/documento";
import { gerarTex } from "../../export/latex/document";
import { lerTex } from "./lerTex";
import { montarReimportacao } from "./reimport";

// Relatório e documento da reimportação (passo 6.2.4): exportar, editar o
// `.tex` por fora e ver cada edição no lugar certo, e só ela
// (docs/latex-abntex.md §1.5).

function reimportar(atual: Documento | null, tex: string) {
  const lido = lerTex(tex, { chavesDeReferencia: new Set(["freire"]) });
  if (!lido.ok) throw new Error(lido.erro.mensagem);
  let proximo = 0;
  return montarReimportacao(atual, lido.tex, () => `novo-${++proximo}`);
}

describe("montarReimportacao", () => {
  const original = documentoCompleto();
  const tex = gerarTex(original, IMAGENS);

  it("arquivo sem edição: nada muda, e o documento é o mesmo", () => {
    const { documento, relatorio } = reimportar(original, tex);
    expect(relatorio.semMudancas).toBe(true);
    expect(relatorio.avisos).toEqual([]);
    expect(documento).toEqual(original);
    // O conteúdo salvo é mantido, não trocado por uma cópia lida.
    documento.sections.forEach((secao, indice) =>
      expect(secao.content).toBe(original.sections[indice].content),
    );
  });

  it("o que o LaTeX perde sem ser edição não conta como mudança", () => {
    const comEspacos = documentoCompleto();
    comEspacos.sections[0].content.push({ type: "paragraph" });
    comEspacos.apendices[0].content = [
      { type: "paragraph", content: [{ type: "text", text: "Perguntas  aplicadas. " }] },
    ];
    const { relatorio, documento } = reimportar(comEspacos, gerarTex(comEspacos, IMAGENS));
    expect(relatorio.semMudancas).toBe(true);
    expect(documento).toEqual(comEspacos);
  });

  it("a edição de um parágrafo volta na seção certa, e só ela muda", () => {
    const editado = tex.replace("Perguntas aplicadas.", "Perguntas aplicadas e revisadas.");
    const { documento, relatorio } = reimportar(original, editado);
    expect(relatorio.apendices.alteradas).toEqual([
      { id: "ap1", titulo: "Questionário", mudancas: ["texto"] },
    ]);
    expect(relatorio.secoes).toEqual({ novas: [], removidas: [], alteradas: [] });
    expect(documento.apendices[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Perguntas aplicadas e revisadas." }] },
    ]);
    documento.sections.forEach((secao, indice) =>
      expect(secao.content).toBe(original.sections[indice].content),
    );
  });

  it("figura e tabela de uma seção editada mantêm o id", () => {
    const editado = tex.replace("\\caption{Fluxo do processo}", "\\caption{Fluxo revisado}");
    const { documento, relatorio } = reimportar(original, editado);
    expect(relatorio.secoes.alteradas).toEqual([
      { id: "s-dev", titulo: "Desenvolvimento", mudancas: ["texto"] },
    ]);
    expect(documento.sections[2].content.map((no) => ("id" in no ? no.id : null))).toEqual([
      "f1",
      "f2",
      "t1",
    ]);
    expect(documento.sections[2].content[0]).toMatchObject({
      legenda: "Fluxo revisado",
      imagem: "img1",
    });
  });

  it("cada \\auracite volta como citação ligada à referência", () => {
    const editado = tex.replace("A educação é prática da liberdade", "A educação é libertadora");
    const { documento } = reimportar(original, editado);
    const citacoes = documento.sections[0].content.flatMap((no) =>
      no.type === "paragraph"
        ? (no.content ?? []).flatMap((item) =>
            item.type === "text"
              ? (item.marks ?? []).filter((marca) => marca.type === "citacao")
              : [],
          )
        : [],
    );
    expect(citacoes).toEqual([
      {
        type: "citacao",
        attrs: { refId: "freire", modo: "direta_curta", pagina: "35", apud: null },
      },
      { type: "citacao", attrs: { refId: "freire", modo: "indireta", pagina: null, apud: null } },
    ]);
  });

  it("seção nova, removida, renomeada e movida vão para o relatório", () => {
    const inicioObj = tex.indexOf("% AURA-SECTION: s-obj");
    const inicioDev = tex.indexOf("% AURA-SECTION: s-dev");
    const fimDev = tex.indexOf("\\postextual");
    const secaoObj = tex.slice(inicioObj, inicioDev);
    const secaoDev = tex.slice(inicioDev, fimDev);
    // Tira s-intro, põe s-dev antes de s-obj, renomeia s-obj e cria uma nova.
    const editado =
      tex.slice(0, tex.indexOf("% AURA-SECTION: s-intro")) +
      secaoDev +
      secaoObj.replace("\\section{Objetivos \\& métodos}", "\\section{Objetivos}") +
      "\\section{Conclusão}\n\nTexto novo.\n\n" +
      tex.slice(fimDev);
    const { documento, relatorio } = reimportar(original, editado);
    expect(relatorio.secoes).toEqual({
      novas: [{ id: "novo-1", titulo: "Conclusão" }],
      removidas: [{ id: "s-intro", titulo: "Introdução" }],
      alteradas: [
        { id: "s-dev", titulo: "Desenvolvimento", mudancas: ["posicao"] },
        {
          id: "s-obj",
          titulo: "Objetivos",
          mudancas: ["titulo", "posicao"],
          tituloAntes: "Objetivos & métodos",
        },
      ],
    });
    expect(documento.sections.map((secao) => [secao.id, secao.ordem])).toEqual([
      ["s-dev", 0],
      ["s-obj", 1],
      ["novo-1", 2],
    ]);
  });

  it("metadado editado no bloco volta e entra no relatório", () => {
    const editado = tex
      .replace(
        "\\newcommand{\\auraresumo}{Resumo do trabalho, em um parágrafo só, sobre a ABNT e o LaTeX.}",
        "\\newcommand{\\auraresumo}{Resumo novo.}",
      )
      .replace(
        "\\newcommand{\\aurapalavraschave}{formatação; normas técnicas; LaTeX}",
        "\\newcommand{\\aurapalavraschave}{formatação; ABNT}",
      );
    const { documento, relatorio } = reimportar(original, editado);
    expect(relatorio.metadados).toEqual([
      {
        campo: "resumo",
        antes: "Resumo do trabalho, em um parágrafo só, sobre a ABNT e o LaTeX.",
        depois: "Resumo novo.",
      },
      {
        campo: "palavrasChave",
        antes: "formatação; normas técnicas; LaTeX",
        depois: "formatação; ABNT",
      },
    ]);
    expect(documento.metadados.resumo).toBe("Resumo novo.");
    expect(documento.metadados.palavrasChave).toEqual(["formatação", "ABNT"]);
    // O que não está no bloco continua: banca, abreviaturas, curso.
    expect(documento.metadados.bancaExaminadora).toEqual(original.metadados.bancaExaminadora);
    expect(documento.metadados.curso).toBe(original.metadados.curso);
  });

  it("opcional esvaziado no arquivo desliga sem apagar o texto guardado", () => {
    const editado = tex.replace(
      "\\newcommand{\\auradedicatoria}{A quem ensina.}",
      "\\newcommand{\\auradedicatoria}{}",
    );
    const { documento, relatorio } = reimportar(original, editado);
    expect(documento.metadados.dedicatoria).toEqual({ ativo: false, texto: "A quem ensina." });
    expect(relatorio.metadados).toEqual([
      { campo: "dedicatoria", antes: "A quem ensina.", depois: "" },
    ]);
  });

  it("figura de apêndice, que o .tex não exporta, volta como estava", () => {
    const comFigura = documentoCompleto();
    comFigura.apendices[0].content.push({
      type: "figura",
      id: "fa",
      legenda: "X",
      fonte: "Y",
      imagem: "img9",
    });
    const texComFigura = gerarTex(comFigura, IMAGENS);
    expect(reimportar(comFigura, texComFigura).relatorio.semMudancas).toBe(true);

    const editado = texComFigura.replace("Perguntas aplicadas.", "Perguntas novas.");
    const { documento } = reimportar(comFigura, editado);
    expect(documento.apendices[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Perguntas novas." }] },
      { type: "figura", id: "fa", legenda: "X", fonte: "Y", imagem: "img9" },
    ]);
  });

  it("chamada editada à mão avisa que não tem efeito", () => {
    const { relatorio, documento } = reimportar(
      original,
      tex.replace("{ (Freire, 1987)}", "{ (FREIRE, 1987)}"),
    );
    expect(relatorio.avisos.map((aviso) => aviso.mensagem)).toEqual([
      "A chamada “(FREIRE, 1987)” no arquivo não é a que o AURA calcula (“(Freire, 1987)”). A chamada vem da referência: editá-la no arquivo não tem efeito.",
    ]);
    expect(relatorio.semMudancas).toBe(true);
    expect(documento).toEqual(original);
  });

  it("\\cite do aluno com chave conhecida muda a seção e avisa", () => {
    const editado = tex.replace("Perguntas aplicadas.", "O diálogo importa \\cite{freire}.");
    const { relatorio } = reimportar(original, editado);
    expect(relatorio.apendices.alteradas).toEqual([
      { id: "ap1", titulo: "Questionário", mudancas: ["texto"] },
    ]);
    expect(relatorio.avisos[0].mensagem).toMatch(/virou citação indireta/);
  });

  it("id desconhecido cria documento novo, com o id do arquivo", () => {
    const { documento, relatorio } = reimportar(null, tex);
    expect(relatorio.documentoNovo).toBe(true);
    expect(relatorio.semMudancas).toBe(false);
    expect(documento.id).toBe(original.id);
    expect(documento.sections.map((secao) => secao.id)).toEqual(["s-intro", "s-obj", "s-dev"]);
    expect(relatorio.secoes.novas.map((secao) => secao.id)).toEqual(["s-intro", "s-obj", "s-dev"]);
    expect(documento.metadados.titulo).toBe(original.metadados.titulo);
    // O .tex avulso não traz as referências: as citações ficam órfãs, e a
    // conferência aponta.
    expect(documento.references).toEqual([]);
  });

  it("seção que volta sem nenhum bloco ganha um parágrafo vazio", () => {
    const editado = tex.replace("Perguntas aplicadas.", "");
    const { documento } = reimportar(original, editado);
    expect(documento.apendices[0].content).toEqual([{ type: "paragraph" }]);
  });
});
