import type { HTMLAttributes } from "react";

export type BadgeTone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Fundo cheio em vez de suave. */
  solid?: boolean;
  /** Marcador circular à esquerda. */
  dot?: boolean;
}

// Etiqueta de estado, só leitura: "Conforme", "3 pendências", "Em breve".
// Cápsula de 11px, uma ou duas palavras em sentence case. Badge **não é
// clicável** — chip selecionável ou removível é `Tag`.
//
// A referência da skill traz uma borda em hex literal para cada tom
// semântico (`#bfe0cd`, `#eed9a5`…), valores que não existem na paleta: as
// semânticas não têm degrau `-200`. Aqui a borda sai do próprio token com
// modificador de opacidade (`border-success/30`), que o Tailwind v4 resolve
// a partir da variável de tema — nenhum valor literal novo entra no sistema.
const classesTomSuave: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-700 border-ink-200",
  brand: "bg-bordo-50 text-bordo-700 border-bordo-200",
  accent: "bg-creme-100 text-creme-700 border-creme-300",
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  info: "bg-info-soft text-info border-info/30",
};

const classesTomCheio: Record<BadgeTone, string> = {
  neutral: "bg-ink-700 text-white border-ink-700",
  brand: "bg-bordo-700 text-on-bordo border-bordo-700",
  accent: "bg-creme-300 text-on-creme border-creme-300",
  success: "bg-success text-white border-success",
  warning: "bg-warning text-white border-warning",
  danger: "bg-danger text-white border-danger",
  info: "bg-info text-white border-info",
};

export function Badge({
  tone = "neutral",
  solid = false,
  dot = false,
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "font-sans text-2xs font-medium tracking-wide whitespace-nowrap",
        solid ? classesTomCheio[tone] : classesTomSuave[tone],
        className,
      ].join(" ")}
      {...rest}
    >
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
