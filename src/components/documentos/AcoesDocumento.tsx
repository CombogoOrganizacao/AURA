"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AvisoDadosFaltando } from "@/components/editor/AvisoDadosFaltando";
import { baixar, nomeArquivo } from "@/components/editor/baixarArquivo";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
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
  // E troca o título da linha depois que o novo é gravado.
  onRenomeado: (id: string, titulo: string) => void;
}

type Janela =
  | { tipo: "faltando"; documento: Documento; faltando: ReturnType<typeof dadosFaltando> }
  | { tipo: "renomear" }
  | { tipo: "excluir" }
  | { tipo: "erro"; mensagem: string };

// Ações de uma linha de "Meus documentos" (pedido da usuária em 07/10/2026,
// à moda do Overleaf; passo 6.4.1): renomear, exportar o `.docx`, baixar o
// projeto LaTeX e excluir. Os arquivos saem do documento **salvo**, que é o
// que existe fora do editor, pelas mesmas funções do editor
// (`lib/exportar.ts`), com o mesmo aviso de dados da capa.
//
// Renomear troca o **título do trabalho** (`metadados.titulo`), o mesmo campo
// de "Dados do trabalho": não há nome de projeto separado (decisão da usuária
// em 08/10/2026). Por isso a janela avisa que a capa muda junto.
//
// Excluir pede confirmação e diz o que se perde: o trabalho, o histórico e as
// imagens deste navegador (`excluirDocumento()` apaga em cascata). Não há
// lixeira nem desfazer: os dados só existem aqui.
export function AcoesDocumento({ documento, onExcluido, onRenomeado }: AcoesDocumentoProps) {
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

  function renomear(novo: string) {
    setJanela(null);
    if (novo === documento.titulo) return;
    void executar(async () => {
      const completo = await carregar();
      if (!completo || !persistencia) return;
      await persistencia.salvarDocumento({
        ...completo,
        metadados: { ...completo.metadados, titulo: novo },
      });
      onRenomeado(documento.id, novo);
    }, "Não foi possível renomear o trabalho.");
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
          icone="pencil-line"
          dica="Renomear"
          rotulo={`Renomear ${titulo}`}
          disabled={!persistencia || ocupado}
          onClick={() => setJanela({ tipo: "renomear" })}
        />
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

      {janela?.tipo === "renomear" && (
        <JanelaRenomear
          atual={documento.titulo}
          onCancelar={() => setJanela(null)}
          onRenomear={renomear}
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

// O campo começa com o título atual, todo selecionado, para digitar por cima.
// O foco vem deste efeito, e não de `autoFocus`: o `Dialog` foca o primeiro
// focável (o X do cabeçalho) no efeito dele, que roda antes deste, porque o
// efeito do pai roda depois do efeito do filho.
// Título só de espaços não vale: a linha viraria "Documento sem título" e a
// capa sairia sem título.
function JanelaRenomear({
  atual,
  onCancelar,
  onRenomear,
}: {
  atual: string;
  onCancelar: () => void;
  onRenomear: (titulo: string) => void;
}) {
  const [titulo, setTitulo] = useState(atual);
  const campo = useRef<HTMLInputElement>(null);
  const limpo = titulo.trim();

  useEffect(() => {
    campo.current?.focus();
    campo.current?.select();
  }, []);

  return (
    <Dialog
      open
      width={460}
      title="Renomear o trabalho"
      onClose={onCancelar}
      footer={
        <>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-renomear" disabled={!limpo}>
            Renomear
          </Button>
        </>
      }
    >
      <form
        id="form-renomear"
        className="flex flex-col gap-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (limpo) onRenomear(limpo);
        }}
      >
        <Input
          ref={campo}
          label="Título do trabalho"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
        />
        <p className="text-sm text-body">
          É o mesmo título de &ldquo;Dados do trabalho&rdquo;: muda também na capa, na folha de
          rosto e no nome dos arquivos exportados.
        </p>
      </form>
    </Dialog>
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
