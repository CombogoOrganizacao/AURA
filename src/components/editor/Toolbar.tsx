"use client";

import type { Editor } from "@tiptap/core";
import { useCallback, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import type { NomeIcone } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
import { novaFigura, novaFormula, novaTabela } from "@/core/document/factory";
import { podeApagarSecao } from "@/core/editor/apagarSecao";
import { estiloDaSelecao, type EstiloBloco } from "@/core/editor/estiloDoBloco";
import { cursorDepoisDoBloco, fimDoBlocoAtual } from "@/core/editor/caret";
import { inserirNotaRodape, podeInserirNota } from "@/core/editor/nodes/footnote";
import { inserirFormulaInline, podeInserirFormulaInline } from "@/core/editor/nodes/formulaInline";
import { deNoConteudo } from "@/core/document/serialize";
import type { FonteTrabalho, NivelSecao, NoConteudo } from "@/core/document/types";
import type { Referencia } from "@/core/references/types";

import { MenuCitacao } from "./MenuCitacao";
import { criarSecaoNoEditor } from "./novaSecao";

// Re-renderiza a toolbar a cada transação do editor — é como o estado
// "ativo" dos botões (negrito ligado, nível 2 selecionado...) acompanha a
// seleção sem `useEffect`+`setState` (mesma razão de `LayoutEdicao.tsx`:
// `useSyncExternalStore` é o hook certo pra sincronizar com algo de fora do
// React). O `EditorState` do ProseMirror é imutável — uma referência nova a
// cada transação é o próprio sinal de "algo mudou", não precisa comparar
// campo a campo.
function useEstadoEditor(editor: Editor | null) {
  const inscrever = useCallback(
    (notificar: () => void) => {
      if (!editor) return () => {};
      editor.on("transaction", notificar);
      return () => {
        editor.off("transaction", notificar);
      };
    },
    [editor],
  );
  const obterInstantaneo = useCallback(() => editor?.state ?? null, [editor]);
  const obterInstantaneoServidor = useCallback(() => null, []);
  useSyncExternalStore(inscrever, obterInstantaneo, obterInstantaneoServidor);
}

interface BotaoToolbarProps {
  ativo?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label: string;
  /** Classes extras do botão — hoje só o `hidden md:flex` da tabela e da fórmula. */
  className?: string;
  children: ReactNode;
}

function BotaoToolbar({ ativo, disabled, onClick, label, className, children }: BotaoToolbarProps) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={ativo}
        disabled={disabled}
        onClick={onClick}
        className={[
          "flex size-7 shrink-0 items-center justify-center rounded-sm transition-colors",
          "focus-visible:outline-none focus-visible:shadow-focus-ring",
          "disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-transparent",
          ativo ? "bg-brand-soft text-bordo-700" : "text-muted hover:bg-sunken hover:text-body",
          className ?? "",
        ].join(" ")}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function Divisor() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-[var(--border-subtle)]" />;
}

// "Mudar para nível N", não "Título de seção nível N": o rótulo acessível não
// pode conter "Título" — colide por substring com o campo de metadados
// `FormMetadados` ("Título" do trabalho), que vive na mesma tela
// (`getByLabel` do Playwright casa por substring, achou os dois — foi assim
// que a suíte e2e pegou isso).
const NIVEIS: ReadonlyArray<{ nivel: NivelSecao; nomeIcone: NomeIcone; label: string }> = [
  { nivel: 1, nomeIcone: "heading-1", label: "Mudar a seção para o nível 1" },
  { nivel: 2, nomeIcone: "heading-2", label: "Mudar a seção para o nível 2" },
  { nivel: 3, nomeIcone: "heading-3", label: "Mudar a seção para o nível 3" },
];

