"use client";

import type { ChainedCommands, Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ReactNode } from "react";

import { nomeDaReferencia } from "@/components/referencias/PreviaReferencia";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Radio } from "@/components/ui/Radio";
import { Select } from "@/components/ui/Select";
import type { AtributosCitacao, FonteOriginal } from "@/core/document/types";
import {
  inserirCitacaoNarrativa,
  podeInserirCitacaoNarrativa,
  type AtributosCitacaoNarrativa,
} from "@/core/editor/nodes/citacaoNarrativa";
import { formatarChamada, formatarChamadaNarrativa } from "@/core/references/format/inText";
import type { Referencia } from "@/core/references/types";
import { useDesktop } from "@/lib/useDesktop";

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
// **Apud** é uma opção de direta e indireta, não um modo: citação de
// citação pode ser transcrição ou paráfrase (§7.3, exemplos 1 e 3). A longa
// não oferece apud porque o nó `citacao_longa` guarda só `refId` e `pagina`
// (docs/schema-tiptap.md §4.3).
//
// **Autor na frase** (§6.1.4) é o único modo que põe algo no texto: o nó
// `citacao_narrativa`, que a tela desenha como "Freire (1987, p. 68)" a
// partir da referência. Não é redação: é a mesma chamada que os outros modos
// põem entre parênteses, na outra forma que a norma admite. O resto da frase
// é do aluno.

type Modo = AtributosCitacao["modo"] | "longa" | "narrativa";

interface Formulario {
  refId: string;
  modo: Modo;
  pagina: string;
  apud: boolean;
  apudSobrenome: string;
  apudPrenome: string;
  apudAno: string;
  apudPagina: string;
  grifoNosso: boolean;
  traducaoNossa: boolean;
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
  narrativa: {
    label: "Autor na frase",
    description:
      "O nome entra na sua frase, com a data e a página entre parênteses: Freire (1987, p. 68). O resto da frase, e as aspas de uma transcrição, você escreve.",
  },
};

