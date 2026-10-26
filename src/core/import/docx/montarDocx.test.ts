import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import { PNG_1X1 } from "../../export/latex/__fixtures__/documento";
import type { NoHtmlColado } from "../../editor/paste";
import { lerDocx } from "./lerDocx";
import { montarImportacaoDocx } from "./montarDocx";

function el(tag: string, filhos: NoHtmlColado[], atributos?: Record<string, string>): NoHtmlColado {
  return { tipo: "elemento", tag, ...(atributos ? { atributos } : {}), filhos };
}
const t = (texto: string): NoHtmlColado => ({ tipo: "texto", texto });

function sequencia() {
  let n = 0;
  return () => `id-${++n}`;
}

const lido = lerDocx([
  el("h1", [t("Introdução")]),
  el("p", [t("Figura 1 — Com PNG")]),
  el("p", [el("img", [], { src: "imagem-1" })]),
  el("p", [t("Figura 2 — Em EMF")]),
  el("p", [el("img", [], { src: "imagem-2" })]),
]);

describe("montarImportacaoDocx", () => {
  it("a imagem PNG vira imagem da loja, com o id do documento; a de outro formato fica de fora", () => {
    const { documento, relatorio, imagens } = montarImportacaoDocx({
      atual: null,
      lido,
      imagens: new Map([
        ["imagem-1", PNG_1X1],
        // EMF: o formato vetorial do Word, que o AURA não aceita.
        ["imagem-2", Uint8Array.from([0x01, 0x00, 0x00, 0x00, 0x6c, 0x00, 0x00, 0x00])],
      ]),
      gerarId: sequencia(),
    });

    const figuras = documento.sections[0].content;
    expect(figuras).toMatchObject([
      { type: "figura", legenda: "Com PNG", imagem: imagens[0].id },
      { type: "figura", legenda: "Em EMF", imagem: null },
    ]);
    expect(figuras.some((figura) => "caminho" in figura)).toBe(false);
    expect(imagens).toEqual([
      {
        id: imagens[0].id,
        documentoId: documento.id,
        formato: "png",
        largura: 1,
        altura: 1,
        bytes: PNG_1X1,
      },
    ]);
    expect(relatorio.avisos.map((aviso) => aviso.mensagem)).toContain(
      "A figura “Em EMF” entrou sem imagem: o AURA aceita PNG e JPEG, e a imagem está em outro formato (no Word, é comum vir em EMF, WMF ou GIF). Salve a imagem como PNG e inclua na figura.",
    );
  });

  it("no trabalho aberto, as imagens ganham o id dele", () => {
    const atual = novoDocumento();
    const { documento, imagens } = montarImportacaoDocx({
      atual,
      lido,
      imagens: new Map([["imagem-1", PNG_1X1]]),
    });
    expect(documento.id).toBe(atual.id);
    expect(imagens.map((imagem) => imagem.documentoId)).toEqual([atual.id]);
  });

  it("imagem acima de 5 MB não entra, e o aviso diz o motivo", () => {
    const grande = new Uint8Array(5 * 1024 * 1024 + 1);
    grande.set(PNG_1X1);
    const { imagens, relatorio } = montarImportacaoDocx({
      atual: null,
      lido,
      imagens: new Map([["imagem-1", grande]]),
    });
    expect(imagens).toEqual([]);
    expect(relatorio.avisos.map((aviso) => aviso.mensagem).join("\n")).toContain("passa de 5 MB");
  });
});
