"use client";
// Formulário real (campos controlados, tipo de input correto), mas sem
// submit funcional — não há Firebase Auth na v1 (CLAUDE.md,
// docs/aura-decisoes-e-pendencias.md §1.11). O botão fica desabilitado com
// a frase explicando o motivo, nunca finge sucesso. Sem "Continuar com o
// Google" da referência da skill: não há OAuth nenhum implementado, e um
// botão de terceiro que não faz nada seria pior que a ausência dele.

import Link from "next/link";
import { useState } from "react";

import { PainelAutenticacao } from "@/components/auth/PainelAutenticacao";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";

export default function EntrarPage() {
  const [manterConectado, setManterConectado] = useState(true);

  return (
    <div className="grid flex-1 grid-cols-2">
      <PainelAutenticacao />

      <div className="flex items-center justify-center px-15">
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
            <h1 className="text-2xl">Entrar</h1>
            <p className="mt-1.5 text-xs text-muted">
              A ativação de contas chega junto com a autenticação.
            </p>
          </div>

          <Input label="E-mail" type="email" placeholder="Ex.: marina.batista@unicap.br" required />
          <Input label="Senha" type="password" placeholder="Sua senha" required />

          <Checkbox
            checked={manterConectado}
            onChange={(evento) => setManterConectado(evento.target.checked)}
            label="Manter conectada"
          />

          <Button type="submit" size="lg" fullWidth disabled>
            Entrar — disponível quando a autenticação existir
          </Button>

          <p className="text-center text-2xs text-subtle">
            Ainda não tem conta? <Link href="/cadastrar">Criar conta gratuita</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
