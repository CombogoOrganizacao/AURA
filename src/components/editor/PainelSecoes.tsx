"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import { PanelHeading } from "@/components/app/PanelHeading";
import { Icon } from "@/components/ui/Icon";
import { numerarSecoes } from "@/core/document/numbering";
import type { Secao } from "@/core/document/types";

// Mesmo limiar que o resto do sistema ainda não tinha precisado nomear —
// este é o primeiro comportamento responsivo do app (nenhum `md:`/`sm:`
// usado em componente algum até este passo). 768px é o breakpoint `md`
// padrão do Tailwind, que o projeto não sobrescreve (`app/globals.css`).
const CONSULTA_DESKTOP = "(min-width: 768px)";

function ehViewportDesktop(): boolean {
  return typeof window !== "undefined" && window.matchMedia(CONSULTA_DESKTOP).matches;
}

// Rola até a seção clicada — busca no DOM, não no editor: `PainelSecoes` não
// tem (nem precisa d)a instância do TipTap, só o `Secao[]` canônico.
// `data-id` (não `id`) é o que `SectionView.tsx` (passo 3.2.2) grava no
// `<section>` do node view; `CSS.escape` evita qualquer problema de
// caractere especial no seletor, mesmo o id sendo sempre um UUID hoje.
function irParaSecao(id: string) {
  const elemento = document.querySelector<HTMLElement>(`section[data-id="${CSS.escape(id)}"]`);
  elemento?.scrollIntoView({ behavior: "smooth", block: "start" });
}

interface AlvoDeArrasto {
  id: string;
  posicao: "antes" | "depois";
}

// Acha, entre as linhas do próprio painel, qual seção está sob o ponteiro —
// e se o ponteiro está na metade de cima ou de baixo dela (decide inserir
// antes ou depois). `elementFromPoint` + `closest`, não coordenadas
// acumuladas: mais simples e já correto pra uma lista curta como a v1 tem.
function acharAlvo(x: number, y: number, idArrastado: string): AlvoDeArrasto | null {
  const linha = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-secao-id]");
  if (!linha) return null;
  const id = linha.dataset.secaoId;
  if (!id || id === idArrastado) return null;

  const retangulo = linha.getBoundingClientRect();
  const naMetadeDeCima = y < retangulo.top + retangulo.height / 2;
  return { id, posicao: naMetadeDeCima ? "antes" : "depois" };
}

interface PainelSecoesProps {
  sections: Secao[];
  /** Move `idOrigem` pra antes/depois de `idDestino` — passo 3.2.4. */
  onReorder: (idOrigem: string, idDestino: string, inserirDepois: boolean) => void;
}

