"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import type { ResumoDocumento } from "@/core/persistence/types";

type Ordenacao = "recentes" | "nome";

interface TabelaDocumentosProps {
  documentos: ResumoDocumento[];
}

// Lista no estilo Overleaf — sem pastas (decisão de produto,
// docs/aura-decisoes-e-pendencias.md §1.12). Busca e ordenação são filtro
// puro sobre a lista já carregada (`useMemo`, sem ida nova ao IndexedDB):
// barato porque a lista de um usuário é pequena, e honesto porque não
// inventa paginação de servidor que a v1 não tem.
//
// **De propósito, fora daqui**: favoritar (exigiria campo novo em
// `Documento`), "Enviar .docx" (importação, fora da v1 —
// docs/aura-decisoes-e-pendencias.md §1.15) e colunas "Conformidade" /
// "Páginas" (não existe motor de conformidade nem paginação real —
// `ResumoDocumento` só tem `id`/`titulo`/`atualizadoEm`; inventar um
// número aqui é o erro que o CLAUDE.md proíbe). Renomear e excluir
// continuam abertos no passo 6.4.1.
export function TabelaDocumentos({ documentos }: TabelaDocumentosProps) {
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrada = termo
      ? documentos.filter((doc) => doc.titulo.toLowerCase().includes(termo))
      : documentos;

    return [...filtrada].sort((a, b) =>
      ordenacao === "nome"
        ? a.titulo.localeCompare(b.titulo, "pt-BR")
        : b.atualizadoEm.getTime() - a.atualizadoEm.getTime(),
    );
  }, [documentos, busca, ordenacao]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Ex.: metodologia"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          icon={<Icon name="search" size={15} />}
          className="w-[300px]"
          aria-label="Buscar documentos"
        />
        <Tabs
          variant="segmented"
          value={ordenacao}
          onChange={(valor) => setOrdenacao(valor as Ordenacao)}
          items={[
            { id: "recentes", label: "Recentes" },
            { id: "nome", label: "Nome" },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-card shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-sunken">
              <Cabecalho>Documento</Cabecalho>
              <Cabecalho>Última edição</Cabecalho>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((documento, i) => (
              <tr
                key={documento.id}
                className={[
                  "hover:bg-bordo-50",
                  i === listaFiltrada.length - 1 ? "" : "border-b border-[var(--border-subtle)]",
                ].join(" ")}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/documento/${documento.id}`}
                    className="flex items-center gap-2.5 font-serif text-md text-body no-underline hover:text-bordo-700"
                  >
                    <span className="flex text-bordo-600">
                      <Icon name="file-text" size={17} />
                    </span>
                    {documento.titulo || "Documento sem título"}
                  </Link>
                </td>
                <td className="px-4 py-3 font-sans text-xs text-muted">
                  {documento.atualizadoEm.toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {listaFiltrada.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <span className="text-ink-300">
              <Icon name="file-search" size={30} />
            </span>
            <p className="font-sans text-sm text-muted">
              Nenhum documento corresponde a &ldquo;{busca}&rdquo;.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Cabecalho({ children }: { children: string }) {
  return (
    <th className="border-b border-[var(--border-subtle)] px-4 py-2.5 text-left font-sans text-2xs font-medium tracking-caps text-subtle uppercase">
      {children}
    </th>
  );
}
