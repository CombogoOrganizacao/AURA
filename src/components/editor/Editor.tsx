"use client";

import { useEffect, useState } from "react";

import TiptapHistory from "@tiptap/extension-history";
import TiptapParagraph from "@tiptap/extension-paragraph";
import TiptapText from "@tiptap/extension-text";
import { Fragment, Slice } from "@tiptap/pm/model";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";

import { EstadoCarregando } from "@/components/ui/Estados";
import { PaperSheet } from "@/components/ui/PaperSheet";
import { novaSecao } from "@/core/document/factory";
import { fromDocumento, toDocumento } from "@/core/document/serialize";
import type { Secao } from "@/core/document/types";
import { cursorNaUltimaLinha } from "@/core/editor/caret";
import { CursorDeIntervalo } from "@/core/editor/gapcursor";
import { Italico } from "@/core/editor/marks/italico";
import { Negrito } from "@/core/editor/marks/negrito";
import { Documento as DocumentoNode } from "@/core/editor/nodes/documento";
import { Figura as FiguraNode } from "@/core/editor/nodes/figure";
import { Formula as FormulaNode } from "@/core/editor/nodes/formula";
import { CitacaoLonga } from "@/core/editor/nodes/longQuote";
import { Secao as SecaoNode } from "@/core/editor/nodes/section";
import { CelulaTabela, LinhaTabela, Tabela as TabelaNode } from "@/core/editor/nodes/table";
import { mapearHtmlColado, type NoHtmlColado } from "@/core/editor/paste";
import { moverSecaoDeTopo } from "@/core/editor/reorder";

import { AvisoPaginacao } from "./AvisoPaginacao";
import { FiguraView } from "./nodes/FiguraView";
import { FormulaView } from "./nodes/FormulaView";
import { SectionView } from "./nodes/SectionView";
import { TabelaView } from "./nodes/TabelaView";
import { Toolbar } from "./Toolbar";

// `section.ts` (src/core/editor/) fica livre de React — o node view que
// mostra a numeração (passo 3.2.2, `SectionView.tsx`) é ligado aqui, o
// primeiro lugar de cima pra baixo onde React já está em escopo.
const SecaoComVisualizacao = SecaoNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SectionView);
  },
});

// Mesma divisão para figura e tabela (passo 3.6.3): o nó fica livre de React
// em `src/core/editor/nodes/`, o node view que desenha legenda/fonte e mostra
// o número derivado é ligado aqui.
const FiguraComVisualizacao = FiguraNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FiguraView);
  },
});

const TabelaComVisualizacao = TabelaNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TabelaView);
  },
});

// E para a fórmula (passo 3.6.5), pelo mesmo motivo com um agravante: o
// KaTeX é uma biblioteca de navegador, e é exatamente por isso que ele fica
// deste lado da divisão — `src/core/editor/nodes/formula.ts` guarda a fonte
// LaTeX e mais nada.
const FormulaComVisualizacao = FormulaNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FormulaView);
  },
});

// Ponte entre `DOMParser` (só existe no navegador) e a árvore própria que
// `mapearHtmlColado()` (src/core/editor/paste.ts, passo 3.3.4) sabe
// percorrer — a decisão de "o que vira o quê" mora inteira lá, testável sem
// navegador; aqui só anda o DOM e converte a forma, sem decidir nada.
function noDomParaArvoreColada(no: Node): NoHtmlColado | null {
  if (no.nodeType === Node.TEXT_NODE) {
    return { tipo: "texto", texto: no.textContent ?? "" };
  }
  if (no.nodeType !== Node.ELEMENT_NODE) return null; // comentário etc. — descartado
  const elemento = no as Element;
  const filhos = Array.from(elemento.childNodes)
    .map(noDomParaArvoreColada)
    .filter((filho): filho is NoHtmlColado => filho !== null);
  return { tipo: "elemento", tag: elemento.tagName.toLowerCase(), filhos };
}

function arvoreColadaDoHtml(html: string): NoHtmlColado[] {
  const documento = new DOMParser().parseFromString(html, "text/html");
  return Array.from(documento.body.childNodes)
    .map(noDomParaArvoreColada)
    .filter((no): no is NoHtmlColado => no !== null);
}

// Assinatura do comando imperativo de reordenar (passo 3.2.4) que `Editor`
// expõe pro pai via `onReorderReady` — não a instância inteira do editor:
// `PainelSecoes.tsx` só precisa desta única capacidade, nunca da superfície
// inteira do TipTap.
export type MoverSecao = (idOrigem: string, idDestino: string, inserirDepois: boolean) => void;

