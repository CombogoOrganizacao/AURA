"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!persistencia) return;
    let cancelado = false;

    persistencia.listarDocumentos().then((lista) => {
      if (!cancelado) setDocumentos(lista);
    });

    return () => {
      cancelado = true;
    };
  }, [persistencia]);

  async function criarDocumento() {
    if (!persistencia) return;
    const documento = novoDocumento();
    await persistencia.salvarDocumento(documento);
    router.push(`/documento/${documento.id}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-8 p-10 font-sans">
      <h1 className="font-serif text-2xl font-bold text-title">Meus trabalhos</h1>

      <button
        type="button"
        onClick={criarDocumento}
        disabled={!persistencia}
        className="rounded-sm bg-bordo-700 px-4 py-2 text-sm font-medium text-on-bordo hover:bg-bordo-800 disabled:opacity-50"
      >
        Criar novo documento
      </button>

      {/* Estado vazio mostra só a ação de criar — nada de tabela vazia. */}
      {documentos === null ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-muted">Nenhum documento ainda.</p>
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
