"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { RotuloComDescricao } from "./RotuloComDescricao";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
}

// Liga/desliga imediato — preferências de revisão, autossalvamento. Sempre
// controlado, como o `Radio`: um switch sem `onChange` fica preso no estado
// inicial, e "preferência que não muda" não é o caso de uso.
//
// Pino vira creme quando ligado (`checked`) — é o único lugar do sistema em
// que o creme marca "ativado" fora de botão secundário.
export function Switch({
  label,
  description,
  checked = false,
  disabled = false,
  id,
  className = "",
  ...rest
}: SwitchProps) {
  const idGerado = useId();
  const uid = id ?? idGerado;

  return (
    <label
      htmlFor={uid}
      className={[
        "flex items-center justify-between gap-3",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      <RotuloComDescricao label={label} description={description} />
      <input
        id={uid}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        className="peer sr-only"
        {...rest}
      />
      <span
        aria-hidden="true"
        className={[
          "relative flex h-[22px] w-[38px] shrink-0 rounded-full",
          "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
          "peer-focus-visible:shadow-focus-ring",
          checked ? "bg-bordo-700" : "bg-ink-300",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "absolute top-[3px] size-4 rounded-full shadow-xs",
            "transition-[left,background-color] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
            checked ? "left-[19px] bg-creme-300" : "left-[3px] bg-white",
          ].join(" ")}
        />
      </span>
    </label>
  );
}
