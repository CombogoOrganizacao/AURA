import Link from "next/link";
import type { ReactNode } from "react";

import { Brand } from "@/components/app/Brand";
import { Icon } from "@/components/ui/Icon";

interface MolduraAutenticacaoProps {
  titulo: string;
  subtitulo: ReactNode;
  /** Linha de rodapé do cartão: o link para a outra tela de acesso. */
  rodape: ReactNode;
  children: ReactNode;
}

// Moldura de /entrar e /cadastrar: a marca no alto e o formulário num cartão
// centralizado, sobre o fundo da aplicação. Substituiu (passo 6.6.4) a tela
// partida ao meio, com o painel bordô à esquerda: o formulário ficava
// espremido num canto, e o painel repetia a promessa da página inicial.
export function MolduraAutenticacao({ titulo, subtitulo, rodape, children }: MolduraAutenticacaoProps) {
  return (
    <div className="flex flex-1 flex-col items-center overflow-auto px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-1 flex-col justify-center gap-6">
        <div className="flex items-center justify-between">
          <Brand size={34} />
          <Link
            href="/"
            className="flex items-center gap-1.5 font-sans text-sm text-muted no-underline hover:text-body"
          >
            <Icon name="arrow-left" size={15} />
            Voltar
          </Link>
        </div>

        <main className="flex flex-col gap-5 rounded-lg border border-[var(--border-subtle)] bg-card p-8 shadow-sm">
          <div>
            <h1 className="text-2xl">{titulo}</h1>
            <p className="mt-1.5 font-sans text-xs text-muted">{subtitulo}</p>
          </div>
          {children}
        </main>

        <p className="text-center font-sans text-xs text-subtle">{rodape}</p>
      </div>
    </div>
  );
}
