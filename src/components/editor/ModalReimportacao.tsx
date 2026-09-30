"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { Aviso } from "@/core/import/latex/fonte";
import type {
  CampoReimportado,
  Comparacao,
  Mudanca,
  Relatorio,
} from "@/core/import/latex/reimport";

// Para onde a reimportação vai (docs/latex-abntex.md §1.5, "Identidade do
// arquivo"): o trabalho aberto, outro trabalho desta máquina, ou um novo.
export type Destino = { tipo: "este" } | { tipo: "outro"; titulo: string } | { tipo: "novo" };

interface ModalReimportacaoProps {
  arquivo: string;
  destino: Destino;
  relatorio: Relatorio;
  gravando: boolean;
  falha: string | null;
  onConfirmar: () => void;
  onFechar: () => void;
}

export const NOME_DA_VERSAO_ANTERIOR = "Antes da reimportação";

const ROTULO_CAMPO: Record<CampoReimportado, string> = {
  titulo: "Título",
  subtitulo: "Subtítulo",
  autores: "Autoria",
  instituicao: "Instituição",
  orientador: "Orientador(a)",
  local: "Local",
  ano: "Ano",
  naturezaTrabalho: "Natureza do trabalho",
  resumo: "Resumo",
  palavrasChave: "Palavras-chave",
  abstract: "Abstract",
  keywords: "Keywords",
  dedicatoria: "Dedicatória",
  agradecimentos: "Agradecimentos",
  epigrafe: "Epígrafe",
};

const ROTULO_MUDANCA: Record<Mudanca, string> = {
  titulo: "título",
  nivel: "nível",
  texto: "texto",
  posicao: "posição",
};

