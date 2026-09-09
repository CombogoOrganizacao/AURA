import type { HTMLAttributes, ReactNode } from "react";

export type CardTone = "default" | "brand" | "accent" | "sunken";

// `title` do HTML nativo é string (vira tooltip do navegador); aqui é o
// título do cartão e aceita nó React — daí o `Omit`.
interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Botões no canto superior direito. */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Espaçamento interno. Aceita qualquer comprimento CSS; padrão 20px. */
  padding?: string;
  tone?: CardTone;
  /** Cartão clicável: hover eleva a sombra. */
  interactive?: boolean;
}

// Superfície em que todo painel, item de lista e bloco de conteúdo se apoia.
// Raio 10px (`--radius-lg`), borda 1px cinza-quente, sombra sutil.
//
// **Nunca** borda colorida só à esquerda — é uma das duas proibições
// explícitas do sistema (a outra é glassmorphism). Aviso com cor de estado é
// papel do `Alert`, que usa fundo suave + borda inteira da mesma família.
const classesTom: Record<CardTone, string> = {
  default: "bg-card border-[var(--border-subtle)]",
  brand: "bg-brand-soft border-bordo-200",
  accent: "bg-accent-soft border-creme-300",
  sunken: "bg-sunken border-[var(--border-subtle)]",
};

export function Card({
  title,
  subtitle,
  actions,
  footer,
  padding = "var(--gutter-panel)",
  tone = "default",
  interactive = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <section
      className={[
        "rounded-lg border shadow-sm",
        "transition-[box-shadow,border-color] duration-[var(--dur-normal)] ease-[var(--ease-standard)]",
        classesTom[tone],
        interactive ? "cursor-pointer hover:border-[var(--border-default)] hover:shadow-md" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {(title || actions) && (
        <header
          className="flex items-start justify-between gap-4"
          style={{ padding: `var(--space-4) ${padding} 0` }}
        >
          <div className="flex flex-col gap-0.5">
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {subtitle && <p className="font-sans text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}

      <div style={{ padding }}>{children}</div>

      {footer && (
        <footer
          className="border-t border-[var(--border-subtle)] font-sans text-xs text-muted"
          style={{ padding: `var(--space-3) ${padding}` }}
        >
          {footer}
        </footer>
      )}
    </section>
  );
}
