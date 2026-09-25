"use client";

import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { useCallback, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/Button";
import { ROTULO_TABELA } from "@/core/document/elements/legenda";
import {
  alternarCabecalho,
  celulaDaSelecao,
  excluirTabela,
  inserirColuna,
  inserirLinha,
  linhaEhCabecalho,
  removerColuna,
  removerLinha,
} from "@/core/editor/tabela";

import { CampoFonte, CampoLegenda } from "./CamposLegenda";
import { useNumeroNumeravel } from "./useNumeroNumeravel";

// Node view do nó `tabela` (passo 3.6.3) — ver docs/schema-tiptap.md §4.7.
// Mesmo desenho de `FiguraView`: legenda acima, objeto no meio, fonte abaixo,
// número derivado a cada transação.
//
// A diferença é o meio: aqui o objeto é conteúdo editável de verdade
// (`linha_tabela`/`celula_tabela`), então entra um `NodeViewContent as="tbody"`
// em vez de uma moldura. `<table>` de verdade, não `<div>` com grade CSS: é o
// que dá navegação por célula e leitura correta em leitor de tela, e é o que
// `parseHTML()` do nó reconhece ao colar.
//
// O padrão IBGE adotado pela ABNT (laterais abertas, sem traço vertical, fio
// em cima e embaixo e outro sob o cabeçalho) fica no CSS do editor
// (`app/globals.css`), não aqui e não no nó — mesma divisão da citação longa.
export function TabelaView({ node, editor, getPos, updateAttributes }: ReactNodeViewProps) {
  const id = node.attrs.id as string | null;
  const numero = useNumeroNumeravel(editor, "tabela", id);
  const grade = useGradeAtiva(editor, getPos);

  return (
    <NodeViewWrapper as="div" data-id={id} className="doc-tabela">
      <CampoLegenda
        rotulo={ROTULO_TABELA}
        numero={numero}
        valor={node.attrs.legenda as string}
        onChange={(legenda) => updateAttributes({ legenda })}
      />
      <table>
        {/*
          Argumento de tipo explícito: `as` é `NoInfer<T>` na assinatura do
          `NodeViewContent`, então TS não deduz "tbody" do próprio valor.
        */}
        <NodeViewContent<"tbody"> as="tbody" />
      </table>
      <CampoFonte
        rotulo={ROTULO_TABELA}
        numero={numero}
        valor={node.attrs.fonte as string}
        onChange={(fonte) => updateAttributes({ fonte })}
      />
      {grade && <BarraGrade editor={editor} grade={grade} />}
    </NodeViewWrapper>
  );
}

interface EstadoGrade {
  linhas: number;
  colunas: number;
  cabecalho: boolean;
}

// Se o cursor está numa célula DESTA tabela, e como está a grade. A barra só
// aparece nesse caso: com várias tabelas no documento, os botões agem na do
// cursor, e mostrá-los em todas faria parecer que agem em qualquer uma.
//
// O instantâneo é uma string, não um objeto: `useSyncExternalStore` compara
// por `Object.is`, e um objeto novo a cada transação re-renderizaria todas as
// tabelas a cada tecla.
function useGradeAtiva(editor: Editor, getPos: () => number | undefined): EstadoGrade | null {
  const inscrever = useCallback(
    (notificar: () => void) => {
      editor.on("transaction", notificar);
      return () => {
        editor.off("transaction", notificar);
      };
    },
    [editor],
  );
  const obterInstantaneo = useCallback(() => {
    const alvo = celulaDaSelecao(editor.state.selection);
    if (!alvo || alvo.posTabela !== getPos()) return "";
    const colunas = alvo.tabela.child(alvo.linha).childCount;
    return `${alvo.tabela.childCount}|${colunas}|${linhaEhCabecalho(alvo) ? 1 : 0}`;
  }, [editor, getPos]);
  const obterInstantaneoServidor = useCallback(() => "", []);

  const instantaneo = useSyncExternalStore(inscrever, obterInstantaneo, obterInstantaneoServidor);
  if (!instantaneo) return null;
  const [linhas, colunas, cabecalho] = instantaneo.split("|");
  return { linhas: Number(linhas), colunas: Number(colunas), cabecalho: cabecalho === "1" };
}

// Botões da grade (passo 6.1.3b). Texto, não ícone: "linha acima" diz o que
// faz, e os ícones de tabela do Lucide se distinguem mal nesse tamanho.
//
// Fica ABAIXO da tabela, e não acima: aparece quando o cursor entra numa
// célula, e acima empurraria para baixo a célula em que a pessoa acabou de
// clicar.
//
// `onMouseDown` com `preventDefault` em vez de `onClick`: o clique normal
// tiraria o foco do editor antes de a operação ler a seleção, e ela não
// saberia mais em que célula agir.
function BarraGrade({ editor, grade }: { editor: Editor; grade: EstadoGrade }) {
  function executar(operacao: (tr: Transaction) => boolean) {
    const tr = editor.state.tr;
    if (!operacao(tr)) return;
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  }

  const botoes: ReadonlyArray<{
    rotulo: string;
    operacao: (tr: Transaction) => boolean;
    desabilitado?: boolean;
    pressionado?: boolean;
  }> = [
    { rotulo: "Linha acima", operacao: (tr) => inserirLinha(tr, "acima") },
    { rotulo: "Linha abaixo", operacao: (tr) => inserirLinha(tr, "abaixo") },
    { rotulo: "Remover linha", operacao: removerLinha, desabilitado: grade.linhas <= 1 },
    { rotulo: "Coluna à esquerda", operacao: (tr) => inserirColuna(tr, "esquerda") },
    { rotulo: "Coluna à direita", operacao: (tr) => inserirColuna(tr, "direita") },
    { rotulo: "Remover coluna", operacao: removerColuna, desabilitado: grade.colunas <= 1 },
    { rotulo: "Linha de cabeçalho", operacao: alternarCabecalho, pressionado: grade.cabecalho },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Grade da tabela"
      className="doc-tabela-grade"
      contentEditable={false}
    >
      {botoes.map(({ rotulo, operacao, desabilitado, pressionado }) => (
        <Button
          key={rotulo}
          size="sm"
          variant={pressionado ? "outline" : "ghost"}
          aria-pressed={pressionado}
          disabled={desabilitado}
          onMouseDown={(evento) => {
            evento.preventDefault();
            executar(operacao);
          }}
        >
          {rotulo}
        </Button>
      ))}
      <Button
        size="sm"
        variant="ghost"
        onMouseDown={(evento) => {
          evento.preventDefault();
          executar(excluirTabela);
        }}
      >
        Excluir tabela
      </Button>
    </div>
  );
}
