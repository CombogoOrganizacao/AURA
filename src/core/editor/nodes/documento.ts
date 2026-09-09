import TiptapDocument from "@tiptap/extension-document";
import { Plugin } from "@tiptap/pm/state";

// Nó raiz do editor — ver docs/schema-tiptap.md §3: "doc — conteúdo: um ou
// mais `secao`. Não existe parágrafo solto fora de uma seção." Essa regra
// já estava documentada, mas nunca chegou a virar `content` de verdade —
// `Editor.tsx` importava o `Document` de fábrica do TipTap, cujo `content`
// padrão é `"block+"` (qualquer nó do grupo `block`, incluindo `paragraph`
// solto).
//
// **Achado ao vivo, testando o passo 2B.12**: `Ctrl+A` (selecionar tudo,
// atalho nativo do TipTap — nenhum código deste projeto o registra)
// seleciona o `doc` inteiro, não o texto de dentro da seção. Digitar por
// cima dessa seleção substitui a seção junto com o texto, e o ProseMirror
// precisa recriar uma seção do nada pra abrigar o que foi digitado —
// via `createAndFill()`, chamado sem atributos explícitos. Isso expôs uma
// característica não-óbvia do `NodeType.create`/`createAndFill` do
// ProseMirror: chamado **sem nenhum argumento**, `attrs` vira `null`, não
// `undefined` — e a checagem interna de atributo obrigatório
// (`_computeAttrs`) só dispara em `undefined`. Resultado: mesmo um `id`
// sem `default` (marcado `isRequired: true` em `section.ts`) não impede a
// seção fantasma de nascer com `id: null`. `toDocumento()`
// (src/core/document/serialize.ts) rejeita isso ("Seção sem id"), mas
// tarde: a rejeição roda depois que a transação já foi aplicada ao editor,
// então a digitação da pessoa se perde sem `onSectionsChange` disparar.
//
// A correção real é impedir a transação de se aplicar, não só detectar o
// resultado depois: um plugin ProseMirror com `filterTransaction` recusa,
// **antes de qualquer render**, qualquer transação cujo documento
// resultante tenha uma seção sem id — o editor simplesmente ignora a
// tecla nesse caso específico (comportamento seguro; não é a experiência
// ideal de "selecionar tudo" cruzar seção, que fica para quando a Fase 3.2
// trouxer edição estrutural de seções, mas garante que o documento nunca
// entra num estado que a conversão para o formato canônico rejeitaria).
export const Documento = TiptapDocument.extend({
  content: "secao+",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        filterTransaction(transacao) {
          const documentoResultante = transacao.doc;
          for (let i = 0; i < documentoResultante.childCount; i++) {
            const filho = documentoResultante.child(i);
            if (filho.type.name === "secao" && !filho.attrs.id) {
              return false;
            }
          }
          return true;
        },
      }),
    ];
  },
});

export default Documento;
