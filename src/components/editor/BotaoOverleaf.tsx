"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { Documento } from "@/core/document/types";
import { carregarImagensDoDocumento } from "@/core/export/docx/media";
import { camposOverleaf, ENDERECO_OVERLEAF } from "@/core/export/latex/overleaf";
import { gerarZipTex } from "@/core/export/latex/zip";
import { usePersistencia } from "@/lib/persistence-provider";

interface BotaoOverleafProps {
  // O documento como está na tela, como no `BotaoExportar`.
  documento: Documento;
  // Grava já, sem esperar o autosave.
  salvarAgora: () => Promise<void>;
}

type Preparo =
  | { status: "preparando" }
  | { status: "pronto"; campos: Record<string, string>; bytes: number }
  | { status: "erro" };

// "Abrir no Overleaf" (passo 6.3.1). O clique abre o aviso de mão única, e o
// pacote é montado enquanto o aviso está aberto. O envio acontece no clique
// de confirmar, sem espera: aberto depois de uma espera longa, o Overleaf
// numa aba nova seria barrado como pop-up.
//
// **Nenhuma URL do trabalho é gerada.** O `.zip` vai dentro do POST, como
// data URL (`core/export/latex/overleaf.ts`), do navegador direto para o
// Overleaf. A CSP libera o `form-action` só para `https://www.overleaf.com`
// (next.config.ts).
export function BotaoOverleaf({ documento, salvarAgora }: BotaoOverleafProps) {
  const persistencia = usePersistencia();
  const [preparo, setPreparo] = useState<Preparo | null>(null);

  async function abrirAviso() {
    if (!persistencia) return;
    setPreparo({ status: "preparando" });
    try {
      // O que vai para o Overleaf fica também salvo aqui.
      await salvarAgora().catch((erro: unknown) => {
        console.error("Falha ao salvar antes de abrir no Overleaf:", erro);
      });
      const imagens = await carregarImagensDoDocumento(persistencia, documento);
      const zip = await gerarZipTex(documento, imagens);
      setPreparo((atual) =>
        atual ? { status: "pronto", campos: camposOverleaf(zip), bytes: zip.length } : atual,
      );
    } catch (erro) {
      console.error("Falha ao montar o projeto para o Overleaf:", erro);
      setPreparo((atual) => (atual ? { status: "erro" } : atual));
    }
  }

  function enviar(campos: Record<string, string>) {
    // Formulário de verdade, e não `fetch`: o Overleaf abre o projeto na aba
    // nova, com a sessão da pessoa lá. `noopener noreferrer`: a aba do
    // Overleaf não recebe acesso a esta nem o endereço dela.
    const formulario = document.createElement("form");
    formulario.method = "post";
    formulario.action = ENDERECO_OVERLEAF;
    formulario.target = "_blank";
    formulario.rel = "noopener noreferrer";
    formulario.hidden = true;
    for (const [nome, valor] of Object.entries(campos)) {
      const campo = document.createElement("input");
      campo.type = "hidden";
      campo.name = nome;
      campo.value = valor;
      formulario.append(campo);
    }
    document.body.append(formulario);
    formulario.submit();
    formulario.remove();
    setPreparo(null);
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={!persistencia} onClick={abrirAviso}>
        Abrir no Overleaf
      </Button>

      {preparo && (
        <Dialog
          open
          width={520}
          title="Abrir no Overleaf"
          subtitle="Uma cópia do trabalho, num projeto novo"
          onClose={() => setPreparo(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPreparo(null)}>
                Cancelar
              </Button>
              <Button
                loading={preparo.status === "preparando"}
                disabled={preparo.status !== "pronto"}
                onClick={() => preparo.status === "pronto" && enviar(preparo.campos)}
              >
                Abrir no Overleaf
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm text-body">
            <Alert tone="warning" title="O caminho é de mão única">
              O que você editar no Overleaf não volta sozinho para o AURA. Para trazer as mudanças,
              baixe o projeto no Overleaf (Menu → Download → Source) e use “Reimportar LaTeX”.
            </Alert>
            <p>
              Voltam o texto das seções, dos apêndices e dos anexos, os dados do bloco de metadados,
              as referências e as figuras. O resto do preâmbulo (pacotes, fontes, margens) fica só
              no Overleaf.
            </p>
            <p className="text-xs text-muted">
              O trabalho vai do seu navegador direto para o Overleaf, que cria o projeto na sua
              conta. O AURA não guarda cópia nem gera link do trabalho.
            </p>
            {preparo.status === "pronto" && (
              <p className="text-xs text-muted">Tamanho do pacote: {tamanho(preparo.bytes)}.</p>
            )}
            {preparo.status === "erro" && (
              <Alert tone="danger" title="Não foi possível montar o projeto">
                Feche e tente de novo. Se o erro continuar, exporte o .docx.
              </Alert>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}

function tamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
