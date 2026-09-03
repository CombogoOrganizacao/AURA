"use client";

import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";

// Editor mínimo — só parágrafo (passo 1.3.1). O nó `secao` entra no 1.3.2; a
// lista fechada completa do editor está em docs/schema-tiptap.md.
//
// Deliberadamente não usa `@tiptap/starter-kit`: ele traz título, negrito,
// listas, citação em bloco e mais — muito além do que este passo pede, e
// o oposto do que uma lista fechada significa. Cada nó/marca entra por
// decisão explícita, um passo do plano de cada vez.
export function Editor() {
  const editor = useEditor({
    extensions: [Document, Paragraph, Text],
    // Evita o nó ser renderizado no primeiro render do lado do servidor e
    // de novo no cliente — mismatch de hidratação clássico do TipTap com
    // Next.js. Ver https://tiptap.dev/docs/guides/ssr.
    immediatelyRender: false,
  });

  return <EditorContent editor={editor} />;
}
