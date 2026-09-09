"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { RotuloComDescricao } from "./RotuloComDescricao";

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
}

// Escolha única num grupo (mesmo `name`) — tipo de trabalho, nível de
// revisão. Sempre controlado: ao contrário de `Checkbox`, um grupo de radio
// sem `onChange` não tem sentido — teria dois ou mais campos travados no
// valor inicial, sem forma de trocar entre eles.
export function Radio({
  label,
  description,
  checked,
  disabled = false,
  id,
  className = "",
  ...rest
}: RadioProps) {
  const idGerado = useId();
  const uid = id ?? idGerado;

  return (
    <label
      htmlFor={uid}
      className={[
        "flex items-start gap-2.5",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      <input
        id={uid}
        type="radio"
        checked={Boolean(checked)}
        disabled={disabled}
        className="peer sr-only"
        {...rest}
      />
      <span
        aria-hidden="true"
        className={[
          "mt-px flex size-[18px] shrink-0 rounded-full bg-card",
          "transition-[border-color,border-width] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
          "peer-focus-visible:shadow-focus-ring",
          checked
            ? "border-[5px] border-bordo-700"
            : "border border-[var(--border-strong)] shadow-inset",
        ].join(" ")}
      />
      <RotuloComDescricao label={label} description={description} />
    </label>
  );
}
