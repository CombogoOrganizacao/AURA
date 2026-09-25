import { getSchema } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { gerarListaDeAbreviaturas } from "../../document/elements/abreviaturas";
import { trechosDoInline } from "../../document/elements/trechos";
import { fromDocumento, toDocumento } from "../../document/serialize";
import type {
  AtributosCitacao,
  Metadados,
  NoInline,
  NoParagrafo,
  Secao,
} from "../../document/types";
import { buscarNoDocumento, substituirTodas } from "../../language/findReplace";
import { textoInline } from "../../rules/checks/percorrer";
import { alvosDasOcorrencias } from "../busca";
import { posicaoNoBloco } from "../localizar";
import { Citacao } from "../marks/citation";
import { Italico } from "../marks/italico";
import { Negrito } from "../marks/negrito";
import { posicoesDasNotas } from "../numbering";
import { Documento } from "./documento";
import { inserirNotaRodape, NotaRodape, podeInserirNota } from "./footnote";
import { CitacaoLonga } from "./longQuote";
import { Secao as SecaoNode } from "./section";
import { CelulaTabela, LinhaTabela, Tabela } from "./table";

// Passo 6.1.3c — a nota de rodapé do editor ao formato canônico, à busca e
// aos trechos da exportação. Só `EditorState`, sem DOM.

const schema = getSchema([
  Documento,
  Paragraph,
  Text,
  SecaoNode,
  CitacaoLonga,
  Tabela,
  LinhaTabela,
  CelulaTabela,
  Negrito,
  Italico,
  Citacao,
  NotaRodape,
]);

const texto = (text: string): NoInline => ({ type: "text", text });
const nota = (conteudo: string): NoInline => ({ type: "nota_rodape", texto: conteudo });

function secoes(...content: Secao["content"]): Secao[] {
  return [{ id: "s1", ordem: 0, nivel: 1, titulo: "Introdução", content }];
}

function documentoDe(sections: Secao[]) {
  return { sections, apendices: [], anexos: [] };
}

function estadoDe(sections: Secao[]) {
  return EditorState.create({ schema, doc: schema.nodeFromJSON(fromDocumento(sections)) });
}

const COM_DUAS_NOTAS = secoes(
  { type: "paragraph", content: [texto("O Estatuto"), nota("Lei 8.069."), texto(" da Criança.")] },
  {
    type: "citacao_longa",
    refId: null,
    pagina: "",
    content: [texto("Citação"), nota("Tradução nossa.")],
  },
);

describe("schema", () => {
  it("é inline e atômica, sem atributo de número", () => {
    const tipo = schema.nodes.nota_rodape;
    expect(tipo.isInline).toBe(true);
    expect(tipo.isAtom).toBe(true);
    expect(Object.keys(tipo.spec.attrs ?? {})).toEqual(["texto"]);
  });

  it("cabe em parágrafo e citação longa, não em célula de tabela", () => {
    const n = schema.nodes.nota_rodape.create({ texto: "x" });
    expect(schema.nodes.paragraph.validContent(schema.nodes.paragraph.create(null, n).content)).toBe(
      true,
    );
    expect(() => schema.nodes.citacao_longa.create(null, n).check()).not.toThrow();
    expect(() => schema.nodes.celula_tabela.create(null, n).check()).toThrow();
  });
});

describe("formato canônico", () => {
  it("faz o round-trip com a nota no lugar e o texto como atributo", () => {
    expect(toDocumento(fromDocumento(COM_DUAS_NOTAS))).toEqual(COM_DUAS_NOTAS);
    const json = fromDocumento(COM_DUAS_NOTAS);
    expect(json.content![0].content![0].content![1]).toEqual({
      type: "nota_rodape",
      attrs: { texto: "Lei 8.069." },
    });
  });
});

