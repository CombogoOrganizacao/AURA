"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import { Icon } from "@/components/ui/Icon";

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
}

// Borda arrastável entre uma coluna lateral e o centro. `pointermove`/
// `pointerup` no `document` (não só no próprio elemento) — sem isso o
// arrasto trava se o ponteiro sair da faixa de 1px da borda no meio do
// gesto. Par de listeners criado e removido dentro do próprio gesto (não em
// `useEffect`), sem estado de "arrastando" — mais simples que sincronizar
// `useCallback`s cruzados pra um par de handlers que só existe entre
// pointerdown e pointerup.
function AlcaRedimensionar({ lado, onArrastar, onConfirmar, label }: AlcaRedimensionarProps) {
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
      tabIndex={0}
      onPointerDown={aoPressionar}
      onKeyDown={aoTeclar}
      className="group relative w-1 shrink-0 cursor-col-resize touch-none select-none focus-visible:outline-none"
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--border-subtle)] transition-colors group-hover:bg-bordo-300 group-focus-visible:bg-bordo-600" />
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

// Reabre a coluna esquerda se estiver recolhida — passo 5.2.3: clicar num
// achado de metadado (resumo, banca...) abre o campo nessa coluna, e ele não
// pode abrir escondido.
export function mostrarColunaEsquerda() {
  prefSidebarColapsada.definir(false);
}

export function LayoutEdicao({ sidebar, children, inspetor }: LayoutEdicaoProps) {
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

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        style={{ width: sidebarColapsada ? 0 : larguraSidebar }}
        className="flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-card transition-[width] duration-[var(--dur-normal)] ease-[var(--ease-standard)]"
      >
        <div className="flex min-h-0 flex-1 flex-col" style={{ width: larguraSidebar }}>
          {sidebar}
        </div>
      </aside>

      {!sidebarColapsada && (
        <AlcaRedimensionar
          lado="sidebar"
          onArrastar={arrastarSidebar}
          onConfirmar={confirmarSidebar}
          label="Redimensionar painel de seções"
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border-subtle)] bg-card px-2 py-1">
          <BotaoColapsar
            lado="sidebar"
            colapsado={sidebarColapsada}
            onToggle={() => prefSidebarColapsada.definir(!sidebarColapsada)}
          />
          <div className="flex-1" />
          <BotaoColapsar
            lado="inspetor"
            colapsado={inspetorColapsado}
            onToggle={() => prefInspetorColapsado.definir(!inspetorColapsado)}
          />
        </div>
        {/*
          Único painel que rola — os dois laterais rolam por conta própria,
          dentro do próprio slot. Coluna flex desde o 5.4.3: o editor divide a
          altura entre toolbar, folha e barra de estatísticas, e só a folha
          rola.
        */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
      </div>

      {!inspetorColapsado && (
        <AlcaRedimensionar
          lado="inspetor"
          onArrastar={arrastarInspetor}
          onConfirmar={confirmarInspetor}
          label="Redimensionar painel inspetor"
        />
      )}

      <aside
        style={{ width: inspetorColapsado ? 0 : larguraInspetor }}
        className="flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-[var(--border-subtle)] bg-card transition-[width] duration-[var(--dur-normal)] ease-[var(--ease-standard)]"
      >
        <div className="flex min-h-0 flex-1 flex-col" style={{ width: larguraInspetor }}>
          {inspetor}
        </div>
      </aside>
    </div>
  );
}
