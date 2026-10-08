"use client";
// Sem estado próprio, mas quase todo uso real passa `onClick` — sem
// "use client" aqui, um `<Button onClick={...}>` direto num Server
// Component quebra o build ("Event handlers cannot be passed to Client
// Component props"), como aconteceu com `Toast` nesta página de amostra.

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { CLASSES_BASE_BOTAO, classesTamanho, classesVariante } from "./classesBotao";
import type { ButtonSize, ButtonVariant } from "./classesBotao";

export type { ButtonSize, ButtonVariant } from "./classesBotao";

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