describe("inserirNotaRodape", () => {
  it("insere no fim da seleção, sem apagar o trecho selecionado, e deixa a nota selecionada", () => {
    const estado = estadoDe(secoes({ type: "paragraph", content: [texto("Estatuto vale")] }));
    // "Estatuto" selecionado: posições 2..10 (secao 0, paragraph 1).
    const selecionado = estado.apply(
      estado.tr.setSelection(TextSelection.create(estado.doc, 2, 10)),
    );
    const tr = selecionado.tr;

    expect(inserirNotaRodape(tr)).toBe(true);
    const depois = selecionado.apply(tr);
    const [paragrafo] = toDocumento(depois.doc.toJSON())[0].content as NoParagrafo[];
    expect(paragrafo.content).toEqual([texto("Estatuto"), nota(""), texto(" vale")]);
    expect(depois.selection).toBeInstanceOf(NodeSelection);
    expect((depois.selection as NodeSelection).node.type.name).toBe("nota_rodape");
  });

  it("não cabe numa célula de tabela — é o que desliga o botão", () => {
    const estado = estadoDe(
      secoes({
        type: "tabela",
        id: "t1",
        legenda: "",
        fonte: "",
        linhas: [{ celulas: [{ cabecalho: true, content: [{ type: "text", text: "A" }] }] }],
      }),
    );
    let dentro = -1;
    estado.doc.descendants((no, pos) => {
      if (no.type.name === "celula_tabela") dentro = pos + 1;
    });
    const naCelula = estado.apply(estado.tr.setSelection(TextSelection.create(estado.doc, dentro)));

    expect(podeInserirNota(naCelula)).toBe(false);
    expect(inserirNotaRodape(naCelula.tr)).toBe(false);
  });
});

describe("numeração derivada", () => {
  it("segue a ordem de leitura, atravessando parágrafo e citação longa", () => {
    const { doc } = estadoDe(COM_DUAS_NOTAS);
    const posicoes = posicoesDasNotas(doc);
    expect(posicoes).toHaveLength(2);
    expect(posicoes.map((pos) => doc.nodeAt(pos)!.attrs.texto)).toEqual([
      "Lei 8.069.",
      "Tradução nossa.",
    ]);
  });

  it("uma nota inserida antes renumera as seguintes, sem nada gravado", () => {
    const estado = estadoDe(COM_DUAS_NOTAS);
    const noComeco = estado.apply(estado.tr.setSelection(TextSelection.create(estado.doc, 2)));
    const tr = noComeco.tr;
    inserirNotaRodape(tr);
    const { doc } = noComeco.apply(tr);

    expect(posicoesDasNotas(doc).map((pos) => doc.nodeAt(pos)!.attrs.texto)).toEqual([
      "",
      "Lei 8.069.",
      "Tradução nossa.",
    ]);
  });
});

describe("a nota conta zero caracteres no texto do parágrafo", () => {
  it("a conferência lê o parágrafo sem a nota", () => {
    const [paragrafo] = COM_DUAS_NOTAS[0].content as NoParagrafo[];
    expect(textoInline(paragrafo.content)).toBe("O Estatuto da Criança.");
  });

  it("índice de caractere vira posição no editor pulando a nota", () => {
    const { doc } = estadoDe(COM_DUAS_NOTAS);
    const paragrafo = doc.child(0).child(0);
    // "O Estatuto" tem 10 caracteres; a nota ocupa a posição 10.
    expect(posicaoNoBloco(paragrafo, 10, "fim")).toBe(10);
    expect(posicaoNoBloco(paragrafo, 10, "inicio")).toBe(11);
    expect(posicaoNoBloco(paragrafo, 12, "inicio")).toBe(13);
  });

  it("a lista de abreviaturas enxerga a sigla usada só numa nota", () => {
    const content = secoes({
      type: "paragraph",
      content: [texto("Texto."), nota("Conforme a ABNT.")],
    });
    const metadados = {
      abreviaturas: [{ sigla: "ABNT", significado: "Associação Brasileira de Normas Técnicas" }],
    } as unknown as Metadados;

    expect(gerarListaDeAbreviaturas(metadados, content).map((item) => item.sigla)).toEqual([
      "ABNT",
    ]);
  });
});

