"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import { Icon } from "@/components/ui/Icon";
import { useDesktop } from "@/lib/useDesktop";

// Layout de três colunas do editor (passo 2.4) — casca de composição, sem
// conteúdo próprio: `sidebar`/`children` (centro)/`inspetor` são slots. A
// lista de seções, o painel de IA/histórico/conformidade e a folha A4 vêm
// depois (Fase 3+); aqui só existe redimensionar, colapsar e persistir a
// largura escolhida, que é o que o passo pede.
//
// Larguras padrão batem com os tokens de `app/globals.css`
// (`--sidebar-w: 264px`, `--inspector-w: 320px`), mas o valor ativo vive
// aqui, não em `:root` — arrastar a borda não deveria reescrever CSS
// global.

const LARGURA_SIDEBAR_PADRAO = 264;
const LARGURA_INSPETOR_PADRAO = 320;
const LARGURA_MIN = 200;
const LARGURA_MAX = 480;

const CHAVE_SIDEBAR_W = "aura:layout:sidebar-w";
const CHAVE_INSPETOR_W = "aura:layout:inspetor-w";
const CHAVE_SIDEBAR_COLAPSADA = "aura:layout:sidebar-colapsada";
const CHAVE_INSPETOR_COLAPSADO = "aura:layout:inspetor-colapsado";

// Preferência de layout, não dado de `Documento` — por isso `localStorage`
// direto, sem passar pelo `AdaptadorPersistencia` (esse é só pra
// `Documento`, ver CLAUDE.md). `useSyncExternalStore`, não
// `useEffect`+`setState`: é literalmente o caso de uso do hook (sincronizar
// com uma fonte externa ao React) e evita cair na mesma regra de lint que
// recusou `setState` síncrono dentro de efeito em `Dialog.tsx` (2.2) e
// `app/page.tsx` (2.3) — aqui nem haveria efeito nenhum pra recusar.
function criarPreferencia(chave: string, padrao: number) {
  function obterSnapshot(): number {
    if (typeof window === "undefined") return padrao;
    const valor = Number(window.localStorage.getItem(chave));
    return Number.isFinite(valor) && valor > 0 ? valor : padrao;
  }
  function obterSnapshotServidor(): number {
    return padrao;
  }
  function inscrever(notificar: () => void): () => void {
    window.addEventListener(`aura:pref:${chave}`, notificar);
    return () => window.removeEventListener(`aura:pref:${chave}`, notificar);
  }
  function definir(valor: number): void {
    window.localStorage.setItem(chave, String(valor));
    window.dispatchEvent(new Event(`aura:pref:${chave}`));
  }
  return { obterSnapshot, obterSnapshotServidor, inscrever, definir };
}

function criarPreferenciaBooleana(chave: string) {
  function obterSnapshot(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(chave) === "1";
  }
  function obterSnapshotServidor(): boolean {
    return false;
  }
  function inscrever(notificar: () => void): () => void {
    window.addEventListener(`aura:pref:${chave}`, notificar);
    return () => window.removeEventListener(`aura:pref:${chave}`, notificar);
  }
  function definir(valor: boolean): void {
    window.localStorage.setItem(chave, valor ? "1" : "0");
    window.dispatchEvent(new Event(`aura:pref:${chave}`));
  }
  return { obterSnapshot, obterSnapshotServidor, inscrever, definir };
}

const prefSidebarW = criarPreferencia(CHAVE_SIDEBAR_W, LARGURA_SIDEBAR_PADRAO);
const prefInspetorW = criarPreferencia(CHAVE_INSPETOR_W, LARGURA_INSPETOR_PADRAO);
const prefSidebarColapsada = criarPreferenciaBooleana(CHAVE_SIDEBAR_COLAPSADA);
const prefInspetorColapsado = criarPreferenciaBooleana(CHAVE_INSPETOR_COLAPSADO);

