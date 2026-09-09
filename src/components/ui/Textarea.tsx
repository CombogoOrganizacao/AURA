"use client";

import { forwardRef, useId, useState } from "react";
import type { ReactNode, TextareaHTMLAttributes } from "react";

import { CampoShell } from "./CampoShell";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  /** Substitui a dica e pinta a borda de vermelho. */
  error?: ReactNode;
  /** Mostra contador "atual/maxLength" — exige `maxLength`. */
  counter?: boolean;
}

// Campo multilinha para resumo, comentário e parágrafo colado — usa a
// serifada do documento (`font-serif`/Newsreader), não a de interface: o que
// se digita aqui é texto acadêmico, não rótulo de formulário. Mesmo padrão
// de foco/desabilitado de `Input.tsx` via `:has()` no invólucro — exceto o
// contador, que precisa mesmo de estado React porque depende do comprimento
// do texto, algo que nenhuma pseudo-classe CSS expõe.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error,
    required,
    counter,
    maxLength,
    rows = 4,
    id,
    className = "",
    onChange,
    ...rest
  },
  ref,
) {
  const idGerado = useId();
  const uid = id ?? idGerado;
  const [comprimento, setComprimento] = useState(
    () => String(rest.value ?? rest.defaultValue ?? "").length,
  );

  return (
    <CampoShell label={label} hint={hint} error={error} required={required} htmlFor={uid}>
      <div className="has-[:disabled]:bg-sunken relative rounded-sm">
        <textarea
          ref={ref}
          id={uid}
          rows={rows}
          maxLength={maxLength}
          required={required}
          onChange={(evento) => {
            if (counter) setComprimento(evento.target.value.length);
            onChange?.(evento);
          }}
          className={[
            "w-full resize-y rounded-sm border px-[var(--control-pad-x-md)] py-2.5 shadow-inset",
            "font-serif text-md leading-relaxed text-body outline-none",
            "transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
            "placeholder:font-sans placeholder:text-sm placeholder:text-subtle",
            "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-disabled disabled:shadow-none",
            error
              ? "border-danger focus:shadow-focus-ring"
              : "border-[var(--border-default)] hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:shadow-focus-ring",
            counter && maxLength ? "pb-6" : "",
            className,
          ].join(" ")}
          {...rest}
        />
        {counter && maxLength && (
          <span className="pointer-events-none absolute right-2.5 bottom-2 font-mono text-2xs text-subtle">
            {comprimento}/{maxLength}
          </span>
        )}
      </div>
    </CampoShell>
  );
});
