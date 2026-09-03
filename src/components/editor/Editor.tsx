"use client";

import { useState } from "react";

import TiptapDocument from "@tiptap/extension-document";
import TiptapParagraph from "@tiptap/extension-paragraph";
import TiptapText from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";

import { novaSecao } from "@/core/document/factory";
import { fromDocumento, toDocumento } from "@/core/document/serialize";
import type { Secao } from "@/core/document/types";
import { Secao as SecaoNode } from "@/core/editor/nodes/section";

interface EditorProps {
  sections: Secao[];
  onSectionsChange: (secoes: Secao[]) => void;
}

// Editor com seções (passo 1.3.7 — antes só tinha parágrafo, 1.3.1). O nó
// `secao` (1.3.2) entra aqui pela primeira vez; a lista fechada completa do
// editor está em docs/schema-tiptap.md.
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
    extensions: [TiptapDocument, TiptapParagraph, TiptapText, SecaoNode],
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

  return <EditorContent editor={editor} />;
}
