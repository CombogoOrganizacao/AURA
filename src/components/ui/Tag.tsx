"use client";
// Recebe `onClick` e `onRemove` na maioria dos usos reais (filtros do painel
// de conformidade, palavras-chave). Mesmo motivo de `Button` e `Toast`: sem
// esta fronteira, passar um handler direto de um Server Component quebra o
// build.

import type { MouseEvent, ReactNode } from "react";

import { Icon } from "./Icon";

interface TagProps {
  /** Estado escolhido: bordô sólido. */
  selected?: boolean;
  /** Quando passado, mostra o "x" de remoção. */
  onRemove?: (evento: MouseEvent) => void;
  onClick?: (evento: MouseEvent<HTMLButtonElement>) => void;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

// Chip selecionável ou removível: filtros de revisão, palavras-chave,
// coautores. Mais quadrado que o `Badge` — raio 4px, altura 26px — porque é
// um controle, e controles usam `--radius-sm`. Etiqueta de leitura é `Badge`.
export function Tag({
  selected = false,
  onRemove,
  onClick,
  icon,
  className = "",
  children,
}: TagProps) {
  const clicavel = Boolean(onClick);

  return (
    <span
      className={[
        "inline-flex h-[26px] items-center gap-1.5 rounded-sm border px-2.5",
        "font-sans text-xs font-medium",
        "transition-[background-color,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
        selected
          ? "border-bordo-700 bg-bordo-700 text-on-bordo"
          : "border-[var(--border-default)] bg-card text-body",
        clicavel && !selected ? "hover:border-bordo-300 hover:bg-bordo-50" : "",
        className,
      ].join(" ")}
    >
      {clicavel ? (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={selected}
          className="-mx-2.5 -my-1 inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-2.5 py-1 focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          {icon}
          {children}
        </button>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}

      {onRemove && (
        <button
          type="button"
          aria-label="Remover"
          onClick={(evento) => {
            evento.stopPropagation();
            onRemove(evento);
          }}
          className="inline-flex cursor-pointer rounded-sm opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </span>
  );
}
