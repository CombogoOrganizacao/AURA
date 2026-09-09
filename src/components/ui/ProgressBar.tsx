import type { HTMLAttributes, ReactNode } from "react";

export type ProgressBarTone = "brand" | "accent" | "success" | "warning" | "danger";
export type ProgressBarSize = "sm" | "md" | "lg";

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  label?: ReactNode;
  /** Valor à direita, em monoespaçada ("82%", "12/14"). */
  valueLabel?: ReactNode;
  tone?: ProgressBarTone;
  size?: ProgressBarSize;
}

// Progresso determinado — análise em curso, índice de conformidade. Nunca
// indeterminado: não há spinner aqui, é `Button`'s `loading` que cobre isso.
const classesFundo: Record<ProgressBarTone, string> = {
  brand: "bg-bordo-700",
  accent: "bg-creme-400",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const classesAltura: Record<ProgressBarSize, string> = {
  sm: "h-1",
  md: "h-1.5",
  lg: "h-2.5",
};

export function ProgressBar({
  value = 0,
  max = 100,
  label,
  valueLabel,
  tone = "brand",
  size = "md",
  className = "",
  ...rest
}: ProgressBarProps) {
  const porcentagem = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")} {...rest}>
      {(label || valueLabel) && (
        <div className="flex justify-between gap-3 font-sans text-2xs text-muted">
          <span>{label}</span>
          <span className="font-mono text-body">{valueLabel}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemax={max}
        className={["overflow-hidden rounded-full bg-ink-200", classesAltura[size]].join(" ")}
      >
        <div
          className={[
            "h-full rounded-full transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out)]",
            classesFundo[tone],
          ].join(" ")}
          style={{ width: `${porcentagem}%` }}
        />
      </div>
    </div>
  );
}
