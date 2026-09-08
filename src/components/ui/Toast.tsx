"use client";
// `onDismiss` vira um botão com `onClick` — mesmo motivo do "use client" em
// `Button.tsx`.

import type { ReactNode } from "react";

import { Icon } from "./Icon";
import type { NomeIcone } from "./Icon";

export type ToastTone = "neutral" | "success" | "danger";

interface ToastProps {
  tone?: ToastTone;
  message: ReactNode;
  /** Segunda linha, opcional. */
  detail?: ReactNode;
  /** Ação curta ("Desfazer"). */
  action?: ReactNode;
  onDismiss?: () => void;
}

// `#7fd6a6`/`#f0a6a0` são os únicos dois hexadecimais literais do sistema de
// componentes: tons de sucesso/erro pensados para contraste sobre bordô-800
// (escuro), não sobre `--surface-card` como o resto da paleta semântica —
// por isso não usam `--color-success`/`--color-danger`. Vêm exatos da
// referência da skill (`Toast.jsx`), não inventados aqui.
const iconePorTom: Record<ToastTone, { nome: NomeIcone; classe: string }> = {
  neutral: { nome: "info", classe: "text-creme-300" },
  success: { nome: "check", classe: "text-[#7fd6a6]" },
  danger: { nome: "circle-alert", classe: "text-[#f0a6a0]" },
};

// Confirmação flutuante (passo 2.2) — a única superfície escura da AURA.
// Relata fato consumado ("Documento exportado"), nunca promessa
// ("Exportando…") — ver `readme.md` da skill, seção CONTENT FUNDAMENTALS.
// Só o componente de apresentação; fila/posicionamento/auto-dismiss ficam
// para quando houver uma tela que precise deles — não antecipar aqui.
export function Toast({ tone = "neutral", message, detail, action, onDismiss }: ToastProps) {
  const { nome, classe } = iconePorTom[tone];
  return (
    <div
      role="alert"
      className="flex min-w-[280px] max-w-[420px] items-center gap-3 rounded-md bg-bordo-800 px-3.5 py-2.5 text-on-bordo shadow-lg"
    >
      <span className={`flex shrink-0 ${classe}`}>
        <Icon name={nome} size={17} />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="font-sans text-sm font-medium">{message}</span>
        {detail && <span className="font-sans text-2xs opacity-75">{detail}</span>}
      </div>
      {action}
      {onDismiss && (
        <button
          type="button"
          aria-label="Fechar"
          onClick={onDismiss}
          className="flex shrink-0 text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  );
}