describe("localizar e substituir", () => {
  it("acha no texto do parágrafo e no texto da nota, que leva a seleção à nota", () => {
    const sections = secoes({
      type: "paragraph",
      content: [texto("O Estatuto"), nota("Ver o Estatuto."), texto(" vale.")],
    });
    const ocorrencias = buscarNoDocumento(documentoDe(sections), "Estatuto");
    expect(ocorrencias.map((ocorrencia) => ocorrencia.campo)).toEqual([
      { tipo: "no", no: 0 },
      { tipo: "nota", no: 0, nota: 0 },
    ]);

    const { doc } = estadoDe(sections);
    const [noTexto, naNota] = alvosDasOcorrencias(doc, ocorrencias);
    expect(noTexto?.alvo === "trecho" && doc.textBetween(noTexto.de, noTexto.ate)).toBe("Estatuto");
    expect(naNota?.alvo === "no" && doc.nodeAt(naNota.posicao)?.type.name).toBe("nota_rodape");
  });

  it("depois de uma nota, o trecho achado no parágrafo ainda é o certo", () => {
    const sections = secoes({
      type: "paragraph",
      content: [texto("Antes"), nota("n"), texto(" depois")],
    });
    const { doc } = estadoDe(sections);
    const [alvo] = alvosDasOcorrencias(doc, buscarNoDocumento(documentoDe(sections), "depois"));
    expect(alvo?.alvo === "trecho" && doc.textBetween(alvo.de, alvo.ate)).toBe("depois");
  });

  it("substituir troca no texto e na nota, e nunca perde a nota", () => {
    const sections = secoes({
      type: "paragraph",
      content: [texto("O Estatuto"), nota("Ver o Estatuto."), texto(" vale.")],
    });
    const { documento, substituidas } = substituirTodas(documentoDe(sections), "Estatuto", "ECA");

    expect(substituidas).toBe(2);
    expect(documento.sections[0].content[0]).toEqual({
      type: "paragraph",
      content: [texto("O ECA"), nota("Ver o ECA."), texto(" vale.")],
    });
  });

  it("uma ocorrência que atravessa a nota troca o texto e mantém a nota logo depois", () => {
    const sections = secoes({
      type: "paragraph",
      content: [texto("pala"), nota("n"), texto("vra solta")],
    });
    const { documento } = substituirTodas(documentoDe(sections), "palavra", "termo");

    expect(documento.sections[0].content[0]).toEqual({
      type: "paragraph",
      content: [texto("termo"), nota("n"), texto(" solta")],
    });
  });
});

describe("trechos da exportação", () => {
  const citacao: AtributosCitacao = {
    refId: "r1",
    modo: "indireta",
    pagina: null,
    apud: null,
  };
  const citado = (text: string): NoInline => ({
    type: "text",
    text,
    marks: [{ type: "citacao", attrs: citacao }],
  });

  it("a nota vira um trecho próprio, no lugar dela", () => {
    const trechos = trechosDoInline([texto("A"), nota("conteúdo"), texto("B")], []);
    expect(trechos.map((trecho) => [trecho.papel, trecho.texto])).toEqual([
      ["texto", "A"],
      ["nota", "conteúdo"],
      ["texto", "B"],
    ]);
  });

  it("nota no meio da citação não a parte em duas", () => {
    const trechos = trechosDoInline([citado("um"), nota("n"), citado(" dois")], []);
    expect(trechos.filter((trecho) => trecho.papel === "chamada")).toHaveLength(1);
    expect(trechos.map((trecho) => trecho.papel)).toEqual(["texto", "nota", "texto", "chamada"]);
  });

  it("nota logo depois da citação sai depois da chamada", () => {
    const trechos = trechosDoInline([citado("um"), nota("n"), texto(" fim")], []);
    expect(trechos.map((trecho) => trecho.papel)).toEqual(["texto", "chamada", "nota", "texto"]);
  });
});
