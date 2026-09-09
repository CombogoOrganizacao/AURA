"use client";

import type { Editor } from "@tiptap/core";
import { useCallback, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import type { NomeIcone } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
import type { NivelSecao } from "@/core/document/types";

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
  children: ReactNode;
}

function BotaoToolbar({ ativo, disabled, onClick, label, children }: BotaoToolbarProps) {
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

// "Seção nível N", não "Título de seção nível N": o rótulo acessível não
// pode conter "Título" — colide por substring com o campo de metadados
// `FormMetadados` ("Título" do trabalho), que vive na mesma tela
// (`getByLabel` do Playwright casa por substring, achou os dois — foi assim
// que a suíte e2e pegou isso).
const NIVEIS: ReadonlyArray<{ nivel: NivelSecao; nomeIcone: NomeIcone; label: string }> = [
  { nivel: 1, nomeIcone: "heading-1", label: "Seção nível 1" },
  { nivel: 2, nomeIcone: "heading-2", label: "Seção nível 2" },
  { nivel: 3, nomeIcone: "heading-3", label: "Seção nível 3" },
];

// Botões desabilitados do passo 2B.12 — controle, ícone, e a fase que liga
// cada um. Todo item aqui tem tooltip explicando o motivo (nunca só o nome
// do controle): é o critério do passo, "nenhum controle desabilitado é
// focável sem indicação do porquê". Cada fase citada é a que o
// docs/to-do.md já registra para aquele recurso — não um "em breve" vago.
const CONTROLES_FUTUROS: ReadonlyArray<{ nome: NomeIcone; label: string }> = [
  { nome: "underline", label: "Sublinhado — sem nó no schema ainda" },
  { nome: "align-justify", label: "Justificar — chega na Fase 3.3" },
  { nome: "list-ordered", label: "Lista numerada — chega na Fase 3" },
  { nome: "quote", label: "Citação longa — chega na Fase 3.4" },
  { nome: "table", label: "Tabela — chega na Fase 3.6" },
  { nome: "superscript", label: "Nota de rodapé — chega na Fase 6" },
];

interface ToolbarProps {
  editor: Editor | null;
}

// Ações de formatação da v1 (passo 2.5, estendida no 2B.12): negrito,
// itálico, nível de título e desfazer/refazer funcionam de verdade — os
// dois primeiros por clique aqui e por atalho direto na marca/nó (`Mod-b`/
// `Mod-i` em src/core/editor/marks/, `Mod-Alt-1..3` em
// src/core/editor/nodes/section.ts), o atalho de nível funciona mesmo sem
// esta barra montada; desfazer/refazer usam o atalho de fábrica do
// `@tiptap/extension-history` (`Mod-z`/`Mod-shift-z`), adicionado neste
// passo.
//
// Todo o resto — estilo de parágrafo, fonte do documento, corpo, sublinhado,
// justificar, lista, citação longa, tabela, nota de rodapé, "Aplicar
// formatação ABNT" — é visual e desabilitado: prévia do que a Fase 3+ liga,
// não um controle que finge funcionar. `CONTROLES_FUTUROS` cobre os
// botões de ícone; os três seletores (`Select`, também desabilitados)
// ficam escritos por extenso abaixo porque cada um tem opções próprias.
//
// Nível de título muda a seção mais próxima da seleção
// (`editor.chain().updateAttributes("secao", { nivel })`), não um parágrafo
// — não existe "Título 1" como estilo de parágrafo neste schema: o título é
// atributo da própria seção (docs/schema-tiptap.md §4.1).
export function Toolbar({ editor }: ToolbarProps) {
  useEstadoEditor(editor);

  if (!editor) return null;

  const nivelAtual = editor.getAttributes("secao").nivel as NivelSecao | undefined;

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

      <Tooltip content="Estilo de parágrafo — a Fase 3 unifica isso com o nível de seção">
        <Select
          aria-label="Estilo de parágrafo"
          disabled
          size="sm"
          className="w-[168px]"
          options={[
            "Corpo do texto",
            "Título 1 (seção primária)",
            "Título 2 (seção secundária)",
            "Citação longa (recuo 4 cm)",
            "Legenda",
          ]}
        />
      </Tooltip>
      <Tooltip content="Fonte do documento — escolha do usuário, chega na Fase 3.3">
        <Select
          aria-label="Fonte do documento"
          disabled
          size="sm"
          className="w-[132px]"
          options={["Times New Roman", "Arial"]}
        />
      </Tooltip>
      <Tooltip content="Tamanho por elemento — chega na Fase 3.3">
        <Select
          aria-label="Corpo"
          disabled
          size="sm"
          className="w-14"
          options={["10", "11", "12"]}
        />
      </Tooltip>

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
      {CONTROLES_FUTUROS.map((item) => (
        <BotaoToolbar key={item.nome} label={item.label} disabled>
          <Icon name={item.nome} size={16} />
        </BotaoToolbar>
      ))}

      <Divisor />

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

      <BotaoToolbar label="Aplicar formatação ABNT — chega na Fase 3" disabled>
        <Icon name="wand-sparkles" size={16} />
      </BotaoToolbar>
    </div>
  );
}
