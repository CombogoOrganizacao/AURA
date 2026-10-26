import { describe, expect, it } from "vitest";

import type { CelulaTabela } from "../../document/types";
import { lerTex } from "../../import/latex/lerTex";
import { montarReimportacao } from "../../import/latex/reimport";
import { documentoCompleto, IMAGENS } from "./__fixtures__/documento";
import { gerarTex } from "./document";

// Passo 8.5.4 — célula mesclada no `.tex` (`\multicolumn` e `\multirow`) e a
// volta pelo Overleaf. A compilação de verdade é `compila.test.ts`.

const texto = (t: string, cabecalho = false): CelulaTabela => ({
  cabecalho,
  content: [{ type: "text", text: t }],
});
const coberta = (cabecalho = false): CelulaTabela => ({ cabecalho, coberta: true });

function documentoComMescla() {
  const documento = documentoCompleto();
  documento.sections[2].content = [
    {
      type: "tabela",
      id: "t9",
      legenda: "Por região",
      fonte: "",
      linhas: [
        {
          celulas: [
            { ...texto("Região", true), rowspan: 2 },
            { ...texto("Ano", true), colspan: 2 },
            coberta(true),
          ],
        },
        { celulas: [coberta(true), texto("2020", true), texto("2021", true)] },
        { celulas: [texto("Sul"), texto("10"), texto("20")] },
      ],
    },
  ];
  return documento;
}

function tabelaDoTex(tex: string): string {
  return tex.slice(tex.indexOf("\\begin{longtable}"), tex.indexOf("\\end{longtable}"));
}

describe("gerarTex — células mescladas", () => {
  const tex = gerarTex(documentoComMescla(), IMAGENS);

  it("carrega o pacote multirow", () => {
    expect(tex).toContain("\\usepackage{longtable,booktabs,array,multirow}");
  });

  it("a âncora sai com \\multirow e \\multicolumn, este com a largura somada", () => {
    const tabela = tabelaDoTex(tex);
    // O `\multirow` abre uma caixa própria: o `\centering` da coluna não
    // chega nela.
    expect(tabela).toContain("\\multirow{2}{=}{\\centering \\textbf{Região}}");
    expect(tabela).toMatch(
      /\\multicolumn\{2\}\{>\{\\centering\\arraybackslash\}p\{\\dimexpr\([^}]*\+2\\tabcolsep\\relax\}\}\{\\textbf\{Ano\}\}/,
    );
  });

  it("a linha de baixo da mescla deixa o lugar vazio, e a de cima tem as células que cabem", () => {
    const tabela = tabelaDoTex(tex);
    expect(tabela).toContain(" & \\textbf{2020} & \\textbf{2021} \\\\");
    // Região e o \multicolumn do Ano: uma separação só.
    const linha = tabela.split("\n").find((l) => l.includes("\\multirow{2}"))!;
    expect(linha.match(/ & /g)).toHaveLength(1);
  });

  it("sem mescla, nada de \\multicolumn nem \\multirow", () => {
    const sem = gerarTex(documentoCompleto(), IMAGENS);
    expect(sem).not.toContain("\\multicolumn");
    expect(sem).not.toContain("\\multirow{");
  });
});

describe("a mescla faz a volta pelo Overleaf", () => {
  function reimportar(atual: ReturnType<typeof documentoComMescla>, tex: string) {
    const lido = lerTex(tex, { chavesDeReferencia: new Set(["freire"]) });
    if (!lido.ok) throw new Error(lido.erro.mensagem);
    let proximo = 0;
    return montarReimportacao(atual, lido.tex, { gerarId: () => `novo-${++proximo}` });
  }

  it("a mescla do AURA volta igual, sem alteração", () => {
    const original = documentoComMescla();
    const { relatorio, documento } = reimportar(original, gerarTex(original, IMAGENS));
    expect(relatorio.semMudancas).toBe(true);
    expect(documento.sections[2].content).toBe(original.sections[2].content);
  });

  it("desfazer a mescla no .tex aparece como alteração da seção", () => {
    const original = documentoComMescla();
    const tex = gerarTex(original, IMAGENS);
    const editado = tex.replace(
      /\\multicolumn\{2\}\{[^\n]*?\}\{\\textbf\{Ano\}\}/,
      "\\textbf{Ano} & ",
    );
    expect(editado).not.toBe(tex);
    const { relatorio } = reimportar(original, editado);
    expect(relatorio.semMudancas).toBe(false);
    expect(relatorio.secoes.alteradas.map((secao) => secao.titulo)).toContain("Desenvolvimento");
  });

  it("um .tex de fora com \\multicolumn e \\multirow entra mesclado, sem aviso de perda", () => {
    const tex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "\\section{Dados}",
      "\\begin{table}",
      "\\caption{Regiões}",
      "\\begin{tabular}{lll}",
      "\\textbf{Região} & \\multicolumn{2}{c}{\\textbf{Ano}} \\\\",
      "\\multirow{2}{*}{Sul} & 2020 & 2021 \\\\",
      " & 2022 & 2023 \\\\",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const lido = lerTex(tex, {});
    if (!lido.ok) throw new Error(lido.erro.mensagem);
    const tabela = lido.tex.secoes[0].content[0];
    if (tabela.type !== "tabela") throw new Error("sem tabela");
    expect(tabela.linhas[0].celulas.map((c) => [c.colspan, c.coberta])).toEqual([
      [undefined, undefined],
      [2, undefined],
      [undefined, true],
    ]);
    expect(tabela.linhas[1].celulas[0]).toMatchObject({ rowspan: 2 });
    expect(tabela.linhas[2].celulas[0]).toMatchObject({ coberta: true });
    expect(lido.tex.avisos.map((aviso) => aviso.mensagem)).toEqual([]);
  });
});
