"use client";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import type { MembroBanca, Metadados } from "@/core/document/types";

interface PainelBancaProps {
  metadados: Metadados;
  onChange: (atualizador: (atual: Metadados) => Metadados) => void;
}

// Banca examinadora da folha de aprovação (NBR 14724:2024 §4.2.1.3) — passo
// 4B.3. O aluno cadastra nome, titulação e instituição de cada membro. A data
// de aprovação e as assinaturas não têm campo: a norma manda que sejam
// "colocadas após a aprovação do trabalho", e a folha sai com as duas em
// branco (`gerarFolhaDeAprovacao()`).
//
// Autor, título e natureza não se repetem aqui: vêm de "Dados do trabalho",
// os mesmos da folha de rosto.
//
// Mesmo padrão controlado de `PainelAbreviaturas.tsx`: recebe e devolve, sem
// ser dono da persistência.
export function PainelBanca({ metadados, onChange }: PainelBancaProps) {
  const membros = metadados.bancaExaminadora ?? [];

  function atualizarLista(proximos: MembroBanca[]) {
    onChange((atual) => ({ ...atual, bancaExaminadora: proximos }));
  }

  function adicionar() {
    atualizarLista([
      ...membros,
      { id: crypto.randomUUID(), nome: "", titulacao: "", instituicao: "" },
    ]);
  }

  function editar(id: string, campo: "nome" | "titulacao" | "instituicao", valor: string) {
    atualizarLista(membros.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)));
  }

  function remover(id: string) {
    atualizarLista(membros.filter((item) => item.id !== id));
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 font-sans">
      <p className="text-2xs text-muted">
        Um bloco por membro, incluindo o orientador. A data de aprovação e as assinaturas saem em
        branco, para preencher depois da defesa, como pede a NBR 14724.
      </p>

      {membros.length > 0 && (
        <ol className="flex flex-col gap-4">
          {membros.map((membro, indice) => {
            const rotulo = membro.nome.trim() || `membro ${indice + 1}`;
            return (
              // Empilhado pelo mesmo motivo de `PainelAbreviaturas`: a
              // coluna tem cerca de 230px de largura.
              <li key={membro.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Nome de ${rotulo}`}
                    value={membro.nome}
                    onChange={(evento) => editar(membro.id, "nome", evento.target.value)}
                    placeholder="Nome completo"
                  />
                  <IconButton
                    name="trash-2"
                    label={`Remover ${rotulo}`}
                    variant="ghost"
                    onClick={() => remover(membro.id)}
                  />
                </div>
                <Input
                  aria-label={`Titulação de ${rotulo}`}
                  value={membro.titulacao}
                  onChange={(evento) => editar(membro.id, "titulacao", evento.target.value)}
                  placeholder="Titulação (ex.: Doutora em Educação)"
                />
                <Input
                  aria-label={`Instituição de ${rotulo}`}
                  value={membro.instituicao}
                  onChange={(evento) => editar(membro.id, "instituicao", evento.target.value)}
                  placeholder="Instituição"
                />
              </li>
            );
          })}
        </ol>
      )}

      <Button variant="outline" size="sm" onClick={adicionar}>
        Adicionar membro da banca
      </Button>

      {membros.length === 0 && (
        <p className="text-2xs text-muted">
          Sem membro cadastrado, a folha de aprovação não sai no .docx.
        </p>
      )}
    </div>
  );
}
