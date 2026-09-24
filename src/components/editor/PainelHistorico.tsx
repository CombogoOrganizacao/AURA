"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
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
// Do kit fica a linha do tempo, com o "Restaurar" de cada item (passo
// 5.3.3). Os eventos do kit ("margens aplicadas", "sumário regenerado") não
// existem aqui: o histórico registra versões do documento, não ações.
//
// Restaurar pede confirmação e nunca descarta o texto de agora: ele vira a
// versão nomeada "Antes de restaurar…" (`restaurarVersao`, versions.ts). O
// "Restaurar" aparece também na versão mais recente, ao contrário do kit:
// o texto pode ter mudado depois dela.
export function PainelHistorico({ historico }: PainelHistoricoProps) {
  const { versoes, falhouAutomatica } = historico;
  const [aRestaurar, setARestaurar] = useState<ResumoVersao | null>(null);
  const [restaurada, setRestaurada] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <FormVersaoNomeada salvar={historico.salvarNomeada} />

      {restaurada && (
        <Alert tone="success" title="Versão restaurada" onDismiss={() => setRestaurada(null)}>
          O texto de antes está no histórico: <strong>{restaurada}</strong>.
        </Alert>
      )}

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
        <LinhaDoTempo versoes={versoes} onRestaurar={setARestaurar} />
      )}

      {aRestaurar && (
        <ConfirmarRestauracao
          versao={aRestaurar}
          restaurar={historico.restaurar}
          aoFechar={() => setARestaurar(null)}
          aoRestaurar={(nomeDoAnterior) => {
            setARestaurar(null);
            setRestaurada(nomeDoAnterior);
          }}
        />
      )}

      <p className="font-sans text-2xs leading-relaxed text-subtle">
        Ficam as {LIMITE_VERSOES_AUTOMATICAS} versões automáticas mais recentes. As versões com nome
        ficam sempre.
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

// Como a versão aparece para o aluno: o nome, ou a data da automática.
function rotulo(versao: ResumoVersao): string {
  return versao.nome ?? `Versão automática de ${FORMATO_DATA.format(versao.criadoEm)}`;
}

function ConfirmarRestauracao({
  versao,
  restaurar,
  aoFechar,
  aoRestaurar,
}: {
  versao: ResumoVersao;
  restaurar: EstadoHistorico["restaurar"];
  aoFechar: () => void;
  aoRestaurar: (nomeDoAnterior: string) => void;
}) {
  const [restaurando, setRestaurando] = useState(false);
  const [erro, setErro] = useState(false);
  const nomeDoAnterior = `Antes de restaurar “${rotulo(versao)}”`;

  async function confirmar() {
    setRestaurando(true);
    setErro(false);
    try {
      await restaurar(versao.id, nomeDoAnterior);
      aoRestaurar(nomeDoAnterior);
    } catch {
      setErro(true);
      setRestaurando(false);
    }
  }

  return (
    <Dialog
      open
      width={420}
      title="Restaurar esta versão?"
      onClose={restaurando ? undefined : aoFechar}
      footer={
        <>
          <Button variant="ghost" onClick={aoFechar} disabled={restaurando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} loading={restaurando}>
            Restaurar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 font-sans text-sm leading-relaxed text-body">
        <p>
          O documento inteiro volta a ser o de <strong>{rotulo(versao)}</strong>: corpo, dados do
          trabalho e referências.
        </p>
        <p>
          O texto de agora não se perde. Ele fica no histórico como{" "}
          <strong>{nomeDoAnterior}</strong>, e dá para voltar a ele do mesmo jeito.
        </p>
        {erro && (
          <Alert tone="danger" title="Não foi possível restaurar">
            O documento continua como estava. Tente de novo.
          </Alert>
        )}
      </div>
    </Dialog>
  );
}

function LinhaDoTempo({
  versoes,
  onRestaurar,
}: {
  versoes: readonly ResumoVersao[];
  onRestaurar: (versao: ResumoVersao) => void;
}) {
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
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <time
                  dateTime={versao.criadoEm.toISOString()}
                  className="font-mono text-2xs text-subtle"
                >
                  {FORMATO_DATA.format(versao.criadoEm)}
                </time>
                {/* Link sublinhado, como no kit; o nome acessível diz qual versão. */}
                <button
                  type="button"
                  onClick={() => onRestaurar(versao)}
                  aria-label={`Restaurar ${rotulo(versao)}`}
                  className="cursor-pointer rounded-xs font-sans text-2xs text-bordo-700 underline hover:text-bordo-800 focus-visible:shadow-focus-ring focus-visible:outline-none"
                >
                  Restaurar
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
