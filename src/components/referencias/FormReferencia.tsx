"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  camposDe,
  exigidoPeloTipo,
  trocarTipo,
  type CampoReferencia,
  type NomeCampo,
} from "@/core/references/campos";
import {
  ROTULO_PARTICIPACAO,
  ROTULO_TIPO,
  type CSLDate,
  type CSLName,
  type CSLType,
  type Edicao,
  type Extensao,
  type Referencia,
  type Responsabilidade,
  type TipoParticipacao,
} from "@/core/references/types";

import { CampoData } from "./CampoData";
import { CampoNomes } from "./CampoNomes";

interface FormReferenciaProps {
  referencia: Referencia;
  onChange: (atualizador: (atual: Referencia) => Referencia) => void;
}

// Formulário de uma referência (passo 4.2). **Não decide quais campos existem**
// — percorre `camposDe(tipo)` (`src/core/references/campos.ts`) e desenha o que
// a tabela manda, na ordem que ela manda. Acrescentar campo a um tipo é editar
// aquele arquivo, não este; é o mesmo princípio de `document/order.ts` mandar
// na ordem dos elementos do `.docx`.
//
// Controlado, como `FormMetadados` e `PainelAbreviaturas`: recebe a referência
// e devolve a próxima, sem ser dono da persistência. Quem salva é o painel
// (passo 4.5).
//
// **Nenhum campo guarda texto já formatado** (CLAUDE.md). É por isso que
// edição, organização e extensão não são caixas de texto: cada uma vira um
// grupinho de controles que preenche os compostos criados no 4.1 justamente
// para não haver um "2. ed. rev. e aum." digitado à mão.
export function FormReferencia({ referencia, onChange }: FormReferenciaProps) {
  // O que a última troca de tipo descartou. Fica à vista em vez de sumir em
  // silêncio: trocar Livro por Site apaga editora, local e edição, e a pessoa
  // precisa saber disso no momento em que acontece — não ao conferir a lista
  // de referências duas semanas depois.
  const [descartados, setDescartados] = useState<string[]>([]);

  function trocarTipoDaReferencia(destino: CSLType) {
    const perdidos = camposDe(referencia.type)
      .filter((campo) => !camposDe(destino).some((outro) => outro.nome === campo.nome))
      .filter((campo) => preenchido(valorDe(referencia, campo.nome)))
      .map((campo) => campo.rotulo);

    setDescartados(perdidos);
    onChange((atual) => trocarTipo(atual, destino));
  }

  function definirCampo(nome: NomeCampo, valor: unknown) {
    onChange((atual) => definir(atual, nome, valor));
  }

  return (
    <form
      className="flex max-w-xl flex-col gap-4 font-sans"
      onSubmit={(evento) => evento.preventDefault()}
      aria-label="Dados da referência"
    >
      <Select
        label="Tipo de referência"
        hint="Trocar o tipo mantém tudo que os dois tipos têm em comum."
        value={referencia.type}
        onChange={(evento) => trocarTipoDaReferencia(evento.target.value as CSLType)}
        options={Object.entries(ROTULO_TIPO).map(([value, label]) => ({ value, label }))}
      />

      {descartados.length > 0 && (
        <Alert
          tone="warning"
          title="Campos descartados na troca"
          onDismiss={() => setDescartados([])}
        >
          {descartados.join(", ")} — o tipo novo não tem esses campos.
        </Alert>
      )}

      {camposDe(referencia.type).map((campo) => (
        <Campo
          key={campo.nome}
          campo={campo}
          referencia={referencia}
          onChange={(valor) => definirCampo(campo.nome, valor)}
        />
      ))}
    </form>
  );
}

