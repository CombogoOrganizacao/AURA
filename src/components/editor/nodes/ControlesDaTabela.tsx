"use client";

import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, RefObject } from "react";

import { Icon } from "@/components/ui/Icon";
import type { NomeIcone } from "@/components/ui/Icon";
import {
  acrescentarColunaNoFim,
  acrescentarLinhaNoFim,
  alternarCabecalho,
  excluirTabela,
  inserirColuna,
  inserirLinha,
  moverColuna,
  moverLinha,
  removerColuna,
  removerLinha,
} from "@/core/editor/tabela";

// Controles da grade da tabela (passo 8.5.3), no estilo do Canva: com o
// cursor numa célula aparecem
//
// - uma alça "⋯" sobre a coluna do cursor, com o menu da coluna;
// - uma alça "⋮" ao lado da linha do cursor, com o menu da linha;
// - um "+" à direita (acrescenta coluna no fim) e outro embaixo, à esquerda
//   (acrescenta linha no fim).
//
// Substitui a barra de botões de texto do 6.1.3b. As operações são as mesmas
// (`core/editor/tabela.ts`), agora também mover linha e coluna.
//
// **Mesclar células não existe:** a célula do AURA não tem `colspan` nem
// `rowspan`, e o `.docx` e o `.tex` não os escrevem. Entra num passo próprio,
// que mexe no schema e nos dois exportadores.
//
// Tudo é interface, não documento: `contentEditable={false}`, fora do `.docx`.
// `onMouseDown` com `preventDefault` segura a seleção no editor durante o
// clique; a operação roda no `onClick`, que Enter e Espaço também disparam.

export interface EstadoGrade {
  linhas: number;
  colunas: number;
  linha: number;
  coluna: number;
  cabecalho: boolean;
}

interface Posicao {
  // Em px, relativos à área da tabela.
  celulaX: number;
  celulaLargura: number;
  celulaY: number;
  celulaAltura: number;
  tabelaLargura: number;
  tabelaAltura: number;
}

// Onde está a célula do cursor, medida no DOM. Remedida a cada transação e a
// cada mudança de tamanho, porque digitar quebra linha e muda a altura.
function usePosicao(
  editor: Editor,
  area: RefObject<HTMLDivElement | null>,
  ativo: boolean,
): Posicao | null {
  const [posicao, setPosicao] = useState<Posicao | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let quadro = 0;

    function medir() {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const raiz = area.current;
        if (!raiz) return;
        const { node } = editor.view.domAtPos(editor.state.selection.from);
        const elemento = node.nodeType === 1 ? (node as Element) : node.parentElement;
        const celula = elemento?.closest("td, th");
        const tabela = raiz.querySelector("table");
        if (!celula || !tabela || !raiz.contains(celula)) return;
        const r = raiz.getBoundingClientRect();
        const c = celula.getBoundingClientRect();
        const t = tabela.getBoundingClientRect();
        const nova: Posicao = {
          celulaX: Math.round(c.left - r.left),
          celulaLargura: Math.round(c.width),
          celulaY: Math.round(c.top - r.top),
          celulaAltura: Math.round(c.height),
          tabelaLargura: Math.round(t.width),
          tabelaAltura: Math.round(t.height),
        };
        setPosicao((atual) =>
          atual && JSON.stringify(atual) === JSON.stringify(nova) ? atual : nova,
        );
      });
    }

    medir();
    editor.on("transaction", medir);
    window.addEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(quadro);
      editor.off("transaction", medir);
      window.removeEventListener("resize", medir);
    };
  }, [editor, area, ativo]);

  return ativo ? posicao : null;
}

interface ItemDoMenu {
  rotulo: string;
  icone: NomeIcone;
  operacao: (tr: Transaction) => boolean;
  desabilitado?: boolean;
  pressionado?: boolean;
  perigo?: boolean;
}

type Grupo = ItemDoMenu[];

