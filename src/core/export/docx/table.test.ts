import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { CelulaTabela, Documento, LinhaTabela, NoTabela } from "../../document/types";
import { ABNT } from "./constants";
import { fromDocumento } from "./fromDocumento";
import { linhasDeCabecalho } from "./table";

// Passo 6.1.3. Os traços vêm das normas de apresentação tabular do IBGE
// (3. ed., 1993), a que a NBR 14724:2024 §5.9 remete — ver o cabeçalho de
// `table.ts`. O XML prova o que o arquivo pede; como o Word pagina e repete o
// cabeçalho só se confere abrindo nele.

function celula(texto: string, cabecalho = false): CelulaTabela {
  return { cabecalho, content: texto ? [{ type: "text", text: texto }] : [] };
}

function linha(textos: string[], cabecalho = false): LinhaTabela {
  return { celulas: textos.map((texto) => celula(texto, cabecalho)) };
}

function tabela(linhas: LinhaTabela[], legenda = "Matrículas por curso", fonte = ""): NoTabela {
  return { type: "tabela", id: "t1", legenda, fonte, linhas };
}

const TRES_POR_TRES = tabela(
  [
    linha(["Curso", "2023", "2024"], true),
    linha(["Letras", "33", "41"]),
    linha(["História", "45", "52"]),
  ],
  "Matrículas por curso",
  "elaborada pela própria autora",
);

async function pacote(no: NoTabela): Promise<{ documento: string; estilos: string }> {
  const documento: Documento = novoDocumento();
  documento.sections = [{ id: "s1", ordem: 0, nivel: 1, titulo: "Resultados", content: [no] }];
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return {
    documento: await zip.file("word/document.xml")!.async("string"),
    estilos: await zip.file("word/styles.xml")!.async("string"),
  };
}

function tabelas(xml: string): string[] {
  return xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? [];
}

function todasAsLinhasXml(tbl: string): string[] {
  return tbl.match(/<w:tr>[\s\S]*?<\/w:tr>|<w:tr [\s\S]*?<\/w:tr>/g) ?? [];
}

// A linha vazia de altura exata abaixo do traço do cabeçalho (o respiro que
// se repete a cada página) não é linha do aluno.
function ehLinhaDeRespiro(tr: string): boolean {
  return /<w:trHeight [^>]*w:hRule="exact"/.test(tr);
}

// As linhas do aluno, sem a de respiro.
function linhasXml(tbl: string): string[] {
  return todasAsLinhasXml(tbl).filter((tr) => !ehLinhaDeRespiro(tr));
}

function celulasXml(tr: string): string[] {
  return tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
}

// Um lado da borda (`top`, `bottom`, `left`, `right`, `insideH`, `insideV`)
// dentro de um bloco de bordas: devolve o `w:val`.
function borda(bloco: string, lado: string): string | undefined {
  return bloco.match(new RegExp(`<w:${lado} [^>]*w:val="([a-z]+)"`))?.[1];
}

function bordasDaTabela(tbl: string): string {
  return tbl.match(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/)![0];
}

function bordasDaCelula(tc: string): string {
  return tc.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)![0];
}

describe("linhasDeCabecalho — o espaço do cabeçalho", () => {
  it("conta as primeiras linhas em que toda célula é cabeçalho", () => {
    expect(linhasDeCabecalho([linha(["a", "b"], true), linha(["c", "d"])])).toBe(1);
    expect(linhasDeCabecalho([linha(["a"], true), linha(["b"], true), linha(["c"])])).toBe(2);
  });

  it("linha com só parte das células de cabeçalho já é corpo", () => {
    const mista: LinhaTabela = { celulas: [celula("a", true), celula("b")] };
    expect(linhasDeCabecalho([mista, linha(["c", "d"])])).toBe(0);
  });

  it("cabeçalho que volta no meio do corpo não conta", () => {
    expect(linhasDeCabecalho([linha(["a"], true), linha(["b"]), linha(["c"], true)])).toBe(1);
  });

  it("tabela sem cabeçalho: zero", () => {
    expect(linhasDeCabecalho([linha(["a"]), linha(["b"])])).toBe(0);
  });
});

