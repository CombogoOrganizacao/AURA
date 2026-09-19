"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { novaReferencia } from "@/core/references/campos";
import { formatarReferencia } from "@/core/references/format/abnt";
import { ROTULO_TIPO, type Referencia } from "@/core/references/types";

import { FormReferencia } from "./FormReferencia";

interface PainelReferenciasProps {
  references: readonly Referencia[];
  onChange: (atualizador: (atual: Referencia[]) => Referencia[]) => void;
}

// Gerenciamento das referências do trabalho (passo 4.5): listar, criar, editar
// e excluir. Dá dono ao `FormReferencia`, que desde o 4.2 morava em `/design`
// por não ter onde viver.
//
// Controlado, como `PainelAbreviaturas` e `FormMetadados`: recebe a fatia do
// documento e devolve a próxima, sem ser dono da persistência — quem salva é o
// `useAutosave` de `DocumentoEditor`.
//
// **A lista aparece na ordem de cadastro, não em ordem alfabética.** É a mesma
// escolha de `PainelAbreviaturas`, e pelo mesmo motivo: a ordem da §9.1 é
// derivada na hora de exportar (`ordenarReferencias()`, 4.4), e aplicá-la aqui
// faria a linha que está sendo editada pular de posição a cada letra digitada
// no sobrenome. O que a pessoa precisa ver enquanto edita é a referência que
// ela abriu, parada onde estava.
export function PainelReferencias({ references, onChange }: PainelReferenciasProps) {
  // Qual referência está aberta para edição. Uma por vez: a lista de um TCC
  // chega a quarenta entradas, e todas abertas seriam uma coluna de formulários
  // impossível de percorrer.
  const [aberta, setAberta] = useState<string | null>(null);

  // A última excluída, para o "Desfazer". Excluir uma referência apaga uma
  // dúzia de campos digitados à mão — perder isso por um clique errado é o
  // tipo de dano que este projeto não deixa acontecer em silêncio.
  const [removida, setRemovida] = useState<Referencia | null>(null);

  function adicionar() {
    // `crypto.randomUUID()` mora aqui, e não em `novaReferencia()`: `src/core/`
    // não fala com o navegador (CLAUDE.md).
    const nova = novaReferencia("book", crypto.randomUUID());
    onChange((atual) => [...atual, nova]);
    setAberta(nova.id);
  }

  function editar(id: string, atualizador: (atual: Referencia) => Referencia) {
    onChange((atual) =>
      atual.map((referencia) => (referencia.id === id ? atualizador(referencia) : referencia)),
    );
  }

  function remover(referencia: Referencia) {
    setRemovida(referencia);
    onChange((atual) => atual.filter((item) => item.id !== referencia.id));
    if (aberta === referencia.id) setAberta(null);
  }

  // Volta para o fim da lista, e não para a posição de origem: a ordem daqui é
  // de cadastro e não afeta o documento — a lista impressa é ordenada pela
  // §9.1 na exportação. Guardar o índice para reinserir seria complexidade sem
  // consequência visível.
  function desfazer() {
    if (!removida) return;
    onChange((atual) => [...atual, removida]);
    setAberta(removida.id);
    setRemovida(null);
  }

  return (
    <div className="flex flex-col gap-3 font-sans">
      <Button variant="outline" size="sm" onClick={adicionar}>
        Nova referência
      </Button>

      {removida && (
        <Alert tone="warning" title="Referência excluída" onDismiss={() => setRemovida(null)}>
          <div className="flex flex-col items-start gap-2">
            <span>{nomeDe(removida)}</span>
            {/*
              "Desfazer" sozinho não basta como nome acessível: a toolbar do
              editor tem o dela ("Desfazer (Ctrl+Z)") e, fora de contexto,
              quem ouve os dois não sabe qual desfaz o quê.
            */}
            <Button
              variant="quiet"
              size="sm"
              aria-label="Desfazer exclusão da referência"
              onClick={desfazer}
            >
              Desfazer
            </Button>
          </div>
        </Alert>
      )}

      {references.length === 0 ? (
        <p className="text-2xs text-muted">
          Nenhuma referência cadastrada. Cada obra citada no texto entra aqui uma vez, em campos
          separados — o AURA monta a entrada na norma sozinho.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {references.map((referencia) => (
            <li
              key={referencia.id}
              className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-2 first:border-t-0 first:pt-0"
            >
              <div className="flex items-start gap-2">
                <p className="flex-1 text-2xs leading-relaxed text-body">
                  <Previa referencia={referencia} />
                </p>
                <Button
                  variant="quiet"
                  size="sm"
                  aria-label={`${aberta === referencia.id ? "Fechar" : "Editar"} ${nomeDe(referencia)}`}
                  onClick={() => setAberta(aberta === referencia.id ? null : referencia.id)}
                >
                  {aberta === referencia.id ? "Fechar" : "Editar"}
                </Button>
              </div>

              {aberta === referencia.id && (
                <div className="flex flex-col gap-3 pb-2">
                  <FormReferencia
                    referencia={referencia}
                    onChange={(atualizador) => editar(referencia.id, atualizador)}
                  />
                  {/*
                    O "Excluir" fica dentro da referência aberta, não ao lado de
                    cada linha da lista: assim não se apaga uma referência por
                    engano ao percorrer a lista com o mouse.
                  */}
                  <Button
                    variant="quiet"
                    size="sm"
                    aria-label={`Excluir ${nomeDe(referencia)}`}
                    onClick={() => remover(referencia)}
                  >
                    Excluir referência
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-2xs text-muted">
        A lista sai em ordem alfabética sozinha, ao final do trabalho. A ordem em que você cadastra
        aqui não importa.
      </p>
    </div>
  );
}

// A referência como ela vai sair impressa — é o que torna concreto que os
// campos separados viram uma entrada na norma, sem a pessoa precisar exportar
// para conferir.
//
// **O negrito é escolha desta tela, não do core.** A §6.7 admite negrito,
// itálico ou sublinhado, desde que uniforme em todas as referências; o core
// marca o trecho com `papel: "titulo"` e quem desenha escolhe. A exportação
// (4.11) precisa escolher o MESMO recurso, ou o documento fica com dois.
function Previa({ referencia }: { referencia: Referencia }) {
  // Referência recém-criada ainda não tem o que formatar: sem título, o
  // formatador devolveria só a imprenta ausente ("[S. l.: s. n.]."), que
  // parece defeito em vez de campo por preencher.
  if (referencia.title.trim() === "") {
    return <span className="text-muted">{ROTULO_TIPO[referencia.type]} sem título</span>;
  }

  return (
    <>
      {formatarReferencia(referencia).map((trecho, indice) =>
        trecho.papel === "titulo" ? (
          <strong key={indice} className="font-semibold">
            {trecho.texto}
          </strong>
        ) : (
          <span key={indice}>{trecho.texto}</span>
        ),
      )}
    </>
  );
}

// Nome curto para rótulo de botão e para o aviso de exclusão. O texto
// formatado inteiro viraria um `aria-label` de duas linhas.
function nomeDe(referencia: Referencia): string {
  const titulo = referencia.title.trim();
  return titulo === "" ? `${ROTULO_TIPO[referencia.type]} sem título` : titulo;
}
