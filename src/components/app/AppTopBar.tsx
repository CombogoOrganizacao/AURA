"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";

import { Brand } from "./Brand";
import { UserChip } from "./UserChip";

export type AppTopBarMode = "guest" | "app" | "editor";

interface AppTopBarProps {
  mode: AppTopBarMode;
  /** Modo `editor`: título do documento, ao lado do botão de voltar. */
  docTitle?: string;
  /** Modo `editor`: status do autosave ("Salvo", "Salvando…"...), já pronto. */
  statusAutosave?: ReactNode;
  /** Modo `editor`: slot de ações — o botão "Exportar .docx" existente. */
  acoes?: ReactNode;
}

const NAV_APP = [
  { href: "/documentos", label: "Meus documentos" },
  { href: "/editais", label: "Central de editais" },
] as const;

// Uma barra, três modos — `guest` na landing, `app` nas telas internas,
// `editor` sobre o documento. Altura fixa `--topbar-h`. A marca aparece
// nos três modos (mesmo lockup, mesmo destino de clique); o modo `editor`
// soma um botão de voltar contextual — redundante com a marca em destino,
// mas é o padrão do próprio UI kit de referência (Overleaf-like: logo
// sempre no canto, voltar contextual dentro da barra de trabalho).
export function AppTopBar({ mode, docTitle, statusAutosave, acoes }: AppTopBarProps) {
  const caminho = usePathname();

  return (
    <header className="flex h-[var(--topbar-h)] shrink-0 items-center gap-6 border-b border-[var(--border-subtle)] bg-card px-6">
      <Brand href={mode === "guest" ? "/" : "/documentos"} />

      {mode === "guest" && (
        <>
          <nav className="flex flex-1 items-center justify-center gap-6">
            <Link
              href="/#recursos"
              className="font-sans text-sm text-body no-underline hover:text-bordo-700"
            >
              Recursos
            </Link>
            <Link
              href="/#normas"
              className="flex items-center gap-1.5 font-sans text-sm text-body no-underline hover:text-bordo-700"
            >
              <Icon name="ruler" size={15} />
              Como funcionam as normas ABNT
            </Link>
          </nav>
          <Link
            href="/entrar"
            className="font-sans text-sm text-body no-underline hover:text-bordo-700"
          >
            Entrar
          </Link>
          <LinkButton href="/cadastrar" size="md">
            Comece grátis
          </LinkButton>
        </>
      )}

      {mode === "app" && (
        <>
          <nav className="flex flex-1 items-stretch gap-5 self-stretch">
            {NAV_APP.map((item) => {
              const ativo = caminho === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={[
                    "-mb-px flex items-center border-b-2 px-0.5 font-sans text-sm no-underline",
                    "transition-[color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
                    ativo
                      ? "border-bordo-700 font-semibold text-bordo-700"
                      : "border-transparent text-muted hover:text-body",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <UserChip />
        </>
      )}

      {mode === "editor" && (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Link
              href="/documentos"
              aria-label="Voltar aos documentos"
              className="flex shrink-0 text-muted hover:text-body"
            >
              <Icon name="arrow-left" size={17} />
            </Link>
            <span className="truncate font-serif text-md text-body">
              {docTitle || "Documento sem título"}
            </span>
            {statusAutosave && (
              <span className="flex shrink-0 items-center gap-1 font-sans text-2xs text-subtle">
                {statusAutosave}
              </span>
            )}
          </div>
          {acoes}
          <UserChip />
        </>
      )}
    </header>
  );
}