describe("grade da tabela no .docx (passo 6.1.3)", () => {
  it("uma tabela 3×3 sai como <w:tbl> de verdade, com o texto de cada célula", async () => {
    const { documento } = await pacote(TRES_POR_TRES);

    const [tbl, ...outras] = tabelas(documento);
    expect(outras).toHaveLength(0);
    const trs = linhasXml(tbl);
    expect(trs).toHaveLength(3);
    for (const tr of trs) expect(celulasXml(tr)).toHaveLength(3);
    for (const texto of ["Curso", "2024", "Letras", "33", "História", "52"]) {
      expect(tbl).toContain(`>${texto}</w:t>`);
    }
    expect(documento).not.toContain("grade da tabela ainda não exportada");
  });

  // IBGE §4.3.1 (três traços horizontais) e §4.3.3 (sem traço vertical nas
  // laterais).
  it("moldura: fecha em cima e embaixo, laterais abertas, sem traço interno", async () => {
    const bordas = bordasDaTabela(tabelas((await pacote(TRES_POR_TRES)).documento)[0]);

    expect(borda(bordas, "top")).toBe("single");
    expect(borda(bordas, "bottom")).toBe("single");
    expect(borda(bordas, "left")).toBe("none");
    expect(borda(bordas, "right")).toBe("none");
    expect(borda(bordas, "insideH")).toBe("none");
    expect(borda(bordas, "insideV")).toBe("none");
  });

  it("nenhuma célula tem traço vertical", async () => {
    const tbl = tabelas((await pacote(TRES_POR_TRES)).documento)[0];

    for (const tc of linhasXml(tbl).flatMap(celulasXml)) {
      const bordas = bordasDaCelula(tc);
      expect(borda(bordas, "left")).toBe("none");
      expect(borda(bordas, "right")).toBe("none");
    }
  });

  // O segundo traço do §4.3.1, e o do topo repetido na célula para o Word o
  // levar junto quando repete o cabeçalho na página seguinte (§8.3 a).
  it("o cabeçalho tem traço em cima e embaixo; o corpo, nenhum", async () => {
    const [cabecalho, ...corpo] = linhasXml(tabelas((await pacote(TRES_POR_TRES)).documento)[0]);

    for (const tc of celulasXml(cabecalho)) {
      expect(borda(bordasDaCelula(tc), "top")).toBe("single");
      expect(borda(bordasDaCelula(tc), "bottom")).toBe("single");
    }
    for (const tc of corpo.flatMap(celulasXml)) {
      expect(borda(bordasDaCelula(tc), "top")).toBe("none");
      expect(borda(bordasDaCelula(tc), "bottom")).toBe("none");
    }
  });

  // IBGE §8.3 a): a tabela que passa de uma página repete o cabeçalho.
  it("só as linhas de cabeçalho repetem quando a tabela quebra página", async () => {
    const trs = linhasXml(tabelas((await pacote(TRES_POR_TRES)).documento)[0]);

    expect(trs[0]).toContain("<w:tblHeader/>");
    expect(trs[1]).not.toContain("<w:tblHeader/>");
    expect(trs[2]).not.toContain("<w:tblHeader/>");
  });

  it("duas linhas de cabeçalho: as duas repetem, e o traço fica sob a segunda", async () => {
    const no = tabela([
      linha(["Curso", "Matrículas", ""], true),
      linha(["", "2023", "2024"], true),
      linha(["Letras", "33", "41"]),
    ]);
    const [primeira, segunda, terceira] = linhasXml(tabelas((await pacote(no)).documento)[0]);

    expect(primeira).toContain("<w:tblHeader/>");
    expect(segunda).toContain("<w:tblHeader/>");
    expect(terceira).not.toContain("<w:tblHeader/>");
    for (const tc of celulasXml(primeira)) {
      expect(borda(bordasDaCelula(tc), "top")).toBe("single");
      expect(borda(bordasDaCelula(tc), "bottom")).toBe("none");
    }
    for (const tc of celulasXml(segunda)) {
      expect(borda(bordasDaCelula(tc), "top")).toBe("none");
      expect(borda(bordasDaCelula(tc), "bottom")).toBe("single");
    }
  });

  it("tabela sem cabeçalho: só os traços de cima e de baixo, nada repete", async () => {
    const no = tabela([linha(["Letras", "33"]), linha(["História", "45"])]);
    const tbl = tabelas((await pacote(no)).documento)[0];

    expect(tbl).not.toContain("<w:tblHeader/>");
    const [primeira, segunda] = linhasXml(tbl);
    for (const tc of celulasXml(primeira)) {
      expect(borda(bordasDaCelula(tc), "top")).toBe("single");
      expect(borda(bordasDaCelula(tc), "bottom")).toBe("none");
    }
    for (const tc of celulasXml(segunda)) {
      expect(borda(bordasDaCelula(tc), "bottom")).toBe("none");
    }
  });

  it("legenda acima da tabela e fonte abaixo (NBR 14724:2024 §5.8/§5.9)", async () => {
    const { documento } = await pacote(TRES_POR_TRES);

    const legenda = documento.indexOf("Matrículas por curso");
    const grade = documento.indexOf("<w:tbl>");
    const fonte = documento.indexOf("Fonte: elaborada pela própria autora");
    expect(legenda).toBeGreaterThan(-1);
    expect(legenda).toBeLessThan(grade);
    expect(grade).toBeLessThan(fonte);
  });

  it("cabeçalho em negrito; marcas do aluno no corpo continuam", async () => {
    const no = tabela([
      linha(["Curso"], true),
      {
        celulas: [
          {
            cabecalho: false,
            content: [{ type: "text", text: "Letras", marks: [{ type: "italico" }] }],
          },
        ],
      },
    ]);
    const [cabecalho, corpo] = linhasXml(tabelas((await pacote(no)).documento)[0]);

    expect(cabecalho).toMatch(/<w:b\/>[\s\S]*?>Curso<\/w:t>/);
    expect(corpo).toMatch(/<w:i\/>[\s\S]*?>Letras<\/w:t>/);
    expect(corpo).not.toContain("<w:b/>");
  });

  it("célula vazia ainda leva um parágrafo (OOXML não aceita <w:tc> sem nenhum)", async () => {
    const no = tabela([linha(["Curso", ""], true), linha(["", ""])]);
    const tbl = tabelas((await pacote(no)).documento)[0];

    for (const tc of linhasXml(tbl).flatMap(celulasXml)) {
      expect(tc).toMatch(/<w:p>|<w:p /);
    }
  });

  it("tabela sem linha nenhuma sai sem grade, com legenda e fonte", async () => {
    const { documento } = await pacote(tabela([], "Vazia", "IBGE (2024)"));

    expect(tabelas(documento)).toHaveLength(0);
    expect(documento).toContain("Vazia");
    expect(documento).toContain("Fonte: IBGE (2024)");
  });

  it("colunas somando a largura útil da folha", async () => {
    const tbl = tabelas((await pacote(TRES_POR_TRES)).documento)[0];

    const larguras = [...tbl.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
    expect(larguras).toHaveLength(3);
    const soma = larguras.reduce((total, largura) => total + largura, 0);
    // `Math.floor` por coluna: até um twip a menos em cada uma.
    expect(soma).toBeLessThanOrEqual(ABNT.larguraUtil);
    expect(soma).toBeGreaterThanOrEqual(ABNT.larguraUtil - 3);
  });

  it("a coluna de texto longo fica mais larga que a de texto curto", async () => {
    const cronograma = tabela([
      linha(["Atividades", "Mês 1"], true),
      linha(["Análise estatística dos dados e redação final da monografia, com revisão", "X"]),
    ]);
    const tbl = tabelas((await pacote(cronograma)).documento)[0];

    const [atividades, mes] = [...tbl.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) =>
      Number(m[1]),
    );
    expect(atividades).toBeGreaterThan(mes * 3);
  });
});

