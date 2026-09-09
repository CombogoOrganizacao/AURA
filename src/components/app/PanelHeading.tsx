import type { ReactNode } from "react";

interface PanelHeadingProps {
  children: ReactNode;
  /** Ação alinhada à direita (ex.: IconButton "Nova seção"). */
  action?: ReactNode;
}

// Rótulo de agrupamento em caixa alta de 11px — um dos dois lugares do
// sistema em que CAIXA ALTA é permitida (o outro é título de seção dentro
// do documento). Cabeçalho de painel lateral: "Seções", "Normas em uso".
export function PanelHeading({ children, action }: PanelHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3">
      <span className="font-sans text-2xs tracking-caps text-subtle uppercase">{children}</span>
      {action}
    </div>
  );
}