export function MenuCitacao({ editor, references, gatilho }: MenuCitacaoProps) {
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const desktop = useDesktop();
  // A referência e o tipo da última citação feita neste trabalho: quem cita a
  // mesma obra várias vezes não a escolhe de novo a cada vez (passo 8.4.1).
  const [ultima, setUltima] = useState<{ refId: string; modo: Modo } | null>(null);

  // O que está sob o cursor quando o menu abre decide o que ele faz: editar a
  // citação existente, ligar a citação longa em que o cursor está, ou citar o
  // trecho selecionado.
  const naLonga = editor.isActive("citacao_longa");
  // O autor na frase selecionado (clique ou setas): o menu o edita.
  const narrativaAtual = editor.isActive("citacao_narrativa")
    ? (editor.getAttributes("citacao_narrativa") as AtributosCitacaoNarrativa)
    : null;
  const citacaoAtual = editor.isActive("citacao")
    ? (editor.getAttributes("citacao") as AtributosCitacao)
    : null;
  const temSelecao = !editor.state.selection.empty;

  function abrir() {
    const longa = naLonga ? editor.getAttributes("citacao_longa") : null;
    const ligada = narrativaAtual ?? citacaoAtual;
    // A última só vale se a obra ainda existe na lista.
    const lembrada = references.some((item) => item.id === ultima?.refId) ? ultima : null;
    setFormulario({
      refId:
        (ligada?.refId ?? (longa?.refId as string | null)) ||
        lembrada?.refId ||
        references[0]?.id ||
        "",
      modo: narrativaAtual
        ? "narrativa"
        : naLonga
          ? "longa"
          : (citacaoAtual?.modo ?? lembrada?.modo ?? "direta_curta"),
      pagina: ligada?.pagina ?? (longa?.pagina as string | undefined) ?? "",
      apud: Boolean(citacaoAtual?.apud),
      apudSobrenome: citacaoAtual?.apud?.author[0]?.family ?? "",
      apudPrenome: citacaoAtual?.apud?.author[0]?.given ?? "",
      apudAno: String(citacaoAtual?.apud?.issued?.["date-parts"]?.[0]?.[0] ?? ""),
      apudPagina: citacaoAtual?.apud?.pagina ?? "",
      grifoNosso: Boolean(ligada?.grifoNosso ?? longa?.grifoNosso),
      traducaoNossa: Boolean(ligada?.traducaoNossa ?? longa?.traducaoNossa),
    });
  }

  function mudar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setFormulario((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  }

  // O foco volta ao texto, com a seleção onde estava: quem citou continua
  // escrevendo dali. O `Dialog` não o devolve ao botão (`restaurarFoco`).
  //
  // `view.focus()` na hora, e não só o `commands.focus()`: o do TipTap espera
  // o próximo quadro, e as teclas de quem continua a frase logo depois de
  // "Inserir citação" se perdiam nesse intervalo (achado no 8.1.1).
  function fechar() {
    setFormulario(null);
    editor.view.focus();
    editor.commands.focus();
  }

  // Ctrl+K (⌘K no Mac) com o foco no texto abre o menu. Não é reservado pelo
  // Chrome nem pelo Firefox (o `preventDefault` vale nos dois) e não usa o
  // Alt, que no ABNT2 é o AltGr: Ctrl+Alt+C escreve "₢". `abrir` é recriado a
  // cada render, então a escuta é refeita a cada um (sem lista de
  // dependências) e guarda sempre o mais novo.
  useEffect(() => {
    if (!desktop) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (!(evento.ctrlKey || evento.metaKey) || evento.altKey || evento.shiftKey) return;
      if (evento.key.toLowerCase() !== "k") return;
      // Na janela, e na fase de captura, como o Ctrl+F do editor: o
      // `preventDefault` precisa chegar antes de o navegador levar a tecla
      // para a barra de endereço.
      evento.preventDefault();
      const foco = document.activeElement;
      const noTexto = foco === document.body || editor.view.dom.contains(foco);
      if (!formulario && noTexto) abrir();
    }
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  });

  function confirmar() {
    if (!formulario || !podeConfirmar(formulario)) return;

    // Só a direta tem trecho transcrito para grifar ou traduzir (§7.1.5,
    // §7.1.6): trocar para indireta descarta as duas escolhas.
    const direta = formulario.modo !== "indireta";
    const grifoNosso = direta && formulario.grifoNosso;
    const traducaoNossa = direta && formulario.traducaoNossa;

    if (formulario.modo === "narrativa") {
      const attrs: AtributosCitacaoNarrativa = {
        refId: formulario.refId,
        pagina: formulario.pagina.trim() || null,
        grifoNosso,
        traducaoNossa,
      };
      if (narrativaAtual) {
        editor.chain().focus().updateAttributes("citacao_narrativa", attrs).run();
      } else {
        editor
          .chain()
          .focus()
          .command(({ tr }) => inserirCitacaoNarrativa(tr, attrs))
          .run();
      }
    } else if (formulario.modo === "longa") {
      const attrs = {
        refId: formulario.refId,
        pagina: formulario.pagina.trim(),
        grifoNosso,
        traducaoNossa,
      };
      const cadeia = editor.chain().focus();
      recolherNoFim(
        naLonga
          ? cadeia.updateAttributes("citacao_longa", attrs)
          : cadeia.setNode("citacao_longa", attrs),
      ).run();
    } else {
      // `false` explícito, e não o campo ausente do formato canônico: ao
      // editar, o `setMark` mescla com os atributos que a marca já tinha, e
      // um grifo desmarcado ficaria lá. Quem tira o `false` do dado é
      // `lerAtributosCitacao()`, na serialização.
      const attrs: Omit<AtributosCitacao, "grifoNosso" | "traducaoNossa"> & {
        grifoNosso: boolean;
        traducaoNossa: boolean;
      } = {
        refId: formulario.refId,
        modo: formulario.modo,
        pagina: formulario.pagina.trim() || null,
        apud: formulario.apud ? fonteOriginal(formulario) : null,
        grifoNosso,
        traducaoNossa,
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
    setUltima({ refId: formulario.refId, modo: formulario.modo });
    fechar();
  }

  function remover() {
    if (narrativaAtual) {
      // O nó é a citação inteira: removê-la tira o nome da frase, que o
      // aluno reescreve como quiser (ou desfaz com Ctrl+Z).
      editor.chain().focus().deleteSelection().run();
    } else if (naLonga) {
      editor
        .chain()
        .focus()
        .updateAttributes("citacao_longa", {
          refId: null,
          pagina: "",
          grifoNosso: false,
          traducaoNossa: false,
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("citacao").unsetMark("citacao").run();
    }
    fechar();
  }

  // Direta e indireta precisam de um trecho: a citação é o texto do aluno, e
  // sem seleção não há texto para ligar.
  //
  // O autor na frase não precisa de trecho: entra no cursor. Precisa só de um
  // lugar que o aceite — parágrafo, não célula de tabela nem citação longa.
  function podeConfirmar(atual: Formulario): boolean {
    if (!atual.refId) return false;
    if (atual.modo === "narrativa") {
      return Boolean(narrativaAtual) || (!naLonga && podeInserirCitacaoNarrativa(editor.state));
    }
    if (atual.modo === "longa") return true;
    if (naLonga) return false;
    if (!temSelecao && !citacaoAtual) return false;
    if (atual.apud && !atual.apudSobrenome.trim()) return false;
    return true;
  }

  const editando =
    Boolean(citacaoAtual) ||
    Boolean(narrativaAtual) ||
    (naLonga && Boolean(editor.getAttributes("citacao_longa").refId));

  return (
    <>
      {gatilho({ abrir, ativo: Boolean(citacaoAtual) || Boolean(narrativaAtual) })}

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
                <Button type="submit" form="form-citacao" disabled={!podeConfirmar(formulario)}>
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
            // Enter em qualquer campo insere (ou salva). O botão do rodapé fica
            // fora do `<form>`, ligado por `form=`; desabilitado, ele também
            // segura o Enter, como `podeConfirmar()` quer.
            <form
              id="form-citacao"
              onSubmit={(evento: FormEvent) => {
                evento.preventDefault();
                confirmar();
              }}
            >
              <CamposCitacao
                formulario={formulario}
                references={references}
                modoFixo={naLonga ? "longa" : narrativaAtual ? "narrativa" : null}
                semNarrativa={Boolean(citacaoAtual)}
                semTrecho={!temSelecao && !citacaoAtual}
                onMudar={mudar}
              />
            </form>
          )}
        </Dialog>
      )}
    </>
  );
}