interface AlcaRedimensionarProps {
  lado: "sidebar" | "inspetor";
  /** Chamado a cada pixel movido — só atualiza o valor "ao vivo". */
  onArrastar: (deltaX: number) => void;
  /** Chamado uma vez, ao soltar (ou a cada tecla de seta) — grava a preferência. */
  onConfirmar: () => void;
  label: string;
  /** Largura atual da coluna, em px — o valor que o leitor de tela anuncia. */
  largura: number;
}

// Borda arrastável entre uma coluna lateral e o centro. `pointermove`/
// `pointerup` no `document` (não só no próprio elemento) — sem isso o
// arrasto trava se o ponteiro sair da faixa de 1px da borda no meio do
// gesto. Par de listeners criado e removido dentro do próprio gesto (não em
// `useEffect`), sem estado de "arrastando" — mais simples que sincronizar
// `useCallback`s cruzados pra um par de handlers que só existe entre
// pointerdown e pointerup.
function AlcaRedimensionar({
  lado,
  onArrastar,
  onConfirmar,
  label,
  largura,
}: AlcaRedimensionarProps) {
  // "Latest ref": mutar `ref.current` fora de render (aqui, num efeito que
  // roda a cada render) é o padrão aceito pra ler a versão mais recente de
  // uma prop dentro de um listener nativo de vida mais longa que o render
  // atual — mutar direto no corpo do componente é o que o lint de hooks
  // recusa ("Cannot access refs during render").
  const onArrastarRef = useRef(onArrastar);
  const onConfirmarRef = useRef(onConfirmar);
  useEffect(() => {
    onArrastarRef.current = onArrastar;
    onConfirmarRef.current = onConfirmar;
  });

  function aoPressionar(evento: ReactPointerEvent<HTMLDivElement>) {
    evento.preventDefault();

    function aoMover(nativo: PointerEvent) {
      onArrastarRef.current(nativo.movementX * (lado === "inspetor" ? -1 : 1));
    }
    function aoSoltar() {
      document.removeEventListener("pointermove", aoMover);
      document.removeEventListener("pointerup", aoSoltar);
      onConfirmarRef.current();
    }

    document.addEventListener("pointermove", aoMover);
    document.addEventListener("pointerup", aoSoltar);
  }

  function aoTeclar(evento: ReactKeyboardEvent<HTMLDivElement>) {
    const passo = evento.shiftKey ? 40 : 10;
    if (evento.key === "ArrowLeft") onArrastar(lado === "inspetor" ? passo : -passo);
    else if (evento.key === "ArrowRight") onArrastar(lado === "inspetor" ? -passo : passo);
    else return;
    onConfirmar();
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      // Separador focável é um controle (ARIA 1.2): precisa dizer o valor
      // atual e os limites, senão o leitor de tela anuncia uma borda muda
      // (achado do axe no 6.6.4).
      aria-valuenow={Math.round(largura)}
      aria-valuemin={LARGURA_MIN}
      aria-valuemax={LARGURA_MAX}
      aria-valuetext={`${Math.round(largura)} pixels`}
      tabIndex={0}
      onPointerDown={aoPressionar}
      onKeyDown={aoTeclar}
      className="group relative w-1 shrink-0 cursor-col-resize touch-none select-none focus-visible:outline-none"
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--border-subtle)] transition-colors group-hover:bg-bordo-300 group-focus-visible:w-[3px] group-focus-visible:bg-bordo-600" />
    </div>
  );
}

interface BotaoColapsarProps {
  colapsado: boolean;
  onToggle: () => void;
  lado: "sidebar" | "inspetor";
}

