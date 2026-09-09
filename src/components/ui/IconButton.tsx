"use client";
// Quase todo uso passa `onClick` (barra de ferramentas, cabeçalho de painel).
// Mesma fronteira de `Button`.

import type { ButtonHTMLAttributes } from "react";

import { Icon, type NomeIcone } from "./Icon";

export type IconButtonVariant = "ghost" | "outline" | "solid";
export type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  name: NomeIcone;
  /** Rótulo acessível, em pt-BR. Vira `aria-label` e `title`. Obrigatório. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Ferramenta ligada — chip bordô-suave, o mesmo "selecionado" do sistema. */
  active?: boolean;
}

// Botão quadrado só com ícone: barra de ferramentas, cabeçalho de painel.
// `name` é tipado como `NomeIcone` (não `string` como no `.d.ts` da skill) —
// aqui o mapa de ícones é fechado e o TypeScript pode garantir em build que
// o glifo existe, coisa que o protótipo em JSX não tinha como fazer.
const classesVariante: Record<IconButtonVariant, string> = {
  ghost:
    "border border-transparent bg-transparent text-muted hover:bg-bordo-50 hover:text-bordo-700",
  outline: "border border-[var(--border-default)] bg-card text-bordo-700 hover:bg-bordo-50",
  solid:
    "border border-bordo-700 bg-bordo-700 text-on-bordo hover:border-bordo-800 hover:bg-bordo-800",
};

// `active` **substitui** as classes de cor da variante, não se soma a elas.
// Somar produzia `bg-transparent` (ghost) e `bg-brand-soft` (active) no mesmo
// elemento: mesma especificidade, e quem vence é a ordem no CSS gerado, não a
// ordem no atributo `class` — o chip de ferramenta ligada simplesmente não
// pintava. Pego lendo estilo computado contra `npm start`, não olhando o
// print. Em `solid` o botão já está cheio de bordô: ligado ou não é a mesma
// superfície, então a variante prevalece.
const classesAtivo: Record<IconButtonVariant, string> = {
  ghost: "border border-bordo-200 bg-brand-soft text-bordo-700 hover:bg-bordo-100",
  outline: "border border-bordo-200 bg-brand-soft text-bordo-700 hover:bg-bordo-100",
  solid:
    "border border-bordo-800 bg-bordo-800 text-on-bordo hover:border-bordo-900 hover:bg-bordo-900",
};

const classesTamanho: Record<IconButtonSize, string> = {
  sm: "size-[var(--control-h-sm)]",
  md: "size-[var(--control-h-md)]",
  lg: "size-[var(--control-h-lg)]",
};

const tamanhoGlifo: Record<IconButtonSize, number> = { sm: 15, md: 18, lg: 20 };

export function IconButton({
  name,
  label,
  variant = "ghost",
  size = "md",
  active = false,
  disabled = false,
  className = "",
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-sm",
        "transition-[background-color,border-color,color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
        "focus-visible:outline-none focus-visible:shadow-focus-ring",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-disabled disabled:hover:bg-transparent",
        classesTamanho[size],
        active ? classesAtivo[variant] : classesVariante[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      <Icon name={name} size={tamanhoGlifo[size]} />
    </button>
  );
}
