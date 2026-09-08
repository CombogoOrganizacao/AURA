"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "@/components/ui/Estados";
import { novoDocumento } from "@/core/document/factory";
import type { ResumoDocumento } from "@/core/persistence/types";
import { usePersistencia } from "@/lib/persistence-provider";

// Lista provisória (passo 1.3.5) — estilo "Meus Trabalhos" do
// docs/aura-decisoes-e-pendencias.md §1.12: título, última modificação,
// ação de criar. Sem busca, ordenação ou exclusão ainda; isso é backlog de
// telas, não deste passo.
export default function Home() {
  const persistencia = usePersistencia();
  const router = useRouter();
  const [documentos, setDocumentos] = useState<ResumoDocumento[] | null>(null);
  const [erroAoListar, setErroAoListar] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!persistencia) return;
    let cancelado = false;

    persistencia
      .listarDocumentos()
      .then((lista) => {
        if (!cancelado) setDocumentos(lista);
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        console.error("Falha ao listar documentos:", erro);
        setErroAoListar(true);
      });

    return () => {
      cancelado = true;
    };
  }, [persistencia, tentativa]);

  async function criarDocumento() {
    if (!persistencia) return;
    const documento = novoDocumento();
    await persistencia.salvarDocumento(documento);
    router.push(`/documento/${documento.id}`);
  }

  // Reseta pro estado de carregamento aqui, não no efeito acima — é o
  // clique que decide voltar a carregar, o efeito só reage à mudança de
  // `tentativa` (setState síncrono dentro de efeito é o que o lint de hooks
  // recusa; ver o mesmo caso em `Dialog.tsx`, passo 2.2).
  function tentarDeNovo() {
    setDocumentos(null);
    setErroAoListar(false);
    setTentativa((n) => n + 1);
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-8 p-10 font-sans">
      <h1 className="font-serif text-2xl font-bold text-title">Meus trabalhos</h1>

      <Button onClick={criarDocumento} disabled={!persistencia}>
        Criar novo documento
      </Button>

      {/* Estado vazio mostra só a ação de criar (acima) — nada de tabela vazia. */}
      {erroAoListar ? (
        <EstadoErro
          titulo="Não foi possível carregar seus documentos."
          action={
            <Button variant="outline" onClick={tentarDeNovo}>
              Tentar de novo
            </Button>
          }
        />
      ) : documentos === null ? (
        <EstadoCarregando />
      ) : documentos.length === 0 ? (
        <EstadoVazio titulo="Nenhum documento ainda." />
      ) : (
        <ul className="flex w-full max-w-xl flex-col gap-2">
          {documentos.map((documento) => (
            <li key={documento.id}>
              <Link
                href={`/documento/${documento.id}`}
                className="flex items-center justify-between rounded-lg border border-ink-200 bg-card px-4 py-3 hover:bg-bordo-50"
              >
                <span className="text-body">{documento.titulo || "Documento sem título"}</span>
                <span className="text-xs text-subtle">
                  {documento.atualizadoEm.toLocaleDateString("pt-BR")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