function CamposCitacao({
  formulario,
  references,
  modoFixo,
  semNarrativa,
  semTrecho,
  onMudar,
}: {
  formulario: Formulario;
  references: readonly Referencia[];
  // Dentro de uma citação longa, ou com um autor na frase selecionado, o
  // menu só edita aquela citação: trocar de modo seria trocar de nó.
  modoFixo: Modo | null;
  // Com o cursor num trecho já marcado, o autor na frase não é oferecido: ele
  // entraria no meio do trecho, em vez de ligá-lo.
  semNarrativa: boolean;
  semTrecho: boolean;
  onMudar: <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => void;
}) {
  const referencia = references.find((item) => item.id === formulario.refId);
  // Direta e indireta são a marca sobre o trecho: só elas pedem trecho e
  // oferecem apud.
  const marca = formulario.modo === "direta_curta" || formulario.modo === "indireta";
  // Grifo e tradução: onde pode haver trecho transcrito.
  const direta = formulario.modo !== "indireta";
  const dados = {
    pagina: formulario.pagina.trim() || null,
    ...(direta && formulario.grifoNosso ? { grifoNosso: true as const } : {}),
    ...(direta && formulario.traducaoNossa ? { traducaoNossa: true as const } : {}),
  };
  const previa = !referencia
    ? ""
    : formulario.modo === "narrativa"
      ? formatarChamadaNarrativa(referencia, dados)
      : formatarChamada(referencia, {
          ...dados,
          apud: marca && formulario.apud ? fonteOriginal(formulario) : null,
        });

  function desabilitado(modo: Modo): boolean {
    if (modoFixo) return modo !== modoFixo;
    return modo === "narrativa" && semNarrativa;
  }

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
            disabled={desabilitado(modo)}
            onChange={() => onMudar("modo", modo)}
            label={ROTULO_MODO[modo].label}
            // A explicação só do tipo escolhido: com as quatro à mostra, a
            // janela passava de meia tela. As outras vão na dica.
            description={formulario.modo === modo ? ROTULO_MODO[modo].description : undefined}
            title={ROTULO_MODO[modo].description}
          />
        ))}
      </fieldset>

      {marca && semTrecho && (
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
        data-foco-inicial
        label="Página ou localização"
        hint={
          formulario.modo === "indireta"
            ? "Opcional na indireta (§7.2). Ex.: 45, 45-47, cap. V, local. 264"
            : formulario.modo === "narrativa"
              ? "Se a frase transcreve o autor, indique onde está o trecho; se resume, é opcional (§6.1.4)."
              : "Na direta, indique onde está o trecho (§7.1). Ex.: 45, 45-47, cap. V"
        }
        value={formulario.pagina}
        onChange={(evento) => onMudar("pagina", evento.target.value)}
      />

      {direta && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold text-title">No trecho transcrito</legend>
          <Checkbox
            checked={formulario.grifoNosso}
            onChange={(evento) => onMudar("grifoNosso", evento.target.checked)}
            label="Grifo nosso"
            description="Você destacou parte do trecho, e o destaque não está no original (§7.1.5)."
          />
          <Checkbox
            checked={formulario.traducaoNossa}
            onChange={(evento) => onMudar("traducaoNossa", evento.target.checked)}
            label="Tradução nossa"
            description="Você traduziu o trecho de uma obra em outra língua (§7.1.6)."
          />
        </fieldset>
      )}

      {marca && (
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
