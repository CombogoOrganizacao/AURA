"use client";

import type { ChainedCommands, Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { useState } from "react";
import type { ReactNode } from "react";

import { nomeDaReferencia } from "@/components/referencias/PreviaReferencia";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Radio } from "@/components/ui/Radio";
import { Select } from "@/components/ui/Select";
import type { AtributosCitacao, FonteOriginal } from "@/core/document/types";
import { formatarChamada } from "@/core/references/format/inText";
import type { Referencia } from "@/core/references/types";

// Inserir e editar citação pela interface (passo 4.10): direta, indireta,
// longa e apud — NBR 10520:2023 §7.1, §7.2, §7.1.1 e §7.3.
//
// **O aluno escreve o texto; o menu só o liga à referência.** Direta e
// indireta marcam o trecho SELECIONADO (o excerto transcrito ou a paráfrase)
// com a marca `citacao` (4.8); a longa transforma o parágrafo num bloco
// `citacao_longa` ligado pelo `refId`. Nenhum dos três escreve texto: aspas e
// chamada são desenhadas pela tela (`chamadas.ts`) e, depois, pela
// exportação, a partir do mesmo dado. O AURA não redige o trabalho
// (CLAUDE.md), e este menu não é exceção.
//
// **Apud** é uma opção de direta e indireta, não um quarto modo: citação de
// citação pode ser transcrição ou paráfrase (§7.3, exemplos 1 e 3). A longa
// não oferece apud porque o nó `citacao_longa` guarda só `refId` e `pagina`
// (docs/schema-tiptap.md §4.3).

type Modo = AtributosCitacao["modo"] | "longa";

interface Formulario {
  refId: string;
  modo: Modo;
  pagina: string;
  apud: boolean;
  apudSobrenome: string;
  apudPrenome: string;
  apudAno: string;
  apudPagina: string;
}

interface MenuCitacaoProps {
  editor: Editor;
  references: readonly Referencia[];
  // O botão que abre o menu vem de quem monta a barra (`Toolbar.tsx`), para
  // ter a mesma forma, foco e estado ativo dos outros botões dela.
  gatilho: (controle: { abrir: () => void; ativo: boolean }) => ReactNode;
}

const ROTULO_MODO: Record<Modo, { label: string; description: string }> = {
  direta_curta: {
    label: "Direta",
    description: "Transcrição de até três linhas. As aspas entram sozinhas.",
  },
  indireta: {
    label: "Indireta",
    description: "Paráfrase das ideias da obra. A página é opcional.",
  },
  longa: {
    label: "Longa",
    description: "Transcrição de mais de três linhas: o parágrafo vira bloco recuado, sem aspas.",
  },
};

