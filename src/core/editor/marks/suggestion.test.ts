import { getSchema } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import type { Node as NoPM } from "@tiptap/pm/model";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { fromDocumento, toDocumento } from "../../document/serialize";
import type { AtributosSugestao, EstadoSugestao, Secao } from "../../document/types";
import { Documento } from "../nodes/documento";
import { CitacaoLonga } from "../nodes/longQuote";
import { Secao as SecaoNode } from "../nodes/section";
import { Citacao } from "./citation";
import { Italico } from "./italico";
import { Negrito } from "./negrito";
import {
  aceitarSugestao,
  faixasDaSugestao,
  lerAtributosSugestao,
  naVersaoFinal,
  rejeitarSugestao,
  sugerirInsercao,
  sugerirRemocao,
} from "./suggestion";
import { Sugestao } from "./suggestion";

// Sem DOM, como citation.test.ts: `getSchema` monta só o Schema do
// ProseMirror, e os comandos rodam sobre `EditorState`.
const schema = getSchema([
  Documento,
  Paragraph,
  Text,
  SecaoNode,
  CitacaoLonga,
  Negrito,
  Italico,
  Citacao,
  Sugestao,
]);

function secaoCom(content: Secao["content"]): Secao[] {
  return [{ id: "s1", ordem: 0, nivel: 1, titulo: "Introdução", content }];
}

function paragrafo(texto: string): Secao["content"][number] {
  return { type: "paragraph", content: [{ type: "text", text: texto }] };
}

function estadoCom(content: Secao["content"]): EditorState {
  return EditorState.create({ doc: schema.nodeFromJSON(fromDocumento(secaoCom(content))) });
}

// Posição do ProseMirror onde `trecho` começa no documento.
function posDe(doc: NoPM, trecho: string): number {
  let achada = -1;
  doc.descendants((no, pos) => {
    if (achada >= 0) return false;
    if (!no.isText) return true;
    const indice = no.text!.indexOf(trecho);
    if (indice >= 0) achada = pos + indice;
    return false;
  });
  if (achada < 0) throw new Error(`"${trecho}" não está no documento`);
  return achada;
}

function aplicar(estado: EditorState, comando: (tr: Transaction) => boolean) {
  const tr = estado.tr;
  const mudou = comando(tr);
  return { mudou, estado: estado.apply(tr) };
}

// O texto como sai na versão final: o do aluno, mais o que foi aceito.
function versaoFinal(doc: NoPM): string {
  let texto = "";
  doc.descendants((no) => {
    if (!no.isText) return true;
    const marca = no.marks.find((item) => item.type.name === "sugestao");
    if (!marca || naVersaoFinal(marca.attrs as AtributosSugestao)) texto += no.text;
    return false;
  });
  return texto;
}

// Canônico → editor → canônico, passando pelo schema real.
function idaEVolta(secoes: Secao[]): Secao[] {
  const no = schema.nodeFromJSON(fromDocumento(secoes));
  no.check();
  return toDocumento(no.toJSON());
}

// "O método é bom" → "O método é adequado": a remoção de "bom" e a inserção
// de "adequado", com o mesmo id.
function comSubstituicao() {
  let estado = estadoCom([paragrafo("O método é bom.")]);
  const inicio = posDe(estado.doc, "bom");
  estado = aplicar(estado, (tr) => sugerirRemocao(tr, inicio, inicio + 3, "sug-1")).estado;
  estado = aplicar(estado, (tr) => sugerirInsercao(tr, inicio + 3, "adequado", "sug-1")).estado;
  return estado;
}

