"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import { PanelHeading } from "@/components/app/PanelHeading";
import { fecharGavetas } from "@/components/editor/LayoutEdicao";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Icon } from "@/components/ui/Icon";
import { numerarSecoes } from "@/core/document/numbering";
import type { Secao } from "@/core/document/types";
import { useDesktop } from "@/lib/useDesktop";

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
// No celular, fecha a gaveta das seções para mostrar o texto (6.4.4).
function irParaSecao(id: string) {
  fecharGavetas();
  const elemento = document.querySelector<HTMLElement>(`section[data-id="${CSS.escape(id)}"]`);
  elemento?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Reordenar é montar a estrutura do trabalho, e no celular a v1 cuida de
// escrever e revisar (decisão §1.12, "Recorte mobile"; passo 6.4.5).
const MOTIVO_REORDENAR =
  "Reordenar seções é só no computador: no celular, esta versão cuida de escrever e revisar, não de montar a estrutura do trabalho";

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
  /** Cria uma seção depois da seção do cursor, no mesmo nível — passo 6.2.7. */
  onNovaSecao: () => void;
  /** Apaga a seção — quem confirma, se ela tiver texto, é o `Editor.tsx`. */
  onApagarSecao: (id: string) => void;
}

interface MenuAberto {
  id: string;
  x: number;
  y: number;
}

// Menu de botão direito de uma linha do painel. Fecha com Esc, com clique fora
// e ao rolar; abre também pela tecla de menu do teclado (Shift+F10), que o
// navegador entrega como o mesmo evento `contextmenu`.
function MenuDaSecao({
  menu,
  podeApagar,
  onApagar,
  onFechar,
}: {
  menu: MenuAberto;
  podeApagar: boolean;
  onApagar: () => void;
  onFechar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    function aoApertarFora(evento: PointerEvent) {
      if (!ref.current?.contains(evento.target as Node)) onFechar();
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onFechar();
    }
    document.addEventListener("pointerdown", aoApertarFora);
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener("scroll", onFechar, true);
    return () => {
      document.removeEventListener("pointerdown", aoApertarFora);
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("scroll", onFechar, true);
    };
  }, [onFechar]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Ações da seção"
      style={{ position: "fixed", left: menu.x, top: menu.y }}
      className="z-50 min-w-44 rounded-md border border-[var(--border-subtle)] bg-card py-1 shadow-lg"
    >
      <button
        type="button"
        role="menuitem"
        disabled={!podeApagar}
        title={podeApagar ? undefined : "O trabalho precisa de pelo menos uma seção"}
        onClick={onApagar}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-sans text-sm text-danger hover:bg-sunken focus-visible:bg-sunken focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-transparent"
      >
        <Icon name="trash-2" size={14} />
        Apagar seção
      </button>
    </div>
  );
}

// Coluna esquerda do editor (passo 2B.10) — lista as seções que existem de
// verdade. Numeração progressiva (3.2.1/3.2.2), navegação por âncora (3.2.3),
// reordenar arrastando (3.2.4, só desktop) e "Nova seção" no cabeçalho
// (6.2.7; a subseção fica na barra do editor, junto do cursor).
export function PainelSecoes({
  sections,
  onReorder,
  onNovaSecao,
  onApagarSecao,
}: PainelSecoesProps) {
  const desktop = useDesktop();
  const numeracao = useMemo(() => numerarSecoes(sections), [sections]);
  const [menu, setMenu] = useState<MenuAberto | null>(null);
  const fecharMenu = useCallback(() => setMenu(null), []);

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

  // Alternativa por teclado à mesma reordenação — só a alça do desktop a
  // chama (no celular a alça é outra, desabilitada, 6.4.5), então isto herda
  // o "só desktop" de graça, sem checagem própria. Seta pra cima troca de posição
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
        <PanelHeading
          action={
            <IconButton
              name="plus"
              label="Nova seção"
              size="sm"
              variant="outline"
              onClick={onNovaSecao}
            />
          }
        >
          Seções
        </PanelHeading>
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
                onContextMenu={(evento) => {
                  evento.preventDefault();
                  // Pela tecla de menu, o evento vem sem coordenada: abre
                  // junto da própria linha.
                  const linha = evento.currentTarget.getBoundingClientRect();
                  const x = evento.clientX || linha.left + 24;
                  const y = evento.clientY || linha.bottom;
                  setMenu({ id: secao.id, x, y });
                }}
                style={{ paddingLeft: 8 + (secao.nivel - 1) * 14 }}
                className={[
                  "flex items-center gap-1 rounded-sm",
                  arrastando === secao.id ? "opacity-40" : "",
                  indicador,
                ].join(" ")}
              >
                {desktop ? (
                  <button
                    type="button"
                    aria-label={`Reordenar "${secao.titulo || "Seção sem título"}" — segure e arraste, ou use as setas`}
                    onPointerDown={(evento) => aoPressionarAlca(evento, secao.id)}
                    onKeyDown={(evento) => aoTeclarAlca(evento, indice)}
                    className="flex shrink-0 touch-none items-center rounded-sm p-1 text-subtle select-none hover:bg-sunken hover:text-muted focus-visible:outline-none focus-visible:shadow-focus-ring"
                    style={{ cursor: "grab" }}
                  >
                    <Icon name="grip-vertical" size={14} />
                  </button>
                ) : (
                  // No celular (6.4.5): à vista e desabilitada, com o motivo
                  // na dica, que abre no foco — tocar põe o foco nela.
                  <Tooltip content={MOTIVO_REORDENAR}>
                    <button
                      type="button"
                      aria-label={`Reordenar "${secao.titulo || "Seção sem título"}" (só no computador)`}
                      aria-disabled="true"
                      onClick={(evento) => evento.currentTarget.focus()}
                      className="flex shrink-0 cursor-not-allowed items-center rounded-sm p-1 text-disabled focus-visible:outline-none focus-visible:shadow-focus-ring"
                    >
                      <Icon name="grip-vertical" size={14} />
                    </button>
                  </Tooltip>
                )}
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
      {menu && (
        <MenuDaSecao
          menu={menu}
          podeApagar={sections.length > 1}
          onFechar={fecharMenu}
          onApagar={() => {
            setMenu(null);
            onApagarSecao(menu.id);
          }}
        />
      )}
    </div>
  );
}