function BotaoColapsar({ colapsado, onToggle, lado }: BotaoColapsarProps) {
  const label =
    lado === "sidebar"
      ? colapsado
        ? "Mostrar painel de seções"
        : "Ocultar painel de seções"
      : colapsado
        ? "Mostrar painel inspetor"
        : "Ocultar painel inspetor";
  const nomeIcone = lado === "sidebar" ? "panel-left" : "panel-right";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={colapsado}
      onClick={onToggle}
      className="flex shrink-0 items-center justify-center rounded-sm p-1.5 text-muted transition-colors hover:bg-sunken hover:text-body focus-visible:outline-none focus-visible:shadow-focus-ring"
    >
      <Icon name={nomeIcone} size={16} />
    </button>
  );
}

interface LayoutEdicaoProps {
  /** Painel esquerdo — lista de seções (Fase 3+; aqui é só o slot). */
  sidebar: ReactNode;
  /** Centro — rola sozinho, independente das colunas laterais. */
  children: ReactNode;
  /** Painel direito — IA/histórico/conformidade (Fase 3+; aqui é só o slot). */
  inspetor: ReactNode;
}

// No celular as colunas viram gavetas (passo 6.4.4). Quem está fora do
// layout as abre e fecha por eventos, como as preferências acima: o achado
// da conferência que leva a um campo de metadado abre a gaveta esquerda, e
// escolher uma seção ou um achado fecha a gaveta para mostrar o texto.
const EVENTO_GAVETA = "aura:layout:gaveta";
type Gaveta = "esquerda" | "direita" | null;

function pedirGaveta(gaveta: Gaveta) {
  window.dispatchEvent(new CustomEvent<Gaveta>(EVENTO_GAVETA, { detail: gaveta }));
}

// Reabre a coluna esquerda se estiver recolhida — passo 5.2.3: clicar num
// achado de metadado (resumo, banca...) abre o campo nessa coluna, e ele não
// pode abrir escondido. No celular, abre a gaveta esquerda.
export function mostrarColunaEsquerda() {
  prefSidebarColapsada.definir(false);
  pedirGaveta("esquerda");
}

// Fecha a gaveta aberta, no celular; no desktop não faz nada.
export function fecharGavetas() {
  pedirGaveta(null);
}

