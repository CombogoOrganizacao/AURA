"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { CampoShell } from "./CampoShell";

export type InputSize = "sm" | "md" | "lg";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  /** Substitui a dica e pinta a borda de vermelho. */
  error?: ReactNode;
  size?: InputSize;
  /** Ícone à esquerda (busca, link). */
  icon?: ReactNode;
  /** Texto curto à direita (unidade, contador). */
  suffix?: ReactNode;
}

const classesAltura: Record<InputSize, string> = {
  sm: "h-[var(--control-h-sm)]",
  md: "h-[var(--control-h-md)]",
  lg: "h-[var(--control-h-lg)]",
};

// Campo de texto de uma linha (passo 2.2), com rótulo/dica/erro em pt-BR via
// `CampoShell`. Sombra inset em repouso, anel de foco bordô, borda vermelha
// em erro — mesmos tokens de `docs/design.md`. O foco/desabilitado do campo
// usam `:has()` no invólucro em vez de estado React (o `<input>` nativo já
// expõe isso via pseudo-classe; replicar em JS seria reescrever o que o
// navegador faz de graça).
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, size = "md", icon, suffix, id, className = "", ...rest },
  ref,
) {
  const idGerado = useId();
  const uid = id ?? idGerado;

  return (
    <CampoShell label={label} hint={hint} error={error} required={required} htmlFor={uid}>
      <div
        className={[
          "flex items-center gap-2 rounded-sm border px-[var(--control-pad-x-md)] shadow-inset",
          "transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
          "has-[:disabled]:bg-sunken has-[:disabled]:shadow-none bg-card",
          classesAltura[size],
          error
            ? "border-danger has-[:focus]:shadow-focus-ring"
            : "border-[var(--border-default)] hover:border-[var(--border-strong)] has-[:focus]:border-[var(--border-focus)] has-[:focus]:shadow-focus-ring",
          "has-[:disabled]:border-[var(--action-disabled)] has-[:disabled]:hover:border-[var(--action-disabled)]",
        ].join(" ")}
      >
        {icon && <span className="flex shrink-0 text-muted">{icon}</span>}
        <input
          ref={ref}
          id={uid}
          required={required}
          className={[
            "min-w-0 flex-1 border-none bg-transparent font-sans text-sm text-body outline-none",
            "placeholder:text-subtle disabled:cursor-not-allowed disabled:text-disabled",
            className,
          ].join(" ")}
          {...rest}
        />
        {suffix && <span className="shrink-0 font-sans text-2xs text-subtle">{suffix}</span>}
      </div>
    </CampoShell>
  );
});
