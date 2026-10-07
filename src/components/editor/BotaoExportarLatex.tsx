"use client";

import { useState } from "react";

import { baixar, nomeArquivo } from "@/components/editor/baixarArquivo";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { Documento } from "@/core/document/types";
import { cabeNoOverleaf, camposOverleaf, ENDERECO_OVERLEAF } from "@/core/export/latex/overleaf";
import { blobDoZip, zipLatexDoDocumento } from "@/lib/exportar";
import { usePersistencia } from "@/lib/persistence-provider";

interface BotaoExportarLatexProps {
  // O documento como está na tela, como no `BotaoExportar`.
  documento: Documento;
  // Grava já, sem esperar o autosave.
  salvarAgora: () => Promise<void>;
}

type Preparo =
  | { status: "preparando" }
  | { status: "pronto"; campos: Record<string, string>; zip: Uint8Array; cabe: boolean }
  | { status: "erro" };

// "Exportar LaTeX" (passo 6.3.1, decisão da usuária em 07/10/2026). O clique
// abre a janela e monta o projeto (`gerarZipTex()`) enquanto ela está aberta.
// A ação principal é baixar o `.zip`; "Abrir no Overleaf" aparece ao lado só
// quando o projeto cabe no que o Overleaf recebe por POST.
//
// **Overleaf: nenhuma URL do trabalho é gerada.** O `.zip` vai dentro do
// POST, como data URL (`core/export/latex/overleaf.ts`), do navegador direto
// para o Overleaf. A CSP libera o `form-action` só para
// `https://www.overleaf.com` (next.config.ts). O envio acontece no clique de
// confirmar, sem espera: aberto depois de uma espera longa, o Overleaf numa
// aba nova seria barrado como pop-up.
//
// **Projeto grande não vai pelo POST.** O Overleaf recusa corpo acima de
// 2 MiB (`LIMITE_ENVIO_OVERLEAF`, medido), e um TCC com algumas fotos passa
// disso. Nesse caso a janela diz o porquê e indica o "Upload Project" do
// Overleaf com o `.zip` baixado. A alternativa da API, o Overleaf buscar o
// `.zip` numa URL, publicaria o trabalho.
export function BotaoExportarLatex({ documento, salvarAgora }: BotaoExportarLatexProps) {
  const persistencia = usePersistencia();
  const [preparo, setPreparo] = useState<Preparo | null>(null);

  async function abrirJanela() {
    if (!persistencia) return;
    setPreparo({ status: "preparando" });
    try {
      // O que sai do AURA fica também salvo aqui.
      await salvarAgora().catch((erro: unknown) => {
        console.error("Falha ao salvar antes de exportar o LaTeX:", erro);
      });
      const zip = await zipLatexDoDocumento(persistencia, documento);
      const campos = camposOverleaf(zip);
      setPreparo((atual) =>
        atual ? { status: "pronto", campos, zip, cabe: cabeNoOverleaf(campos) } : atual,
      );
    } catch (erro) {
      console.error("Falha ao montar o projeto LaTeX:", erro);
      setPreparo((atual) => (atual ? { status: "erro" } : atual));
    }
  }

  function abrirNoOverleaf(campos: Record<string, string>) {
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

  function baixarProjeto(zip: Uint8Array) {
    baixar(blobDoZip(zip), `${nomeArquivo(documento)}.zip`);
    setPreparo(null);
  }

  const pronto = preparo?.status === "pronto" ? preparo : null;

  return (
    <>
      <Button variant="outline" size="sm" disabled={!persistencia} onClick={abrirJanela}>
        Exportar LaTeX
      </Button>

      {preparo && (
        <Dialog
          open
          width={520}
          title="Exportar LaTeX"
          subtitle="Projeto completo, para o Overleaf ou outro editor LaTeX"
          onClose={() => setPreparo(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPreparo(null)}>
                Cancelar
              </Button>
              {pronto?.cabe && (
                <Button variant="outline" onClick={() => abrirNoOverleaf(pronto.campos)}>
                  Abrir no Overleaf
                </Button>
              )}
              <Button
                loading={preparo.status === "preparando"}
                disabled={!pronto}
                onClick={() => pronto && baixarProjeto(pronto.zip)}
              >
                Baixar o projeto (.zip)
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm text-body">
            <p>
              O arquivo .zip traz o main.tex, um arquivo por capítulo, as referências em
              referencias.bib e as figuras. No Overleaf, envie-o em New Project → Upload Project.
            </p>
            <Alert tone="warning" title="O caminho é de mão única">
              O que você editar fora do AURA não volta sozinho. Para trazer as mudanças, use
              “Importar LaTeX” com o projeto editado (no Overleaf, Menu → Download → Source). Voltam
              o texto das seções, dos apêndices e dos anexos, os dados do bloco de metadados, as
              referências e as figuras; o resto do preâmbulo (pacotes, fontes, margens) não.
            </Alert>
            {pronto && (
              <p className="text-xs text-muted">
                Tamanho do projeto: {tamanho(pronto.zip.length)}.
              </p>
            )}
            {pronto?.cabe && (
              <p className="text-xs text-muted">
                “Abrir no Overleaf” envia o projeto do seu navegador direto para o Overleaf, que o
                cria na sua conta. O AURA não guarda cópia nem gera link do trabalho.
              </p>
            )}
            {pronto && !pronto.cabe && (
              <Alert tone="info" title="Grande demais para abrir direto no Overleaf">
                O Overleaf só recebe projetos de até cerca de 1,4 MB por envio direto, e as figuras
                deixam este maior. Baixe o .zip e envie-o em New Project → Upload Project.
              </Alert>
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
