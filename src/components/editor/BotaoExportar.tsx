"use client";

import { useState } from "react";

import { AvisoDadosFaltando } from "@/components/editor/AvisoDadosFaltando";
import { baixar, nomeArquivo } from "@/components/editor/baixarArquivo";
import type { Documento } from "@/core/document/types";
import { dadosFaltando, type CampoExigido } from "@/core/rules/checks/dadosDeIdentificacao";
import { docxDoDocumento } from "@/lib/exportar";
import { usePersistencia } from "@/lib/persistence-provider";

interface BotaoExportarProps {
  // O documento como está na tela, e não o salvo.
  documento: Documento;
  // Grava já, sem esperar o autosave.
  salvarAgora: () => Promise<void>;
  // Leva ao campo que falta, nos dados do trabalho (6.2.12).
  onPreencherDados?: (campo: CampoExigido) => void;
}

type Status = "pronto" | "exportando" | "erro";

// Botão "Exportar .docx" (passo 1.4.4) — monta o `.docx`
// (`docxDoDocumento()`, em `lib/exportar.ts`).
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
//
// Dado de capa faltando avisa antes, sem impedir (`AvisoDadosFaltando`,
// passo 6.2.12); aqui, "Preencher dados" leva ao campo.
export function BotaoExportar({ documento, salvarAgora, onPreencherDados }: BotaoExportarProps) {
  const persistencia = usePersistencia();
  const [status, setStatus] = useState<Status>("pronto");
  const [faltando, setFaltando] = useState<ReturnType<typeof dadosFaltando> | null>(null);

  function pedirExportacao() {
    const lista = dadosFaltando(documento.metadados);
    if (lista.length > 0) setFaltando(lista);
    else void exportar();
  }

  async function exportar() {
    setFaltando(null);
    if (!persistencia) return;
    setStatus("exportando");
    try {
      await salvarAgora().catch((erro: unknown) => {
        console.error("Falha ao salvar antes de exportar:", erro);
      });
      baixar(await docxDoDocumento(persistencia, documento), `${nomeArquivo(documento)}.docx`);
      setStatus("pronto");
    } catch (erro) {
      console.error("Falha ao exportar .docx:", erro);
      setStatus("erro");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={pedirExportacao}
        disabled={!persistencia || status === "exportando"}
        className="rounded-sm bg-bordo-700 px-4 py-2 text-sm font-medium text-on-bordo hover:bg-bordo-800 disabled:opacity-50"
      >
        {status === "exportando"
          ? "Exportando…"
          : status === "erro"
            ? "Erro ao exportar — tentar de novo"
            : "Exportar .docx"}
      </button>

      {faltando && (
        <AvisoDadosFaltando
          faltando={faltando}
          onExportarAssimMesmo={() => void exportar()}
          onFechar={() => setFaltando(null)}
          preencher={
            onPreencherDados && {
              rotulo: "Preencher dados",
              onClick: () => {
                const primeiro = faltando[0].campo;
                setFaltando(null);
                onPreencherDados(primeiro);
              },
            }
          }
        />
      )}
    </>
  );
}
