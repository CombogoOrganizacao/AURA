"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { novoDocumento } from "@/core/document/factory";
import type { Documento, Metadados } from "@/core/document/types";
import type { AdaptadorPersistencia } from "@/core/persistence/types";
import { usePersistencia } from "@/lib/persistence-provider";
import { useAutosave, type StatusAutosave } from "@/lib/useAutosave";

interface FormMetadadosProps {
  documentoId: string;
}

const estiloCampo =
  "rounded border border-bordo-200 bg-white px-3 py-2 text-sm text-bordo-900 focus:border-bordo-500 focus:outline-none";

const TEXTO_STATUS: Record<StatusAutosave, string> = {
  pendente: "Alterações não salvas…",
  salvando: "Salvando…",
  salvo: "Salvo",
  erro: "Erro ao salvar",
};

// Formulário mínimo de metadados (passo 1.3.4) — só os campos que o to-do
// pede: título, autor, instituição, curso, orientador, cidade, ano e
// natureza do trabalho. Resumo/abstract e palavras-chave ganham componente
// próprio no passo 3.5.2; não antecipar aqui.
//
// O componente é dono da persistência (carrega e salva o `Documento`
// inteiro, não só `Metadados`) porque nenhuma tela ainda monta um
// `Documento` — isso é o passo 1.3.5. Quando essa tela existir, ela decide
// se continua sendo este componente quem salva, ou se passa a receber
// `documento`/`onChange` de fora.
export function FormMetadados({ documentoId }: FormMetadadosProps) {
  const persistencia = usePersistencia();
  const [documento, setDocumento] = useState<Documento | null>(null);

  useEffect(() => {
    if (!persistencia) return;
    let cancelado = false;

    persistencia.carregarDocumento(documentoId).then((encontrado) => {
      if (cancelado) return;
      // Documento inexistente = primeira vez que este id é usado; nasce
      // vazio, com o id que foi pedido (não o que novoDocumento() geraria).
      setDocumento(encontrado ?? { ...novoDocumento(), id: documentoId });
    });

    return () => {
      cancelado = true;
    };
  }, [persistencia, documentoId]);

  if (!documento || !persistencia) {
    return <p className="text-sm text-bordo-700">Carregando metadados…</p>;
  }

  // `CamposMetadados` só monta quando `documento` já existe — é o que faz o
  // "não salva na primeira renderização" do useAutosave (src/lib/useAutosave.ts)
  // coincidir com "não salva o que acabou de ser carregado, sem edição
  // nenhuma": o primeiro `valor` que o hook vê já é o documento carregado.
  return (
    <CamposMetadados
      documento={documento}
      onDocumentoChange={setDocumento}
      persistencia={persistencia}
    />
  );
}

function CamposMetadados({
  documento,
  onDocumentoChange,
  persistencia,
}: {
  documento: Documento;
  onDocumentoChange: Dispatch<SetStateAction<Documento | null>>;
  persistencia: AdaptadorPersistencia;
}) {
  // Debounce de 3–5s (passo 1.3.6) — dez teclas seguidas geram uma escrita
  // só, no blur, no Enter, em qualquer troca de foco: em qualquer edição.
  const status = useAutosave(documento, (atual) => persistencia.salvarDocumento(atual));

  function atualizarCampo<K extends keyof Metadados>(campo: K, valor: Metadados[K]) {
    onDocumentoChange((atual) =>
      atual ? { ...atual, metadados: { ...atual.metadados, [campo]: valor } } : atual,
    );
  }

  const { metadados } = documento;

  return (
    <form
      className="flex max-w-xl flex-col gap-4 font-sans"
      onSubmit={(evento) => evento.preventDefault()}
      aria-label="Metadados do trabalho"
    >
      <Campo label="Título">
        <input
          className={estiloCampo}
          value={metadados.titulo}
          onChange={(evento) => atualizarCampo("titulo", evento.target.value)}
        />
      </Campo>

      <Campo label="Autor">
        <input
          className={estiloCampo}
          value={metadados.autores[0] ?? ""}
          onChange={(evento) =>
            atualizarCampo("autores", evento.target.value ? [evento.target.value] : [])
          }
        />
      </Campo>

      <Campo label="Instituição">
        <input
          className={estiloCampo}
          value={metadados.instituicao}
          onChange={(evento) => atualizarCampo("instituicao", evento.target.value)}
        />
      </Campo>

      <Campo label="Curso">
        <input
          className={estiloCampo}
          value={metadados.curso}
          onChange={(evento) => atualizarCampo("curso", evento.target.value)}
        />
      </Campo>

      <Campo label="Orientador">
        <input
          className={estiloCampo}
          value={metadados.orientador}
          onChange={(evento) => atualizarCampo("orientador", evento.target.value)}
        />
      </Campo>

      <Campo label="Cidade">
        <input
          className={estiloCampo}
          value={metadados.local}
          onChange={(evento) => atualizarCampo("local", evento.target.value)}
        />
      </Campo>

      <Campo label="Ano">
        <input
          className={estiloCampo}
          type="number"
          value={metadados.ano}
          onChange={(evento) => atualizarCampo("ano", Number(evento.target.value))}
        />
      </Campo>

      <Campo label="Natureza do trabalho">
        <input
          className={estiloCampo}
          value={metadados.naturezaTrabalho}
          onChange={(evento) => atualizarCampo("naturezaTrabalho", evento.target.value)}
          placeholder="Ex.: Trabalho de Conclusão de Curso apresentado a..."
        />
      </Campo>

      <p role="status" className="text-xs text-bordo-600">
        {TEXTO_STATUS[status]}
      </p>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-bordo-900">
      {label}
      {children}
    </label>
  );
}