// A célula não está entre as exceções da NBR 14724:2024 §5.1 (tamanho menor)
// nem da §5.2 (espaço simples): sai como o corpo, 12 pt e 1,5.
describe("estilo CelulaTabela", () => {
  it("toda célula usa o estilo nomeado", async () => {
    const tbl = tabelas((await pacote(TRES_POR_TRES)).documento)[0];

    for (const tc of linhasXml(tbl).flatMap(celulasXml)) {
      expect(tc).toContain('<w:pStyle w:val="CelulaTabela"/>');
    }
  });

  // A entrelinha 1,5 põe a meia linha a mais embaixo do texto; o respiro a
  // devolve logo depois de cada traço. Abaixo do traço do cabeçalho ele é uma
  // linha vazia que se repete, para valer também nas páginas seguintes.
  it("respiro acima do cabeçalho e, abaixo do traço dele, numa linha vazia que repete", async () => {
    const respiro = /<w:spacing w:before="140"\/>/;
    const duas = tabela([
      linha(["Região", "Ano"], true),
      linha(["", "1940"], true),
      linha(["Brasil", "42,74"]),
      linha(["Região I", "45,38"]),
    ]);
    const trs = todasAsLinhasXml(tabelas((await pacote(duas)).documento)[0]);
    const [primeira, segunda, vazia, dados, outra] = trs;

    for (const tc of celulasXml(primeira)) expect(tc).toMatch(respiro);
    expect(segunda).not.toContain("w:before");

    // A linha vazia logo depois do cabeçalho: 7 pt exatos, repetida, sem
    // texto e sem traço (o traço é o de baixo da linha anterior).
    expect(ehLinhaDeRespiro(vazia)).toBe(true);
    expect(vazia).toContain('<w:trHeight w:val="140" w:hRule="exact"/>');
    expect(vazia).toContain("<w:tblHeader/>");
    expect(vazia).not.toMatch(/<w:t[ >]/);
    expect(celulasXml(vazia)).toHaveLength(2);
    for (const tc of celulasXml(vazia)) expect(borda(bordasDaCelula(tc), "top")).toBe("none");

    for (const tr of [dados, outra]) {
      expect(tr).not.toContain("w:before");
      expect(tr).not.toContain("<w:tblHeader/>");
    }
    expect(trs.filter(ehLinhaDeRespiro)).toHaveLength(1);
  });

  it("sem cabeçalho, ou só com cabeçalho, não há linha vazia", async () => {
    const respiro = /<w:spacing w:before="140"\/>/;
    // Sem cabeçalho nada repete: o respiro vai na linha 0, sob o traço do topo.
    const semCabecalho = todasAsLinhasXml(
      tabelas(
        (await pacote(tabela([linha(["Brasil", "42,74"]), linha(["Sul", "50"])]))).documento,
      )[0],
    );
    expect(semCabecalho.filter(ehLinhaDeRespiro)).toHaveLength(0);
    for (const tc of celulasXml(semCabecalho[0])) expect(tc).toMatch(respiro);
    expect(semCabecalho[1]).not.toContain("w:before");

    const soCabecalho = todasAsLinhasXml(
      tabelas((await pacote(tabela([linha(["Região", "Ano"], true)]))).documento)[0],
    );
    expect(soCabecalho.filter(ehLinhaDeRespiro)).toHaveLength(0);
  });

  // Centralizada desde 13/10/2026, cabeçalho e dados: o IBGE não fixa o
  // alinhamento, e os exemplos dele centralizam.
  it("12 pt, entrelinha 1,5, centralizada e sem recuo", async () => {
    const { estilos } = await pacote(TRES_POR_TRES);
    const estilo = estilos.match(
      /<w:style [^>]*w:styleId="CelulaTabela"[^>]*>[\s\S]*?<\/w:style>/,
    )![0];

    expect(estilo).toContain('<w:sz w:val="24"/>');
    expect(estilo).toMatch(/<w:spacing [^>]*w:line="360"/);
    expect(estilo).toContain('<w:jc w:val="center"/>');
    expect(estilo).toMatch(/<w:ind [^>]*w:firstLine="0"/);
  });
});

