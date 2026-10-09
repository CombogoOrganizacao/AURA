"use client";
// Mesma ressalva de app/entrar/page.tsx: campos reais, submit desabilitado
// — não há Firebase Auth na v1. "Nível de estudo" da referência da skill
// (Graduação/Mestrado/Doutorado…) não entrou: a v1 só oferece TCC
// (CLAUDE.md, "Escopo da v1"; src/core/standards/workTypes.ts expõe só
// `tcc` por essa mesma razão) — um seletor de nível sugeriria suporte a
// tipos de trabalho que a interface não tem.

import Link from "next/link";
import { useState } from "react";

import { MolduraAutenticacao } from "@/components/auth/MolduraAutenticacao";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";

export default function CadastrarPage() {
  const [aceitouTermos, setAceitouTermos] = useState(false);

  return (
    <MolduraAutenticacao
      titulo="Criar conta"
      subtitulo="Gratuita, sem limite de documentos e sem cartão de crédito."
      rodape={
        <>
          Já tem conta? <Link href="/entrar" className="text-bordo-700 underline hover:text-bordo-800">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={(evento) => evento.preventDefault()} className="flex flex-col gap-4">
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

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled
            aria-describedby="cadastrar-indisponivel"
          >
            Criar conta
          </Button>
          <p id="cadastrar-indisponivel" className="text-center font-sans text-2xs text-subtle">
            O cadastro chega junto com a autenticação. Por enquanto, os trabalhos ficam salvos neste
            navegador.
          </p>
        </div>
      </form>
    </MolduraAutenticacao>
  );
}