// Celular (passo 6.4.4, decisão §1.12 "Recorte mobile"): abaixo de 768 px o
// texto ocupa a largura toda, e as duas colunas viram gavetas por cima dele,
// fechadas ao abrir, sem alças de redimensionar nem preferência gravada.
//
// **Uma árvore só para as duas larguras.** Cruzar os 768 px (girar um
// celular grande, redimensionar a janela) muda só a aparência das colunas;
// se trocasse de componente, o React remontaria o editor (perdendo o
// desfazer) e os painéis (fechando o que estava aberto). Por isso cada
// elemento fica na mesma posição nos dois modos, e o que só existe num deles
// entra como `{condição && ...}`, que guarda o lugar. As gavetas também
// ficam sempre montadas, só escondidas: `abrirPainel()` (DocumentoEditor)
// procura o campo no DOM logo depois de pedir a gaveta.
export function LayoutEdicao({ sidebar, children, inspetor }: LayoutEdicaoProps) {
  const desktop = useDesktop();
  const [gaveta, setGaveta] = useState<Gaveta>(null);

  const larguraSidebarPersistida = useSyncExternalStore(
    prefSidebarW.inscrever,
    prefSidebarW.obterSnapshot,
    prefSidebarW.obterSnapshotServidor,
  );
  const larguraInspetorPersistida = useSyncExternalStore(
    prefInspetorW.inscrever,
    prefInspetorW.obterSnapshot,
    prefInspetorW.obterSnapshotServidor,
  );
  const sidebarColapsada = useSyncExternalStore(
    prefSidebarColapsada.inscrever,
    prefSidebarColapsada.obterSnapshot,
    prefSidebarColapsada.obterSnapshotServidor,
  );
  const inspetorColapsado = useSyncExternalStore(
    prefInspetorColapsado.inscrever,
    prefInspetorColapsado.obterSnapshot,
    prefInspetorColapsado.obterSnapshotServidor,
  );

  // Largura "ao vivo" durante o arrasto — só vira preferência gravada (e
  // some desse estado local) quando o gesto termina, pra não escrever no
  // localStorage a cada pixel movido.
  const [larguraSidebarAoVivo, setLarguraSidebarAoVivo] = useState<number | null>(null);
  const [larguraInspetorAoVivo, setLarguraInspetorAoVivo] = useState<number | null>(null);

  const larguraSidebar = larguraSidebarAoVivo ?? larguraSidebarPersistida;
  const larguraInspetor = larguraInspetorAoVivo ?? larguraInspetorPersistida;

  const arrastarSidebar = useCallback(
    (deltaX: number) => {
      setLarguraSidebarAoVivo((atual) =>
        Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, (atual ?? larguraSidebarPersistida) + deltaX)),
      );
    },
    [larguraSidebarPersistida],
  );

  const confirmarSidebar = useCallback(() => {
    setLarguraSidebarAoVivo((atual) => {
      if (atual != null) prefSidebarW.definir(atual);
      return null;
    });
  }, []);

  const arrastarInspetor = useCallback(
    (deltaX: number) => {
      setLarguraInspetorAoVivo((atual) =>
        Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, (atual ?? larguraInspetorPersistida) + deltaX)),
      );
    },
    [larguraInspetorPersistida],
  );

  const confirmarInspetor = useCallback(() => {
    setLarguraInspetorAoVivo((atual) => {
      if (atual != null) prefInspetorW.definir(atual);
      return null;
    });
  }, []);

  useEffect(() => {
    function aoPedir(evento: Event) {
      // `flushSync`: quem pediu a gaveta põe o foco num campo dela no quadro
      // seguinte, e um elemento ainda invisível não recebe foco.
      flushSync(() => setGaveta((evento as CustomEvent<Gaveta>).detail));
    }
    window.addEventListener(EVENTO_GAVETA, aoPedir);
    return () => window.removeEventListener(EVENTO_GAVETA, aoPedir);
  }, []);

  useEffect(() => {
    if (desktop || !gaveta) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setGaveta(null);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [desktop, gaveta]);

  const gavetaAberta = desktop ? null : gaveta;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <Coluna
        lado="esquerda"
        desktop={desktop}
        largura={larguraSidebar}
        colapsada={sidebarColapsada}
        aberta={gavetaAberta === "esquerda"}
        onFechar={() => setGaveta(null)}
      >
        {sidebar}
      </Coluna>

      {desktop && !sidebarColapsada && (
        <AlcaRedimensionar
          lado="sidebar"
          onArrastar={arrastarSidebar}
          onConfirmar={confirmarSidebar}
          label="Redimensionar painel de seções"
          largura={larguraSidebar}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border-subtle)] bg-card px-2 py-1">
          {desktop ? (
            <BotaoColapsar
              lado="sidebar"
              colapsado={sidebarColapsada}
              onToggle={() => prefSidebarColapsada.definir(!sidebarColapsada)}
            />
          ) : (
            <BotaoGaveta
              lado="esquerda"
              aberta={gavetaAberta === "esquerda"}
              onAbrir={() => setGaveta("esquerda")}
            />
          )}
          <div className="flex-1" />
          {desktop ? (
            <BotaoColapsar
              lado="inspetor"
              colapsado={inspetorColapsado}
              onToggle={() => prefInspetorColapsado.definir(!inspetorColapsado)}
            />
          ) : (
            <BotaoGaveta
              lado="direita"
              aberta={gavetaAberta === "direita"}
              onAbrir={() => setGaveta("direita")}
            />
          )}
        </div>
        {/*
          Único painel que rola — os dois laterais rolam por conta própria,
          dentro do próprio slot. Coluna flex desde o 5.4.3: o editor divide a
          altura entre toolbar, folha e barra de estatísticas, e só a folha
          rola.
        */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
      </div>

      {desktop && !inspetorColapsado && (
        <AlcaRedimensionar
          lado="inspetor"
          onArrastar={arrastarInspetor}
          onConfirmar={confirmarInspetor}
          label="Redimensionar painel inspetor"
          largura={larguraInspetor}
        />
      )}

      <Coluna
        lado="direita"
        desktop={desktop}
        largura={larguraInspetor}
        colapsada={inspetorColapsado}
        aberta={gavetaAberta === "direita"}
        onFechar={() => setGaveta(null)}
      >
        {inspetor}
      </Coluna>

      {gavetaAberta && (
        <div
          aria-hidden="true"
          onClick={() => setGaveta(null)}
          className="fixed inset-0 z-40 bg-ink-900/40"
        />
      )}
    </div>
  );
}

