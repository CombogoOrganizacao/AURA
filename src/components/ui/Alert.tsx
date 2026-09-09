"use client";
// `onDismiss` é função — mesma fronteira de `Toast`.

import type { HTMLAttributes, ReactNode } from "react";

import { Icon, type NomeIcone } from "./Icon";

export type AlertTone = "info" | "success" | "warning" | "danger" | "brand";

// `title` do HTML nativo é string; aqui é o título do aviso e aceita nó
// React (mesmo caso do `Card`).
interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: AlertTone;
  title?: ReactNode;
  /** Botões abaixo do texto. */
  action?: ReactNode;
  /** Presente = mostra o "x" de fechar. */
  onDismiss?: () => void;
}

// Aviso fixo no fluxo da página — pendência de norma, resultado de
// exportação, limite. Fundo suave + borda inteira da mesma família; para
// confirmação passageira o componente é `Toast`, não este.
//
// O ícone é fixo por tom, não escolhido por quem usa — é o que garante que
// "atenção" sempre pareça "atenção" no sistema inteiro.
const configTom: Record<AlertTone, { classes: string; icone: NomeIcone }> = {
  info: { classes: "bg-info-soft border-info/30 text-info", icone: "info" },
  success: { classes: "bg-success-soft border-success/30 text-success", icone: "check-check" },
  warning: { classes: "bg-warning-soft border-warning/30 text-warning", icone: "triangle-alert" },
  danger: { classes: "bg-danger-soft border-danger/30 text-danger", icone: "circle-alert" },
  brand: { classes: "bg-brand-soft border-bordo-200 text-bordo-700", icone: "book-marked" },
};

export function Alert({
  tone = "info",
  title,
  action,
  onDismiss,
  className = "",
  children,
  ...rest
}: AlertProps) {
  const { classes, icone } = configTom[tone];

  return (
    <div
      role="status"
      className={["flex gap-3 rounded-md border p-3.5", classes, className].join(" ")}
      {...rest}
    >
      <span className="mt-px flex shrink-0">
        <Icon name={icone} size={18} />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        {title && <strong className="font-sans text-sm font-semibold">{title}</strong>}
        {children && <div className="font-sans text-xs leading-normal text-body">{children}</div>}
        {action && <div className="mt-1.5 flex gap-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Fechar"
          onClick={onDismiss}
          className="flex h-[18px] shrink-0 cursor-pointer border-none bg-transparent p-0 text-muted focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