// Botões desabilitados do passo 2B.12 — controle, ícone e o motivo. Todo
// item aqui tem tooltip explicando o porquê (nunca só o nome do controle): é
// o critério do passo, "nenhum controle desabilitado é focável sem indicação
// do porquê". O motivo é o estado real do recurso, não uma fase do plano:
// sublinhado e lista não têm nó no schema nem passo na v1, e o corpo já é
// justificado pelo estilo (passo 3.3.2).
const CONTROLES_FUTUROS: ReadonlyArray<{ nome: NomeIcone; label: string }> = [
  { nome: "underline", label: "Sublinhado — ainda não disponível" },
  { nome: "align-justify", label: "Justificar — o corpo do texto já é justificado" },
  { nome: "list-ordered", label: "Lista numerada — ainda não disponível" },
];

const ROTULO_ESTILO: Record<"corpo" | "citacao_longa", string> = {
  corpo: "Corpo do texto",
  citacao_longa: "Citação longa (recuo 4 cm)",
};

// Estilo do bloco do cursor. Só corpo e citação longa se trocam por aqui: o
// título da seção não é um parágrafo neste schema (é atributo da seção, e o
// nível muda pelos botões H1–H3), e legenda, célula e nota têm lugar próprio.
function CaixaEstilo({ editor, estilo }: { editor: Editor; estilo: EstiloBloco }) {
  if (estilo === "celula" || estilo === "outro") {
    return (
      <Tooltip content="Este elemento tem estilo próprio, definido pela norma">
        <Select
          aria-label="Estilo do parágrafo"
          disabled
          size="sm"
          className="w-[184px]"
          value={estilo}
          options={[{ value: estilo, label: estilo === "celula" ? "Célula de tabela" : "—" }]}
        />
      </Tooltip>
    );
  }

  const opcoes = [
    ...(estilo === "misto" ? [{ value: "misto", label: "Estilos variados" }] : []),
    { value: "corpo", label: ROTULO_ESTILO.corpo },
    { value: "citacao_longa", label: ROTULO_ESTILO.citacao_longa },
  ];
  return (
    <Select
      aria-label="Estilo do parágrafo"
      size="sm"
      className="w-[184px]"
      value={estilo}
      options={opcoes}
      onChange={(evento) => {
        const novo = evento.target.value;
        if (novo !== "corpo" && novo !== "citacao_longa") return;
        editor
          .chain()
          .focus()
          .setNode(novo === "corpo" ? "paragraph" : "citacao_longa")
          .run();
      }}
    />
  );
}

// Tamanho da fonte do bloco do cursor — só leitura. Quem define é a norma,
// conforme o elemento (`estiloDaSelecao`, src/core/editor/estiloDoBloco.ts).
function IndicadorTamanho({ tamanhoPt }: { tamanhoPt: number | null }) {
  return (
    <Tooltip content="Tamanho definido pela ABNT para este elemento: 12 no texto, 10 na citação longa, nas notas e nas legendas. Para mudar, mude o estilo.">
      <output
        aria-label="Tamanho da fonte"
        className="flex h-[var(--control-h-sm)] w-14 shrink-0 items-center justify-center rounded-sm border border-[var(--border-subtle)] bg-sunken font-sans text-sm text-muted tabular-nums"
      >
        {tamanhoPt ?? "—"}
      </output>
    </Tooltip>
  );
}

interface ToolbarProps {
  editor: Editor | null;
  // Para o menu de citação (4.10) listar o que pode ser citado.
  references: readonly Referencia[];
  // Abre a barra de localizar e substituir (5.4.3).
  onBuscar?: () => void;
  // Apaga a seção do cursor — quem confirma é o `Editor.tsx`.
  onApagarSecao?: () => void;
  // Fonte do trabalho (`Metadados.fonte`); ausente é Times.
  fonte?: FonteTrabalho;
  onFonteChange?: (fonte: FonteTrabalho) => void;
}

