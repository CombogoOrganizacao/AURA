"use client";

import type { Metadados } from "@/core/document/types";

interface FormMetadadosProps {
  metadados: Metadados;
  onChange: (atualizador: (atual: Metadados) => Metadados) => void;
}

const estiloCampo =
  "rounded-sm border border-ink-300 bg-card px-3 py-2 text-sm text-body shadow-inset focus:border-bordo-600 focus:shadow-focus-ring focus:outline-none";

// Formulário mínimo de metadados (passo 1.3.4) — só os campos que o to-do
// pede: título, autor, instituição, curso, orientador, cidade, ano e
// natureza do trabalho. Resumo/abstract e palavras-chave ganham componente
// próprio no passo 3.5.2; não antecipar aqui.
//
// Componente controlado desde o passo 1.3.7 — recebe `metadados` e
// `onChange`, não é mais dono da persistência. Antes carregava e salvava o
// `Documento` inteiro sozinho; isso quebrava quando o corpo do editor
// também passou a persistir (passo 1.3.7): os dois, cada um com sua cópia
// do `Documento`, brigavam por quem escrevia por último, apagando a
// mudança do outro. Quem carrega, salva e decide quando (debounce) é
// `DocumentoEditor` (src/components/documento/DocumentoEditor.tsx), o dono
// único do `Documento` na tela de edição.
export function FormMetadados({ metadados, onChange }: FormMetadadosProps) {
  function atualizarCampo<K extends keyof Metadados>(campo: K, valor: Metadados[K]) {
    onChange((atual) => ({ ...atual, [campo]: valor }));
  }

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
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-body">
      {label}
      {children}
    </label>
  );
}