export function ControlesDaTabela({
  editor,
  grade,
  area,
}: {
  editor: Editor;
  grade: EstadoGrade;
  area: RefObject<HTMLDivElement | null>;
}) {
  const posicao = usePosicao(editor, area, true);
  const [aberto, setAberto] = useState<"coluna" | "linha" | null>(null);

  function executar(operacao: (tr: Transaction) => boolean) {
    const tr = editor.state.tr;
    if (operacao(tr)) editor.view.dispatch(tr.scrollIntoView());
    setAberto(null);
    editor.view.focus();
  }

  const menuColuna: Grupo[] = [
    [
      {
        rotulo: "Inserir coluna à esquerda",
        icone: "arrow-left",
        operacao: (tr) => inserirColuna(tr, "esquerda"),
      },
      {
        rotulo: "Inserir coluna à direita",
        icone: "arrow-right",
        operacao: (tr) => inserirColuna(tr, "direita"),
      },
    ],
    [
      {
        rotulo: "Mover coluna para a esquerda",
        icone: "arrow-left",
        operacao: (tr) => moverColuna(tr, "esquerda"),
        desabilitado: grade.coluna === 0,
      },
      {
        rotulo: "Mover coluna para a direita",
        icone: "arrow-right",
        operacao: (tr) => moverColuna(tr, "direita"),
        desabilitado: grade.coluna >= grade.colunas - 1,
      },
    ],
    [
      {
        rotulo: "Excluir coluna",
        icone: "trash-2",
        operacao: removerColuna,
        desabilitado: grade.colunas <= 1,
        perigo: true,
      },
      { rotulo: "Excluir tabela", icone: "trash-2", operacao: excluirTabela, perigo: true },
    ],
  ];

  const menuLinha: Grupo[] = [
    [
      {
        rotulo: "Inserir linha acima",
        icone: "chevron-up",
        operacao: (tr) => inserirLinha(tr, "acima"),
      },
      {
        rotulo: "Inserir linha abaixo",
        icone: "chevron-down",
        operacao: (tr) => inserirLinha(tr, "abaixo"),
      },
    ],
    [
      {
        rotulo: "Mover linha para cima",
        icone: "chevron-up",
        operacao: (tr) => moverLinha(tr, "acima"),
        desabilitado: grade.linha === 0,
      },
      {
        rotulo: "Mover linha para baixo",
        icone: "chevron-down",
        operacao: (tr) => moverLinha(tr, "abaixo"),
        desabilitado: grade.linha >= grade.linhas - 1,
      },
    ],
    [
      {
        rotulo: "Linha de cabeçalho",
        icone: "table",
        operacao: alternarCabecalho,
        pressionado: grade.cabecalho,
      },
    ],
    [
      {
        rotulo: "Excluir linha",
        icone: "trash-2",
        operacao: removerLinha,
        desabilitado: grade.linhas <= 1,
        perigo: true,
      },
      { rotulo: "Excluir tabela", icone: "trash-2", operacao: excluirTabela, perigo: true },
    ],
  ];

  if (!posicao) return null;

  return (
    <div className="doc-tabela-controles" contentEditable={false}>
      <Alca
        rotulo="Coluna"
        icone="ellipsis"
        estilo={{
          left: posicao.celulaX + posicao.celulaLargura / 2,
          top: 0,
          // Centrada na borda de cima: metade fora, no respiro da legenda.
          transform: "translate(-50%, -50%)",
        }}
        aberto={aberto === "coluna"}
        onAlternar={() => setAberto((a) => (a === "coluna" ? null : "coluna"))}
      />
      <Alca
        rotulo="Linha"
        icone="ellipsis"
        vertical
        estilo={{
          left: -12,
          top: posicao.celulaY + posicao.celulaAltura / 2,
          transform: "translate(-100%, -50%)",
        }}
        aberto={aberto === "linha"}
        onAlternar={() => setAberto((a) => (a === "linha" ? null : "linha"))}
      />
      <Mais
        rotulo="Acrescentar coluna no fim"
        estilo={{
          left: posicao.tabelaLargura + 12,
          top: posicao.celulaY + posicao.celulaAltura / 2 - 12,
        }}
        onClick={() => executar(acrescentarColunaNoFim)}
        // Na linha do cursor: o "+" fica ao lado dela, como o Canva faz.
      />
      <Mais
        rotulo="Acrescentar linha no fim"
        estilo={{
          left: -12,
          top: posicao.tabelaAltura + 4,
          transform: "translateX(-100%)",
        }}
        onClick={() => executar(acrescentarLinhaNoFim)}
      />

      {aberto && (
        <Menu
          rotulo={aberto === "coluna" ? "Menu da coluna" : "Menu da linha"}
          grupos={aberto === "coluna" ? menuColuna : menuLinha}
          estilo={
            aberto === "coluna"
              ? {
                  // Sobre a tabela, logo abaixo da alça, e nunca fora da
                  // folha: a largura do menu é 16rem (256 px).
                  left: Math.min(
                    Math.max(posicao.celulaX + posicao.celulaLargura / 2, 128),
                    Math.max(posicao.tabelaLargura - 128, 128),
                  ),
                  top: 4,
                  transform: "translateX(-50%)",
                }
              : {
                  // Para dentro: o lado esquerdo da folha é a barra de seções.
                  left: 0,
                  top: posicao.celulaY + posicao.celulaAltura / 2,
                }
          }
          onExecutar={executar}
          onFechar={() => {
            setAberto(null);
            editor.view.focus();
          }}
        />
      )}
    </div>
  );
}

