"use client";

import { useId, useState } from "react";
import type { KeyboardEvent } from "react";

import { CampoShell } from "@/components/ui/CampoShell";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { siglaAparece } from "@/core/document/elements/abreviaturas";
import type { Abreviatura, Metadados, Secao } from "@/core/document/types";

interface PainelAbreviaturasProps {
  metadados: Metadados;
  sections: Secao[];
  onChange: (atualizador: (atual: Metadados) => Metadados) => void;
}

// Cadastro das abreviaturas e siglas (passo 3.6.4). O que se digita aqui é o
// PAR — sigla e significado por extenso. A lista impressa (quem entra e em
// que ordem) é derivada por `gerarListaDeAbreviaturas()`, nunca editada à
// mão: por isso não há botão de reordenar nem campo de posição.
//
// **`sections` entra aqui só para o aviso de uso.** A norma pede a relação
// das abreviaturas *utilizadas no texto*, então uma sigla cadastrada que
// ainda não aparece no corpo fica fora da lista exportada. Sem este aviso, a
// pessoa cadastraria a sigla, não a veria no `.docx` e não teria como saber
// por quê — que é exatamente o tipo de comportamento silencioso que o
// exportador não deve ter.
//
// Mesmo padrão controlado de `Resumo.tsx`/`PainelElementos.tsx`: recebe e
// devolve, sem ser dono da persistência.
export function PainelAbreviaturas({ metadados, sections, onChange }: PainelAbreviaturasProps) {
  const abreviaturas = metadados.abreviaturas ?? [];

  function atualizarLista(proximas: Abreviatura[]) {
    onChange((atual) => ({ ...atual, abreviaturas: proximas }));
  }

  function adicionar(sigla: string, significado: string) {
    atualizarLista([...abreviaturas, { id: crypto.randomUUID(), sigla, significado }]);
  }

  function editar(id: string, campo: "sigla" | "significado", valor: string) {
    atualizarLista(
      abreviaturas.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)),
    );
  }

  function remover(id: string) {
    atualizarLista(abreviaturas.filter((item) => item.id !== id));
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 font-sans">
      <NovaAbreviatura onAdicionar={adicionar} />

      {abreviaturas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {abreviaturas.map((item) => {
            // Só avisa depois que a sigla foi digitada: um cadastro em branco
            // recém-criado não é um erro, é uma linha que ainda vai ser
            // preenchida.
            const usada = !item.sigla.trim() || siglaAparece(item.sigla, sections);

            return (
              <li key={item.id} className="flex flex-col gap-1">
                {/*
                  Empilhado, não lado a lado: esta coluna tem ~230px de
                  largura (medido na tela, não estimado), e sigla +
                  significado + botão na mesma linha deixava o significado
                  cortado e o botão de remover fora do campo de visão.
                */}
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Sigla ${item.sigla || "nova"}`}
                    value={item.sigla}
                    onChange={(evento) => editar(item.id, "sigla", evento.target.value)}
                    placeholder="Sigla"
                  />
                  <IconButton
                    name="trash-2"
                    label={`Remover ${item.sigla || "abreviatura"}`}
                    variant="ghost"
                    onClick={() => remover(item.id)}
                  />
                </div>
                <Input
                  aria-label={`Significado de ${item.sigla || "nova sigla"}`}
                  value={item.significado}
                  onChange={(evento) => editar(item.id, "significado", evento.target.value)}
                  placeholder="O que ela significa por extenso"
                />
                {!usada && (
                  <p className="text-2xs text-muted">
                    Ainda não aparece no texto — a norma lista só as siglas usadas, então esta fica
                    de fora até ser citada.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-2xs text-muted">
        A lista sai em ordem alfabética sozinha, entre o abstract e o sumário. A ordem em que você
        cadastra aqui não importa.
      </p>
    </div>
  );
}

function NovaAbreviatura({
  onAdicionar,
}: {
  onAdicionar: (sigla: string, significado: string) => void;
}) {
  const [sigla, setSigla] = useState("");
  const [significado, setSignificado] = useState("");
  const idSigla = useId();

  const podeAdicionar = Boolean(sigla.trim() && significado.trim());

  function adicionar() {
    if (!podeAdicionar) return;
    onAdicionar(sigla.trim(), significado.trim());
    setSigla("");
    setSignificado("");
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    adicionar();
  }

  return (
    <CampoShell
      label="Nova abreviatura"
      hint="Sigla e significado — Enter ou o botão adicionam."
      htmlFor={idSigla}
    >
      {/* Empilhado pelo mesmo motivo das linhas já cadastradas, acima. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            id={idSigla}
            value={sigla}
            onChange={(evento) => setSigla(evento.target.value)}
            onKeyDown={aoTeclar}
            placeholder="ABNT"
          />
          <IconButton
            name="plus"
            label="Adicionar abreviatura"
            variant="outline"
            onClick={adicionar}
            disabled={!podeAdicionar}
          />
        </div>
        <Input
          // "Significado por extenso", e não "...da nova abreviatura": o
          // `getByLabel` do Playwright casa por substring, e qualquer rótulo
          // que contenha "Nova abreviatura" colidiria com o campo da sigla,
          // rotulado pelo `CampoShell` em volta (mesma armadilha registrada
          // em `Toolbar.tsx`).
          aria-label="Significado por extenso"
          value={significado}
          onChange={(evento) => setSignificado(evento.target.value)}
          onKeyDown={aoTeclar}
          placeholder="Associação Brasileira de Normas Técnicas"
        />
      </div>
    </CampoShell>
  );
}