export function MenuCitacao({ editor, references, gatilho }: MenuCitacaoProps) {
  const [formulario, setFormulario] = useState<Formulario | null>(null);

  // O que está sob o cursor quando o menu abre decide o que ele faz: editar a
  // citação existente, ligar a citação longa em que o cursor está, ou citar o
  // trecho selecionado.
  const naLonga = editor.isActive("citacao_longa");
  const citacaoAtual = editor.isActive("citacao")
    ? (editor.getAttributes("citacao") as AtributosCitacao)
    : null;
  const temSelecao = !editor.state.selection.empty;

  function abrir() {
    const longa = naLonga ? editor.getAttributes("citacao_longa") : null;
    setFormulario({
      refId: (citacaoAtual?.refId ?? (longa?.refId as string | null)) || references[0]?.id || "",
      modo: naLonga ? "longa" : (citacaoAtual?.modo ?? "direta_curta"),
      pagina: citacaoAtual?.pagina ?? (longa?.pagina as string | undefined) ?? "",
      apud: Boolean(citacaoAtual?.apud),
      apudSobrenome: citacaoAtual?.apud?.author[0]?.family ?? "",
      apudPrenome: citacaoAtual?.apud?.author[0]?.given ?? "",
      apudAno: String(citacaoAtual?.apud?.issued?.["date-parts"]?.[0]?.[0] ?? ""),
      apudPagina: citacaoAtual?.apud?.pagina ?? "",
    });
  }

  function mudar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setFormulario((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  }

  // O foco volta ao texto, com a seleção onde estava: quem citou continua
  // escrevendo dali. O `Dialog` não o devolve ao botão (`restaurarFoco`).
  function fechar() {
    setFormulario(null);
    editor.commands.focus();
  }

  function confirmar() {
    if (!formulario || !podeConfirmar(formulario)) return;

    if (formulario.modo === "longa") {
      const attrs = { refId: formulario.refId, pagina: formulario.pagina.trim() };
      const cadeia = editor.chain().focus();
      recolherNoFim(
        naLonga
          ? cadeia.updateAttributes("citacao_longa", attrs)
          : cadeia.setNode("citacao_longa", attrs),
      ).run();
    } else {
      const attrs: AtributosCitacao = {
        refId: formulario.refId,
        modo: formulario.modo,
        pagina: formulario.pagina.trim() || null,
        apud: formulario.apud ? fonteOriginal(formulario) : null,
      };
      const cadeia = editor.chain().focus();
      // Sem seleção, mas com o cursor numa citação: edita a citação inteira.
      recolherNoFim(
        (citacaoAtual && !temSelecao ? cadeia.extendMarkRange("citacao") : cadeia).setMark(
          "citacao",
          attrs,
        ),
      ).run();
    }
    fechar();
  }

  function remover() {
    if (naLonga) {
      editor.chain().focus().updateAttributes("citacao_longa", { refId: null, pagina: "" }).run();
    } else {
      editor.chain().focus().extendMarkRange("citacao").unsetMark("citacao").run();
    }
    fechar();
  }

  // Direta e indireta precisam de um trecho: a citação é o texto do aluno, e
  // sem seleção não há texto para ligar.
  function podeConfirmar(atual: Formulario): boolean {
    if (!atual.refId) return false;
    if (atual.modo === "longa") return true;
    if (naLonga) return false;
    if (!temSelecao && !citacaoAtual) return false;
    if (atual.apud && !atual.apudSobrenome.trim()) return false;
    return true;
  }

  const editando =
    Boolean(citacaoAtual) || (naLonga && Boolean(editor.getAttributes("citacao_longa").refId));

  return (
    <>
      {gatilho({ abrir, ativo: Boolean(citacaoAtual) })}

      {formulario && (
        <Dialog
          open
          width={560}
          restaurarFoco={false}
          title={editando ? "Editar citação" : "Citar"}
          subtitle="NBR 10520: o texto é seu; a chamada e as aspas o AURA escreve."
          onClose={fechar}
          footer={
            references.length === 0 ? (
              <Button variant="ghost" onClick={fechar}>
                Fechar
              </Button>
            ) : (
              <>
                {editando && (
                  <Button variant="quiet" onClick={remover} className="mr-auto">
                    Remover citação
                  </Button>
                )}
                <Button variant="ghost" onClick={fechar}>
                  Cancelar
                </Button>
                <Button disabled={!podeConfirmar(formulario)} onClick={confirmar}>
                  {editando ? "Salvar citação" : "Inserir citação"}
                </Button>
              </>
            )
          }
        >
          {references.length === 0 ? (
            <p className="text-sm">
              Cadastre a obra em <strong>Referências</strong>, na coluna à esquerda, antes de
              citá-la. A citação aponta para a referência, e é dela que sai a chamada.
            </p>
          ) : (
            <CamposCitacao
              formulario={formulario}
              references={references}
              naLonga={naLonga}
              semTrecho={!temSelecao && !citacaoAtual}
              onMudar={mudar}
            />
          )}
        </Dialog>
      )}
    </>
  );
}

function CamposCitacao({
  formulario,
  references,
  naLonga,
  semTrecho,
  onMudar,
}: {
  formulario: Formulario;
  references: readonly Referencia[];
  naLonga: boolean;
  semTrecho: boolean;
  onMudar: <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => void;
}) {
  const referencia = references.find((item) => item.id === formulario.refId);
  const inline = formulario.modo !== "longa";
  const previa = referencia
    ? formatarChamada(referencia, {
        pagina: formulario.pagina.trim() || null,
        apud: inline && formulario.apud ? fonteOriginal(formulario) : null,
      })
    : "";

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold text-title">Tipo de citação</legend>
        {(Object.keys(ROTULO_MODO) as Modo[]).map((modo) => (
          <Radio
            key={modo}
            name="modo-citacao"
            value={modo}
            checked={formulario.modo === modo}
            // Dentro de uma citação longa, o bloco já é a citação: marcar um
            // trecho dele seria uma segunda ligação (docs/schema-tiptap.md §4.3).
            disabled={naLonga && modo !== "longa"}
            onChange={() => onMudar("modo", modo)}
            label={ROTULO_MODO[modo].label}
            description={ROTULO_MODO[modo].description}
          />
        ))}
      </fieldset>

      {inline && semTrecho && (
        <p role="status" className="text-xs text-warning">
          Selecione no texto o trecho citado antes de inserir a citação.
        </p>
      )}

      <Select
        label="Referência"
        value={formulario.refId}
        onChange={(evento) => onMudar("refId", evento.target.value)}
        options={references.map((item) => ({ value: item.id, label: rotuloReferencia(item) }))}
      />

      <Input
        label="Página ou localização"
        hint={
          formulario.modo === "indireta"
            ? "Opcional na indireta (§7.2). Ex.: 45, 45-47, cap. V, local. 264"
            : "Na direta, indique onde está o trecho (§7.1). Ex.: 45, 45-47, cap. V"
        }
        value={formulario.pagina}
        onChange={(evento) => onMudar("pagina", evento.target.value)}
      />

      {inline && (
        <div className="flex flex-col gap-3">
          <Checkbox
            checked={formulario.apud}
            onChange={(evento) => onMudar("apud", evento.target.checked)}
            label="Citação de citação (apud)"
            description="Você leu o autor original citado nesta referência. Só a obra que você leu entra na lista (§7.3)."
          />
          {formulario.apud && (
            <div className="ml-7 grid grid-cols-2 gap-3">
              <Input
                label="Sobrenome do autor original"
                value={formulario.apudSobrenome}
                onChange={(evento) => onMudar("apudSobrenome", evento.target.value)}
              />
              <Input
                label="Prenome"
                value={formulario.apudPrenome}
                onChange={(evento) => onMudar("apudPrenome", evento.target.value)}
              />
              <Input
                label="Ano do original"
                inputMode="numeric"
                value={formulario.apudAno}
                onChange={(evento) => onMudar("apudAno", evento.target.value)}
              />
              <Input
                label="Página do original"
                value={formulario.apudPagina}
                onChange={(evento) => onMudar("apudPagina", evento.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {previa && (
        <div className="rounded-sm border border-[var(--border-subtle)] bg-sunken px-3 py-2">
          <p className="text-2xs font-semibold text-muted">Como a chamada vai sair</p>
          <p aria-label="Prévia da chamada" className="font-serif text-sm text-body">
            {previa}
          </p>
        </div>
      )}
    </div>
  );
}

// Os dados da obra original, em campos (4.8): o sobrenome é o que a chamada
// mostra; prenome, ano e página completam o que a §7.3 pede.
function fonteOriginal(formulario: Formulario): FonteOriginal {
  const ano = Number.parseInt(formulario.apudAno, 10);
  const given = formulario.apudPrenome.trim();
  return {
    author: [{ family: formulario.apudSobrenome.trim(), ...(given ? { given } : {}) }],
    ...(Number.isFinite(ano) ? { issued: { "date-parts": [[ano]] } } : {}),
    pagina: formulario.apudPagina.trim() || null,
  };
}

function rotuloReferencia(referencia: Referencia): string {
  const autor = referencia.author?.[0];
  const nome = autor?.literal ?? autor?.family;
  const ano = referencia.issued?.["date-parts"]?.[0]?.[0] ?? referencia.issued?.raw;
  return [nome, ano, nomeDaReferencia(referencia)].filter(Boolean).join(" — ");
}

// Depois de citar, o cursor vai para o FIM do trecho, sem seleção. Deixar o
// trecho selecionado era perder texto: a próxima tecla de quem continua
// escrevendo substituía o excerto inteiro — achado no Playwright, com a
// máquina lenta o bastante para a tecla chegar antes do cursor se mover.
function recolherNoFim(cadeia: ChainedCommands): ChainedCommands {
  return cadeia.command(({ tr }) => {
    tr.setSelection(TextSelection.create(tr.doc, tr.selection.to));
    return true;
  });
}
