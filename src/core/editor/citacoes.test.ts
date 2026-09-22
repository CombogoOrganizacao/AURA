import { getSchema } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";

import type { AtributosCitacao } from "../document/types";
import { chamadaDaCitacao } from "../references/citacoes";
import type { ReferenciaLivro } from "../references/types";
import { faixasDeCitacao } from "./citacoes";
import { Citacao } from "./marks/citation";
import { Italico } from "./marks/italico";
import { Negrito } from "./marks/negrito";
import { Documento } from "./nodes/documento";
import { CitacaoLonga } from "./nodes/longQuote";
import { Secao } from "./nodes/section";

const schema = getSchema([
  Documento,
  Paragraph,
  Text,
  Secao,
  CitacaoLonga,
  Negrito,
  Italico,
  Citacao,
]);

const DIRETA: AtributosCitacao = {
  refId: "ref-freire",
  modo: "direta_curta",
  pagina: "68",
  apud: null,
};

function doc(...blocos: ReturnType<typeof schema.node>[]) {
  return schema.node("doc", null, [
    schema.node("secao", { id: "s1", nivel: 1, titulo: "Introdução" }, blocos),
  ]);
}

describe("faixasDeCitacao — onde estão as citações na árvore do editor (4.10)", () => {
  it("acha o trecho marcado, em posições do ProseMirror", () => {
    const citacao = schema.marks.citacao.create(DIRETA);
    const documento = doc(
      schema.node("paragraph", null, [schema.text("Antes "), schema.text("citado", [citacao])]),
    );

    const [faixa] = faixasDeCitacao(documento);
    expect(faixa.tipo).toBe("marca");
    if (faixa.tipo !== "marca") return;
    expect(documento.textBetween(faixa.de, faixa.ate)).toBe("citado");
    expect(faixa.attrs).toEqual(DIRETA);
  });

  it("uma palavra em itálico no meio do excerto não parte a citação", () => {
    const citacao = schema.marks.citacao.create(DIRETA);
    const italico = schema.marks.italico.create();
    const documento = doc(
      schema.node("paragraph", null, [
        schema.text("a educação é ", [citacao]),
        schema.text("sempre", [italico, citacao]),
        schema.text(" política", [citacao]),
      ]),
    );

    const faixas = faixasDeCitacao(documento);
    expect(faixas).toHaveLength(1);
    const [faixa] = faixas;
    if (faixa.tipo !== "marca") throw new Error("esperava marca");
    expect(documento.textBetween(faixa.de, faixa.ate)).toBe("a educação é sempre política");
  });

  it("citação longa ligada: a chamada vai no fim do conteúdo do bloco", () => {
    const documento = doc(
      schema.node("citacao_longa", { refId: "ref-nichols", pagina: "181" }, [
        schema.text("Trecho longo."),
      ]),
    );

    const [faixa] = faixasDeCitacao(documento);
    expect(faixa).toMatchObject({ tipo: "longa", refId: "ref-nichols", pagina: "181" });
    if (faixa.tipo !== "longa") return;
    expect(documento.resolve(faixa.fimDoConteudo).parent.type.name).toBe("citacao_longa");
    expect(documento.textBetween(faixa.fimDoConteudo - 13, faixa.fimDoConteudo)).toBe(
      "Trecho longo.",
    );
  });

  it("citação longa sem referência não tem chamada", () => {
    const documento = doc(
      schema.node("citacao_longa", { refId: null, pagina: "" }, [schema.text("Solta.")]),
    );

    expect(faixasDeCitacao(documento)).toEqual([]);
  });
});

describe("chamadaDaCitacao — o que a tela desenha", () => {
  const FREIRE: ReferenciaLivro = {
    id: "ref-freire",
    type: "book",
    author: [{ family: "Freire", given: "Paulo" }],
    title: "Pedagogia do oprimido",
    issued: { "date-parts": [[1987]] },
  };

  it("a chamada da 10520, a partir da referência", () => {
    expect(chamadaDaCitacao(DIRETA, [FREIRE])).toEqual({
      texto: "(Freire, 1987, p. 68)",
      orfa: false,
    });
  });

  it("referência excluída: aviso no lugar da chamada", () => {
    expect(chamadaDaCitacao(DIRETA, [])).toEqual({ texto: "(referência excluída)", orfa: true });
  });

  it("corrigir a referência muda a chamada, sem tocar na citação", () => {
    const corrigida = { ...FREIRE, issued: { "date-parts": [[1970]] as [number][] } };

    expect(chamadaDaCitacao(DIRETA, [corrigida]).texto).toBe("(Freire, 1970, p. 68)");
  });
});
