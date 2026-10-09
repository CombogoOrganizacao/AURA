"use client";
// Formulário real (campos controlados, tipo de input correto), mas sem
// submit funcional — não há Firebase Auth na v1 (CLAUDE.md,
// docs/aura-decisoes-e-pendencias.md §1.11). O botão fica desabilitado, com
// o motivo escrito logo abaixo, e nunca finge sucesso. Sem "Continuar com o
// Google" da referência da skill: não há OAuth nenhum implementado, e um
// botão de terceiro que não faz nada seria pior que a ausência dele.

import Link from "next/link";
import { useState } from "react";

import { MolduraAutenticacao } from "@/components/auth/MolduraAutenticacao";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";

export default function EntrarPage() {
  const [manterConectado, setManterConectado] = useState(true);

  return (
    <MolduraAutenticacao
      titulo="Entrar"
      subtitulo="Acesse seus trabalhos de qualquer computador."
      rodape={
        <>
          Ainda não tem conta?{" "}
          <Link href="/cadastrar" className="text-bordo-700 underline hover:text-bordo-800">
            Criar conta gratuita
          </Link>
        </>
      }
    >
      <form onSubmit={(evento) => evento.preventDefault()} className="flex flex-col gap-4">
        <Input label="E-mail" type="email" placeholder="Ex.: marina.batista@unicap.br" required />
        <Input label="Senha" type="password" placeholder="Sua senha" required />

        <Checkbox
          checked={manterConectado}
          onChange={(evento) => setManterConectado(evento.target.checked)}
          label="Manter conectado"
        />

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" fullWidth disabled aria-describedby="entrar-indisponivel">
            Entrar
          </Button>
          <p id="entrar-indisponivel" className="text-center font-sans text-2xs text-subtle">
            O acesso por conta chega junto com a autenticação. Por enquanto, os trabalhos ficam
            salvos neste navegador.
          </p>
        </div>
      </form>
    </MolduraAutenticacao>
  );
}
