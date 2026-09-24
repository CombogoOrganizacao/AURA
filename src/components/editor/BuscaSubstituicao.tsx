"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { fromDocumento } from "@/core/document/serialize";
import type { Secao } from "@/core/document/types";
import { alvosDasOcorrencias, definirRealces, trocarConteudo } from "@/core/editor/busca";
import { selecaoDoAlvo } from "@/core/editor/localizar";
import {
  acharNoTexto,
  buscarNoDocumento,
  substituirOcorrencia,
  substituirTodas,
  type OcorrenciaBusca,
  type OpcoesBusca,
} from "@/core/language/findReplace";

export type CampoDaBusca = "localizar" | "substituir";

interface BuscaSubstituicaoProps {
  editor: Editor;
  // As seções no formato canônico, sempre as mais recentes (a prop
  // `sections` do `Editor`, que o `DocumentoEditor` atualiza a cada mudança).
  secoes: readonly Secao[];
  termoInicial: string;
  // Cada novo Ctrl+F / Ctrl+H com a barra aberta põe o foco de volta no campo
  // pedido; `vez` muda a cada pedido.
  foco: { campo: CampoDaBusca; vez: number };
  onFechar: () => void;
}

// Localizar e substituir (passo 5.4.3). A busca e a troca são as do núcleo
// (src/core/language/findReplace.ts, 5.4.2), sobre o formato canônico. O
// editor só recebe o resultado:
// - o realce é decoração do ProseMirror (`definirRealces`), e some ao fechar
//   sem nunca ter entrado no documento;
// - a troca entra por `trocarConteudo`, numa transação só: o Ctrl+Z desfaz
//   uma substituição, ou todas de uma vez, como qualquer edição.
//
// Até o aluno navegar, todas as ocorrências têm o mesmo realce e o contador
// diz "N resultados". Mover a seleção enquanto ele ainda digita o termo, ou
// enquanto escreve no texto com a barra aberta, tiraria o cursor do lugar.
export function BuscaSubstituicao({
  editor,
  secoes,
  termoInicial,
  foco,
  onFechar,
}: BuscaSubstituicaoProps) {
  const [termo, setTermo] = useState(termoInicial);
  const [substituto, setSubstituto] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  // Índice da ocorrência atual, ou `null` antes de navegar.
  const [atual, setAtual] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const campoLocalizar = useRef<HTMLInputElement>(null);
  const campoSubstituir = useRef<HTMLInputElement>(null);
  // Depois de uma substituição, a próxima ocorrência só existe na lista nova,
  // que chega no render seguinte. O efeito de realce a seleciona.
  const selecionarNaProxima = useRef(false);

  const corpo = useMemo(() => ({ sections: [...secoes], apendices: [], anexos: [] }), [secoes]);
  const opcoes = useMemo<OpcoesBusca>(() => ({ matchCase, wholeWord }), [matchCase, wholeWord]);
  const ocorrencias = useMemo(
    () => buscarNoDocumento(corpo, termo, opcoes),
    [corpo, termo, opcoes],
  );
  const indice =
    atual === null || ocorrencias.length === 0 ? null : Math.min(atual, ocorrencias.length - 1);

  useEffect(() => {
    const alvo = foco.campo === "localizar" ? campoLocalizar.current : campoSubstituir.current;
    alvo?.focus();
    alvo?.select();
  }, [foco]);

  // Realce: todas as ocorrências que estão no texto, a atual em destaque.
  useEffect(() => {
    const alvos = alvosDasOcorrencias(editor.state.doc, ocorrencias);
    const realces = alvos.flatMap((alvo, i) =>
      alvo?.alvo === "trecho" ? [{ de: alvo.de, ate: alvo.ate, atual: i === indice }] : [],
    );
    let tr = definirRealces(editor.state.tr, realces);
    if (selecionarNaProxima.current && indice !== null) {
      const alvo = alvos[indice];
      if (alvo) tr = tr.setSelection(selecaoDoAlvo(tr.doc, alvo)).scrollIntoView();
    }
    selecionarNaProxima.current = false;
    editor.view.dispatch(tr);
  }, [editor, ocorrencias, indice]);

  // Fechar apaga o realce.
  useEffect(
    () => () => {
      if (!editor.isDestroyed) editor.view.dispatch(definirRealces(editor.state.tr, []));
    },
    [editor],
  );

  function mostrar(proximo: number) {
    const total = ocorrencias.length;
    if (total === 0) return;
    const i = ((proximo % total) + total) % total;
    setAtual(i);
    setAviso(null);
    const [alvo] = alvosDasOcorrencias(editor.state.doc, [ocorrencias[i]]);
    // Seleciona sem tirar o foco da barra: Enter continua avançando.
    if (alvo) {
      editor.view.dispatch(
        editor.state.tr.setSelection(selecaoDoAlvo(editor.state.doc, alvo)).scrollIntoView(),
      );
    }
  }

  function aplicar(novas: readonly Secao[]) {
    const tr = editor.state.tr;
    if (trocarConteudo(tr, editor.schema.nodeFromJSON(fromDocumento([...novas])))) {
      editor.view.dispatch(tr);
    }
  }

  function substituirAtual() {
    if (indice === null) {
      // Primeiro "Substituir" sem ocorrência escolhida: mostra a primeira,
      // como no Word. A troca vem no clique seguinte, com o aluno vendo o quê.
      mostrar(0);
      return;
    }
    const ocorrencia: OcorrenciaBusca = ocorrencias[indice];
    aplicar(substituirOcorrencia(corpo, ocorrencia, substituto).sections);
    // A próxima ocorrência passa a ocupar este índice, a não ser que o
    // substituto contenha o termo ("a" por "aa"): aí ela vem depois dele.
    setAtual(indice + acharNoTexto(substituto, termo, opcoes).length);
    selecionarNaProxima.current = true;
    setAviso(null);
  }

  function substituirTudo() {
    const { documento, substituidas } = substituirTodas(corpo, termo, substituto, opcoes);
    if (substituidas === 0) return;
    aplicar(documento.sections);
    setAtual(null);
    // Sem ocorrência, os botões ficam desabilitados e o foco cairia fora da
    // barra, onde o Esc não a fecha mais.
    campoLocalizar.current?.focus();
    setAviso(
      substituidas === 1
        ? "1 ocorrência substituída."
        : `${substituidas} ocorrências substituídas.`,
    );
  }

  function fechar() {
    onFechar();
    editor.commands.focus();
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      fechar();
    }
  }

  const contador = !termo
    ? ""
    : ocorrencias.length === 0
      ? "Nenhum resultado"
      : indice === null
        ? ocorrencias.length === 1
          ? "1 resultado"
          : `${ocorrencias.length} resultados`
        : `${indice + 1} de ${ocorrencias.length}`;

  return (
    <div
      role="search"
      aria-label="Localizar e substituir"
      onKeyDown={aoTeclar}
      className="flex shrink-0 flex-col gap-2 border-b border-[var(--border-subtle)] bg-card px-4 py-3"
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Input
            ref={campoLocalizar}
            label="Localizar"
            size="sm"
            value={termo}
            suffix={contador}
            onChange={(evento) => {
              setTermo(evento.target.value);
              setAtual(null);
              setAviso(null);
            }}
            onKeyDown={(evento) => {
              if (evento.key !== "Enter") return;
              evento.preventDefault();
              mostrar(indice === null ? 0 : indice + (evento.shiftKey ? -1 : 1));
            }}
          />
        </div>
        <IconButton
          name="chevron-up"
          label="Ocorrência anterior (Shift+Enter)"
          size="sm"
          disabled={ocorrencias.length === 0}
          onClick={() => mostrar(indice === null ? -1 : indice - 1)}
        />
        <IconButton
          name="chevron-down"
          label="Próxima ocorrência (Enter)"
          size="sm"
          disabled={ocorrencias.length === 0}
          onClick={() => mostrar(indice === null ? 0 : indice + 1)}
        />
        <div className="min-w-48 flex-1">
          <Input
            ref={campoSubstituir}
            label="Substituir por"
            size="sm"
            value={substituto}
            onChange={(evento) => setSubstituto(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key !== "Enter") return;
              evento.preventDefault();
              substituirAtual();
            }}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={ocorrencias.length === 0}
          onClick={substituirAtual}
        >
          Substituir
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={ocorrencias.length === 0}
          onClick={substituirTudo}
        >
          Substituir todas
        </Button>
        <IconButton name="x" label="Fechar a busca (Esc)" size="sm" onClick={fechar} />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <Checkbox
          label="Diferenciar maiúsculas"
          checked={matchCase}
          onChange={(evento) => {
            setMatchCase(evento.target.checked);
            setAtual(null);
          }}
        />
        <Checkbox
          label="Palavra inteira"
          checked={wholeWord}
          onChange={(evento) => {
            setWholeWord(evento.target.checked);
            setAtual(null);
          }}
        />
        <p className="font-sans text-xs text-muted" aria-live="polite">
          {aviso}
        </p>
      </div>
    </div>
  );
}
