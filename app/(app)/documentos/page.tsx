"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TabelaDocumentos } from "@/components/documentos/TabelaDocumentos";
import { Button } from "@/components/ui/Button";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "@/components/ui/Estados";
import { Icon } from "@/components/ui/Icon";
import { novoDocumento } from "@/core/document/factory";
import type { ResumoDocumento } from "@/core/persistence/types";
import { usePersistencia } from "@/lib/persistence-provider";

// "Meus documentos" (passo 2B.8) — o que vivia em `app/page.tsx` antes da
// landing (2B.6) tomar essa rota; a lógica de carregar/criar/repetir em
// erro é a mesma de lá, só a casca mudou (agora dentro do grupo `(app)`,
// com `AppTopBar` no modo `app`). A tabela com busca e ordenação é nova
// (`TabelaDocumentos.tsx`) — cumpre o passo 6.4.1 exceto renomear/excluir,
// que continuam abertos.
export default function DocumentosPage() {
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

  // Mesmo motivo de app/page.tsx original: o clique decide voltar a
  // carregar, o efeito só reage à mudança de `tentativa` — setState
  // síncrono dentro de efeito é o que o lint de hooks recusa.
  function tentarDeNovo() {
    setDocumentos(null);
    setErroAoListar(false);
    setTentativa((n) => n + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1060px] flex-1 flex-col gap-5 p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Meus documentos</h1>
          <p className="mt-1 font-sans text-xs text-muted">
            {documentos?.length ?? 0} documento{documentos?.length === 1 ? "" : "s"} · nenhum limite
            de uso
          </p>
        </div>
        <Button
          onClick={criarDocumento}
          disabled={!persistencia}
          icon={<Icon name="plus" size={16} />}
        >
          Novo documento
        </Button>
      </div>

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
        <TabelaDocumentos documentos={documentos} />
      )}
    </div>
  );
}
