"use client";

import { Packer } from "docx";
import { useState } from "react";

import { fromDocumento } from "@/core/export/docx/fromDocumento";
import { carregarImagensDoDocumento } from "@/core/export/docx/media";
import type { Documento } from "@/core/document/types";
import { usePersistencia } from "@/lib/persistence-provider";

interface BotaoExportarProps {
  // O documento como está na tela, e não o salvo.
  documento: Documento;
  // Grava já, sem esperar o autosave.
  salvarAgora: () => Promise<void>;
}

type Status = "pronto" | "exportando" | "erro";

// Botão "Exportar .docx" (passo 1.4.4) — monta o `.docx`
// (`fromDocumento.ts`, passo 1.4.2) e empacota com `Packer.toBlob()`, a
// escolha certa pra download no navegador (`Packer.toBuffer()` é pra Node —
// ver o comentário em `src/core/export/docx/index.ts`).
//
// **Exporta o que está na tela** (correção feita junto do 6.1.2). Até ali
// exportava o documento salvo, e o autosave espera 4 s depois da última
// tecla: quem exportava logo após editar recebia o arquivo sem as últimas
// mudanças, e o aluno pode descobrir isso só depois de entregar. Agora o
// documento vem de quem está com ele (`DocumentoEditor`), e o mesmo clique
// grava na hora (`salvarAgora`), para o exportado estar também salvo.
//
// Desabilitar o botão até o autosave terminar foi considerado e descartado:
// quem digita sem parar veria o botão sempre desabilitado, e uma falha de
// gravação o prenderia assim, justo quando exportar é o jeito de não
// perder o trabalho. Se a gravação falhar, a exportação segue com o que está
// na tela, e o status do autosave mostra o erro.
export function BotaoExportar({ documento, salvarAgora }: BotaoExportarProps) {
  const persistencia = usePersistencia();
  const [status, setStatus] = useState<Status>("pronto");

  async function exportar() {
    if (!persistencia) return;
    setStatus("exportando");
    try {
      await salvarAgora().catch((erro: unknown) => {
        console.error("Falha ao salvar antes de exportar:", erro);
      });
      // As imagens das figuras moram fora do documento (6.1.2): o exportador,
      // que é lógica pura, as recebe já carregadas.
      const imagens = await carregarImagensDoDocumento(persistencia, documento);
      const blob = await Packer.toBlob(fromDocumento(documento, imagens));
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