// Um campo, escolhido pela FORMA de perguntar (`campo.tipo`), não pelo nome.
// É o que mantém este componente do tamanho que está: acrescentar
// `publisher-place` a mais um tipo não passa por aqui.
function Campo({
  campo,
  referencia,
  onChange,
}: {
  campo: CampoReferencia;
  referencia: Referencia;
  onChange: (valor: unknown) => void;
}) {
  const valor = valorDe(referencia, campo.nome);

  switch (campo.tipo) {
    case "texto":
    case "url":
      return (
        <Input
          label={campo.rotulo}
          hint={campo.dica}
          required={campo.obrigatorio}
          type={campo.tipo === "url" ? "url" : "text"}
          value={(valor as string | undefined) ?? ""}
          onChange={(evento) => onChange(evento.target.value)}
          placeholder={campo.exemplo}
        />
      );

    case "nomes":
      return (
        <CampoNomes
          rotulo={campo.rotulo}
          dica={campo.dica}
          valor={valor as CSLName[] | undefined}
          onChange={onChange}
        />
      );

    case "data":
      return (
        <CampoData
          rotulo={campo.rotulo}
          dica={campo.dica}
          obrigatorio={campo.obrigatorio}
          valor={valor as CSLDate | undefined}
          onChange={onChange}
        />
      );

    case "edicao":
      return <CampoEdicao campo={campo} valor={valor as Edicao | undefined} onChange={onChange} />;

    case "responsabilidade":
      return (
        <CampoResponsabilidade
          campo={campo}
          valor={valor as Responsabilidade | undefined}
          onChange={onChange}
        />
      );

    case "extensao":
      return (
        <CampoExtensao campo={campo} valor={valor as Extensao | undefined} onChange={onChange} />
      );
  }
}

// Idiomas para a grafia do ordinal e da palavra "edição" (§8.3) — o do
// DOCUMENTO referenciado, não o do trabalho. Lista curta de propósito: é o que
// cobre o acervo de um TCC brasileiro, e vazio já significa "o mesmo do
// trabalho" em `Edicao.idioma`.
const IDIOMAS = [
  { value: "", label: "Mesmo idioma do trabalho" },
  { value: "pt", label: "Português" },
  { value: "en", label: "Inglês" },
  { value: "es", label: "Espanhol" },
  { value: "fr", label: "Francês" },
  { value: "de", label: "Alemão" },
  { value: "it", label: "Italiano" },
];

// §8.3 e §8.3.1. Sem o número não há edição nenhuma — por isso limpar o número
// apaga o composto inteiro, em vez de deixar um "rev. e aum." órfão que o
// formatador não saberia onde pendurar.
function CampoEdicao({
  campo,
  valor,
  onChange,
}: {
  campo: CampoReferencia;
  valor: Edicao | undefined;
  onChange: (valor: Edicao | undefined) => void;
}) {
  function atualizar(mudanca: Partial<Edicao>) {
    const proximo = { ...valor, ...mudanca } as Edicao;
    onChange(Number.isFinite(proximo.numero) ? proximo : undefined);
  }

  return (
    <Grupo campo={campo}>
      <div className="flex items-end gap-2">
        <Input
          aria-label="Número da edição"
          type="number"
          inputMode="numeric"
          value={valor?.numero ?? ""}
          onChange={(evento) =>
            atualizar({ numero: evento.target.value === "" ? NaN : Number(evento.target.value) })
          }
          placeholder="2"
          suffix="ed."
        />
        <Select
          aria-label="Idioma do documento"
          value={valor?.idioma ?? ""}
          onChange={(evento) => atualizar({ idioma: evento.target.value || undefined })}
          options={IDIOMAS}
        />
      </div>
      <Input
        aria-label="Acréscimos à edição"
        value={valor?.acrescimos ?? ""}
        onChange={(evento) => atualizar({ acrescimos: evento.target.value || undefined })}
        placeholder="rev. e aum."
        hint="Transcreva como consta no documento (§8.3.1)."
      />
    </Grupo>
  );
}

