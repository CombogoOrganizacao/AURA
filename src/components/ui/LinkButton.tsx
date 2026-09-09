import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { CLASSES_BASE_BOTAO, classesTamanho, classesVariante } from "./Button";
import type { ButtonSize, ButtonVariant } from "./Button";

interface LinkButtonProps extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

// `Button` com a forma de um botão, mas navegação de verdade — CTA de
// landing e barra superior ("Comece agora!", "Entrar") são links reais
// (rastreáveis, "abrir em nova aba" funciona), não `<button
// onClick={() => router.push(...)}>`. Mesmas classes de `Button.tsx`, a
// mesma fonte — nenhum valor duplicado à mão.
//
// Sem `loading`: um link em navegação não tem estado de carregamento
// próprio (a página de destino é que carrega); e sem `disabled`, porque
// `<a>` não tem esse atributo nativo — um CTA que não deveria ser clicável
// simplesmente não deveria ser um link.
export function LinkButton({
  variant = "primary",
  size = "md",
  icon,
  iconEnd,
  fullWidth = false,
  className = "",
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={[
        CLASSES_BASE_BOTAO,
        fullWidth ? "w-full" : "",
        classesTamanho[size],
        classesVariante[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {icon}
      {children}
      {iconEnd}
    </Link>
  );
}