interface EditorProps {
  sections: Secao[];
  onSectionsChange: (secoes: Secao[]) => void;
  /**
   * Chamado com o comando `moverSecao` assim que o editor está pronto, e de
   * novo com um no-op na desmontagem — quem chama guarda a versão mais
   * recente numa ref (ver `DocumentoEditor.tsx`) pra `PainelSecoes`, um
   * componente irmão sem acesso à instância do TipTap, poder reordenar.
   */
  onReorderReady?: (mover: MoverSecao) => void;
}

// Editor com seções (passo 1.3.7), formatação (passo 2.5: negrito, itálico,
// nível de título — `Toolbar.tsx`), citação longa (passo 3.4.1) e
// figura/tabela com legenda numerada (passo 3.6.3) e fórmula em LaTeX
// (passo 3.6.5). A lista fechada completa do editor está em
// docs/schema-tiptap.md; "listas" (`lista`/`item_lista`) ainda não tem nó
// aqui de propósito (`NoConteudo` não a cobre, ver
// src/core/document/types.ts).
//
// Continua sem `@tiptap/starter-kit` de propósito — cada nó/marca entra por
// decisão explícita, um passo do plano de cada vez.
//
// Controlado: `sections` só alimenta o conteúdo INICIAL (via `useRef`, uma
// vez só) — mudanças depois vêm de dentro do próprio editor (`onUpdate`),
// nunca de fora, pra uma escrita externa não brigar com o que a pessoa está
// digitando. Documento inexistente ganha uma seção-semente
// (`novaSecao()`), porque `doc` exige pelo menos um bloco e um `secao`
// vazio (`content: []`) não dá lugar pro cursor entrar.
export function Editor({ sections, onSectionsChange, onReorderReady }: EditorProps) {
  // `useState` com inicializador preguiçoso — roda uma vez só, no mount, e
  // ler o valor durante o render é normal (diferente de `ref.current`, que
  // a regra `react-hooks/refs` proíbe fora de efeito/handler).
  const [conteudoInicial] = useState(() =>
    fromDocumento(sections.length > 0 ? sections : [novaSecao(0)]),
  );

  const editor = useEditor({
    extensions: [
      DocumentoNode,
      TiptapParagraph,
      TiptapText,
      SecaoComVisualizacao,
      // Sem botão nem atalho pra criar uma ainda (isso é 3.4.2, o "botão de
      // conversão na toolbar") — registrado aqui de propósito mesmo assim,
      // mesmo padrão de `secao` (existe com round-trip completo desde muito
      // antes de "nova seção" ganhar UI, ver docs/to-do.md).
      CitacaoLonga,
      // Figura e tabela (passo 3.6.3) — inseridas pela toolbar
      // (`Toolbar.tsx`), a tabela só no desktop. `linha_tabela`/
      // `celula_tabela` não têm node view próprio: são desenhadas pelo
      // `NodeViewContent` de `TabelaView`, dentro do `<table>`.
      FiguraComVisualizacao,
      TabelaComVisualizacao,
      LinhaTabela,
      CelulaTabela,
      // Fórmula (passo 3.6.5) — inserida pela toolbar, só no desktop, pelo
      // mesmo motivo da tabela (ver o botão em `Toolbar.tsx`).
      FormulaComVisualizacao,
      Negrito,
      Italico,
      // Desfazer/refazer (passo 2B.12) não vem de graça: as extensões
      // "core" do TipTap v3 (Editable, Commands, Keymap...) não incluem
      // histórico — é um pacote separado desde sempre, agora
      // `@tiptap/extension-history`. Sem isto, `editor.commands.undo()`
      // simplesmente não existe.
      TiptapHistory,
      // Cursor de intervalo (src/core/editor/gapcursor.ts): é o que dá ao
      // cursor um lugar ENTRE dois blocos — depois de uma tabela no fim da
      // seção, entre duas figuras, antes do primeiro bloco. Sem ele, seta
      // para baixo e clique não tinham para onde ir nesses pontos.
      CursorDeIntervalo,
    ],
    content: conteudoInicial,
    // Evita o nó ser renderizado no primeiro render do lado do servidor e
    // de novo no cliente — mismatch de hidratação clássico do TipTap com
    // Next.js. Ver https://tiptap.dev/docs/guides/ssr.
    immediatelyRender: false,
    editorProps: {
      // Colar do Word e de outras fontes (passo 3.3.4). Sem isto, o
      // `DOMParser` de fábrica do ProseMirror já recusaria tag/marca fora do
      // schema (fechado, docs/schema-tiptap.md) — mas o resultado disso é
      // implícito e não testável sem navegador; interceptar aqui faz a regra
      // ("o que não mapeia vira parágrafo simples", CLAUDE.md "nenhum HTML
      // bruto no schema") explícita e coberta por Vitest, não uma
      // consequência acidental do parser genérico.
      handlePaste(view, event) {
        const html = event.clipboardData?.getData("text/html");
        if (!html) return false; // sem HTML (só texto puro) — o padrão do TipTap já serve

        const conteudo = mapearHtmlColado(arvoreColadaDoHtml(html));
        if (conteudo.length === 0) return false; // nada aproveitável — sem handler nenhum sobraria só texto puro, se houver

        event.preventDefault();
        const { state, dispatch } = view;
        const fragmento = Fragment.fromArray(conteudo.map((no) => state.schema.nodeFromJSON(no)));
        dispatch(state.tr.replaceSelection(new Slice(fragmento, 0, 0)).scrollIntoView());
        return true;
      },
    },
    onUpdate({ editor }) {
      try {
        onSectionsChange(toDocumento(editor.getJSON()));
      } catch (erro) {
        // Não deveria acontecer com a UI atual (sem toolbar/comandos que
        // insiram algo fora da lista fechada) — mas falhar em silêncio
        // aqui perderia a digitação da pessoa sem aviso nenhum.
        console.error("Falha ao converter o editor para o formato canônico:", erro);
      }
    },
  });

  // Expõe `moverSecaoDeTopo` (src/core/editor/reorder.ts, passo 3.2.4) como
  // comando imperativo pro pai — `sections` (a prop) só alimenta o conteúdo
  // inicial (comentário acima), então reordenar não pode passar por ela: só
  // uma transação de verdade dentro do editor move o nó de fato, e o
  // `onUpdate` de cima já reage a ela do mesmo jeito que reage a qualquer
  // outra digitação.
  useEffect(() => {
    if (!editor || !onReorderReady) return;
    onReorderReady((idOrigem, idDestino, inserirDepois) => {
      const tr = editor.state.tr;
      if (moverSecaoDeTopo(tr, idOrigem, idDestino, inserirDepois)) {
        editor.view.dispatch(tr);
      }
    });
    return () => {
      onReorderReady(() => {});
    };
  }, [editor, onReorderReady]);

  // `immediatelyRender: false` (acima) devolve `editor` como `null` no
  // primeiro render do cliente de propósito (evita o mismatch de
  // hidratação) — sem isso, essa janela mostrava a tela em branco por um
  // instante em vez de um estado de carregamento.
  if (!editor) {
    return <EstadoCarregando texto="Carregando editor…" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar editor={editor} />
      <AvisoPaginacao />
      {/*
        Folha A4 real (passo 2B.10, `PaperSheet` do passo 2B.4) — mesma
        moldura da amostra estática, agora com o `EditorContent` de
        verdade dentro. `PaperSheet` recorta o que passa da altura da
        folha (`overflow: hidden`, correto para uma página impressa sem
        paginação real ainda) — o aviso de que a paginação real só existe
        no `.docx` (passo 3.3.3, `AvisoPaginacao`, acima) fica fora deste
        recorte de propósito: teria sumido rolando a folha; para o texto
        curto que a v1 produz hoje (a v1 não tem "nova seção" nem rolagem de
        páginas), o limite não aparece na prática.
      */}
      <div className="flex flex-1 flex-col items-center gap-6 overflow-auto bg-ink-100 p-8">
        <PaperSheet>
          {/*
            Clicar no vazio da folha, abaixo do texto, põe o cursor na última
            linha — criando-a se o documento terminar em tabela, figura ou
            fórmula (`cursorNaUltimaLinha()`, src/core/editor/caret.ts). É o
            gesto que se faz em qualquer editor, e aqui ele não chegava ao
            ProseMirror: abaixo do último bloco não há nó nenhum sob o
            ponteiro.

            `h-full` para que a área clicável seja a folha inteira, e não só a
            altura do texto já escrito. `target !== currentTarget` deixa
            passar o clique que caiu no conteúdo de verdade — esse o
            ProseMirror trata sozinho, e roubá-lo moveria o cursor para o fim
            a cada clique no meio do texto.
          */}
          <div
            className="h-full cursor-text"
            onMouseDown={(evento) => {
              if (evento.target !== evento.currentTarget) return;
              evento.preventDefault();
              const tr = editor.state.tr;
              cursorNaUltimaLinha(tr);
              editor.view.dispatch(tr);
              editor.view.focus();
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </PaperSheet>
      </div>
    </div>
  );
}
