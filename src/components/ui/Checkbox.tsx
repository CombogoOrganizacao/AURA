"use client";

import { useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { Icon } from "./Icon";
import { RotuloComDescricao } from "./RotuloComDescricao";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked"> {
  label?: ReactNode;
  description?: ReactNode;
  /** Controlado — exige `onChange`. Sem `onChange`, o componente alterna sozinho. */
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
}

// Caixa de seleção 18px, marca creme sobre bordô — regra de norma na Fase 5
// (revisão de regras), item de checklist.
//
// Modo não-controlado quando não há `onChange`: sem isso, um `<Checkbox
// checked />` sem handler dispara o aviso do React de "controlled input
// without onChange" e trava sem alternar — a referência da skill resolve o
// mesmo jeito. `peer` no `<input>` real leva o anel de foco até a réplica
// visual (`peer-focus-visible:`) sem duplicar estado de foco em React.
export function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  indeterminate = false,
  disabled = false,
  onChange,
  id,
  className = "",
  ...rest
}: CheckboxProps) {
  const idGerado = useId();
  const uid = id ?? idGerado;
  const naoControlado = onChange === undefined;
  const [proprio, setProprio] = useState(Boolean(checked ?? defaultChecked));
  const marcado = naoControlado ? proprio : Boolean(checked);
  const ligado = marcado || indeterminate;

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
        type="checkbox"
        disabled={disabled}
        className="peer sr-only"
        {...(naoControlado
          ? { checked: proprio, onChange: (e) => setProprio(e.target.checked) }
          : { checked: Boolean(checked), onChange })}
        {...rest}
      />
      <span
        aria-hidden="true"
        className={[
          "mt-px flex size-[18px] shrink-0 items-center justify-center rounded-xs text-creme-200",
          "transition-[background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
          "peer-focus-visible:shadow-focus-ring",
          ligado
            ? "border border-bordo-700 bg-bordo-700"
            : "border border-[var(--border-strong)] bg-card shadow-inset",
        ].join(" ")}
      >
        {indeterminate ? (
          <Icon name="minus" size={13} />
        ) : marcado ? (
          <Icon name="check" size={13} />
        ) : null}
      </span>
      <RotuloComDescricao label={label} description={description} />
    </label>
  );
}
