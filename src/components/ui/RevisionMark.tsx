import type { CSSProperties, HTMLAttributes } from "react";

export type RevisionMarkKind = "insert" | "delete" | "comment" | "norm" | "citation";

interface RevisionMarkProps extends HTMLAttributes<HTMLElement> {
  kind?: RevisionMarkKind;
  /** Texto do tooltip nativo com o motivo. */
  note?: string;
}

// Marcação inline no corpo do documento — a linguagem visual da camada de
// revisão da AURA. Cada `kind` mapeia 1:1 pra um `--revision-*`; essas cinco
// cores **nunca** aparecem fora do texto do documento (regra da paleta,
// docs/design.md). Cores em valor literal (não classe Tailwind) porque
// cada `kind` mistura cor de texto, decoração e fundo com opacidade
// diferentes — não há utilitário `bg-revision-insert/8` pronto pra isso, e
// criar um só para cinco casos exclusivos não vale a indireção.
const ESTILO_POR_TIPO: Record<RevisionMarkKind, CSSProperties> = {
  insert: {
    color: "var(--color-revision-insert)",
    textDecoration: "underline",
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    background: "rgba(31, 111, 74, 0.08)",
  },
  delete: {
    color: "var(--color-revision-delete)",
    textDecoration: "line-through",
    background: "rgba(179, 38, 30, 0.08)",
  },
  comment: {
    background: "var(--color-revision-comment)",
    boxShadow: "inset 0 -2px 0 var(--color-creme-400)",
  },
  norm: {
    background: "var(--color-bordo-50)",
    boxShadow: "inset 0 -2px 0 var(--color-bordo-300)",
    color: "var(--color-bordo-800)",
  },
  citation: {
    color: "var(--color-revision-citation)",
    background: "rgba(43, 90, 126, 0.08)",
    boxShadow: "inset 0 -2px 0 rgba(43, 90, 126, 0.35)",
  },
};

export function RevisionMark({
  kind = "comment",
  note,
  style,
  children,
  ...rest
}: RevisionMarkProps) {
  return (
    <mark
      title={note}
      style={{
        padding: "0 1px",
        borderRadius: "2px",
        cursor: note ? "help" : "inherit",
        background: "transparent",
        ...ESTILO_POR_TIPO[kind],
        ...style,
      }}
      {...rest}
    >
      {children}
    </mark>
  );
}
