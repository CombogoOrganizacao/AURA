"use client";

import { cloneElement, isValidElement, useId, useState } from "react";
import type { ReactElement, ReactNode } from "react";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  placement?: TooltipPlacement;
  /** Elemento que dispara a dica no hover/foco — recebe `aria-describedby` automaticamente. */
  children: ReactNode;
}

const classesPosicao: Record<TooltipPlacement, string> = {
  top: "bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2",
  bottom: "top-[calc(100%+8px)] left-1/2 -translate-x-1/2",
  left: "right-[calc(100%+8px)] top-1/2 -translate-y-1/2",
  right: "left-[calc(100%+8px)] top-1/2 -translate-y-1/2",
};

// Dica curta no hover/foco (passo 2.2), nunca com ação ou link dentro —
// texto puro, no máximo cinco palavras, sem ponto final (ver
// `Tooltip.prompt.md` da skill). `role="tooltip"` + `aria-describedby` no
// gatilho (via `cloneElement`) em vez de só `title`: `title` não é acessível
// por teclado nem em telas de toque.
export function Tooltip({ content, placement = "top", children }: TooltipProps) {
  const [aberto, setAberto] = useState(false);
  const id = useId();

  const gatilho = isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": id,
      })
    : children;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
      onFocus={() => setAberto(true)}
      onBlur={() => setAberto(false)}
    >
      {gatilho}
      <span
        id={id}
        role="tooltip"
        className={[
          "pointer-events-none absolute z-40 whitespace-nowrap rounded-sm bg-ink-900 px-2.5 py-1",
          "font-sans text-2xs tracking-wide text-ink-50 shadow-md",
          "transition-opacity duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
          classesPosicao[placement],
          aberto ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        {content}
      </span>
    </span>
  );
}
