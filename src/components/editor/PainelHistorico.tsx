"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EstadoCarregando, EstadoVazio } from "@/components/ui/Estados";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import type { ResumoVersao } from "@/core/persistence/types";
import { LIMITE_VERSOES_AUTOMATICAS } from "@/core/persistence/versions";
import type { EstadoHistorico } from "@/lib/useVersaoAutomatica";

interface PainelHistoricoProps {
  historico: EstadoHistorico;
}

const FORMATO_DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Aba Histórico do inspetor (passo 5.3.2). No alto, gravar uma versão com
// nome; embaixo, a linha do tempo do kit de design, da mais recente para a
// mais antiga.
//
// Do kit fica a linha do tempo. O "Restaurar" de cada item é o passo 5.3.3.
// Os eventos do kit ("margens aplicadas", "sumário regenerado") não existem
// aqui: o histórico registra versões do documento, não ações.
export function PainelHistorico({ historico }: PainelHistoricoProps) {
  const { versoes, falhouAutomatica } = historico;

  return (
    <div className="flex flex-col gap-5">
      <FormVersaoNomeada salvar={historico.salvarNomeada} />

      {falhouAutomatica && (
        <Alert tone="warning" title="A última versão automática não foi gravada">
          O texto continua salvo. A próxima edição tenta de novo.
        </Alert>
      )}

      {versoes === null ? (
        <EstadoCarregando texto="Carregando histórico…" />
      ) : versoes.length === 0 ? (
        <EstadoVazio
          icon={<Icon name="history" size={20} />}
          titulo="Nenhuma versão ainda"
          descricao="Enquanto você escreve, uma versão é gravada a cada 10 minutos."
        />
      ) : (
        <LinhaDoTempo versoes={versoes} />
      )}

      <p className="font-sans text-2xs leading-relaxed text-subtle">
        Ficam as {LIMITE_VERSOES_AUTOMATICAS} versões automáticas mais recentes. As versões com
        nome ficam sempre.
      </p>
    </div>
  );
}

function FormVersaoNomeada({ salvar }: { salvar: (nome: string) => Promise<void> }) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await salvar(nome);
      setNome("");
    } catch {
      setErro("Não foi possível gravar a versão. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2.5">
      <Input
        label="Nome da versão"
        hint="Um marco para voltar depois, como “Enviada ao orientador”."
        size="sm"
        value={nome}
        maxLength={80}
        error={erro}
        onChange={(evento) => setNome(evento.target.value)}
      />
      <Button type="submit" size="sm" variant="outline" disabled={!nome.trim()} loading={salvando}>
        Salvar versão
      </Button>
    </form>
  );
}

function LinhaDoTempo({ versoes }: { versoes: readonly ResumoVersao[] }) {
  return (
    <ol aria-label="Versões" className="flex flex-col">
      {versoes.map((versao, indice) => {
        const ultima = indice === versoes.length - 1;
        return (
          <li key={versao.id} className={`flex gap-2.75 ${ultima ? "" : "pb-4"}`}>
            <div className="flex shrink-0 flex-col items-center">
              <span
                className={[
                  "flex size-6.5 items-center justify-center rounded-full",
                  versao.automatica ? "bg-sunken text-muted" : "bg-brand-soft text-bordo-700",
                ].join(" ")}
              >
                <Icon name={versao.automatica ? "history" : "book-marked"} size={14} />
              </span>
              {!ultima && <span className="mt-1 w-px flex-1 bg-[var(--border-subtle)]" />}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="font-sans text-sm leading-snug break-words text-body">
                {versao.nome ?? "Versão automática"}
              </p>
              <p className="mt-1 font-mono text-2xs text-subtle">
                <time dateTime={versao.criadoEm.toISOString()}>
                  {FORMATO_DATA.format(versao.criadoEm)}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