// §8.1.1.4. Sem nomes não há responsabilidade — o papel sozinho não vira nada
// na referência, então a lista vazia apaga o composto.
function CampoResponsabilidade({
  campo,
  valor,
  onChange,
}: {
  campo: CampoReferencia;
  valor: Responsabilidade | undefined;
  onChange: (valor: Responsabilidade | undefined) => void;
}) {
  return (
    <Grupo campo={campo}>
      <CampoNomes
        rotulo="Responsáveis pela obra"
        valor={valor?.nomes}
        onChange={(nomes) =>
          onChange(nomes ? { nomes, tipo: valor?.tipo ?? "organizador" } : undefined)
        }
      />
      {valor && (
        <Select
          label="Tipo de participação"
          value={valor.tipo}
          onChange={(evento) =>
            onChange({ ...valor, tipo: evento.target.value as TipoParticipacao })
          }
          options={Object.entries(ROTULO_PARTICIPACAO).map(([value, label]) => ({ value, label }))}
        />
      )}
    </Grupo>
  );
}

// §8.7.2.1. A unidade é dado, não enfeite: trabalho acadêmico conta folhas,
// livro conta páginas, e é ela que decide entre "82 f." e "204 p.".
function CampoExtensao({
  campo,
  valor,
  onChange,
}: {
  campo: CampoReferencia;
  valor: Extensao | undefined;
  onChange: (valor: Extensao | undefined) => void;
}) {
  function atualizar(mudanca: Partial<Extensao>) {
    const proximo = { unidade: "folha", ...valor, ...mudanca } as Extensao;
    onChange(Number.isFinite(proximo.quantidade) ? proximo : undefined);
  }

  return (
    <Grupo campo={campo}>
      <div className="flex items-end gap-2">
        <Input
          aria-label="Quantidade"
          type="number"
          inputMode="numeric"
          value={valor?.quantidade ?? ""}
          onChange={(evento) =>
            atualizar({
              quantidade: evento.target.value === "" ? NaN : Number(evento.target.value),
            })
          }
          placeholder="82"
        />
        <Select
          aria-label="Unidade da extensão"
          value={valor?.unidade ?? "folha"}
          onChange={(evento) => atualizar({ unidade: evento.target.value as Extensao["unidade"] })}
          options={[
            { value: "folha", label: "folhas (f.)" },
            { value: "pagina", label: "páginas (p.)" },
          ]}
        />
      </div>
    </Grupo>
  );
}

// Moldura dos compostos, para os três terem a mesma cara dos campos de nome e
// de data — um `<fieldset>` com o rótulo do grupo e a dica embaixo.
function Grupo({ campo, children }: { campo: CampoReferencia; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-sm border border-[var(--border-subtle)] p-3">
      <legend className="px-1 font-sans text-xs font-medium tracking-wide text-body">
        {campo.rotulo}
      </legend>
      {children}
      {campo.dica && <p className="font-sans text-2xs text-subtle">{campo.dica}</p>}
    </fieldset>
  );
}

// --- Leitura e escrita genéricas ---------------------------------------------
// As duas asserções abaixo existem pelo mesmo motivo da de `trocarTipo()`: ler
// e escrever um campo cujo nome só se conhece em tempo de execução, num membro
// de união discriminada. Ficam confinadas aqui, e o nome sempre vem de
// `camposDe(referencia.type)` — nunca de uma string solta.

function valorDe(referencia: Referencia, nome: NomeCampo): unknown {
  return (referencia as unknown as Record<string, unknown>)[nome];
}

function preenchido(valor: unknown): boolean {
  if (valor === undefined || valor === null || valor === "") return false;
  if (Array.isArray(valor)) return valor.length > 0;
  return true;
}

// Campo esvaziado **some do objeto**, em vez de virar `""` — é o que faz
// `Object.keys()` dizer a verdade sobre o que a referência tem, e o que impede
// `trocarTipo()` de carregar restos vazios para o tipo novo.
//
// A exceção são os campos que o TIPO exige (`title`, `container-title`, `URL`
// conforme o caso): apagá-los quebraria a união. Esses ficam como string
// vazia, que é o que já eram numa referência recém-criada.
function definir(referencia: Referencia, nome: NomeCampo, valor: unknown): Referencia {
  const proximo = { ...referencia } as unknown as Record<string, unknown>;

  if (!preenchido(valor) && !exigidoPeloTipo(referencia.type, nome)) delete proximo[nome];
  else proximo[nome] = preenchido(valor) ? valor : "";

  return proximo as unknown as Referencia;
}
