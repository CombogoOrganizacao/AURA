"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import katex from "katex";
import { useEffect, useMemo, useRef } from "react";

// O CSS do KaTeX vem do pacote, importado aqui e não em `app/globals.css`:
// é só esta tela que precisa dele, e o Next o carrega junto do chunk deste
// componente. As fontes que ele referencia são emitidas em
// `/_next/static/media/`, ou seja, mesma origem — a CSP do `next.config.ts`
// (`font-src 'self'`) continua valendo sem exceção nenhuma.
import "katex/dist/katex.min.css";

// Node view do nó `formula` (passo 3.6.5) — ver docs/schema-tiptap.md §4.8.
//
// Fica em `src/components/` e não em `src/core/` de propósito: o nó em si
// (`src/core/editor/nodes/formula.ts`) continua livre de React e de DOM —
// quem liga este node view a ele é `Editor.tsx`, mesma divisão de
// `SectionView.tsx` e `FiguraView.tsx`.
//
// **Duas camadas, uma fonte de verdade.** Em cima, a fórmula desenhada pelo
// KaTeX; embaixo, o `<input>` com o LaTeX que a pessoa escreve. O que fica
// gravado é só o `<input>` (atributo `texto`); o desenho é refeito a cada
// mudança e jogado fora. O campo fica sempre visível, e não só com o nó
// selecionado, pelo mesmo motivo dos campos de legenda em `FiguraView`: uma
// afordância de edição que aparece e some deixa a pessoa sem saber onde se
// escreve a fórmula.
//
// **Nada de `innerHTML`.** `katex.render()` monta nós de DOM de verdade e os
// anexa ao destino (conferido no fonte do pacote: `baseNode.textContent =
// ""` + `appendChild`, nunca `innerHTML`) — a invariante do CLAUDE.md fica
// intacta. Além disso, `trust: false` (o padrão, explicitado abaixo) recusa
// os comandos do KaTeX que geram HTML arbitrário: `\href`, `\url`,
// `\includegraphics`, `\htmlClass` e companhia. O que chega aqui é a fonte
// LaTeX da pessoa, não HTML — e continua não sendo HTML depois de desenhada.
//
// **Erro de sintaxe não apaga o que foi escrito.** LaTeX pela metade é o
// estado normal de quem está digitando: enquanto não fecha uma chave, o
// KaTeX lança. A fórmula crua é mostrada no lugar do desenho, com um aviso
// em pt-BR ao lado — nunca o "KaTeX parse error" em inglês, e nunca um campo
// que se esvazia sozinho.

// `strict: false` silencia os avisos de TeX não canônico (acento fora de
// `\text{}`, unidade em modo matemático) que o padrão `"warn"` despeja no
// console a cada tecla — não afeta segurança nenhuma, que é papel do
// `trust`. `maxExpand` fica no padrão (1000), o limite que impede uma macro
// recursiva de travar a aba.
const OPCOES_KATEX = {
  // Equação destacada do parágrafo, não embutida na linha (NBR 14724).
  displayMode: true,
  // Erro vira exceção, para o aviso em pt-BR abaixo tomar o lugar dele. Com
  // `false`, o KaTeX desenharia o próprio aviso, em inglês e em vermelho,
  // dentro da folha A4.
  throwOnError: true,
  trust: false,
  strict: false as const,
  // MathML junto do HTML (é o padrão, explicitado): é o que dá a fórmula a
  // um leitor de tela — sem ele, sobra uma pilha de `<span>`s mudos.
  output: "htmlAndMathml" as const,
};

// A sintaxe é conferida DURANTE o render, não dentro do efeito, e é por isso
// que a validação passa por `renderToString()` (que não toca no DOM) em vez
// de por `render()`: o aviso de erro faz parte do mesmo render em que o texto
// mudou, sem um `setState` em efeito que provocaria um segundo render em
// cascata (é o que a regra `react-hooks/set-state-in-effect` cobra, e com
// razão — a pessoa está digitando).
//
// O custo é analisar o LaTeX duas vezes por tecla: uma aqui, outra no
// `katex.render()` do efeito. São microssegundos para uma expressão de
// trabalho acadêmico, e o preço de não depender de API interna do KaTeX
// (`__renderToDomTree`, fora dos tipos publicados) nem de `innerHTML`.
function mensagemDeErro(texto: string): string | null {
  if (!texto.trim()) return null;
  try {
    katex.renderToString(texto, OPCOES_KATEX);
    return null;
  } catch (falha) {
    return falha instanceof Error ? falha.message : String(falha);
  }
}

export function FormulaView({ node, updateAttributes }: ReactNodeViewProps) {
  const texto = node.attrs.texto as string;
  const destino = useRef<HTMLDivElement>(null);
  const erro = useMemo(() => mensagemDeErro(texto), [texto]);

  useEffect(() => {
    const elemento = destino.current;
    if (!elemento) return;

    if (erro || !texto.trim()) {
      // A fórmula crua no lugar do desenho: o que a pessoa escreveu continua
      // à vista enquanto ela conserta a sintaxe.
      elemento.textContent = erro ? texto : "";
      return;
    }

    katex.render(texto, elemento, OPCOES_KATEX);
  }, [texto, erro]);

  return (
    <NodeViewWrapper as="div" className="doc-formula">
      <div
        ref={destino}
        contentEditable={false}
        data-erro={erro ? "" : undefined}
        className="doc-formula-render"
      />
      {!texto.trim() && (
        <p className="doc-formula-aviso" contentEditable={false}>
          fórmula vazia — escreva em LaTeX no campo abaixo
        </p>
      )}
      {erro && (
        // A mensagem original do KaTeX (em inglês, com a posição do erro) fica
        // no `title`: serve a quem conhece LaTeX sem impor inglês a quem não
        // conhece.
        <p className="doc-formula-aviso" contentEditable={false} title={erro}>
          não foi possível desenhar a fórmula — confira a sintaxe LaTeX
        </p>
      )}
      <div className="doc-formula-fonte" contentEditable={false}>
        <span aria-hidden="true">LaTeX:&nbsp;</span>
        <input
          type="text"
          value={texto}
          onChange={(evento) => updateAttributes({ texto: evento.target.value })}
          placeholder="ex.: E = mc^2"
          aria-label="Fórmula em LaTeX"
          spellCheck={false}
          className="border-none bg-transparent outline-none placeholder:text-subtle focus-visible:rounded-xs focus-visible:shadow-focus-ring"
        />
      </div>
    </NodeViewWrapper>
  );
}
