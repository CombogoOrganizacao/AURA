"use client";

import { useState } from "react";

import TiptapHistory from "@tiptap/extension-history";
import TiptapParagraph from "@tiptap/extension-paragraph";
import TiptapText from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";

import { EstadoCarregando } from "@/components/ui/Estados";
import { PaperSheet } from "@/components/ui/PaperSheet";
import { novaSecao } from "@/core/document/factory";
import { fromDocumento, toDocumento } from "@/core/document/serialize";
import type { Secao } from "@/core/document/types";
import { Italico } from "@/core/editor/marks/italico";
import { Negrito } from "@/core/editor/marks/negrito";
import { Documento as DocumentoNode } from "@/core/editor/nodes/documento";
import { Secao as SecaoNode } from "@/core/editor/nodes/section";

import { Toolbar } from "./Toolbar";

interface EditorProps {
  sections: Secao[];
  onSectionsChange: (secoes: Secao[]) => void;
}

// Editor com seções (passo 1.3.7) e formatação (passo 2.5: negrito, itálico,
// nível de título — `Toolbar.tsx`). A lista fechada completa do editor está
// em docs/schema-tiptap.md; "listas" (`lista`/`item_lista`) ainda não tem nó
// aqui de propósito — fica pra Fase 3, junto com citação/figura/tabela
// (`NoConteudo` só cobre parágrafo até lá, ver src/core/document/types.ts).
//
// Continua sem `@tiptap/starter-kit` de propósito — cada nó/marca entra por
// decisão explícita, um passo do plano de cada vez.
//
// Controlado: `sections` só alimenta o conteúdo INICIAL (via `useRef`, uma
// vez só) — mudanças depois vêm de dentro do próprio editor (`onUpdate`),
// nunca de fora, pra uma escrita externa não brigar com o que a pessoa está
// digitando. Documento inexistente ganha uma seção-semente
// (`novaSecao()`), porque `doc` exige pelo menos um bloco e um `secao`
// vazio (`content: []`) não dá lugar pro cursor entrar.
export function Editor({ sections, onSectionsChange }: EditorProps) {
  // `useState` com inicializador preguiçoso — roda uma vez só, no mount, e
  // ler o valor durante o render é normal (diferente de `ref.current`, que
  // a regra `react-hooks/refs` proíbe fora de efeito/handler).
  const [conteudoInicial] = useState(() =>
    fromDocumento(sections.length > 0 ? sections : [novaSecao(0)]),
  );

  const editor = useEditor({
    extensions: [
      DocumentoNode,
      TiptapParagraph,
      TiptapText,
      SecaoNode,
      Negrito,
      Italico,
      // Desfazer/refazer (passo 2B.12) não vem de graça: as extensões
      // "core" do TipTap v3 (Editable, Commands, Keymap...) não incluem
      // histórico — é um pacote separado desde sempre, agora
      // `@tiptap/extension-history`. Sem isto, `editor.commands.undo()`
      // simplesmente não existe.
      TiptapHistory,
    ],
    content: conteudoInicial,
    // Evita o nó ser renderizado no primeiro render do lado do servidor e
    // de novo no cliente — mismatch de hidratação clássico do TipTap com
    // Next.js. Ver https://tiptap.dev/docs/guides/ssr.
    immediatelyRender: false,
    onUpdate({ editor }) {
      try {
        onSectionsChange(toDocumento(editor.getJSON()));
      } catch (erro) {
        // Não deveria acontecer com a UI atual (sem toolbar/comandos que
        // insiram algo fora da lista fechada) — mas falhar em silêncio
        // aqui perderia a digitação da pessoa sem aviso nenhum.
        console.error("Falha ao converter o editor para o formato canônico:", erro);
      }
    },
  });

  // `immediatelyRender: false` (acima) devolve `editor` como `null` no
  // primeiro render do cliente de propósito (evita o mismatch de
  // hidratação) — sem isso, essa janela mostrava a tela em branco por um
  // instante em vez de um estado de carregamento.
  if (!editor) {
    return <EstadoCarregando texto="Carregando editor…" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar editor={editor} />
      {/*
        Folha A4 real (passo 2B.10, `PaperSheet` do passo 2B.4) — mesma
        moldura da amostra estática, agora com o `EditorContent` de
        verdade dentro. `PaperSheet` recorta o que passa da altura da
        folha (`overflow: hidden`, correto para uma página impressa sem
        paginação real ainda) — o aviso de que a paginação real só existe
        no `.docx` é o passo 3.3.3, deliberadamente fora daqui; para o
        texto curto que a v1 produz hoje (a v1 não tem "nova seção" nem
        rolagem de páginas), o limite não aparece na prática.
      */}
      <div className="flex flex-1 flex-col items-center gap-6 overflow-auto bg-ink-100 p-8">
        <PaperSheet>
          <EditorContent editor={editor} />
        </PaperSheet>
      </div>
    </div>
  );
}
