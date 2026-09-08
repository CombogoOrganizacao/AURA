"use client";

import { forwardRef, useId } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";

import { CampoShell } from "./CampoShell";
import { Icon } from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
}

export type SelectSize = "sm" | "md" | "lg";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  size?: SelectSize;
  /** Strings simples ou `{ value, label }`. Ignorado se `children` for passado. */
  options?: Array<string | SelectOption>;
}

const classesAltura: Record<SelectSize, string> = {
  sm: "h-[var(--control-h-sm)]",
  md: "h-[var(--control-h-md)]",
  lg: "h-[var(--control-h-lg)]",
};

// Seletor nativo estilizado (passo 2.2) — normas, formatos de citação,
// idioma, natureza do trabalho. `<select>` nativo (teclado e acessibilidade
// de graça) com o chevron sobreposto via `Icon`; mesma moldura de `Input`.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, options, size = "md", id, className = "", children, ...rest },
  ref,
) {
  const idGerado = useId();
  const uid = id ?? idGerado;

  return (
    <CampoShell label={label} hint={hint} error={error} required={required} htmlFor={uid}>
      <div className="relative flex items-center">
        <select
          ref={ref}
          id={uid}
          required={required}
          className={[
            "w-full appearance-none rounded-sm border pl-[var(--control-pad-x-md)] pr-8 shadow-inset",
            "font-sans text-sm text-body outline-none",
            "transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
            "bg-card disabled:cursor-not-allowed disabled:bg-sunken disabled:text-disabled disabled:shadow-none",
            "cursor-pointer disabled:cursor-not-allowed",
            classesAltura[size],
            error
              ? "border-danger focus:shadow-focus-ring"
              : "border-[var(--border-default)] hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:shadow-focus-ring",
            "disabled:border-[var(--action-disabled)] disabled:hover:border-[var(--action-disabled)]",
            className,
          ].join(" ")}
          {...rest}
        >
          {children ??
            options?.map((opcao) =>
              typeof opcao === "string" ? (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ) : (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ),
            )}
        </select>
        <span className="pointer-events-none absolute right-3 flex text-muted">
          <Icon name="chevron-down" size={15} />
        </span>
      </div>
    </CampoShell>
  );
});