const ROTULO_GAVETA = {
  esquerda: "Seções e dados do trabalho",
  direita: "Conferência, histórico e exportação",
} as const;

function BotaoGaveta({
  lado,
  aberta,
  onAbrir,
}: {
  lado: "esquerda" | "direita";
  aberta: boolean;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Abrir: ${ROTULO_GAVETA[lado]}`}
      aria-expanded={aberta}
      onClick={onAbrir}
      className="flex shrink-0 items-center justify-center rounded-sm p-1.5 text-muted transition-colors hover:bg-sunken hover:text-body focus-visible:outline-none focus-visible:shadow-focus-ring"
    >
      <Icon name={lado === "esquerda" ? "panel-left" : "panel-right"} size={18} />
    </button>
  );
}

// Uma coluna lateral: no desktop, coluna redimensionável e recolhível; no
// celular, gaveta por cima do texto, com cabeçalho e botão de fechar, e
// `inert` quando fechada (fora da tela, do Tab e do leitor de tela, sem
// desmontar o conteúdo). O mesmo `<aside>` e o mesmo invólucro do conteúdo
// nos dois modos: o conteúdo nunca remonta.
function Coluna({
  lado,
  desktop,
  largura,
  colapsada,
  aberta,
  onFechar,
  children,
}: {
  lado: "esquerda" | "direita";
  desktop: boolean;
  largura: number;
  colapsada: boolean;
  aberta: boolean;
  onFechar: () => void;
  children: ReactNode;
}) {
  const esquerda = lado === "esquerda";
  return (
    <aside
      role={desktop ? undefined : "dialog"}
      aria-modal={desktop ? undefined : aberta}
      aria-label={desktop ? undefined : ROTULO_GAVETA[lado]}
      inert={!desktop && !aberta}
      style={desktop ? { width: colapsada ? 0 : largura } : undefined}
      className={
        desktop
          ? [
              "flex min-h-0 shrink-0 flex-col overflow-hidden bg-card",
              "transition-[width] duration-[var(--dur-normal)] ease-[var(--ease-standard)]",
              esquerda
                ? "border-r border-[var(--border-subtle)]"
                : "border-l border-[var(--border-subtle)]",
            ].join(" ")
          : [
              "fixed inset-y-0 z-50 flex w-[min(88vw,340px)] flex-col bg-card shadow-lg",
              "transition-transform duration-[var(--dur-normal)] ease-[var(--ease-standard)]",
              esquerda ? "left-0" : "right-0",
              aberta
                ? "translate-x-0"
                : esquerda
                  ? "invisible -translate-x-full"
                  : "invisible translate-x-full",
            ].join(" ")
      }
    >
      {!desktop && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-2">
          <span className="font-sans text-xs font-semibold text-body">{ROTULO_GAVETA[lado]}</span>
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={onFechar}
            className="flex rounded-sm p-1.5 text-muted hover:bg-sunken hover:text-body focus-visible:outline-none focus-visible:shadow-focus-ring"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
      )}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        style={desktop ? { width: largura } : undefined}
      >
        {children}
      </div>
    </aside>
  );
}
