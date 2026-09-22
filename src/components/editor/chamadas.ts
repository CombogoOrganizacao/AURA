import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as NoPM } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { faixasDeCitacao } from "@/core/editor/citacoes";
import { chamadaDaCitacao } from "@/core/references/citacoes";
import type { Referencia } from "@/core/references/types";

// A chamada e as aspas na tela (passo 4.10). Nada disto é texto do documento:
// são decorações do ProseMirror, desenhadas a partir da marca `citacao` e das
// referências. Por isso o aluno nunca digita "(Silva, 2019)" nem as aspas —
// e elas mudam sozinhas quando a referência é corrigida, somem quando a
// citação é removida e viram aviso quando a referência é excluída (4.8).
//
// Fica em `src/components/` porque cria elementos do DOM; o que decide ONDE
// estão as citações e O QUE a chamada diz é `src/core/` (`faixasDeCitacao()`,
// `chamadaDaCitacao()`), testado sem navegador.

interface EstadoChamadas {
  referencias: readonly Referencia[];
  decoracoes: DecorationSet;
}

const chave = new PluginKey<EstadoChamadas>("chamadasDeCitacao");

// As referências chegam de fora do editor (`Documento.references`, dono é o
// `DocumentoEditor`) por uma transação só de meta, que não altera o texto e
// não entra no desfazer.
export function atualizarReferenciasDasChamadas(
  editor: Editor,
  referencias: readonly Referencia[],
) {
  const tr = editor.state.tr.setMeta(chave, referencias).setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

export const ChamadasDeCitacao = Extension.create({
  name: "chamadasDeCitacao",

  addProseMirrorPlugins() {
    return [
      new Plugin<EstadoChamadas>({
        key: chave,
        state: {
          init: (_, estado) => ({
            referencias: [],
            decoracoes: decorar(estado.doc, []),
          }),
          apply: (tr, anterior) => {
            const novas = tr.getMeta(chave) as readonly Referencia[] | undefined;
            if (!novas && !tr.docChanged) return anterior;
            const referencias = novas ?? anterior.referencias;
            return { referencias, decoracoes: decorar(tr.doc, referencias) };
          },
        },
        props: {
          decorations: (estado) => chave.getState(estado)?.decoracoes,
        },
      }),
    ];
  },
});

function decorar(doc: NoPM, referencias: readonly Referencia[]): DecorationSet {
  const decoracoes: Decoration[] = [];

  for (const faixa of faixasDeCitacao(doc)) {
    if (faixa.tipo === "longa") {
      const chamada = chamadaDaCitacao(
        { refId: faixa.refId, pagina: faixa.pagina || null },
        referencias,
      );
      decoracoes.push(widget(faixa.fimDoConteudo, ` ${chamada.texto}`, chamada.orfa, 1));
      continue;
    }

    const chamada = chamadaDaCitacao(faixa.attrs, referencias);
    // 10520 §7.1: a direta de até três linhas vai "entre aspas duplas". As
    // aspas são da chamada, não do texto — o aluno não as digita, e a
    // exportação as escreve do mesmo lugar.
    if (faixa.attrs.modo === "direta_curta") {
      // A de abertura fica colada ao texto que vem depois dela; a de
      // fechamento, ao texto de antes — e por isso antes da chamada, que está
      // na mesma posição com `side: 1`.
      decoracoes.push(aspas(faixa.de, "“", 1), aspas(faixa.ate, "”", -1));
    }
    decoracoes.push(widget(faixa.ate, ` ${chamada.texto}`, chamada.orfa, 1));
    // Destaque discreto do trecho citado, para o aluno ver o que está ligado
    // a uma referência — e, na órfã, o que perdeu a ligação.
    decoracoes.push(
      Decoration.inline(faixa.de, faixa.ate, {
        class: chamada.orfa ? "doc-citado doc-citado-orfa" : "doc-citado",
      }),
    );
  }

  return DecorationSet.create(doc, decoracoes);
}

function widget(posicao: number, texto: string, orfa: boolean, lado: number): Decoration {
  return Decoration.widget(
    posicao,
    () => {
      const elemento = document.createElement("span");
      elemento.className = orfa ? "doc-chamada doc-chamada-orfa" : "doc-chamada";
      elemento.contentEditable = "false";
      elemento.textContent = texto;
      if (orfa) {
        elemento.title =
          "A referência desta citação foi excluída. O texto foi mantido; ligue-o a outra referência ou restaure a excluída.";
      }
      return elemento;
    },
    // `key` com o texto: o ProseMirror reaproveita o elemento enquanto a
    // chamada não muda, e o redesenha quando a referência é corrigida.
    { side: lado, key: `chamada:${orfa}:${texto}`, ignoreSelection: true },
  );
}

function aspas(posicao: number, sinal: string, lado: number): Decoration {
  return Decoration.widget(
    posicao,
    () => {
      const elemento = document.createElement("span");
      elemento.className = "doc-aspas";
      elemento.contentEditable = "false";
      elemento.textContent = sinal;
      return elemento;
    },
    { side: lado, key: `aspas:${sinal}`, ignoreSelection: true },
  );
}
