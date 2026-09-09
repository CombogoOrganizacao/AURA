"use client";
// Sem estado próprio, mas quase todo uso real passa `onClick` — sem
// "use client" aqui, um `<Button onClick={...}>` direto num Server
// Component quebra o build ("Event handlers cannot be passed to Client
// Component props"), como aconteceu com `Toast` nesta página de amostra.

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícone à esquerda do rótulo. */
  icon?: ReactNode;
  /** Ícone à direita do rótulo (chevron, link externo). */
  iconEnd?: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
}

// Classes por variante — strings inteiras, nunca montadas por template
// literal: o build de produção poda variável de tema que só aparece via
// interpolação em runtime (achado do passo 2.1, documentado em
// docs/design.md). "Hover sempre escurece" é regra do sistema, nunca clareia.
// Exportados (só a partir do passo 2B.5) pra `LinkButton.tsx` reaproveitar
// exatamente as mesmas classes num `<a>` de navegação real — CTA de
// landing e barra superior precisam ser link de verdade (crawlable,
// "abrir em nova aba"), não botão com `onClick={() => router.push(...)}`.
export const classesVariante: Record<ButtonVariant, string> = {
  primary:
    "border border-bordo-700 bg-bordo-700 text-on-bordo hover:border-bordo-800 hover:bg-bordo-800 active:border-bordo-900 active:bg-bordo-900 disabled:border-transparent disabled:bg-[var(--action-disabled)] disabled:text-disabled",
  secondary:
    "border border-creme-400 bg-creme-300 text-on-creme hover:border-creme-500 hover:bg-creme-400 active:bg-creme-500 disabled:border-transparent disabled:bg-[var(--action-disabled)] disabled:text-disabled",
  outline:
    "border border-brand bg-card text-bordo-700 hover:bg-brand-soft disabled:border-[var(--border-subtle)] disabled:bg-transparent disabled:text-disabled",
  ghost:
    "border border-transparent bg-transparent text-bordo-700 hover:bg-brand-soft disabled:bg-transparent disabled:text-disabled",
  quiet:
    "border border-transparent bg-transparent text-muted hover:bg-sunken hover:text-body disabled:bg-transparent disabled:text-disabled",
  danger:
    "border border-danger bg-danger text-white hover:border-[#9c1f18] hover:bg-[#9c1f18] disabled:border-transparent disabled:bg-[var(--action-disabled)] disabled:text-disabled",
};

export const classesTamanho: Record<ButtonSize, string> = {
  sm: "h-[var(--control-h-sm)] gap-1.5 px-[var(--control-pad-x-sm)] text-xs",
  md: "h-[var(--control-h-md)] gap-2 px-[var(--control-pad-x-md)] text-sm",
  lg: "h-[var(--control-h-lg)] gap-2.5 px-[var(--control-pad-x-lg)] text-md",
};

// Classes que independem de variante/tamanho — a base geométrica e de
// movimento que qualquer superfície com a "forma" de botão usa, incluindo
// `LinkButton`. `active:translate-y-px`/`disabled:*` só fazem sentido em
// `<button>`; `LinkButton` (um `<a>`, sem estado `disabled` nativo) usa só
// a primeira linha.
export const CLASSES_BASE_BOTAO =
  "inline-flex items-center justify-center rounded-sm font-sans font-medium tracking-wide transition-[background-color,border-color,color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:shadow-focus-ring";

// Botão de ação (passo 2.2) — `primary` bordô uma vez por tela, `secondary`
// creme para a ação pareada, `outline`/`ghost`/`quiet` dentro de painel,
// `danger` para exclusão. Ver `Button.prompt.md` da skill `aura-design`.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    iconEnd,
    fullWidth = false,
    loading = false,
    disabled,
    className = "",
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const inativo = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={inativo}
      aria-busy={loading || undefined}
      className={[
        CLASSES_BASE_BOTAO,
        "active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0",
        fullWidth ? "w-full" : "",
        classesTamanho[size],
        classesVariante[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-[1em] shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      {children}
      {iconEnd}
    </button>
  );
});