// Relatório da reimportação (passo 6.2.4) antes de qualquer gravação: nada
// muda no trabalho até o "Reimportar" (§1.5, princípio 2). Tudo o que o
// arquivo trouxe de diferente aparece, e os avisos dizem a linha, para o
// aluno achar no Overleaf.
export function ModalReimportacao({
  arquivo,
  destino,
  relatorio,
  gravando,
  falha,
  onConfirmar,
  onFechar,
}: ModalReimportacaoProps) {
  const nadaAGravar = relatorio.semMudancas && destino.tipo === "este";

  return (
    <Dialog
      open
      width={720}
      title="Reimportar do LaTeX"
      subtitle={arquivo}
      onClose={gravando ? undefined : onFechar}
      footer={
        nadaAGravar ? (
          <Button onClick={onFechar}>Fechar</Button>
        ) : (
          <>
            <Button variant="ghost" disabled={gravando} onClick={onFechar}>
              Cancelar
            </Button>
            <Button loading={gravando} onClick={onConfirmar}>
              {destino.tipo === "novo" ? "Criar trabalho" : "Reimportar"}
            </Button>
          </>
        )
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
        {falha && (
          <Alert tone="danger" title="Não foi possível gravar">
            {falha}
          </Alert>
        )}
        <AvisoDeDestino destino={destino} />
        {relatorio.semMudancas && (
          <Alert tone="success" title="Nada mudou">
            O arquivo diz o mesmo que o trabalho no AURA.
          </Alert>
        )}

        <GrupoDeComparacao
          titulo="Seções"
          comparacao={relatorio.secoes}
          novo={destino.tipo === "novo"}
        />
        <GrupoDeComparacao
          titulo="Apêndices"
          comparacao={relatorio.apendices}
          novo={destino.tipo === "novo"}
        />
        <GrupoDeComparacao
          titulo="Anexos"
          comparacao={relatorio.anexos}
          novo={destino.tipo === "novo"}
        />

        {relatorio.metadados.length > 0 && (
          <section aria-label="Dados do trabalho alterados" className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-title">
              Dados do trabalho ({relatorio.metadados.length})
            </h3>
            <ul className="flex flex-col gap-2">
              {relatorio.metadados.map(({ campo, antes, depois }) => (
                <li key={campo} className="flex flex-col gap-0.5 text-xs text-body">
                  <span className="font-semibold">{ROTULO_CAMPO[campo]}</span>
                  <span className="line-clamp-2 text-muted line-through">{antes || "(vazio)"}</span>
                  <span className="line-clamp-3">{depois || "(vazio)"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {relatorio.avisos.length > 0 && <ListaDeAvisos avisos={relatorio.avisos} />}

        {!nadaAGravar && destino.tipo !== "novo" && (
          <p className="text-xs text-muted">
            Antes de gravar, o trabalho como está agora fica guardado no histórico como “
            {NOME_DA_VERSAO_ANTERIOR}”, e pode ser restaurado.
          </p>
        )}
      </div>
    </Dialog>
  );
}

function AvisoDeDestino({ destino }: { destino: Destino }) {
  if (destino.tipo === "outro") {
    return (
      <Alert tone="info" title={`Este arquivo é do trabalho “${destino.titulo || "sem título"}”`}>
        A reimportação vai para ele, e ele é aberto em seguida. O trabalho aberto agora não muda.
      </Alert>
    );
  }
  if (destino.tipo === "novo") {
    return (
      <Alert tone="info" title="Trabalho novo">
        Este arquivo é de um trabalho que não está neste navegador, e a reimportação cria um
        trabalho novo com ele. As referências não vêm no .tex: as citações ficam sem referência até
        você cadastrá-las.
      </Alert>
    );
  }
  return null;
}

function GrupoDeComparacao({
  titulo,
  comparacao,
  novo,
}: {
  titulo: string;
  comparacao: Comparacao;
  novo: boolean;
}) {
  const { novas, removidas, alteradas } = comparacao;
  if (novas.length + removidas.length + alteradas.length === 0) return null;

  return (
    <section aria-label={titulo} className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-title">{titulo}</h3>
      {novas.length > 0 && (
        <Lista rotulo={novo ? `Do arquivo (${novas.length})` : `Novos (${novas.length})`}>
          {novas.map((item) => (
            <li key={item.id}>{item.titulo || "(sem título)"}</li>
          ))}
        </Lista>
      )}
      {alteradas.length > 0 && (
        <Lista rotulo={`Alterados (${alteradas.length})`}>
          {alteradas.map((item) => (
            <li key={item.id}>
              {item.titulo || "(sem título)"}{" "}
              <span className="text-muted">
                — {item.mudancas.map((mudanca) => ROTULO_MUDANCA[mudanca]).join(", ")}
                {item.tituloAntes !== undefined && ` (antes: “${item.tituloAntes}”)`}
              </span>
            </li>
          ))}
        </Lista>
      )}
      {removidas.length > 0 && (
        <Alert tone="warning" title={`Removidos no arquivo (${removidas.length})`}>
          <ul className="list-disc pl-4">
            {removidas.map((item) => (
              <li key={item.id}>{item.titulo || "(sem título)"}</li>
            ))}
          </ul>
          <p className="mt-1">Saem do trabalho. O texto deles fica na versão guardada.</p>
        </Alert>
      )}
    </section>
  );
}

function Lista({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-semibold tracking-wide text-muted uppercase">{rotulo}</span>
      <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-body">{children}</ul>
    </div>
  );
}

function ListaDeAvisos({ avisos }: { avisos: readonly Aviso[] }) {
  return (
    <section aria-label="Avisos da reimportação" className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-title">Avisos ({avisos.length})</h3>
      <ul className="flex flex-col gap-1.5">
        {avisos.map((aviso, indice) => (
          <li key={indice} className="text-xs text-body">
            <span className="font-mono text-2xs text-muted">
              {aviso.arquivo}, linha {aviso.linha}
            </span>{" "}
            {aviso.mensagem}
          </li>
        ))}
      </ul>
    </section>
  );
}
