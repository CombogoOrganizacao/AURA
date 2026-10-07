"use client";

import { Packer } from "docx";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { baixar, nomeArquivo } from "@/components/editor/baixarArquivo";
import { fromDocumento } from "@/core/export/docx/fromDocumento";
import { carregarImagensDoDocumento } from "@/core/export/docx/media";
import type { Documento } from "@/core/document/types";
import { dadosFaltando, type CampoExigido } from "@/core/rules/checks/dadosDeIdentificacao";
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
//
// **Dado de capa faltando avisa antes, sem impedir** (passo 6.2.12). Um TCC
// importado de fora do AURA chega sem título, autor nem orientador, e o
// `.docx` sairia com a capa só com o ano e "Orientador:" sem nome. O diálogo
// lista o que falta (a mesma regra da conferência, `dadosFaltando()`) e
// oferece ir aos dados ou exportar assim mesmo: exportar um rascunho é
// legítimo, e bloquear tiraria do aluno o jeito de salvar o trabalho fora.
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
        <Dialog
          open
          width={480}
          title="Faltam dados da capa"
          subtitle="A capa e a folha de rosto vão sair incompletas"
          onClose={() => setFaltando(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => void exportar()}>
                Exportar assim mesmo
              </Button>
              {onPreencherDados && (
                <Button
                  onClick={() => {
                    const primeiro = faltando[0].campo;
                    setFaltando(null);
                    onPreencherDados(primeiro);
                  }}
                >
                  Preencher dados
                </Button>
              )}
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm text-body">
            <Alert tone="warning" title="Elementos obrigatórios (NBR 14724) ainda vazios">
              <ul className="list-disc pl-5">
                {faltando.map((item) => (
                  <li key={item.campo}>{item.nome}</li>
                ))}
              </ul>
            </Alert>
            <p className="text-xs text-muted">
              Dá para exportar agora e completar depois: o arquivo sai com esses lugares vazios.
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
