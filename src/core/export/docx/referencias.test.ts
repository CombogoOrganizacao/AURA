import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento } from "../../document/types";
import type { Referencia } from "../../references/types";
import { fromDocumento } from "./fromDocumento";

// Critério do passo 4.11: "no .docx, alinhada à esquerda, espaçamento simples,
// linha em branco entre entradas" — NBR 6023:2025 §6.3 e NBR 14724:2024 §5.2.
//
// Isto prova o que o XML diz. **Não substitui abrir o arquivo no Word**
// (CLAUDE.md): a conferência humana do 4.11 fica registrada como pendente.

const REFERENCIAS: Referencia[] = [
  {
    id: "bauman",
    type: "book",
    author: [{ family: "Bauman", given: "Zygmunt" }],
    title: "Globalização",
    subtitle: "as consequências humanas",
    publisher: "Jorge Zahar",
    "publisher-place": "Rio de Janeiro",
    issued: { "date-parts": [[1999]] },
  },
  {
    id: "freire",
    type: "book",
    author: [{ family: "Freire", given: "Paulo" }],
    title: "Pedagogia do oprimido",
    edicao: { numero: 17 },
    publisher: "Paz e Terra",
    "publisher-place": "Rio de Janeiro",
    issued: { "date-parts": [[1987]] },
  },
  {
    id: "alvares",
    type: "book",
    author: [{ family: "Álvares", given: "Ana" }],
    title: "Pesquisa",
    publisher: "Atlas",
    "publisher-place": "São Paulo",
    issued: { "date-parts": [[2020]] },
  },
];

async function xmlCom(references: Referencia[]): Promise<string> {
  const documento: Documento = { ...novoDocumento(), references };
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return zip.file("word/document.xml")!.async("string");
}

async function estiloReferencia(): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(novoDocumento())));
  const estilos = await zip.file("word/styles.xml")!.async("string");
  const bloco = estilos.match(/<w:style [^>]*w:styleId="Referencia"[^>]*>[\s\S]*?<\/w:style>/)?.[0];
  expect(bloco).toBeDefined();
  return bloco!;
}

// Os parágrafos da seção de Referências: do título até o fim do documento
// (sem apêndice nem anexo neste teste, a lista é o último elemento).
function paragrafosDaLista(xml: string): string[] {
  const paragrafos = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  const inicio = paragrafos.findIndex((p) => p.includes(">REFERÊNCIAS<"));
  expect(inicio).toBeGreaterThanOrEqual(0);
  return paragrafos.slice(inicio);
}

function texto(paragrafo: string): string {
  return [...paragrafo.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
}

describe("seção de Referências no .docx (passo 4.11)", () => {
  it("título REFERÊNCIAS no estilo dos pós-textuais — centralizado, e no sumário", async () => {
    const [titulo] = paragrafosDaLista(await xmlCom(REFERENCIAS));

    expect(titulo).toContain('<w:pStyle w:val="TituloPosTextual"/>');
    expect(texto(titulo)).toBe("REFERÊNCIAS");
  });

  it("em ordem alfabética, com uma linha em branco entre as entradas", async () => {
    const [, ...corpo] = paragrafosDaLista(await xmlCom(REFERENCIAS));

    expect(corpo.map(texto)).toEqual([
      "ÁLVARES, Ana. Pesquisa. São Paulo: Atlas, 2020.",
      "",
      "BAUMAN, Zygmunt. Globalização: as consequências humanas. Rio de Janeiro: Jorge Zahar, 1999.",
      "",
      "FREIRE, Paulo. Pedagogia do oprimido. 17. ed. Rio de Janeiro: Paz e Terra, 1987.",
    ]);
  });

  // Desde o 6.1.1 a formatação vem do estilo nomeado `Referencia`, e não de
  // cada parágrafo: o parágrafo aponta para o estilo, e o estilo carrega os
  // valores da norma.
  it("cada parágrafo, entrada ou linha em branco, usa o estilo Referencia", async () => {
    const [, ...corpo] = paragrafosDaLista(await xmlCom(REFERENCIAS));

    for (const paragrafo of corpo) {
      expect(paragrafo).toContain('<w:pStyle w:val="Referencia"/>');
    }
  });

  it("o estilo Referencia é alinhado à esquerda, em espaço simples, sem recuo", async () => {
    const estilo = await estiloReferencia();

    // Espaço simples: linha de 240 twips "auto" = 1,0; nada antes nem depois
    // — a separação é a linha em branco, não um espaçamento.
    expect(estilo).toMatch(/<w:spacing [^>]*w:line="240"/);
    expect(estilo).toMatch(/<w:spacing [^>]*w:before="0"/);
    expect(estilo).toMatch(/<w:spacing [^>]*w:after="0"/);
    expect(estilo).toContain('<w:jc w:val="left"/>');
    expect(estilo).toMatch(/<w:ind [^>]*w:firstLine="0"/);
  });

  it("a linha em branco é UMA, e não sobra uma depois da última entrada", async () => {
    const [, ...corpo] = paragrafosDaLista(await xmlCom(REFERENCIAS));

    const vazios = corpo.map((paragrafo) => texto(paragrafo) === "");
    expect(vazios).toEqual([false, true, false, true, false]);
  });

  it("o título da obra em negrito, e só ele (6023 §6.7, mesmo recurso da tela)", async () => {
    const [, bauman] = paragrafosDaLista(await xmlCom([REFERENCIAS[0]]));

    const runs = bauman.match(/<w:r>[\s\S]*?<\/w:r>/g) ?? [];
    const emNegrito = runs.filter((run) => run.includes("<w:b/>")).map(texto);
    expect(emNegrito).toEqual(["Globalização"]);
  });

  it("sem referência nenhuma, não sai REFERÊNCIAS vazio", async () => {
    const xml = await xmlCom([]);

    expect(xml).not.toContain(">REFERÊNCIAS<");
  });
});
