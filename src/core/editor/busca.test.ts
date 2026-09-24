import { getSchema } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { fromDocumento, toDocumento } from "../document/serialize";
import type { Secao } from "../document/types";
import { buscarNoDocumento, substituirTodas } from "../language/findReplace";
import {
  alvosDasOcorrencias,
  definirRealces,
  pluginRealceBusca,
  realcesDoEstado,
  trocarConteudo,
} from "./busca";
import { Citacao } from "./marks/citation";
import { Italico } from "./marks/italico";
import { Negrito } from "./marks/negrito";
import { Documento } from "./nodes/documento";
import { Figura } from "./nodes/figure";
import { CitacaoLonga } from "./nodes/longQuote";
import { Secao as SecaoNode } from "./nodes/section";
import { CelulaTabela, LinhaTabela, Tabela } from "./nodes/table";

// Passo 5.4.3 — a ponte entre a busca do formato canônico e o editor. Só
// `EditorState`, sem `EditorView` nem DOM, como `localizar.test.ts`.

const schema = getSchema([
  Documento,
  Paragraph,
  Text,
  SecaoNode,
  CitacaoLonga,
  Figura,
  Tabela,
  LinhaTabela,
  CelulaTabela,
  Negrito,
  Italico,
  Citacao,
]);

function texto(t: string) {
  return [{ type: "text" as const, text: t }];
}

const SECOES: Secao[] = [
  {
    id: "s1",
    ordem: 0,
    nivel: 1,
    titulo: "O campo",
    content: [
      { type: "paragraph", content: texto("Um campo de estudo e outro campo.") },
      { type: "figura", id: "f1", legenda: "Mapa do campo", fonte: "Autora", imagem: null },
    ],
  },
  {
    id: "s2",
    ordem: 1,
    nivel: 1,
    titulo: "Resultados",
    content: [
      {
        type: "tabela",
        id: "t1",
        legenda: "",
        fonte: "",
        linhas: [
          {
            celulas: [
              { cabecalho: true, content: texto("Nome") },
              { cabecalho: true, content: texto("Campo") },
            ],
          },
          {
            celulas: [
              { cabecalho: false, content: texto("A") },
              { cabecalho: false, content: texto("o campo sul") },
            ],
          },
        ],
      },
      { type: "citacao_longa", refId: null, pagina: "", content: texto("Citação sobre o campo.") },
    ],
  },
];

function documentoDe(secoes: Secao[]) {
  return {
    id: "d",
    metadados: {} as never,
    sections: secoes,
    references: [],
    apendices: [],
    anexos: [],
  };
}

function docPM(secoes: Secao[]) {
  return schema.nodeFromJSON(fromDocumento(secoes));
}

describe("alvosDasOcorrencias", () => {
  const doc = docPM(SECOES);
  const ocorrencias = buscarNoDocumento(documentoDe(SECOES), "campo");
  const alvos = alvosDasOcorrencias(doc, ocorrencias);

  it("no texto (parágrafo, célula, citação longa), cada alvo seleciona exatamente a palavra achada", () => {
    const trechos = alvos
      .filter((alvo) => alvo?.alvo === "trecho")
      .map((alvo) => alvo!.alvo === "trecho" && doc.textBetween(alvo!.de, alvo!.ate));

    expect(trechos).toEqual(["campo", "campo", "Campo", "campo", "campo"]);
  });

  it("título e legenda, que são atributos, levam ao nó sem trecho", () => {
    const porCampo = ocorrencias.map((ocorrencia, i) => [ocorrencia.campo.tipo, alvos[i]?.alvo]);

    expect(porCampo).toContainEqual(["titulo", "secao"]);
    expect(porCampo).toContainEqual(["legenda", "no"]);
  });

  it("apêndice, sem tela de edição, não tem alvo", () => {
    const [alvo] = alvosDasOcorrencias(doc, [
      { onde: { tipo: "apendice", id: "a1" }, campo: { tipo: "no", no: 0 }, inicio: 0, fim: 1 },
    ]);
    expect(alvo).toBeNull();
  });
});

describe("trocarConteudo", () => {
  it("leva a substituição do formato canônico ao editor, e o editor devolve o mesmo formato", () => {
    const { documento } = substituirTodas(documentoDe(SECOES), "campo", "território");
    const estado = EditorState.create({ schema, doc: docPM(SECOES) });

    const tr = estado.tr;
    expect(trocarConteudo(tr, docPM(documento.sections))).toBe(true);
    const depois = estado.apply(tr);

    expect(toDocumento(depois.doc.toJSON())).toEqual(documento.sections);
  });

  it("troca só o intervalo que mudou: a seção sem ocorrência não é recriada", () => {
    const secoes: Secao[] = [
      { ...SECOES[0] },
      {
        id: "s3",
        ordem: 2,
        nivel: 1,
        titulo: "Fim",
        content: [{ type: "paragraph", content: texto("Nada aqui.") }],
      },
    ];
    const estado = EditorState.create({ schema, doc: docPM(secoes) });
    const ultimaAntes = estado.doc.lastChild;

    const { documento } = substituirTodas(documentoDe(secoes), "campo", "território");
    const tr = estado.tr;
    trocarConteudo(tr, docPM(documento.sections));

    // O mesmo objeto de nó: o ProseMirror reaproveitou o que não mudou.
    expect(estado.apply(tr).doc.lastChild).toBe(ultimaAntes);
    expect(tr.steps).toHaveLength(1);
  });

  it("documento igual: nada a trocar", () => {
    const estado = EditorState.create({ schema, doc: docPM(SECOES) });
    const tr = estado.tr;

    expect(trocarConteudo(tr, docPM(SECOES))).toBe(false);
    expect(tr.docChanged).toBe(false);
  });
});

describe("realce", () => {
  function estadoComRealce() {
    return EditorState.create({ schema, doc: docPM(SECOES), plugins: [pluginRealceBusca()] });
  }

  it("realça por decoração: o documento não muda, e o JSON não leva nada do realce", () => {
    const estado = estadoComRealce();
    const tr = definirRealces(estado.tr, [
      { de: 5, ate: 10, atual: true },
      { de: 20, ate: 25, atual: false },
    ]);
    const depois = estado.apply(tr);

    expect(realcesDoEstado(depois).find()).toHaveLength(2);
    expect(tr.docChanged).toBe(false);
    expect(depois.doc.toJSON()).toEqual(estado.doc.toJSON());
    expect(JSON.stringify(depois.doc.toJSON())).not.toContain("realce");
  });

  it("fica fora do desfazer", () => {
    const tr = definirRealces(estadoComRealce().tr, []);
    expect(tr.getMeta("addToHistory")).toBe(false);
  });

  it("lista vazia apaga os realces", () => {
    let estado = estadoComRealce();
    estado = estado.apply(definirRealces(estado.tr, [{ de: 5, ate: 10, atual: true }]));
    estado = estado.apply(definirRealces(estado.tr, []));

    expect(realcesDoEstado(estado).find()).toHaveLength(0);
  });

  it("digitar antes de um realce o desloca junto com o texto", () => {
    let estado = estadoComRealce();
    estado = estado.apply(definirRealces(estado.tr, [{ de: 10, ate: 15, atual: true }]));
    estado = estado.apply(estado.tr.insertText("xyz", 4));

    const [realce] = realcesDoEstado(estado).find();
    expect([realce.from, realce.to]).toEqual([13, 18]);
  });
});
