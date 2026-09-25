import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento, NoConteudo, NoInline } from "../../document/types";
import { fromDocumento } from "./fromDocumento";

// Passo 6.1.3c. Forma da nota pela NBR 14724:2024 §5.2.1 e numeração pela NBR
// 10520:2023 §8, lidas no PDF neste passo. O XML prova o que o arquivo pede;
// onde a nota cai na página e o filete de 5 cm só se conferem no Word.

const texto = (text: string): NoInline => ({ type: "text", text });
const nota = (conteudo: string): NoInline => ({ type: "nota_rodape", texto: conteudo });

async function pacote(...content: NoConteudo[]) {
  const documento: Documento = novoDocumento();
  documento.sections = [{ id: "s1", ordem: 0, nivel: 1, titulo: "Introdução", content }];
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return {
    documento: await zip.file("word/document.xml")!.async("string"),
    notas: (await zip.file("word/footnotes.xml")?.async("string")) ?? "",
    estilos: await zip.file("word/styles.xml")!.async("string"),
  };
}

// As notas do usuário em `footnotes.xml`, sem os dois separadores (-1 e 0)
// que o Word exige ali.
function notasDoAluno(xml: string): string[] {
  return (xml.match(/<w:footnote w:id="\d+"[\s\S]*?<\/w:footnote>/g) ?? []).filter(
    (item) => !/w:id="(-1|0)"/.test(item),
  );
}

function estilo(xml: string, id: string): string {
  return xml.match(new RegExp(`<w:style [^>]*w:styleId="${id}"[\\s\\S]*?</w:style>`))?.[0] ?? "";
}

describe("nota de rodapé no .docx", () => {
  it("a referência fica no ponto da nota, e o texto dela vai para o rodapé", async () => {
    const { documento, notas } = await pacote({
      type: "paragraph",
      content: [texto("O Estatuto"), nota("Lei nº 8.069, de 13 de julho de 1990."), texto(" vale.")],
    });

    const paragrafo = documento.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*O Estatuto[\s\S]*?<\/w:p>/)?.[0];
    expect(paragrafo).toBeDefined();
    // Ordem: texto, referência, texto — a nota não sai como texto no parágrafo.
    const ordem = paragrafo!.match(/O Estatuto|<w:footnoteReference w:id="\d+"\/>| vale\./g);
    expect(ordem).toEqual(["O Estatuto", '<w:footnoteReference w:id="1"/>', " vale."]);
    expect(paragrafo).not.toContain("Lei nº 8.069");

    const [unica] = notasDoAluno(notas);
    expect(unica).toContain('w:id="1"');
    expect(unica).toContain("Lei nº 8.069, de 13 de julho de 1990.");
    expect(unica).toContain('<w:pStyle w:val="FootnoteText"/>');
    // O expoente que o Word numera (`footnoteRef`), e não um número escrito.
    expect(unica).toContain("<w:footnoteRef/>");
    // A tabulação que leva o texto ao recuo deslocado (§5.2.1).
    expect(unica).toContain("<w:tab/>");
  });

  // NBR 10520:2023 §8: "números arábicos sequenciais". O número não é
  // gravado: é o Word que conta as referências, na ordem do documento.
  it("cada nota tem id próprio, e nenhum número é escrito no texto", async () => {
    const { documento, notas } = await pacote(
      { type: "paragraph", content: [texto("Um"), nota("primeira")] },
      { type: "citacao_longa", refId: null, pagina: "", content: [texto("Dois"), nota("segunda")] },
      { type: "paragraph", content: [texto("Três"), nota("terceira")] },
    );

    expect(documento.match(/<w:footnoteReference w:id="(\d+)"\/>/g)).toEqual([
      '<w:footnoteReference w:id="1"/>',
      '<w:footnoteReference w:id="2"/>',
      '<w:footnoteReference w:id="3"/>',
    ]);
    expect(notasDoAluno(notas).map((item) => item.match(/primeira|segunda|terceira/)?.[0])).toEqual(
      ["primeira", "segunda", "terceira"],
    );
    expect(documento).not.toMatch(/<w:vertAlign w:val="superscript"\/><\/w:rPr><w:t[^>]*>\d/);
  });

  it("sem nota no documento, nenhuma nota do aluno no pacote", async () => {
    const { notas } = await pacote({ type: "paragraph", content: [texto("Sem nota.")] });
    expect(notasDoAluno(notas)).toHaveLength(0);
  });

  // NBR 14724:2024 §5.2.1: espaço simples, sem espaço entre as notas, fonte
  // menor, segunda linha abaixo da primeira letra da primeira palavra.
  it("o estilo da nota segue a §5.2.1", async () => {
    const { estilos } = await pacote({ type: "paragraph", content: [texto("x"), nota("y")] });
    const footnote = estilo(estilos, "FootnoteText");

    expect(footnote).toContain('w:line="240"');
    expect(footnote).toMatch(/w:before="0"/);
    expect(footnote).toMatch(/w:after="0"/);
    expect(footnote).toContain('<w:sz w:val="20"/>');
    // Recuo deslocado: esquerda e deslocamento iguais, o expoente na margem.
    const recuo = footnote.match(/<w:ind [^>]*\/>/)?.[0] ?? "";
    const esquerda = recuo.match(/w:left="(\d+)"/)?.[1];
    const deslocado = recuo.match(/w:hanging="(\d+)"/)?.[1];
    expect(esquerda).toBeDefined();
    expect(deslocado).toBe(esquerda);
  });
});