describe("marca sugestao — criar (6.5.1)", () => {
  it("a sugestão nasce pendente, com id, tipo e estado e nada mais", () => {
    const estado = comSubstituicao();
    const faixas = faixasDaSugestao(estado.doc, "sug-1");

    expect(faixas.map((faixa) => faixa.attrs)).toEqual([
      { id: "sug-1", tipo: "remocao", estado: "pendente" },
      { id: "sug-1", tipo: "insercao", estado: "pendente" },
    ]);
    expect(estado.doc.textBetween(faixas[0].de, faixas[0].ate)).toBe("bom");
    expect(estado.doc.textBetween(faixas[1].de, faixas[1].ate)).toBe("adequado");
  });

  it("pendente, vale o texto do aluno: nada sugerido entra sem decisão", () => {
    expect(versaoFinal(comSubstituicao().doc)).toBe("O método é bom.");
  });

  it("a inserção herda o destaque do ponto onde entra", () => {
    const estado = estadoCom([
      {
        type: "paragraph",
        content: [{ type: "text", text: "in vitro", marks: [{ type: "italico" }] }],
      },
    ]);
    const { estado: depois } = aplicar(estado, (tr) =>
      sugerirInsercao(tr, posDe(estado.doc, " vitro"), " e", "sug-1"),
    );

    const [faixa] = faixasDaSugestao(depois.doc, "sug-1");
    const nomes = depois.doc
      .nodeAt(faixa.de)!
      .marks.map((marca) => marca.type.name)
      .sort();
    expect(nomes).toEqual(["italico", "sugestao"]);
  });

  it("digitar logo depois da sugestão não estende a marca", () => {
    expect(schema.marks.sugestao.spec.inclusive).toBe(false);
  });

  it("um trecho que já tem sugestão não recebe outra por cima", () => {
    const estado = comSubstituicao();
    const inicio = posDe(estado.doc, "bom");

    // Por cima, a nova apagaria a anterior em silêncio.
    expect(aplicar(estado, (tr) => sugerirRemocao(tr, inicio, inicio + 3, "sug-2")).mudou).toBe(
      false,
    );
    expect(
      aplicar(estado, (tr) => sugerirInsercao(tr, inicio + 1, "x", "sug-2")).mudou,
    ).toBe(false);
  });

  it("a citação longa, transcrição literal, não recebe sugestão", () => {
    const estado = estadoCom([
      { type: "citacao_longa", refId: null, pagina: "", content: [{ type: "text", text: "texto citado" }] },
    ]);
    const inicio = posDe(estado.doc, "citado");

    expect(aplicar(estado, (tr) => sugerirRemocao(tr, inicio, inicio + 6, "sug-1")).mudou).toBe(
      false,
    );
    expect(aplicar(estado, (tr) => sugerirInsercao(tr, inicio, "bem ", "sug-1")).mudou).toBe(false);
  });

  it("recusa id vazio, texto vazio e trecho vazio", () => {
    const estado = estadoCom([paragrafo("abc")]);
    const inicio = posDe(estado.doc, "abc");

    expect(aplicar(estado, (tr) => sugerirInsercao(tr, inicio, "x", "")).mudou).toBe(false);
    expect(aplicar(estado, (tr) => sugerirInsercao(tr, inicio, "", "sug-1")).mudou).toBe(false);
    expect(aplicar(estado, (tr) => sugerirRemocao(tr, inicio, inicio, "sug-1")).mudou).toBe(false);
  });
});

describe("marca sugestao — aceitar e rejeitar (6.5.1)", () => {
  it("aceitar muda o estado das duas metades e o texto continua no documento", () => {
    const { mudou, estado } = aplicar(comSubstituicao(), (tr) => aceitarSugestao(tr, "sug-1"));

    expect(mudou).toBe(true);
    expect(faixasDaSugestao(estado.doc, "sug-1").map((faixa) => faixa.attrs.estado)).toEqual([
      "aceita",
      "aceita",
    ]);
    // Decidir não é aplicar: os dois textos seguem marcados no documento.
    expect(estado.doc.textContent).toBe("O método é bomadequado.");
    expect(versaoFinal(estado.doc)).toBe("O método é adequado.");
  });

  it("rejeitar mantém o texto do aluno na versão final", () => {
    const { mudou, estado } = aplicar(comSubstituicao(), (tr) => rejeitarSugestao(tr, "sug-1"));

    expect(mudou).toBe(true);
    expect(faixasDaSugestao(estado.doc, "sug-1").map((faixa) => faixa.attrs.estado)).toEqual([
      "rejeitada",
      "rejeitada",
    ]);
    expect(versaoFinal(estado.doc)).toBe("O método é bom.");
  });

  it("a decisão pode ser revista", () => {
    let estado = aplicar(comSubstituicao(), (tr) => rejeitarSugestao(tr, "sug-1")).estado;
    estado = aplicar(estado, (tr) => aceitarSugestao(tr, "sug-1")).estado;

    expect(versaoFinal(estado.doc)).toBe("O método é adequado.");
  });

  it("decidir uma sugestão não toca nas outras", () => {
    let estado = comSubstituicao();
    const fim = posDe(estado.doc, ".");
    estado = aplicar(estado, (tr) => sugerirInsercao(tr, fim, " para o estudo", "sug-2")).estado;
    estado = aplicar(estado, (tr) => aceitarSugestao(tr, "sug-2")).estado;

    expect(faixasDaSugestao(estado.doc, "sug-1").map((faixa) => faixa.attrs.estado)).toEqual([
      "pendente",
      "pendente",
    ]);
    expect(versaoFinal(estado.doc)).toBe("O método é bom para o estudo.");
  });

  it("sem mudança, devolve false: id desconhecido ou já no estado pedido", () => {
    const estado = aplicar(comSubstituicao(), (tr) => aceitarSugestao(tr, "sug-1")).estado;

    expect(aplicar(estado, (tr) => aceitarSugestao(tr, "sug-1")).mudou).toBe(false);
    expect(aplicar(estado, (tr) => rejeitarSugestao(tr, "nao-existe")).mudou).toBe(false);
  });

  it.each<[AtributosSugestao["tipo"], EstadoSugestao, boolean]>([
    ["insercao", "pendente", false],
    ["insercao", "aceita", true],
    ["insercao", "rejeitada", false],
    ["remocao", "pendente", true],
    ["remocao", "aceita", false],
    ["remocao", "rejeitada", true],
  ])("%s %s está na versão final? %s", (tipo, estado, esperado) => {
    expect(naVersaoFinal({ id: "x", tipo, estado })).toBe(esperado);
  });
});

