"use client";

import { SEPARADOR_LEGENDA, textoLegenda } from "@/core/document/elements/legenda";

// Legenda e fonte de figura/tabela na tela (passo 3.6.3). Os dois campos são
// ATRIBUTOS do nó, não conteúdo do ProseMirror, então são `<input>` nativos
// dentro do node view: mesma técnica (e mesmo motivo) do título da seção em
// `SectionView.tsx`. Cada linha carrega o próprio `contentEditable={false}`.
//
// **O número não é editável e não é digitado em lugar nenhum**: vem de
// `useNumeroNumeravel()`, recalculado a cada transação (docs/schema-tiptap.md
// §2). Enquanto ele não existe — nó recém-criado, antes da primeira transação
// — sai só o rótulo, nunca "Figura ?".
//
// O indicativo e o separador vêm de `textoLegenda()`/`SEPARADOR_LEGENDA`
// (src/core/document/elements/legenda.ts), as mesmas peças que o `.docx`
// usa — aqui aparecem separados do título só porque o título é um `<input>`,
// não porque a grafia seja outra.
//
// São dois componentes e não um: a legenda vai ACIMA do objeto e a fonte
// ABAIXO, então nunca são vizinhos no DOM.
//
// Tipografia (10pt, espaço simples) fica no CSS do editor, em
// `app/globals.css` — a escala de documento é em pt e mora fora do Tailwind
// de propósito (ver o comentário do `:root` lá). As classes Tailwind aqui são
// só de interação: foco, largura, placeholder.

const CLASSE_CAMPO =
  "border-none bg-transparent outline-none placeholder:text-subtle focus-visible:rounded-xs focus-visible:shadow-focus-ring";

interface CampoProps {
  rotulo: string;
  numero: number | null;
  valor: string;
  onChange: (valor: string) => void;
}

function indicativoDe(rotulo: string, numero: number | null): string {
  return numero === null ? rotulo : textoLegenda(rotulo, numero, "");
}

export function CampoLegenda({ rotulo, numero, valor, onChange }: CampoProps) {
  const indicativo = indicativoDe(rotulo, numero);

  return (
    <div className="doc-legenda" contentEditable={false}>
      <span aria-hidden="true">
        {indicativo}
        {SEPARADOR_LEGENDA}
      </span>
      <input
        type="text"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder={`Legenda da ${rotulo.toLowerCase()}`}
        aria-label={`Legenda — ${indicativo}`}
        className={CLASSE_CAMPO}
      />
    </div>
  );
}

export function CampoFonte({ rotulo, numero, valor, onChange }: CampoProps) {
  return (
    <div className="doc-legenda" contentEditable={false}>
      <span aria-hidden="true">Fonte:&nbsp;</span>
      <input
        type="text"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder="obrigatória — ex.: Elaborado pela autora (2026)"
        aria-label={`Fonte — ${indicativoDe(rotulo, numero)}`}
        className={CLASSE_CAMPO}
      />
    </div>
  );
}