const CLASSE_ALCA =
  "absolute z-10 flex items-center justify-center rounded-full border border-[var(--border-default)] bg-card text-muted shadow-sm transition-colors hover:text-body focus-visible:outline-none focus-visible:shadow-focus-ring";

function Alca({
  rotulo,
  icone,
  vertical = false,
  estilo,
  aberto,
  onAlternar,
}: {
  rotulo: string;
  icone: NomeIcone;
  vertical?: boolean;
  estilo: CSSProperties;
  aberto: boolean;
  onAlternar: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${rotulo}: mais opções`}
      aria-haspopup="menu"
      aria-expanded={aberto}
      title={`${rotulo}: mais opções`}
      style={estilo}
      onMouseDown={(evento) => evento.preventDefault()}
      onClick={onAlternar}
      className={[
        CLASSE_ALCA,
        vertical ? "h-7 w-4" : "h-4 w-7",
        aberto ? "text-bordo-700" : "",
      ].join(" ")}
    >
      <span className={vertical ? "rotate-90" : ""}>
        <Icon name={icone} size={12} />
      </span>
    </button>
  );
}

function Mais({
  rotulo,
  estilo,
  onClick,
}: {
  rotulo: string;
  estilo: CSSProperties;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      style={estilo}
      onMouseDown={(evento) => evento.preventDefault()}
      onClick={onClick}
      className={`${CLASSE_ALCA} size-6 hover:bg-brand-soft hover:text-bordo-700`}
    >
      <Icon name="plus" size={14} />
    </button>
  );
}

function Menu({
  rotulo,
  grupos,
  estilo,
  onExecutar,
  onFechar,
}: {
  rotulo: string;
  grupos: Grupo[];
  estilo: CSSProperties;
  onExecutar: (operacao: (tr: Transaction) => boolean) => void;
  onFechar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Clique fora fecha; Esc fecha e devolve o foco ao texto. O primeiro item
  // habilitado recebe o foco, para o menu abrir também pelo teclado.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
    function aoClicar(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (ref.current?.contains(alvo)) return;
      // O clique na própria alça é tratado por ela (alterna).
      if ((alvo as Element).closest?.("[aria-haspopup='menu']")) return;
      onFechar();
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [onFechar]);

  function aoTeclar(evento: KeyboardEvent) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      onFechar();
      return;
    }
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
    evento.preventDefault();
    const itens = Array.from(
      ref.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [],
    );
    const atual = itens.indexOf(document.activeElement as HTMLElement);
    const proximo = evento.key === "ArrowDown" ? atual + 1 : atual - 1;
    itens[(proximo + itens.length) % itens.length]?.focus();
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={rotulo}
      style={estilo}
      onKeyDown={aoTeclar}
      className="absolute z-20 w-64 rounded-md border border-[var(--border-default)] bg-card py-1 font-sans shadow-lg"
    >
      {grupos.map((grupo, i) => (
        <div
          key={i}
          role="group"
          className={i > 0 ? "mt-1 border-t border-[var(--border-subtle)] pt-1" : ""}
        >
          {grupo.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role={item.pressionado === undefined ? "menuitem" : "menuitemcheckbox"}
              aria-checked={item.pressionado}
              disabled={item.desabilitado}
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => onExecutar(item.operacao)}
              className={[
                "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm",
                "hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-transparent",
                item.perigo ? "text-danger" : "text-body",
              ].join(" ")}
            >
              <Icon name={item.icone} size={16} />
              <span className="flex-1">{item.rotulo}</span>
              {item.pressionado && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
