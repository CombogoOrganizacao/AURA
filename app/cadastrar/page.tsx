"use client";
// Mesma ressalva de app/entrar/page.tsx: campos reais, submit desabilitado
// — não há Firebase Auth na v1. "Nível de estudo" da referência da skill
// (Graduação/Mestrado/Doutorado…) não entrou: a v1 só oferece TCC
// (CLAUDE.md, "Escopo da v1"; src/core/standards/workTypes.ts expõe só
// `tcc` por essa mesma razão) — um seletor de nível sugeriria suporte a
// tipos de trabalho que a interface não tem.

import Link from "next/link";
import { useState } from "react";

import { PainelAutenticacao } from "@/components/auth/PainelAutenticacao";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";

export default function CadastrarPage() {
  const [aceitouTermos, setAceitouTermos] = useState(false);

  return (
    <div className="grid flex-1 grid-cols-2">
      <PainelAutenticacao />

      <div className="flex items-center justify-center overflow-auto px-15 py-10">
        <form
          onSubmit={(evento) => evento.preventDefault()}
          className="flex w-full max-w-[340px] flex-col gap-4"
        >
          <Link
            href="/"
            className="-ml-2.5 flex items-center gap-1.5 self-start font-sans text-sm text-muted no-underline hover:text-body"
          >
            <Icon name="arrow-left" size={15} />
            Voltar
          </Link>

          <div>
            <h1 className="text-2xl">Criar conta</h1>
            <p className="mt-1.5 text-xs text-muted">
              Gratuita, sem limite de documentos e sem cartão de crédito.
            </p>
          </div>

          <Input label="Nome completo" placeholder="Ex.: Marina Batista" required />
          <Input
            label="E-mail institucional"
            type="email"
            placeholder="Ex.: marina.batista@unicap.br"
            required
          />
          <Input label="Senha" type="password" placeholder="Mínimo de 8 caracteres" required />

          <Checkbox
            checked={aceitouTermos}
            onChange={(evento) => setAceitouTermos(evento.target.checked)}
            label="Aceito os termos de uso e a política de privacidade"
          />

          <Button type="submit" size="lg" fullWidth disabled>
            Criar conta — disponível quando a autenticação existir
          </Button>

          <p className="text-center text-2xs text-subtle">
            Já tem conta? <Link href="/entrar">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