// Coluna esquerda do editor (passo 2B.10) — lista as seções que existem de
// verdade. Numeração progressiva (3.2.1/3.2.2), navegação por âncora (3.2.3)
// e reordenar arrastando (3.2.4, só desktop) já têm código por trás agora.
//
// Hoje isso normalmente mostra **uma linha**: a UI ainda não tem "nova
// seção" (só a seção-semente de `novaSecao()` existe). Refletir com
// honestidade o que existe é melhor que fabricar uma árvore que a v1 não
// tem ainda.
export function PainelSecoes({ sections, onReorder }: PainelSecoesProps) {
  const numeracao = useMemo(() => numerarSecoes(sections), [sections]);

  // "Latest ref" — mesmo padrão de `LayoutEdicao.tsx`/`AlcaRedimensionar`:
  // o gesto de arrasto dura vários renders (cada `pointermove` chama
  // `setAlvo`), então o handler nativo precisa sempre da versão mais
  // recente de `onReorder`, não a que existia no `pointerdown` que o criou.
  const onReorderRef = useRef(onReorder);
  useEffect(() => {
    onReorderRef.current = onReorder;
  });

  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<AlvoDeArrasto | null>(null);

  function aoPressionarAlca(evento: ReactPointerEvent, idOrigem: string) {
    // Defesa em dois níveis, não só CSS: a alça já está `hidden` abaixo do
    // breakpoint (nem chega a existir no DOM pra receber o gesto), e este
    // guarda cobre o caso de o evento chegar mesmo assim (ex.: disparado
    // via script, sem passar pelo layout real).
    if (!ehViewportDesktop()) return;
    evento.preventDefault();

    function aoMover(nativo: PointerEvent) {
      setAlvo(acharAlvo(nativo.clientX, nativo.clientY, idOrigem));
    }
    function aoSoltar() {
      document.removeEventListener("pointermove", aoMover);
      document.removeEventListener("pointerup", aoSoltar);
      setAlvo((atual) => {
        if (atual) onReorderRef.current(idOrigem, atual.id, atual.posicao === "depois");
        return null;
      });
      setArrastando(null);
    }

    setArrastando(idOrigem);
    document.addEventListener("pointermove", aoMover);
    document.addEventListener("pointerup", aoSoltar);
  }

  // Alternativa por teclado à mesma reordenação — a alça só existe no DOM em
  // viewport desktop (`hidden md:flex` abaixo), então isto herda o "só
  // desktop" de graça, sem checagem própria. Seta pra cima troca de posição
  // com a seção anterior; pra baixo, com a seguinte.
  function aoTeclarAlca(evento: ReactKeyboardEvent, indice: number) {
    if (evento.key === "ArrowUp" && indice > 0) {
      evento.preventDefault();
      onReorder(sections[indice].id, sections[indice - 1].id, false);
    } else if (evento.key === "ArrowDown" && indice < sections.length - 1) {
      evento.preventDefault();
      onReorder(sections[indice].id, sections[indice + 1].id, true);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-4">
        <PanelHeading>Seções</PanelHeading>
      </div>
      <nav aria-label="Seções do documento" className="flex-1 overflow-auto px-2 pb-4">
        {sections.length === 0 ? (
          <p className="px-2 py-1.5 font-sans text-xs text-subtle">Nenhuma seção ainda.</p>
        ) : (
          sections.map((secao, indice) => {
            const numero = numeracao.get(secao.id);
            // `alvo && alvo.id === secao.id` (não `alvo?.id === secao.id`
            // guardado à parte): TS só estreita `alvo` pra não-nulo dentro
            // desta mesma expressão quando o `&&` é direto, não através de
            // um booleano calculado antes.
            const indicador =
              alvo && alvo.id === secao.id
                ? alvo.posicao === "antes"
                  ? "border-t-2 border-bordo-600"
                  : "border-b-2 border-bordo-600"
                : "";
            return (
              <div
                key={secao.id}
                data-secao-id={secao.id}
                style={{ paddingLeft: 8 + (secao.nivel - 1) * 14 }}
                className={[
                  "flex items-center gap-1 rounded-sm",
                  arrastando === secao.id ? "opacity-40" : "",
                  indicador,
                ].join(" ")}
              >
                <button
                  type="button"
                  aria-label={`Reordenar "${secao.titulo || "Seção sem título"}" — segure e arraste, ou use as setas`}
                  onPointerDown={(evento) => aoPressionarAlca(evento, secao.id)}
                  onKeyDown={(evento) => aoTeclarAlca(evento, indice)}
                  className="hidden shrink-0 touch-none items-center rounded-sm p-1 text-subtle select-none hover:bg-sunken hover:text-muted focus-visible:outline-none focus-visible:shadow-focus-ring md:flex"
                  style={{ cursor: "grab" }}
                >
                  <Icon name="grip-vertical" size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => irParaSecao(secao.id)}
                  className={[
                    "flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-left font-serif text-sm text-body",
                    "rounded-sm transition-colors hover:bg-sunken",
                    "focus-visible:outline-none focus-visible:shadow-focus-ring",
                  ].join(" ")}
                >
                  {numero && (
                    <span aria-hidden="true" className="shrink-0 text-xs text-subtle">
                      {numero}
                    </span>
                  )}
                  <span className="truncate">{secao.titulo || "Seção sem título"}</span>
                </button>
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}
