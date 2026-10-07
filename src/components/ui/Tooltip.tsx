"use client";

import { cloneElement, isValidElement, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  placement?: TooltipPlacement;
  /** Elemento que dispara a dica no hover/foco — recebe `aria-describedby` automaticamente. */
  children: ReactNode;
}

// Distância entre o gatilho e a dica, e margem mínima até a borda da janela.
const ESPACO = 8;

// Dica curta no hover/foco (passo 2.2), nunca com ação ou link dentro —
// texto puro, sem ponto final (ver `Tooltip.prompt.md` da skill).
// `role="tooltip"` + `aria-describedby` no gatilho (via `cloneElement`) em
// vez de só `title`: `title` não é acessível por teclado nem em telas de
// toque.
//
// **A dica é desenhada no `body`, com posição fixa**, calculada pelo gatilho
// no momento em que abre. Dentro dele, como `absolute`, ela era cortada por
// qualquer contêiner com `overflow` (a coluna central da edição) e ficava sob
// o painel lateral. A posição é limitada à janela, e o texto quebra linha a
// partir de 18rem.
export function Tooltip({ content, placement = "top", children }: TooltipProps) {
  const [posicao, setPosicao] = useState<{ left: number; top: number } | null>(null);
  const gatilhoRef = useRef<HTMLSpanElement>(null);
  const dicaRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  // O portal só existe no cliente: no servidor não há `body`, e o HTML da
  // hidratação tem de ser igual ao do servidor.
  const noCliente = useSyncExternalStore(
    nuncaMuda,
    () => true,
    () => false,
  );

  // A dica já existe, invisível: dá para medi-la antes de mostrar.
  function abrir() {
    const gatilho = gatilhoRef.current?.getBoundingClientRect();
    const dica = dicaRef.current?.getBoundingClientRect();
    if (gatilho && dica) setPosicao(calcularPosicao(placement, gatilho, dica));
  }

  const gatilho = isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": id,
      })
    : children;

  return (
    <span
      ref={gatilhoRef}
      className="relative inline-flex"
      onMouseEnter={abrir}
      onMouseLeave={() => setPosicao(null)}
      onFocus={abrir}
      onBlur={() => setPosicao(null)}
    >
      {gatilho}
      {noCliente &&
        createPortal(
          <span
            ref={dicaRef}
            id={id}
            role="tooltip"
            style={posicao ?? { left: 0, top: 0 }}
            className={[
              "pointer-events-none fixed z-[60] w-max max-w-[18rem] rounded-sm bg-ink-900 px-2.5 py-1",
              "font-sans text-2xs tracking-wide text-ink-50 shadow-md",
              "transition-opacity duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
              posicao ? "opacity-100" : "invisible opacity-0",
            ].join(" ")}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}

function nuncaMuda(): () => void {
  return () => {};
}

function calcularPosicao(
  placement: TooltipPlacement,
  gatilho: DOMRect,
  dica: DOMRect,
): { left: number; top: number } {
  const centroX = gatilho.left + gatilho.width / 2 - dica.width / 2;
  const centroY = gatilho.top + gatilho.height / 2 - dica.height / 2;
  const desejada = {
    top: { left: centroX, top: gatilho.top - dica.height - ESPACO },
    bottom: { left: centroX, top: gatilho.bottom + ESPACO },
    left: { left: gatilho.left - dica.width - ESPACO, top: centroY },
    right: { left: gatilho.right + ESPACO, top: centroY },
  }[placement];
  // Sem espaço acima, a dica de cima passa para baixo do gatilho.
  if (placement === "top" && desejada.top < ESPACO) desejada.top = gatilho.bottom + ESPACO;
  return {
    left: limitar(desejada.left, ESPACO, window.innerWidth - dica.width - ESPACO),
    top: limitar(desejada.top, ESPACO, window.innerHeight - dica.height - ESPACO),
  };
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(valor, Math.max(minimo, maximo)));
}
