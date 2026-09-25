import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";

import { CelulaTabela, LinhaTabela, Tabela } from "./table";

const schema = getSchema([Document, Paragraph, Text, Tabela, LinhaTabela, CelulaTabela]);

function celula(texto: string, cabecalho = false) {
  return schema.nodes.celula_tabela.create({ cabecalho }, schema.text(texto));
}

describe("nós tabela / linha_tabela / celula_tabela (passo 3.6.3)", () => {
  it("serializa a grade inteira e sobrevive ao round-trip", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.tabela.create({ id: "t1", legenda: "Faixas", fonte: "IBGE (2024)" }, [
        schema.nodes.linha_tabela.create(null, [celula("Faixa", true), celula("Total", true)]),
        schema.nodes.linha_tabela.create(null, [celula("18–24"), celula("120")]),
      ]),
    ]);

    expect(() => doc.check()).not.toThrow();

    const json = doc.toJSON();
    expect(json.content[0].attrs).toEqual({ id: "t1", legenda: "Faixas", fonte: "IBGE (2024)" });
    expect(json.content[0].content).toHaveLength(2);
    expect(json.content[0].content[0].content[0].attrs).toEqual({ cabecalho: true });

    expect(schema.nodeFromJSON(json).toJSON()).toEqual(json);
  });

  it("não tem atributo de número — 'Tabela 2' é derivado, nunca gravado", () => {
    expect(Object.keys(schema.nodes.tabela.spec.attrs ?? {})).toEqual(["id", "legenda", "fonte"]);
  });

  // `content: "linha_tabela+"` — uma tabela sem linha nenhuma não teria onde
  // receber o cursor, mesma razão pela qual `novaSecao()` nasce com um
  // parágrafo dentro.
  it("exige pelo menos uma linha", () => {
    expect(() =>
      schema.nodes.doc.create(null, [schema.nodes.tabela.create({ id: "t1" })]).check(),
    ).toThrow();
  });

  it("linha e célula não pertencem ao grupo block — não cabem soltas numa seção", () => {
    expect(schema.nodes.linha_tabela.isInGroup("block")).toBe(false);
    expect(schema.nodes.celula_tabela.isInGroup("block")).toBe(false);
  });

  // `celula_tabela` é `inline*`: uma célula que aceitasse blocos aceitaria
  // uma tabela dentro de outra, que a v1 não quer.
  // Nem nota de rodapé (passo 6.1.3c): a tabela tem rodapé próprio (IBGE).
  it("a célula aceita texto com marca, mas não blocos nem nota de rodapé", () => {
    expect(schema.nodes.celula_tabela.spec.content).toBe("text*");
  });

  it("`cabecalho` decide a tag, e é o que a torna acessível a leitor de tela", () => {
    expect(schema.nodes.celula_tabela.create({ cabecalho: false }).attrs).toEqual({
      cabecalho: false,
    });
  });

  it("nasce sem id por default — quem cria é `novaTabela()`, nunca o schema", () => {
    const vazia = schema.nodes.tabela.create(null, [
      schema.nodes.linha_tabela.create(null, [schema.nodes.celula_tabela.create()]),
    ]);

    expect(vazia.attrs).toEqual({ id: null, legenda: "", fonte: "" });
  });
});