// Ações de formatação da v1 (passo 2.5, estendida no 2B.12): negrito,
// itálico, nível de título e desfazer/refazer funcionam de verdade — os
// dois primeiros por clique aqui e por atalho direto na marca/nó (`Mod-b`/
// `Mod-i` em src/core/editor/marks/, `Mod-Alt-1..3` em
// src/core/editor/nodes/section.ts), o atalho de nível funciona mesmo sem
// esta barra montada; desfazer/refazer usam o atalho de fábrica do
// `@tiptap/extension-history` (`Mod-z`/`Mod-shift-z`), adicionado neste
// passo. Citação longa (passo 3.4.2) também é de verdade: alterna o bloco
// da seleção entre `paragrafo` e `citacao_longa`
// (`editor.chain().toggleNode("citacao_longa", "paragraph")`) — primeiro
// jeito de criar um `citacao_longa` pela interface (o nó existe desde 3.4.1,
// sem UI própria até aqui).
//
// Figura e tabela (passo 3.6.3) e fórmula (passo 3.6.5) também são de
// verdade: `insertContent()` com o nó que `novaFigura()`/`novaTabela()`/
// `novaFormula()` (src/core/document/factory.ts) produzem, convertido pra
// JSON do TipTap pela mesma `deNoConteudo()` do round-trip (`serialize.ts`)
// — não um literal montado aqui, que seria uma segunda definição da forma do
// nó. Os ids de figura e tabela saem de `crypto.randomUUID()` na fábrica,
// nunca de um default do schema (a fórmula não tem id: não é numerada nem
// listada). Tabela e fórmula são **só desktop**; ver o comentário em cada
// botão.
//
// A caixa de estilo troca o bloco entre corpo e citação longa, e o
// indicador de tamanho só mostra o que a norma fixa para o bloco
// (`CaixaEstilo` e `IndicadorTamanho`, abaixo). Sublinhado, justificar,
// lista e "Aplicar formatação ABNT" continuam visuais e desabilitados:
// prévia, não um controle que finge funcionar (`CONTROLES_FUTUROS`).
//
// Nível de título muda a seção mais próxima da seleção
// (`editor.chain().updateAttributes("secao", { nivel })`), não um parágrafo
// — não existe "Título 1" como estilo de parágrafo neste schema: o título é
// atributo da própria seção (docs/schema-tiptap.md §4.1).
export function Toolbar({
  editor,
  references,
  onBuscar,
  onApagarSecao,
  fonte,
  onFonteChange,
}: ToolbarProps) {
  useEstadoEditor(editor);

  if (!editor) return null;

  const nivelAtual = editor.getAttributes("secao").nivel as NivelSecao | undefined;
  const estilo = estiloDaSelecao(editor.state);

  // `insertContentAt(selection.to)`, não `insertContent()`: quando a seleção
  // é o nó inteiro — e é o que acontece logo depois de inserir uma figura,
  // que é atômica —, `insertContent()` SUBSTITUI o que está selecionado.
  // Clicar em "figura" e depois em "tabela" apagava a figura recém-criada.
  // Achado olhando a tela, não pelo Vitest: é comportamento de seleção do
  // ProseMirror, que só existe com um editor de verdade montado.
  // Depois de inserir, abre (ou reaproveita) uma linha logo abaixo do bloco e
  // deixa o cursor nela — `cursorDepoisDoBloco()`, src/core/editor/caret.ts.
  // Sem isto, inserir uma tabela no fim do documento era um beco sem saída:
  // não existe posição de texto entre o fim da tabela e o fim da seção, então
  // não havia onde clicar para continuar escrevendo (e, por tabela, nem como
  // inserir a figura seguinte).
  const inserirBloco = (no: NoConteudo) =>
    editor
      .chain()
      .focus()
      .insertContentAt(editor.state.selection.to, deNoConteudo(no))
      .command(({ tr }) => {
        const fim = fimDoBlocoAtual(tr.selection);
        if (fim !== null) cursorDepoisDoBloco(tr, fim);
        return true;
      })
      .run();

  return (
    <div
      role="toolbar"
      aria-label="Formatação"
      className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[var(--border-subtle)] bg-card px-2 py-1"
    >
      <BotaoToolbar
        label="Desfazer (Ctrl+Z)"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Icon name="undo-2" size={16} />
      </BotaoToolbar>
      <BotaoToolbar
        label="Refazer (Ctrl+Shift+Z)"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Icon name="redo-2" size={16} />
      </BotaoToolbar>

      <Divisor />

      <CaixaEstilo editor={editor} estilo={estilo.estilo} />
      {onFonteChange && (
        <Tooltip content="Fonte do trabalho inteiro — a ABNT aceita Times New Roman ou Arial; o tamanho não muda">
          <Select
            aria-label="Fonte do trabalho"
            size="sm"
            className="w-[150px]"
            value={fonte ?? "times"}
            options={[
              { value: "times", label: "Times New Roman" },
              { value: "arial", label: "Arial" },
            ]}
            onChange={(evento) => onFonteChange(evento.target.value as FonteTrabalho)}
          />
        </Tooltip>
      )}
      <IndicadorTamanho tamanhoPt={estilo.tamanhoPt} />

      <Divisor />

      <BotaoToolbar
        label="Negrito (Ctrl+B)"
        ativo={editor.isActive("negrito")}
        onClick={() => editor.chain().focus().toggleMark("negrito").run()}
      >
        <Icon name="bold" size={16} />
      </BotaoToolbar>
      <BotaoToolbar
        label="Itálico (Ctrl+I)"
        ativo={editor.isActive("italico")}
        onClick={() => editor.chain().focus().toggleMark("italico").run()}
      >
        <Icon name="italic" size={16} />
      </BotaoToolbar>
      <BotaoToolbar
        label="Citação longa (NBR 10520 — recuo 4 cm, fonte menor, espaço simples)"
        ativo={editor.isActive("citacao_longa")}
        onClick={() => editor.chain().focus().toggleNode("citacao_longa", "paragraph").run()}
      >
        <Icon name="quote" size={16} />
      </BotaoToolbar>
      {/*
        Citar só no desktop, pelo mesmo `hidden md:flex` do cadastro de
        referências (4.5): citar é escolher uma referência cadastrada, e o
        cadastro não existe no celular. A citação já inserida continua
        visível em qualquer largura.
      */}
      <MenuCitacao
        editor={editor}
        references={references}
        gatilho={({ abrir, ativo }) => (
          <BotaoToolbar
            label="Citar (só no computador) — liga o trecho selecionado a uma referência"
            className="hidden md:flex"
            ativo={ativo}
            onClick={abrir}
          >
            <Icon name="book-marked" size={16} />
          </BotaoToolbar>
        )}
      />
      <BotaoToolbar
        label="Figura — legenda e fonte numeradas automaticamente"
        onClick={() => inserirBloco(novaFigura())}
      >
        <Icon name="image" size={16} />
      </BotaoToolbar>
      {/*
        Tabela **só no desktop** (critério do passo 3.6.3): `hidden md:flex`,
        mesma abordagem de `PainelSecoes.tsx` pra reordenar arrastando
        (3.2.4). Montar uma grade célula a célula com o teclado virtual
        cobrindo metade da tela não é uma tarefa que a v1 se proponha a
        resolver; a tabela já criada continua visível e editável em qualquer
        largura — o que o breakpoint tira é o botão de CRIAR uma.
      */}
      <BotaoToolbar
        label="Tabela (só no computador) — padrão IBGE, laterais abertas"
        className="hidden md:flex"
        onClick={() => inserirBloco(novaTabela())}
      >
        <Icon name="table" size={16} />
      </BotaoToolbar>
      {/*
        Fórmula **só no desktop** (critério do passo 3.6.5), pelo mesmo
        `hidden md:flex` da tabela e pelo mesmo motivo: escrever LaTeX é
        digitar `\`, `{`, `}`, `^` e `_` o tempo todo, e num teclado virtual
        cada um deles está a duas camadas de distância. A fórmula já criada
        continua visível e editável em qualquer largura — o que o breakpoint
        tira é o botão de CRIAR uma.
      */}
      <BotaoToolbar
        label="Fórmula (só no computador) — escrita em LaTeX, destacada e centralizada"
        className="hidden md:flex"
        onClick={() => inserirBloco(novaFormula())}
      >
        <Icon name="sigma" size={16} />
      </BotaoToolbar>
      {/*
        Fórmula no meio da frase (passo 6.2.11) — só no computador, pelo
        mesmo motivo da de bloco. Sem `.focus()`, como a nota: o foco vai
        para o campo do LaTeX que o node view abre.
      */}
      <BotaoToolbar
        label="Fórmula no texto (só no computador) — escrita em LaTeX, no meio da frase"
        className="hidden md:flex"
        disabled={!podeInserirFormulaInline(editor.state)}
        onClick={() => editor.commands.command(({ tr }) => inserirFormulaInline(tr))}
      >
        <Icon name="radical" size={16} />
      </BotaoToolbar>
      {/*
        Nota de rodapé (passo 6.1.3c). Desligada onde a nota não cabe, como
        numa célula de tabela: `podeInserirNota()` pergunta ao schema.

        **Sem `.focus()`**, ao contrário dos outros botões: o foco vai para o
        campo da nota, que o node view abre (`NotaRodapeView`). O `focus()`
        do TipTap devolve o foco ao editor num quadro seguinte, e o tirava do
        campo logo depois de ele o receber.
      */}
      <BotaoToolbar
        label="Nota de rodapé — numerada automaticamente, no pé da página no .docx"
        disabled={!podeInserirNota(editor.state)}
        onClick={() => editor.commands.command(({ tr }) => inserirNotaRodape(tr))}
      >
        <Icon name="superscript" size={16} />
      </BotaoToolbar>
      {CONTROLES_FUTUROS.map((item) => (
        <BotaoToolbar key={item.nome} label={item.label} disabled>
          <Icon name={item.nome} size={16} />
        </BotaoToolbar>
      ))}

      <Divisor />

      {/*
        Criar seção (passo 6.2.7). Os botões de nível, ao lado, só mudam o
        nível da seção do cursor — antes disto eram o único controle de
        seção, e pareciam criar uma.
      */}
      <BotaoToolbar
        label="Nova seção — no mesmo nível da seção atual"
        onClick={() => criarSecaoNoEditor(editor, false)}
      >
        <Icon name="list-plus" size={16} />
      </BotaoToolbar>
      <BotaoToolbar
        label="Nova subseção — um nível abaixo da seção atual"
        onClick={() => criarSecaoNoEditor(editor, true)}
      >
        <Icon name="list-indent-increase" size={16} />
      </BotaoToolbar>
      {onApagarSecao && (
        <BotaoToolbar
          label={
            podeApagarSecao(editor.state.doc)
              ? "Apagar a seção atual — as subseções dela continuam"
              : "Apagar a seção atual — o trabalho precisa de pelo menos uma seção"
          }
          disabled={!podeApagarSecao(editor.state.doc)}
          onClick={onApagarSecao}
        >
          <Icon name="trash-2" size={16} />
        </BotaoToolbar>
      )}

      {NIVEIS.map((item) => (
        <BotaoToolbar
          key={item.nivel}
          label={`${item.label} (Ctrl+Alt+${item.nivel})`}
          ativo={nivelAtual === item.nivel}
          onClick={() =>
            editor.chain().focus().updateAttributes("secao", { nivel: item.nivel }).run()
          }
        >
          <Icon name={item.nomeIcone} size={16} />
        </BotaoToolbar>
      ))}

      <Divisor />

      {onBuscar && (
        <BotaoToolbar label="Localizar e substituir (Ctrl+F)" onClick={onBuscar}>
          <Icon name="search" size={16} />
        </BotaoToolbar>
      )}

      <BotaoToolbar
        label="Aplicar formatação ABNT — não é preciso: o trabalho já segue a norma na tela e na exportação"
        disabled
      >
        <Icon name="wand-sparkles" size={16} />
      </BotaoToolbar>
    </div>
  );
}
