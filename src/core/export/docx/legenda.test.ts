import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento, NoConteudo } from "../../document/types";
import { fromDocumento } from "./fromDocumento";

async function documentXmlDe(content: NoConteudo[]): Promise<string> {
  const documento: Documento = novoDocumento();
  documento.sections = [{ id: "s1", ordem: 0, nivel: 1, titulo: "Resultados", content }];

  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return zip.file("word/document.xml")!.async("string");
}

function figura(id: string, legenda = "", fonte = ""): NoConteudo {
  return { type: "figura", id, legenda, fonte, imagem: null };
}

describe("legenda de figura/tabela no .docx (passo 3.6.3)", () => {
  // O número é campo `SEQ`, não texto — mesmo raciocínio do campo `TOC` no
  // sumário (3.6.2): quem conta é o Word, então inserir uma figura no meio do
  // arquivo JÁ EXPORTADO renumera as seguintes sem reexportar nada.
  it("o número é um campo SEQ, não um número escrito pelo exportador", async () => {
    const xml = await documentXmlDe([figura("f1", "Fluxo do processo")]);

    expect(xml).toMatch(/<w:fldSimple w:instr="SEQ Figura \\\* ARABIC">/);
    expect(xml).toContain("Fluxo do processo");
    // O "1" não é texto da legenda: fica DENTRO do campo, como resultado em
    // cache. "Figura 1" como string contígua continua não existindo no XML —
    // se existisse, seria um número gravado, o que docs/schema-tiptap.md §2
    // proíbe, e o Word não teria o que renumerar.
    expect(xml).not.toContain("Figura 1");
  });

  // O motivo de o cache existir (ver o cabeçalho de `legenda.ts`): sem ele, o
  // campo é gravado vazio e o `TOC \c "Tabela"` da lista — que vem ANTES do
  // corpo — monta a entrada sem o número, porque o Word atualiza os campos em
  // ordem de documento.
  it("o campo SEQ guarda o número derivado como resultado em cache", async () => {
    const xml = await documentXmlDe([figura("f1", "Primeira"), figura("f2", "Segunda")]);

    expect(xml).toMatch(/<w:fldSimple w:instr="SEQ Figura[^"]*"><w:r><w:t[^>]*>1<\/w:t>/);
    expect(xml).toMatch(/<w:fldSimple w:instr="SEQ Figura[^"]*"><w:r><w:t[^>]*>2<\/w:t>/);
    // Nunca `<w:fldChar separate/>` seguido direto de `<w:fldChar end/>`, que
    // é o campo sem resultado nenhum que causava o defeito.
    expect(xml).not.toMatch(/fldCharType="separate"\/><w:fldChar w:fldCharType="end"/);
  });

  // O número da legenda no `.docx` e o número na tela vêm da MESMA função
  // (`numerarFiguras()`), e é isso que impede os dois de divergirem.
  it("a contagem do cache é a contagem derivada, contínua no documento", async () => {
    const xml = await documentXmlDe([
      figura("f1"),
      { type: "tabela", id: "t1", legenda: "", fonte: "", linhas: [] },
      figura("f2"),
    ]);

    // A tabela no meio não avança a contagem das figuras: sequências
    // separadas, como `numerarFiguras()`/`numerarTabelas()` já garantiam.
    expect(xml).toMatch(/<w:fldSimple w:instr="SEQ Figura[^"]*"><w:r><w:t[^>]*>2<\/w:t>/);
    expect(xml).toMatch(/<w:fldSimple w:instr="SEQ Tabela[^"]*"><w:r><w:t[^>]*>1<\/w:t>/);
  });

  it("legenda e fonte usam o estilo nomeado Legenda, não tamanho solto no run", async () => {
    const xml = await documentXmlDe([figura("f1", "Fluxo", "IBGE (2024)")]);

    // Duas ocorrências: a legenda e a linha "Fonte:". O tamanho menor vem do
    // estilo (`styles.ts`) — é o que faz o número dentro do campo sair no
    // mesmo corpo do resto da legenda.
    expect(xml.match(/<w:pStyle w:val="Legenda"\/>/g)).toHaveLength(2);
  });

  it("figura e tabela usam sequências SEQ distintas", async () => {
    const xml = await documentXmlDe([
      figura("f1"),
      { type: "tabela", id: "t1", legenda: "", fonte: "", linhas: [] },
    ]);

    expect(xml).toMatch(/SEQ Figura/);
    expect(xml).toMatch(/SEQ Tabela/);
  });

  // Ancorado no início de um `<w:t>`: o travessão do placeholder da capa
  // ("Capa — metadados chegam...") também é um " — " solto no XML, e casar
  // por substring nua encontraria aquele em vez deste.
  it("o travessão e o título só saem quando há legenda digitada", async () => {
    expect(await documentXmlDe([figura("f1", "Fluxo")])).toMatch(/<w:t[^>]*> — Fluxo</);
    expect(await documentXmlDe([figura("f1")])).not.toMatch(/<w:t[^>]*> — /);
  });

  it("omite a linha Fonte quando o campo está vazio, e a escreve quando não está", async () => {
    expect(await documentXmlDe([figura("f1", "Fluxo", "IBGE (2024)")])).toContain(
      "Fonte: IBGE (2024)",
    );
    expect(await documentXmlDe([figura("f1", "Fluxo")])).not.toContain("Fonte:");
  });

  // Legenda ACIMA, fonte ABAIXO. Convenção corrente, não regra conferida na
  // fonte primária — ver o cabeçalho de `document/elements/legenda.ts`.
  it("a legenda vem antes do objeto e a fonte depois", async () => {
    const xml = await documentXmlDe([figura("f1", "Fluxo do processo", "IBGE (2024)")]);

    expect(xml.indexOf("Fluxo do processo")).toBeLessThan(xml.indexOf("espaço reservado"));
    expect(xml.indexOf("espaço reservado")).toBeLessThan(xml.indexOf("Fonte: IBGE (2024)"));
  });

  // O que este passo NÃO entrega, dito por teste para ninguém supor o
  // contrário: a imagem em `word/media/` é 6.1.2 e a grade OOXML é 6.1.3.
  it("figura e tabela saem com placeholder no lugar do objeto, não em silêncio", async () => {
    const xml = await documentXmlDe([
      figura("f1", "Fluxo"),
      { type: "tabela", id: "t1", legenda: "Faixas", fonte: "", linhas: [] },
    ]);

    expect(xml).toContain("espaço reservado para a imagem");
    expect(xml).toContain("grade da tabela ainda não exportada");
  });
});
