import { AllSelection, EditorState } from "@tiptap/pm/state";
import { getSchema } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";

import { Secao } from "./section";
import { Documento } from "./documento";

// Sem `EditorView`/DOM — só `Schema` e `EditorState`, o mesmo padrão de
// `section.test.ts`. `filterTransaction` roda sobre `EditorState`, então
// dá pra testar aqui em `src/core` sem montar um editor de verdade.
const schema = getSchema([Documento, Paragraph, Text, Secao]);

// `EditorState.create({ doc })` sozinho não pluga o `filterTransaction` de
// `Documento` — plugins de extensão só se conectam automaticamente através
// do `Editor`/`useEditor` inteiro, que exige `EditorView`/DOM (fora do
// alcance de `src/core`, ver CLAUDE.md). Chamar `addProseMirrorPlugins()`
// direto do `.config` da extensão é o mesmo plugin que o editor real usa —
// não uma reimplementação paralela da regra que o teste deveria proteger.
// A assinatura espera um `this` de extensão resolvida (`editor`, `type`...)
// que só existe dentro do `Editor` de verdade; o plugin em si não lê nada
// disso, então o `as never` é só pra passar pelo tipo, não pra imitá-lo.
const plugins = Documento.config.addProseMirrorPlugins!.call(Documento as never);

function estadoComUmaSecao() {
  const secao = schema.nodes.secao.create(
    { id: "s1", nivel: 1, titulo: "" },
    schema.nodes.paragraph.create(null, schema.text("abc")),
  );
  const doc = schema.nodes.doc.create(null, [secao]);
  return EditorState.create({ doc, plugins });
}

describe("nó documento — guarda contra seção sem id", () => {
  it("aceita uma transação normal (digitar dentro da seção)", () => {
    const estado = estadoComUmaSecao();
    // Posição 1: dentro do parágrafo, antes do "a" de "abc".
    const transacao = estado.tr.insertText("x", 1);
    const novoEstado = estado.apply(transacao);
    expect(novoEstado.doc.textContent).toBe("xabc");
  });

  it("recusa uma transação que substituiria a seção por um bloco sem id", () => {
    const estado = estadoComUmaSecao();

    // Reproduz exatamente o que `Mod-a` faz — `AllSelection`, o mesmo tipo
    // que o comando `selectAll` de `@tiptap/core` usa (não uma
    // `TextSelection` cobrindo o documento inteiro, que é outra coisa e
    // nem reproduz o bug). Selecionar tudo com `AllSelection` e digitar
    // por cima substitui o conteúdo do `doc` inteiro — incluindo o nó
    // `secao`, não só o texto de dentro — e o `createAndFill()` do
    // ProseMirror preenche o resultado com um `secao` de `id: null` pra
    // satisfazer `content: "secao+"`.
    const selecaoInteira = new AllSelection(estado.doc);
    const transacao = estado.tr.setSelection(selecaoInteira).insertText("x");

    // A transação foi CONSTRUÍDA (o ProseMirror não impede isso na hora de
    // montar), mas `EditorState.apply` roda os plugins, incluindo o
    // `filterTransaction` de `documento.ts` — é ali que a rejeição
    // acontece.
    const novoEstado = estado.apply(transacao);

    // Sem o guarda, `novoEstado.doc` teria uma seção com `id: null` (o bug
    // real, achado ao vivo testando o passo 2B.12). Com o guarda, a
    // transação é recusada e o estado não muda.
    expect(novoEstado.doc).toBe(estado.doc);
  });
});
