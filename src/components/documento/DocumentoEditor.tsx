"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AppTopBar } from "@/components/app/AppTopBar";
import { BotaoExportar } from "@/components/editor/BotaoExportar";
import { Editor, type MoverSecao } from "@/components/editor/Editor";
import { LayoutEdicao } from "@/components/editor/LayoutEdicao";
import { PainelInspetor } from "@/components/editor/PainelInspetor";
import { PainelSecoes } from "@/components/editor/PainelSecoes";
import { Button } from "@/components/ui/Button";
import { EstadoCarregando, EstadoErro } from "@/components/ui/Estados";
import { novoDocumento } from "@/core/document/factory";
import type { Documento, Metadados, Secao } from "@/core/document/types";
import type { AdaptadorPersistencia } from "@/core/persistence/types";
import { usePersistencia } from "@/lib/persistence-provider";
import { useAutosave, type StatusAutosave } from "@/lib/useAutosave";

import { FormMetadados } from "./FormMetadados";

interface DocumentoEditorProps {
  documentoId: string;
}

const TEXTO_STATUS: Record<StatusAutosave, string> = {
  pendente: "Alterações não salvas…",
  salvando: "Salvando…",
  salvo: "Salvo",
  erro: "Erro ao salvar",
};

// Dono único do `Documento` na tela de edição (passo 1.3.7). Inserido ao
// perceber, testando o exportador (1.4.4), que `FormMetadados` e `Editor`
// não podiam continuar cada um carregando e salvando sua própria cópia do
// `Documento`: o autosave de um sobrescrevia inteiro o `Documento` com
// dados desatualizados do outro (o último a salvar apagava a mudança mais
// recente, em silêncio). Aqui só há um `useAutosave`, sobre o `Documento`
// inteiro; `FormMetadados` e `Editor` são controlados — só editam sua
// fatia (`metadados` / `sections`) e devolvem a mudança pra cá.
//
// A partir do passo 2B.10, esta é a única tela que monta `AppTopBar` no
// modo `editor` — o que exige montá-lo também nos ramos de carregamento e
// erro, aqui embaixo, sem `docTitle`/`statusAutosave`/`acoes` (não há
// documento carregado ainda pra preenchê-los).
export function DocumentoEditor({ documentoId }: DocumentoEditorProps) {
  const persistencia = usePersistencia();
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!persistencia) return;
    let cancelado = false;

    persistencia
      .carregarDocumento(documentoId)
      .then((encontrado) => {
        if (cancelado) return;
        // Documento inexistente = primeira vez que este id é usado; nasce
        // vazio, com o id que foi pedido (não o que novoDocumento() geraria).
        setDocumento(encontrado ?? { ...novoDocumento(), id: documentoId });
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        console.error("Falha ao carregar documento:", erro);
        setErroAoCarregar(true);
      });

    return () => {
      cancelado = true;
    };
  }, [persistencia, documentoId, tentativa]);

  // Reseta pro estado de carregamento aqui, não no efeito acima — mesmo
  // motivo de `app/page.tsx`: setState síncrono dentro de efeito é o que o
  // lint de hooks recusa.
  function tentarDeNovo() {
    setDocumento(null);
    setErroAoCarregar(false);
    setTentativa((n) => n + 1);
  }

  if (erroAoCarregar) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <AppTopBar mode="editor" />
        <EstadoErro
          titulo="Não foi possível carregar este documento."
          action={
            <Button variant="outline" onClick={tentarDeNovo}>
              Tentar de novo
            </Button>
          }
        />
      </div>
    );
  }

  if (!documento || !persistencia) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <AppTopBar mode="editor" />
        <EstadoCarregando texto="Carregando documento…" />
      </div>
    );
  }

  // `Carregado` só monta quando `documento` já existe — é o que faz o "não
  // salva na primeira renderização" do useAutosave coincidir com "não
  // salva o que acabou de ser carregado, sem edição nenhuma" (mesmo
  // truque de FormMetadados no passo 1.3.6).
  return (
    <Carregado documentoId={documentoId} documentoInicial={documento} persistencia={persistencia} />
  );
}

function Carregado({
  documentoId,
  documentoInicial,
  persistencia,
}: {
  documentoId: string;
  documentoInicial: Documento;
  persistencia: AdaptadorPersistencia;
}) {
  const [documento, setDocumento] = useState(documentoInicial);
  const status = useAutosave(documento, (atual) => persistencia.salvarDocumento(atual));

  function atualizarMetadados(atualizador: (atual: Metadados) => Metadados) {
    setDocumento((atual) => ({ ...atual, metadados: atualizador(atual.metadados) }));
  }

  function atualizarSecoes(secoes: Secao[]) {
    setDocumento((atual) => ({ ...atual, sections: secoes }));
  }

  // `PainelSecoes` (irmão de `Editor`, sem acesso à instância do TipTap)
  // reordena através desta ref — passo 3.2.4. `useCallback` com deps vazias
  // dá pro `onReorderReady` de `Editor.tsx` uma identidade estável, então o
  // efeito que a chama roda só quando o editor troca de instância de
  // verdade, não a cada re-render deste componente (autosave, digitação...).
  const moverSecaoRef = useRef<MoverSecao | null>(null);
  const registrarComandoDeReordenar = useCallback((mover: MoverSecao) => {
    moverSecaoRef.current = mover;
  }, []);
  const reordenarSecoes: MoverSecao = useCallback((idOrigem, idDestino, inserirDepois) => {
    moverSecaoRef.current?.(idOrigem, idDestino, inserirDepois);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppTopBar
        mode="editor"
        docTitle={documento.metadados.titulo}
        statusAutosave={TEXTO_STATUS[status]}
        acoes={<BotaoExportar documentoId={documentoId} />}
      />
      <LayoutEdicao
        sidebar={
          <div className="flex min-h-0 flex-1 flex-col">
            {/*
              `<details>` nativo — recolhível sem estado React nem
              primitivo de acordeão novo (não pedido neste passo). Começa
              fechado: a seção é o que a coluna prioriza; metadados são
              consulta ocasional, não o que se olha a cada abertura.
            */}
            <details className="shrink-0 border-b border-[var(--border-subtle)]">
              <summary className="cursor-pointer px-4 py-3 font-sans text-xs font-semibold tracking-wide text-body select-none">
                Dados do trabalho
              </summary>
              <div className="px-4 pb-4">
                <FormMetadados metadados={documento.metadados} onChange={atualizarMetadados} />
              </div>
            </details>
            <PainelSecoes sections={documento.sections} onReorder={reordenarSecoes} />
          </div>
        }
        inspetor={<PainelInspetor documentoId={documentoId} />}
      >
        <Editor
          sections={documento.sections}
          onSectionsChange={atualizarSecoes}
          onReorderReady={registrarComandoDeReordenar}
        />
      </LayoutEdicao>
    </div>
  );
}
