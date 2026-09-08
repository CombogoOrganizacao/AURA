"use client";

import { useEffect, useState } from "react";

import { Editor } from "@/components/editor/Editor";
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
      <EstadoErro
        titulo="Não foi possível carregar este documento."
        action={
          <Button variant="outline" onClick={tentarDeNovo}>
            Tentar de novo
          </Button>
        }
      />
    );
  }

  if (!documento || !persistencia) {
    return <EstadoCarregando texto="Carregando documento…" />;
  }

  // `Carregado` só monta quando `documento` já existe — é o que faz o "não
  // salva na primeira renderização" do useAutosave coincidir com "não
  // salva o que acabou de ser carregado, sem edição nenhuma" (mesmo
  // truque de FormMetadados no passo 1.3.6).
  return <Carregado documentoInicial={documento} persistencia={persistencia} />;
}

function Carregado({
  documentoInicial,
  persistencia,
}: {
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

  return (
    <div className="flex flex-col gap-6">
      <FormMetadados metadados={documento.metadados} onChange={atualizarMetadados} />

      <Editor sections={documento.sections} onSectionsChange={atualizarSecoes} />

      <p role="status" className="text-xs text-subtle">
        {TEXTO_STATUS[status]}
      </p>
    </div>
  );
}
