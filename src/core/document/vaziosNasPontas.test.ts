import { describe, expect, it } from "vitest";

import type { NoConteudo } from "./types";
import { semVaziosNasPontas } from "./vaziosNasPontas";

const vazio: NoConteudo = { type: "paragraph" };
const branco: NoConteudo = { type: "paragraph", content: [{ type: "text", text: "   " }] };
const texto = (t: string): NoConteudo => ({ type: "paragraph", content: [{ type: "text", text: t }] });

describe("semVaziosNasPontas", () => {
  it("seção só com o parágrafo vazio do editor: não sobra nada", () => {
    expect(semVaziosNasPontas([vazio])).toEqual([]);
  });

  it("tira os vazios do começo e do fim, inclusive os só com espaços", () => {
    expect(semVaziosNasPontas([vazio, branco, texto("A"), vazio])).toEqual([texto("A")]);
  });

  it("mantém o vazio do meio, que a pessoa pôs", () => {
    expect(semVaziosNasPontas([texto("A"), vazio, texto("B")])).toEqual([
      texto("A"),
      vazio,
      texto("B"),
    ]);
  });

  it("parágrafo só com nota de rodapé não é vazio", () => {
    const comNota: NoConteudo = {
      type: "paragraph",
      content: [{ type: "nota_rodape", texto: "Nota." }],
    };
    expect(semVaziosNasPontas([comNota])).toEqual([comNota]);
  });

  it("figura, tabela e citação nunca saem", () => {
    const citacao: NoConteudo = { type: "citacao_longa", refId: null, pagina: "" };
    expect(semVaziosNasPontas([citacao])).toEqual([citacao]);
  });
});
