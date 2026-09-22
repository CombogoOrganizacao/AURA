"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

import { Icon } from "./Icon";

// `useSyncExternalStore` sem inscrição real: só para diferenciar
// servidor/cliente de um jeito seguro pra hidratação, sem `setState` dentro
// de `useEffect` (o lint de hooks recusa isso — "cascading renders").
function inscreverNoop() {
  return () => {};
}
function instantaneoCliente() {
  return true;
}
function instantaneoServidor() {
  return false;
}

interface DialogProps {
  open: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Rodapé com os botões, alinhados à direita — cancelar (`ghost`) à esquerda do confirmar (`primary`). */
  footer?: ReactNode;
  /** Largura em px. 420 confirmação, 520 padrão, 720 formulário. */
  width?: number;
  onClose?: () => void;
  /**
   * Devolver o foco a quem abriu, ao fechar (padrão). `false` quando quem
   * abriu decide para onde o foco vai — o menu de citação (4.10) o devolve ao
   * texto, e não ao botão da toolbar: com o foco no botão, o Enter de quem
   * continua escrevendo reabria o menu.
   */
  restaurarFoco?: boolean;
  children?: ReactNode;
}

const seletorFocavel =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modal (passo 2.2). Diferenças deliberadas em relação à referência da skill
// (que só posiciona `absolute` dentro do ancestral e não trata teclado):
// aqui é produção — portal para `document.body` (`fixed inset-0`, cobre a
// viewport inteira, não só o container relativo), Esc fecha, clique no véu
// fecha, foco vai para o primeiro elemento focável ao abrir e volta pro
// gatilho ao fechar, Tab não escapa do diálogo (`aoTeclar`), scroll da
// página trava enquanto aberto. Renderiza só depois de montar no cliente —
// `document` não existe durante SSR.
export function Dialog({
  open,
  title,
  subtitle,
  footer,
  width = 520,
  onClose,
  restaurarFoco = true,
  children,
}: DialogProps) {
  const montado = useSyncExternalStore(inscreverNoop, instantaneoCliente, instantaneoServidor);
  const dialogRef = useRef<HTMLDivElement>(null);
  const focoAnteriorRef = useRef<HTMLElement | null>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!open) return;

    focoAnteriorRef.current = document.activeElement as HTMLElement | null;
    const raiz = document.documentElement;
    const overflowOriginal = raiz.style.overflow;
    raiz.style.overflow = "hidden";

    const primeiroFocavel = dialogRef.current?.querySelector<HTMLElement>(seletorFocavel);
    (primeiroFocavel ?? dialogRef.current)?.focus();

    return () => {
      raiz.style.overflow = overflowOriginal;
      if (restaurarFoco) focoAnteriorRef.current?.focus();
    };
  }, [open, restaurarFoco]);

  if (!open || !montado) return null;

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      onClose?.();
      return;
    }
    if (evento.key !== "Tab" || !dialogRef.current) return;

    const focaveis = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(seletorFocavel));
    if (focaveis.length === 0) return;

    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  function aoClicarVeu(evento: MouseEvent<HTMLDivElement>) {
    if (evento.target === evento.currentTarget) onClose?.();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,37,34,0.42)] p-6 backdrop-blur-[2px]"
      onClick={aoClicarVeu}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? tituloId : undefined}
        tabIndex={-1}
        onKeyDown={aoTeclar}
        style={{ width, maxWidth: "100%" }}
        className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-card shadow-lg outline-none"
      >
        <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
          <div className="flex flex-col gap-0.5">
            {title && (
              <h2 id={tituloId} className="font-serif text-xl text-title">
                {title}
              </h2>
            )}
            {subtitle && <p className="font-sans text-xs text-muted">{subtitle}</p>}
          </div>
          {onClose && (
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="-m-1 flex shrink-0 rounded-xs p-1 text-muted transition-colors hover:text-body focus-visible:outline-none focus-visible:shadow-focus-ring"
            >
              <Icon name="x" size={18} />
            </button>
          )}
        </header>
        <div className="px-5 pb-5 font-sans text-sm leading-normal text-body">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-[var(--border-subtle)] bg-sunken px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
