"use client";

import { Packer } from "docx";
import { useState } from "react";

import { fromDocumento } from "@/core/export/docx/fromDocumento";
import type { Documento } from "@/core/document/types";
import { usePersistencia } from "@/lib/persistence-provider";

interface BotaoExportarProps {
  documentoId: string;
}

type Status = "pronto" | "exportando" | "erro";

// Botão "Exportar .docx" (passo 1.4.4) — carrega o `Documento` salvo,
// monta o `.docx` (`fromDocumento.ts`, passo 1.4.2) e empacota com
// `Packer.toBlob()`, a escolha certa pra download no navegador
// (`Packer.toBuffer()` é pra Node — ver o comentário em
// `src/core/export/docx/index.ts`).
//
// Exporta o que já está salvo, não o que está sendo digitado agora: o
// autosave (metadados desde 1.3.6, corpo desde 1.3.7) salva com debounce —
// exportar logo após digitar pode pegar a versão anterior. Capa e
// pré-textuais continuam placeholder no exportador, sem ler `metadados`
// nenhum (dependem do passo 3.5.1); o `.docx` baixado reflete isso — só o
// corpo (título de seção + parágrafos) vem do que foi digitado.
export function BotaoExportar({ documentoId }: BotaoExportarProps) {
  const persistencia = usePersistencia();
  const [status, setStatus] = useState<Status>("pronto");

  async function exportar() {
    if (!persistencia) return;
    setStatus("exportando");
    try {
      const documento = await persistencia.carregarDocumento(documentoId);
      if (!documento) {
        throw new Error(`Documento "${documentoId}" não encontrado`);
      }
      const blob = await Packer.toBlob(fromDocumento(documento));
      baixar(blob, `${nomeArquivo(documento)}.docx`);
      setStatus("pronto");
    } catch (erro) {
      console.error("Falha ao exportar .docx:", erro);
      setStatus("erro");
    }
  }

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={!persistencia || status === "exportando"}
      className="rounded-sm bg-bordo-700 px-4 py-2 text-sm font-medium text-on-bordo hover:bg-bordo-800 disabled:opacity-50"
    >
      {status === "exportando"
        ? "Exportando…"
        : status === "erro"
          ? "Erro ao exportar — tentar de novo"
          : "Exportar .docx"}
    </button>
  );
}

// Nome de arquivo não aceita todo caractere em todo SO — troca qualquer
// coisa fora de letra/número/espaço/hífen por espaço.
function nomeArquivo(documento: Documento): string {
  const base = documento.metadados.titulo.trim() || "documento";
  return (
    base
      .replace(/[^\p{L}\p{N} -]/gu, " ")
      .replace(/\s+/g, " ")
      .trim() || "documento"
  );
}

function baixar(conteudo: Blob, nome: string): void {
  const url = URL.createObjectURL(conteudo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
