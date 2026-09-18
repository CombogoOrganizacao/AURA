import { Extension } from "@tiptap/core";
import { gapCursor } from "@tiptap/pm/gapcursor";

// Cursor de intervalo (gap cursor) — o cursor fino que aparece ENTRE dois
// blocos onde não existe texto para o cursor normal ocupar.
//
// **Sem ele, um bloco não-textual no fim da seção é um beco sem saída.** Foi
// o defeito relatado: inserida uma tabela no fim do documento, não havia
// onde clicar para escrever depois dela — o ProseMirror não tem posição de
// texto entre o fim da tabela e o fim da seção, então o clique não tinha para
// onde ir. Vale igual para figura e fórmula, que são atômicas (`atom: true`),
// e para duas tabelas seguidas. Com o gap cursor, a seta para baixo e o
// clique na faixa entre os blocos passam a pousar ali, e digitar cria o
// parágrafo sozinho.
//
// É o `prosemirror-gapcursor` oficial, que já vem dentro de `@tiptap/pm` —
// **não** uma dependência nova. Mora em `src/core/editor/` como as outras
// extensões e não importa React nem toca no DOM direto; o CSS do cursor
// (`.ProseMirror-gapcursor`) fica em `app/globals.css`, junto do resto da
// aparência do editor.
//
// `name: "gapCursor"` é o nome que o próprio plugin espera; não traduzido,
// como `history`, por ser identificador de terceiro.
export const CursorDeIntervalo = Extension.create({
  name: "gapCursor",

  addProseMirrorPlugins() {
    return [gapCursor()];
  },
});