describe("marca sugestao — o round-trip preserva o estado (6.5.1)", () => {
  it.each<EstadoSugestao>(["pendente", "aceita", "rejeitada"])("%s", (estado) => {
    const secoes = secaoCom([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "O método é " },
          { type: "text", text: "bom", marks: [{ type: "sugestao", attrs: { id: "sug-1", tipo: "remocao", estado } }] },
          {
            type: "text",
            text: "adequado",
            marks: [{ type: "sugestao", attrs: { id: "sug-1", tipo: "insercao", estado } }],
          },
          { type: "text", text: "." },
        ],
      },
    ]);

    expect(idaEVolta(secoes)).toEqual(secoes);
  });

  it("o estado decidido no editor chega ao canônico", () => {
    const estado = aplicar(comSubstituicao(), (tr) => aceitarSugestao(tr, "sug-1")).estado;
    const [paragrafoSalvo] = toDocumento(estado.doc.toJSON())[0].content;

    expect(paragrafoSalvo).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "O método é " },
        {
          type: "text",
          text: "bom",
          marks: [{ type: "sugestao", attrs: { id: "sug-1", tipo: "remocao", estado: "aceita" } }],
        },
        {
          type: "text",
          text: "adequado",
          marks: [{ type: "sugestao", attrs: { id: "sug-1", tipo: "insercao", estado: "aceita" } }],
        },
        { type: "text", text: "." },
      ],
    });
  });

  it("convive com negrito, itálico e citação", () => {
    const secoes = secaoCom([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "trecho",
            marks: [
              { type: "italico" },
              { type: "citacao", attrs: { refId: "ref-1", modo: "indireta", pagina: null, apud: null } },
              { type: "sugestao", attrs: { id: "sug-1", tipo: "remocao", estado: "pendente" } },
            ],
          },
        ],
      },
    ]);

    expect(idaEVolta(secoes)).toEqual(secoes);
  });
});

describe("marca sugestao — atributo fora de forma é recusado, não consertado", () => {
  const VALIDA = { id: "sug-1", tipo: "insercao", estado: "pendente" };

  it.each([
    ["sem id", { ...VALIDA, id: null }],
    ["id vazio", { ...VALIDA, id: "" }],
    ["tipo desconhecido", { ...VALIDA, tipo: "substituicao" }],
    ["sem estado", { ...VALIDA, estado: undefined }],
    ["estado desconhecido", { ...VALIDA, estado: "aprovada" }],
    ["não é objeto", "sug-1"],
  ])("%s", (_, attrs) => {
    expect(lerAtributosSugestao(attrs)).toBeNull();
  });

  it("chaves estranhas não passam adiante", () => {
    expect(lerAtributosSugestao({ ...VALIDA, autor: "ia" })).toEqual(VALIDA);
  });

  it("a serialização lança em vez de gravar um estado inventado", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "secao",
          attrs: { id: "s1", nivel: 1, titulo: "T" },
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "x",
                  marks: [{ type: "sugestao", attrs: { id: "sug-1", tipo: "insercao", estado: "aprovada" } }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(() => toDocumento(json)).toThrow(/sugestão/);
  });
});
