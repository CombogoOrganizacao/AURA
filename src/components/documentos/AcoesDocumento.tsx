"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AvisoDadosFaltando } from "@/components/editor/AvisoDadosFaltando";
import { baixar, nomeArquivo } from "@/components/editor/baixarArquivo";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { NomeIcone } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Documento } from "@/core/document/types";
import type { ResumoDocumento } from "@/core/persistence/types";
import { dadosFaltando } from "@/core/rules/checks/dadosDeIdentificacao";
import { blobDoZip, docxDoDocumento, zipLatexDoDocumento } from "@/lib/exportar";
import { usePersistencia } from "@/lib/persistence-provider";

interface AcoesDocumentoProps {
  documento: ResumoDocumento;
  // A lista tira a linha depois que a exclusão é gravada.
  onExcluido: (id: string) => void;
}

type Janela =
  | { tipo: "faltando"; documento: Documento; faltando: ReturnType<typeof dadosFaltando> }
  | { tipo: "excluir" }
  | { tipo: "erro"; mensagem: string };

// Ações de uma linha de "Meus documentos" (pedido da usuária em 07/10/2026,
// à moda do Overleaf; parte do passo 6.4.1): exportar o `.docx`, baixar o
// projeto LaTeX e excluir. Os arquivos saem do documento **salvo**, que é o
// que existe fora do editor, pelas mesmas funções do editor
// (`lib/exportar.ts`), com o mesmo aviso de dados da capa.
//
// Excluir pede confirmação e diz o que se perde: o trabalho, o histórico e as
// imagens deste navegador (`excluirDocumento()` apaga em cascata). Não há
// lixeira nem desfazer: os dados só existem aqui.
export function AcoesDocumento({ documento, onExcluido }: AcoesDocumentoProps) {
  const persistencia = usePersistencia();
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [janela, setJanela] = useState<Janela | null>(null);
  const titulo = documento.titulo || "Documento sem título";

  async function carregar(): Promise<Documento | null> {
    if (!persistencia) return null;
    const completo = await persistencia.carregarDocumento(documento.id);
    if (!completo) setJanela({ tipo: "erro", mensagem: "O trabalho não foi encontrado." });
    return completo;
  }

  async function executar(acao: () => Promise<void>, mensagem: string) {
    setOcupado(true);
    try {
      await acao();
    } catch (erro) {
      console.error(mensagem, erro);
      setJanela({ tipo: "erro", mensagem });
    } finally {
      setOcupado(false);
    }
  }

  function pedirDocx() {
    void executar(async () => {
      const completo = await carregar();
      if (!completo) return;
      const faltando = dadosFaltando(completo.metadados);
      if (faltando.length > 0) setJanela({ tipo: "faltando", documento: completo, faltando });
      else await exportarDocx(completo);
    }, "Não foi possível exportar o .docx.");
  }

  async function exportarDocx(completo: Documento) {
    if (!persistencia) return;
    baixar(await docxDoDocumento(persistencia, completo), `${nomeArquivo(completo)}.docx`);
  }

  function baixarLatex() {
    void executar(async () => {
      const completo = await carregar();
      if (!completo || !persistencia) return;
      const zip = await zipLatexDoDocumento(persistencia, completo);
      baixar(blobDoZip(zip), `${nomeArquivo(completo)}.zip`);
    }, "Não foi possível montar o projeto LaTeX.");
  }

  function excluir() {
    setJanela(null);
    void executar(async () => {
      if (!persistencia) return;
      await persistencia.excluirDocumento(documento.id);
      onExcluido(documento.id);
    }, "Não foi possível excluir o trabalho.");
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Acao
          icone="file-down"
          dica="Exportar .docx"
          rotulo={`Exportar .docx de ${titulo}`}
          disabled={!persistencia || ocupado}
          onClick={pedirDocx}
        />
        <Acao
          icone="file-archive"
          dica="Baixar LaTeX (.zip)"
          rotulo={`Baixar o projeto LaTeX (.zip) de ${titulo}`}
          disabled={!persistencia || ocupado}
          onClick={baixarLatex}
        />
        <Acao
          icone="trash-2"
          dica="Excluir"
          rotulo={`Excluir ${titulo}`}
          disabled={!persistencia || ocupado}
          onClick={() => setJanela({ tipo: "excluir" })}
          className="hover:text-danger!"
        />
      </div>

      {janela?.tipo === "faltando" && (
        <AvisoDadosFaltando
          faltando={janela.faltando}
          onFechar={() => setJanela(null)}
          onExportarAssimMesmo={() => {
            const completo = janela.documento;
            setJanela(null);
            void executar(() => exportarDocx(completo), "Não foi possível exportar o .docx.");
          }}
          preencher={{
            rotulo: "Abrir o trabalho",
            onClick: () => router.push(`/documento/${documento.id}`),
          }}
        />
      )}

      {janela?.tipo === "excluir" && (
        <Dialog
          open
          width={460}
          title="Excluir o trabalho?"
          subtitle={titulo}
          onClose={() => setJanela(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setJanela(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={excluir}>
                Excluir
              </Button>
            </>
          }
        >
          <p className="text-sm text-body">
            O trabalho, o histórico de versões e as imagens das figuras são apagados deste
            navegador. Não dá para desfazer. Para guardar uma cópia, exporte o .docx ou o projeto
            LaTeX antes.
          </p>
        </Dialog>
      )}

      {janela?.tipo === "erro" && (
        <Dialog
          open
          width={420}
          title={janela.mensagem}
          onClose={() => setJanela(null)}
          footer={<Button onClick={() => setJanela(null)}>Fechar</Button>}
        >
          <p className="text-sm text-body">Tente de novo. Se o erro continuar, abra o trabalho.</p>
        </Dialog>
      )}
    </>
  );
}

// Dica curta e visível (o `Tooltip`); o rótulo para leitor de tela leva o
// título do trabalho, para cada linha ter botões com nomes distintos.
function Acao({
  icone,
  dica,
  rotulo,
  disabled,
  onClick,
  className,
}: {
  icone: NomeIcone;
  dica: string;
  rotulo: string;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Tooltip content={dica}>
      <IconButton
        name={icone}
        size="sm"
        label={rotulo}
        title={undefined}
        disabled={disabled}
        onClick={onClick}
        className={className}
      />
    </Tooltip>
  );
}
