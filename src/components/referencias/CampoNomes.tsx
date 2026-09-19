"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import type { CSLName } from "@/core/references/types";

interface CampoNomesProps {
  rotulo: string;
  dica?: string;
  valor: CSLName[] | undefined;
  onChange: (nomes: CSLName[] | undefined) => void;
}

// Lista de nomes de uma referência — autoria, tradução, organização,
// orientação (passo 4.2). Um `CSLName` por linha.
//
// **Sobrenome e prenome em campos separados, não "nome completo".** A NBR 6023
// §8.1.1 manda inverter — "SILVA, Maria Aparecida" —, e de uma string só não
// se extrai com segurança onde o sobrenome termina: "Maria Aparecida Silva
// Neto", "Antônio Augusto Moura da Silva" e "García Márquez" quebram qualquer
// heurística. Quem separa é quem sabe: a pessoa que está digitando.
//
// **A entidade é outra coisa, não um nome sem sobrenome.** A §8.1.2 trata
// autoria corporativa como entrada própria e **não a inverte** — "ASSOCIAÇÃO
// BRASILEIRA DE NORMAS TÉCNICAS", nunca "TÉCNICAS, Associação Brasileira de
// Normas". Por isso `literal` é campo separado em `CSLName` desde o 4.1, e por
// isso a linha tem a caixa "é uma entidade" em vez de o formatador adivinhar.
//
// Lista vazia vira `undefined`, não `[]`: um array vazio criaria a chave no
// objeto e faria `Object.keys()` dizer que a referência tem autoria quando ela
// não tem — e a §8.1.4 prevê obra sem autoria, entrando pelo título.
export function CampoNomes({ rotulo, dica, valor, onChange }: CampoNomesProps) {
  const nomes = valor ?? [];

  function atualizar(proximos: CSLName[]) {
    onChange(proximos.length > 0 ? proximos : undefined);
  }

  function editar(indice: number, mudanca: Partial<CSLName>) {
    atualizar(nomes.map((nome, i) => (i === indice ? { ...nome, ...mudanca } : nome)));
  }

  // Trocar de pessoa para entidade **apaga os campos do outro formato** em vez
  // de guardá-los escondidos: uma linha com `family` e `literal` ao mesmo tempo
  // não tem resposta certa na hora de formatar, e o formatador teria que
  // escolher um por conta própria.
  function alternarEntidade(indice: number, entidade: boolean) {
    atualizar(nomes.map((nome, i) => (i === indice ? (entidade ? { literal: "" } : {}) : nome)));
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-sm border border-[var(--border-subtle)] p-3">
      <legend className="px-1 font-sans text-xs font-medium tracking-wide text-body">
        {rotulo}
      </legend>

      {nomes.map((nome, indice) => {
        const entidade = nome.literal !== undefined;
        // O número na etiqueta é o que separa uma linha da outra para o leitor
        // de tela e para o Playwright, que casa rótulo por substring — duas
        // linhas rotuladas só "Sobrenome" seriam indistinguíveis.
        const posicao = `${rotulo} ${indice + 1}`;

        return (
          <div
            key={indice}
            className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-2 first:border-t-0 first:pt-0"
          >
            <div className="flex items-end gap-2">
              {entidade ? (
                <Input
                  aria-label={`${posicao} — nome da entidade`}
                  value={nome.literal ?? ""}
                  onChange={(evento) => editar(indice, { literal: evento.target.value })}
                  placeholder="Associação Brasileira de Normas Técnicas"
                />
              ) : (
                <>
                  <Input
                    aria-label={`${posicao} — sobrenome`}
                    value={nome.family ?? ""}
                    onChange={(evento) => editar(indice, { family: evento.target.value })}
                    placeholder="Sobrenome"
                  />
                  <Input
                    aria-label={`${posicao} — prenome`}
                    value={nome.given ?? ""}
                    onChange={(evento) => editar(indice, { given: evento.target.value })}
                    placeholder="Prenome(s)"
                  />
                </>
              )}
              <IconButton
                name="trash-2"
                label={`Remover ${posicao.toLocaleLowerCase("pt-BR")}`}
                variant="ghost"
                onClick={() => atualizar(nomes.filter((_, i) => i !== indice))}
              />
            </div>
            <Checkbox
              label="É uma entidade, não uma pessoa"
              description="Entidade não se inverte na referência (§8.1.2)."
              checked={entidade}
              onChange={(evento) => alternarEntidade(indice, evento.target.checked)}
            />
          </div>
        );
      })}

      <button
        type="button"
        className="self-start rounded-sm px-1 font-sans text-2xs font-medium text-bordo-700 underline-offset-2 hover:underline"
        onClick={() => atualizar([...nomes, {}])}
      >
        + Adicionar {rotulo.toLocaleLowerCase("pt-BR")}
      </button>

      {dica && <p className="font-sans text-2xs text-subtle">{dica}</p>}
    </fieldset>
  );
}
