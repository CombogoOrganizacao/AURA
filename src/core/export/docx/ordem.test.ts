import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import { ORDEM_CANONICA } from "../../document/order";
import type { Documento } from "../../document/types";
import { fromDocumento } from "./fromDocumento";

// O critério de aceite do passo 3.7.2, literal: "Vitest confere a ordem
// completa — capa, folha de rosto, dedicatória, agradecimentos, epígrafe,
// resumo, abstract, listas, sumário, corpo, referências, apêndices, anexos".
//
// Um documento com TODOS os elementos preenchidos, exportado de verdade, e a
// ordem lida do XML. Cada elemento é procurado por um trecho que só ele tem —
// título e autor aparecem na capa E na folha de rosto, então nenhum dos dois
// serve de marcador.

function documentoCompleto(): Documento {
  const documento = novoDocumento();

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
  };

  documento.sections = [
    {
      id: "s1",
      ordem: 0,
      nivel: 1,
      titulo: "Introdução",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A ABNT define o formato." }] },
        { type: "figura", id: "f1", legenda: "Fluxo do processo", fonte: "", imagem: null },
        { type: "tabela", id: "t1", legenda: "Amostra coletada", fonte: "", linhas: [] },
      ],
    },
  ];

  documento.references = [
    { id: "r1", type: "book", title: "Um livro qualquer" },
  ];

  documento.apendices = [
    { id: "ap1", titulo: "Questionário aplicado", content: [] },
  ];
  documento.anexos = [{ id: "an1", titulo: "Parecer do comitê", content: [] }];

  return documento;
}

async function documentXml(documento: Documento): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento)));
  return zip.file("word/document.xml")!.async("string");
}

// Um marcador por elemento da ordem canônica — `Record` completo de
// propósito: acrescentar um elemento em `order.ts` e esquecer de conferi-lo
// aqui vira erro de tipo, não um teste que passa sem olhar nada.
const MARCADOR: Record<(typeof ORDEM_CANONICA)[number], string> = {
  // Só a capa traz o nome da instituição como linha própria (na folha de
  // rosto ele vive dentro da nota de natureza) — ver `elements/capa.ts`.
  capa: "Universidade Católica de Pernambuco",
  folhaDeRosto: "Trabalho de Conclusão de Curso apresentado ao curso de X.",
  dedicatoria: "À minha família.",
  agradecimentos: "AGRADECIMENTOS",
  epigrafe: "Uma citação qualquer.",
  resumo: "RESUMO",
  abstract: "ABSTRACT",
  listaDeFiguras: "LISTA DE FIGURAS",
  listaDeTabelas: "LISTA DE TABELAS",
  listaDeAbreviaturas: "LISTA DE ABREVIATURAS E SIGLAS",
  sumario: "SUMÁRIO",
  corpo: "A ABNT define o formato.",
  referencias: "REFERÊNCIAS",
  apendices: "APÊNDICE A",
  anexos: "ANEXO A",
};

describe("ordem canônica no .docx (passo 3.7.2)", () => {
  it("todos os elementos saem, e na ordem de ORDEM_CANONICA", async () => {
    const xml = await documentXml(documentoCompleto());

    const posicoes = ORDEM_CANONICA.map((elemento) => ({
      elemento,
      posicao: xml.indexOf(MARCADOR[elemento]),
    }));

    // Primeiro: cada um saiu. Um `-1` aqui seria elemento que sumiu do
    // arquivo, e a asserção de ordem abaixo o esconderia (todos os `-1`
    // empatam).
    for (const { elemento, posicao } of posicoes) {
      expect(posicao, `elemento ausente do .docx: ${elemento}`).toBeGreaterThan(-1);
    }

    expect(posicoes.map(({ elemento }) => elemento)).toEqual(
      [...posicoes].sort((a, b) => a.posicao - b.posicao).map(({ elemento }) => elemento),
    );
  });

  // A ordem do arquivo é a da constante, não uma sequência escrita à mão no
  // exportador: a lista de elementos conferidos acima É `ORDEM_CANONICA`.
  it("a capa fica na primeira seção OOXML, sozinha e fora da contagem", async () => {
    const xml = await documentXml(documentoCompleto());

    const primeiroSectPr = xml.indexOf("<w:sectPr");
    expect(xml.indexOf(MARCADOR.capa)).toBeLessThan(primeiroSectPr);
    // A folha de rosto abre a SEGUNDA seção: é ela que conta como página 1.
    expect(xml.indexOf(MARCADOR.folhaDeRosto)).toBeGreaterThan(primeiroSectPr);
  });

  it("apêndices e anexos abrem em página própria, depois do corpo", async () => {
    const xml = await documentXml(documentoCompleto());

    const entreCorpoEApendice = xml.slice(
      xml.indexOf(MARCADOR.corpo),
      xml.indexOf(MARCADOR.apendices),
    );
    const entreApendiceEAnexo = xml.slice(
      xml.indexOf(MARCADOR.apendices),
      xml.indexOf(MARCADOR.anexos),
    );

    expect(entreCorpoEApendice).toMatch(/<w:br w:type="page"\s*\/>/);
    expect(entreApendiceEAnexo).toMatch(/<w:br w:type="page"\s*\/>/);
  });

  // Documento em branco não pode virar um trabalho cheio de títulos vazios —
  // é a mesma regra que `paragrafosResumo()` já seguia, agora valendo para a
  // ordem inteira.
  it("documento vazio não fabrica elemento nenhum", async () => {
    const xml = await documentXml(novoDocumento());

    for (const titulo of [
      "RESUMO",
      "ABSTRACT",
      "LISTA DE FIGURAS",
      "LISTA DE TABELAS",
      "LISTA DE ABREVIATURAS E SIGLAS",
      "REFERÊNCIAS",
      "APÊNDICE",
      "ANEXO",
      "AGRADECIMENTOS",
    ]) {
      expect(xml, `elemento fabricado sem dado: ${titulo}`).not.toContain(titulo);
    }

    // O sumário é a exceção: é campo `TOC`, existe mesmo sem seção nenhuma
    // para listar, e é o Word que o preenche (3.6.2).
    expect(xml).toContain("SUMÁRIO");
  });

  it("referências cadastradas não somem em silêncio antes do passo 4.11", async () => {
    const documento = documentoCompleto();
    const xml = await documentXml(documento);

    expect(xml).toContain("REFERÊNCIAS");
    expect(xml).toContain("formatação ABNT ainda não exportada");
  });
});
