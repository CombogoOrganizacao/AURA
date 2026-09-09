"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";

// Sem autenticação na v1 (Firebase Auth é pré-requisito de acesso público,
// não desta fase — CLAUDE.md, `docs/aura-decisoes-e-pendencias.md` §1.11):
// não há nome, e-mail ou instituição reais pra mostrar. O avatar é um
// ícone genérico, não iniciais de um nome inventado, e o único item do
// menu é "Sair", desabilitado com a explicação — nada aqui finge sessão
// ativa. Quando o Auth existir, isto ganha nome/e-mail reais e os itens
// voltam a fazer sentido.
export function UserChip() {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("pointerdown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="flex items-center gap-2 rounded-sm border border-transparent bg-transparent p-1 transition-colors hover:bg-sunken focus-visible:outline-none focus-visible:shadow-focus-ring"
      >
        <span
          aria-hidden="true"
          className="flex size-[30px] items-center justify-center rounded-full bg-creme-300 text-bordo-800"
        >
          <Icon name="user" size={16} />
        </span>
        <Icon name="chevron-down" size={14} className="text-muted" />
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-[42px] z-10 flex w-56 flex-col gap-0.5 rounded-md border border-[var(--border-subtle)] bg-card p-1.5 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled
            className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-left font-sans text-sm text-disabled disabled:cursor-not-allowed"
          >
            <Icon name="log-out" size={15} />
            Sair
          </button>
          <p className="px-2.5 pb-1 font-sans text-2xs text-subtle">
            Disponível quando a autenticação existir.
          </p>
        </div>
      )}
    </div>
  );
}