// Passo 8.5.4 — células mescladas. `w:gridSpan` nas colunas, `w:vMerge` nas
// linhas: a âncora abre a mescla e cada linha de baixo continua. Como o Word
// e o LibreOffice a desenham só se confere abrindo-os (passo 🔍).
describe("células mescladas no .docx (passo 8.5.4)", () => {
  const ancora = (texto: string, extra: Partial<CelulaTabela>): CelulaTabela => ({
    ...celula(texto),
    ...extra,
  });
  const coberta = (): CelulaTabela => ({ cabecalho: false, coberta: true });
  const MESCLADA = tabela(
    [
      {
        celulas: [
          { ...celula("Região", true), rowspan: 2 },
          { ...celula("Ano", true), colspan: 2 },
          { cabecalho: true, coberta: true },
        ],
      },
      { celulas: [{ cabecalho: true, coberta: true }, celula("2020", true), celula("2021", true)] },
      { celulas: [ancora("Sul", { rowspan: 2 }), celula("10"), celula("20")] },
      { celulas: [coberta(), celula("30"), celula("40")] },
    ],
    "Por região",
  );

  it("a âncora leva o gridSpan e o vMerge de início; a de baixo, a continuação", async () => {
    const trs = linhasXml(tabelas((await pacote(MESCLADA)).documento)[0]);
    expect(trs).toHaveLength(4);

    const [topo, segunda, terceira, quarta] = trs.map(celulasXml);
    // Linha 0: Região (início do vMerge), Ano (gridSpan 2). A coberta não sai.
    expect(topo).toHaveLength(2);
    expect(topo[0]).toContain('<w:vMerge w:val="restart"/>');
    expect(topo[1]).toContain('<w:gridSpan w:val="2"/>');
    // Linha 1: a continuação da Região, e as duas colunas do ano.
    expect(segunda).toHaveLength(3);
    expect(segunda[0]).toContain('<w:vMerge w:val="continue"/>');
    expect(segunda[0]).not.toContain(">Região<");
    expect(terceira[0]).toContain('<w:vMerge w:val="restart"/>');
    expect(quarta[0]).toContain('<w:vMerge w:val="continue"/>');
  });

  it("cada linha soma as colunas da grade, e a mescla centraliza na vertical", async () => {
    const tbl = tabelas((await pacote(MESCLADA)).documento)[0];
    for (const tr of linhasXml(tbl)) {
      const colunas = celulasXml(tr).reduce(
        (soma, tc) => soma + Number(/<w:gridSpan w:val="(\d+)"/.exec(tc)?.[1] ?? 1),
        0,
      );
      expect(colunas).toBe(3);
    }
    expect(celulasXml(linhasXml(tbl)[0])[0]).toContain('<w:vAlign w:val="center"/>');
  });

  it("o traço do cabeçalho vai na última linha dele e também na âncora que a termina", async () => {
    const trs = linhasXml(tabelas((await pacote(MESCLADA)).documento)[0]);
    // O cabeçalho tem 2 linhas, e a Região as ocupa as duas. O Word e o
    // LibreOffice não concordam sobre qual célula da mescla manda no traço de
    // baixo; os dois recebem, e o traço não duplica (bordas fundidas).
    const [topo, segunda] = trs.map(celulasXml);
    expect(borda(bordasDaCelula(topo[0]), "bottom")).toBe("single");
    expect(borda(bordasDaCelula(segunda[0]), "bottom")).toBe("single");
    // O "Ano" ocupa só a linha de cima: o traço dele é o das células de baixo.
    expect(borda(bordasDaCelula(topo[1]), "bottom")).toBe("none");
    expect(borda(bordasDaCelula(segunda[1]), "bottom")).toBe("single");
  });

  it("tabela sem mescla continua sem gridSpan nem vMerge", async () => {
    const { documento } = await pacote(TRES_POR_TRES);
    expect(documento).not.toContain("w:gridSpan");
    expect(documento).not.toContain("w:vMerge");
  });
});
