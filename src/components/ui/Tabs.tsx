"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
}

export type TabsVariant = "underline" | "segmented";

interface TabsProps {
  items: TabItem[];
  /** Controlado; omita para estado interno. */
  value?: string;
  onChange?: (id: string) => void;
  variant?: TabsVariant;
  "aria-label"?: string;
}

// Abas (passo 2.2) — `underline` para navegação de página (Meus documentos /
// Central de editais), `segmented` para alternar vista dentro de um painel
// (ex.: histórico de versões). `count` renderiza um marcador monoespaçado —
// usar para contagem de pendência, nunca decorativo.
export function Tabs({ items, value, onChange, variant = "underline", ...rest }: TabsProps) {
  const [internoAtivo, setInternoAtivo] = useState(value ?? items[0]?.id);
  const ativo = value ?? internoAtivo;
  const idBase = useId();
  const segmentado = variant === "segmented";

  function selecionar(id: string) {
    setInternoAtivo(id);
    onChange?.(id);
  }

  return (
    <div
      role="tablist"
      className={
        segmentado
          ? "inline-flex items-center gap-1 rounded-md bg-sunken p-[3px]"
          : "flex items-center gap-5 border-b border-[var(--border-subtle)]"
      }
      {...rest}
    >
      {items.map((item) => {
        const on = item.id === ativo;
        return (
          <button
            key={item.id}
            id={`${idBase}-${item.id}`}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={item.disabled}
            onClick={() => selecionar(item.id)}
            className={[
              "inline-flex items-center gap-1.5 font-sans text-sm",
              "transition-[color,background-color,border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
              "focus-visible:outline-none focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:text-disabled",
              on ? "font-semibold" : "font-normal",
              segmentado
                ? on
                  ? "h-[30px] rounded-sm bg-card px-3 text-bordo-700 shadow-xs"
                  : "h-[30px] rounded-sm bg-transparent px-3 text-muted hover:text-body"
                : on
                  ? "-mb-px border-b-2 border-bordo-700 pb-2.5 text-bordo-700"
                  : "-mb-px border-b-2 border-transparent pb-2.5 text-muted hover:text-body",
            ].join(" ")}
          >
            {item.icon}
            {item.label}
            {item.count != null && (
              <span
                className={[
                  "rounded-full px-1.5 py-px font-mono text-2xs",
                  on ? "bg-bordo-100 text-bordo-700" : "bg-ink-100 text-muted",
                ].join(" ")}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
