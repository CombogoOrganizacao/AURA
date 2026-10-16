import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novaFigura, novaTabela, novoDocumento } from "../../document/factory";
import type { Documento } from "../../document/types";
import type { ImagemArmazenada } from "../../persistence/types";
import { entrelinha } from "./constants";
import { fromDocumento } from "./fromDocumento";

// Passo 8.2.1. O `lineRule` é opcional no OOXML: o Word lê a falta dele como
// "auto", mas o LibreOffice 24.2 lê como entrelinha FIXA e corta a imagem
// inline à altura de uma linha (conferido abrindo o `.docx` no LibreOffice
// 24.2.3 em 16/10/2026). O teste varre o pacote inteiro, de um documento que
// usa todo tipo de elemento, atrás de um `w:spacing` com `w:line` e sem
// `w:lineRule`. **Não prova que o LibreOffice abre certo**: isso é a
// conferência humana (CLAUDE.md, "Verificação").

const SEM_REGRA = /<w:spacing(?=[^>]*\bw:line=")(?![^>]*\bw:lineRule=)[^>]*\/>/g;

function imagem(): ImagemArmazenada {
  return {
    id: "img1",
    documentoId: "doc",
    formato: "png",
    largura: 640,
    altura: 360,
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
  };
}

function documentoComTudo(): Documento {
  const documento = { ...novoDocumento(), id: "doc" };
  documento.metadados = {
    ...documento.metadados,
    titulo: "A formatação de trabalhos acadêmicos",
    autores: ["Maria da Silva"],
    instituicao: "Universidade Católica de Pernambuco",
    curso: "Ciência da Computação",
    orientador: "João Souza",
    local: "Recife",
    ano: 2026,
    naturezaTrabalho: "Trabalho de Conclusão de Curso apresentado ao curso de X.",
    resumo: "Este trabalho investiga X.",
    palavrasChave: ["formatação"],
    abstract: "This work investigates X.",
    keywords: ["formatting"],
    dedicatoria: { ativo: true, texto: "À minha família." },
    agradecimentos: { ativo: true, texto: "Ao meu orientador." },
    epigrafe: { ativo: true, texto: "Uma citação qualquer." },
    abreviaturas: [
      { id: "a1", sigla: "ABNT", significado: "Associação Brasileira de Normas Técnicas" },
    ],
    bancaExaminadora: [
      { id: "b1", nome: "Ana Lima", titulacao: "Doutora em Educação", instituicao: "UFPE" },
    ],
  };

  const tabela = novaTabela(2, 2);
  tabela.legenda = "Amostra";
  tabela.fonte = "Autoria própria";
  tabela.linhas.forEach((linha) =>
    linha.celulas.forEach((celula) => {
      celula.content = [{ type: "text", text: "dado" }];
    }),
  );

  documento.sections = [
    {
      id: "s1",
      ordem: 0,
      nivel: 1,
      titulo: "Introdução",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A ABNT define o formato." }] },
        { ...novaFigura(), legenda: "Com imagem", fonte: "Autoria própria", imagem: "img1" },
        { ...novaFigura(), legenda: "Sem imagem", fonte: "Autoria própria", imagem: null },
        tabela,
        { type: "formula", texto: "E = mc^2" },
      ],
    },
    { id: "s2", ordem: 1, nivel: 2, titulo: "Método", content: [] },
    { id: "s3", ordem: 2, nivel: 3, titulo: "Instrumentos", content: [] },
  ];
  documento.references = [{ id: "r1", type: "book", title: "Um livro qualquer" }];
  documento.apendices = [
    {
      id: "ap1",
      titulo: "Questionário",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Texto." }] }],
    },
  ];
  documento.anexos = [{ id: "an1", titulo: "Parecer", content: [] }];
  return documento;
}

async function partesXml(): Promise<Record<string, string>> {
  const documento = documentoComTudo();
  const buffer = await Packer.toBuffer(fromDocumento(documento, new Map([["img1", imagem()]])));
  const zip = await JSZip.loadAsync(buffer);
  const partes: Record<string, string> = {};
  for (const nome of Object.keys(zip.files)) {
    if (/^word\/[^/]+\.xml$/.test(nome)) partes[nome] = await zip.file(nome)!.async("string");
  }
  return partes;
}

describe("entrelinha com a regra explícita (passo 8.2.1)", () => {
  it("entrelinha() escreve o múltiplo e a regra auto", () => {
    expect(entrelinha(240)).toEqual({ line: 240, lineRule: "auto" });
    expect(entrelinha(360)).toEqual({ line: 360, lineRule: "auto" });
  });

  it("nenhuma parte do pacote tem w:line sem w:lineRule", async () => {
    const partes = await partesXml();

    // Garante que o documento de teste cobre o que importa: o parágrafo da
    // imagem e a fórmula de bloco, os dois que o LibreOffice cortava.
    expect(partes["word/document.xml"]).toContain("<w:drawing");
    expect(partes["word/document.xml"]).toContain("<m:oMath>");

    for (const [nome, xml] of Object.entries(partes)) {
      expect(xml.match(SEM_REGRA) ?? [], `${nome} tem w:line sem w:lineRule`).toEqual([]);
    }
  });

  it("os valores não mudaram: o parágrafo da imagem segue em entrelinha simples", async () => {
    const xml = (await partesXml())["word/document.xml"];
    const drawing = xml.indexOf("<w:drawing");
    const paragrafo = xml.slice(xml.lastIndexOf("<w:p>", drawing), drawing);

    expect(paragrafo).toContain('w:line="240"');
    expect(paragrafo).toContain('w:lineRule="auto"');
  });

  it("o padrão do documento (docDefaults) segue em 1,5, agora com a regra", async () => {
    const estilos = (await partesXml())["word/styles.xml"];
    const padrao = estilos.match(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/)![0];

    expect(padrao).toContain('w:line="360"');
    expect(padrao).toContain('w:lineRule="auto"');
  });
});
