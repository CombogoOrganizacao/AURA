import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";

import { cursorDepoisDoBloco, faltaLinhaDepois } from "./caret";

// Uma linha para digitar depois de uma tabela, figura ou fórmula que fecha a
// seção (passo 8.1.3).
//
// O cursor de intervalo (`gapcursor.ts`) só pousa entre dois blocos
// "fechados". Uma tabela no fim de uma seção que tem outra seção depois não
// atende a isso, e entre as duas não existe faixa em branco para clicar: a
// margem de figura e tabela é interna ao bloco, e o título da seção seguinte
// começa onde o bloco acaba. A seta para baixo caía no primeiro parágrafo da
// seção seguinte, e não havia como escrever entre o fim da tabela e o título.
//
// Aqui a linha é criada **por ação explícita** — a seta para baixo na última
// linha da tabela, ou com uma figura ou fórmula selecionada —, e só quando
// falta. Nada roda sozinho a cada transação (decisão de `caret.ts`: nada de
// parágrafo vazio que ninguém pediu no `.docx`). O clique no vazio da folha,
// abaixo do último bloco, é tratado em `Editor.tsx`.
export const LinhaAposBloco = Extension.create({
  name: "linhaAposBloco",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("linhaAposBloco"),
        props: {
          handleKeyDown(view, evento) {
            if (evento.key !== "ArrowDown") return false;
            if (evento.shiftKey || evento.ctrlKey || evento.altKey || evento.metaKey) return false;

            const { selection } = view.state;
            let fim: number | null = null;

            if (selection instanceof NodeSelection && !selection.node.isTextblock) {
              // Figura ou fórmula selecionada inteira.
              fim = selection.to;
            } else {
              // Cursor numa célula: só a última linha da tabela, e só no fim
              // do texto dela — nas outras, a seta anda dentro da tabela.
              const { $from } = selection;
              let profundidade = $from.depth;
              while (profundidade > 0 && $from.node(profundidade).type.name !== "tabela") {
                profundidade--;
              }
              if (profundidade === 0) return false;
              if ($from.index(profundidade) !== $from.node(profundidade).childCount - 1) {
                return false;
              }
              if (!view.endOfTextblock("down")) return false;
              fim = $from.after(profundidade);
            }

            if (!faltaLinhaDepois(view.state.doc, fim)) return false;

            const tr = view.state.tr;
            cursorDepoisDoBloco(tr, fim);
            view.dispatch(tr.scrollIntoView());
            evento.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});
