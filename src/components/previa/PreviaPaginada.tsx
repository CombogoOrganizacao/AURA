"use client";

import katex from "katex";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { dataUrl } from "@/components/editor/ImagensDoDocumento";
import { Icon } from "@/components/ui/Icon";
import type { Documento } from "@/core/document/types";
import { carregarImagensDoDocumento } from "@/core/export/docx/media";
import type { AdaptadorPersistencia } from "@/core/persistence/types";
import { montarPrevia, previaSemConteudo } from "@/core/preview/previa";

import { ConteudoDaPrevia } from "./ConteudoDaPrevia";
import { estilosDaPrevia } from "./estilos";

import "katex/dist/katex.min.css";

// Prévia paginada, só de leitura (passo 8.6.1, reabre o §1.5 de
// `docs/aura-decisoes-e-pendencias.md`): o trabalho em folhas A4, com as
// margens, a fonte e o espaçamento do `.docx`, para ver onde a página quebra
// sem exportar.
//
// **É uma aproximação, e a tela diz.** Quem quebra as páginas é o Paged.js, um
// motor de CSS; o Word tem o dele, e as duas quebras diferem em algumas
// linhas. O arquivo oficial é o `.docx`.
//
// O HTML é montado em React a partir do modelo (`core/preview/previa.ts`),
// escondido, e uma cópia é entregue ao Paged.js, que a espalha em folhas
// dentro do painel. Imprimir e PDF continuam fora da v1.
//
// Tela cheia por cima do editor, em vez de uma rota: mostra o documento como
// está na tela agora, sem esperar o autosave, e fechar devolve tudo como
// estava. O Paged.js põe estilos no `<head>` (as regras `@page`); ao fechar,
// eles saem junto.

const OPCOES_KATEX = { throwOnError: false, trust: false, strict: false as const };

type Estado = "carregando" | "montando" | "pronta" | "erro";

export function PreviaPaginada({
  documento,
  persistencia,
  onFechar,
}: {
  documento: Documento;
  persistencia: AdaptadorPersistencia;
  onFechar: () => void;
}) {
  // O documento de quando a prévia abriu: ela não se refaz a cada tecla.
  const [instantaneo] = useState(documento);
  const previa = useMemo(() => montarPrevia(instantaneo), [instantaneo]);
  const [imagens, setImagens] = useState<ReadonlyMap<string, string> | null>(null);
  const [estado, setEstado] = useState<Estado>("carregando");
  const [paginas, setPaginas] = useState(0);
  const fonte = useRef<HTMLDivElement>(null);
  const destino = useRef<HTMLDivElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);

  // Foco no botão de fechar ao abrir, e de volta a quem abriu ao sair. A
  // página de trás não rola enquanto a prévia está aberta.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const raiz = document.documentElement;
    const overflow = raiz.style.overflow;
    raiz.style.overflow = "hidden";
    fechar.current?.focus();
    return () => {
      raiz.style.overflow = overflow;
      anterior?.focus();
    };
  }, []);

  // As imagens das figuras, como `data:` (a CSP não admite `blob:`).
  useEffect(() => {
    let vivo = true;
    carregarImagensDoDocumento(persistencia, instantaneo).then(
      (carregadas) => {
        if (!vivo) return;
        const urls = new Map<string, string>();
        for (const [id, imagem] of carregadas) urls.set(id, dataUrl(imagem.formato, imagem.bytes));
        setImagens(urls);
        setEstado("montando");
      },
      () => {
        if (!vivo) return;
        // Sem as imagens a prévia sai com o espaço reservado, como o `.docx`.
        setImagens(new Map());
        setEstado("montando");
      },
    );
    return () => {
      vivo = false;
    };
  }, [persistencia, instantaneo]);

  // Depois que o HTML escondido existe: preenche as fórmulas e entrega uma
  // cópia ao Paged.js.
  useEffect(() => {
    if (!imagens || !fonte.current || !destino.current) return;
    const origem = fonte.current;
    const alvo = destino.current;
    let vivo = true;
    let desfazer: (() => void) | null = null;

    for (const elemento of origem.querySelectorAll<HTMLElement>("[data-latex]")) {
      katex.render(elemento.dataset.latex ?? "", elemento, {
        ...OPCOES_KATEX,
        displayMode: elemento.dataset.bloco === "1",
      });
    }

    (async () => {
      try {
        const { Previewer } = await import("pagedjs");
        if (!vivo) return;
        const previewer = new Previewer();
        desfazer = () => {
          try {
            previewer.polisher.destroy();
            previewer.chunker.destroy();
          } catch {
            // Já desmontado: nada a desfazer.
          }
        };
        const fluxo = await previewer.preview(
          origem.cloneNode(true),
          [{ "previa.css": estilosDaPrevia(instantaneo.metadados.fonte) }],
          alvo,
        );
        if (!vivo) return;
        setPaginas(fluxo.total);
        setEstado("pronta");
      } catch {
        if (vivo) setEstado("erro");
      }
    })();

    return () => {
      vivo = false;
      desfazer?.();
      alvo.replaceChildren();
    };
    // `estado` não entra aqui de propósito: mudar para "pronta" refaria o efeito e
    // apagaria as folhas recém-montadas.
  }, [imagens, instantaneo]);

  const vazia = previaSemConteudo(previa);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Prévia do trabalho"
      className="pv-tela fixed inset-0 z-50 flex flex-col bg-ink-100"
      onKeyDown={(evento) => {
        if (evento.key === "Escape") onFechar();
      }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--border-subtle)] bg-card px-4 py-2">
        <h2 className="font-serif text-lg text-title">Prévia</h2>
        <p role="status" className="font-sans text-xs text-muted">
          {estado === "pronta"
            ? `${paginas} ${paginas === 1 ? "página" : "páginas"}`
            : estado === "erro"
              ? "Não foi possível montar a prévia."
              : vazia
                ? ""
                : "Montando a prévia…"}
        </p>
        <p className="flex-1 font-sans text-xs text-body">
          Prévia aproximada: o Word pode quebrar a página em outro ponto. O arquivo oficial é o
          .docx.
        </p>
        <button
          ref={fechar}
          type="button"
          onClick={onFechar}
          aria-label="Fechar a prévia"
          className="flex items-center gap-1.5 rounded-sm px-2 py-1 font-sans text-sm text-body hover:bg-sunken focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          <Icon name="x" size={16} />
          Fechar
        </button>
      </header>

      {/* Rolagem pelo teclado: a região precisa poder receber o foco. */}
      <div
        role="region"
        aria-label="Folhas da prévia"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto p-4 focus-visible:outline-none focus-visible:shadow-focus-ring"
      >
        {vazia && (
          <p className="mx-auto mt-10 max-w-md text-center font-sans text-sm text-muted">
            Ainda não há nada para mostrar: escreva ao menos uma seção.
          </p>
        )}
        {/* O HTML de origem, escondido: o Paged.js recebe uma cópia dele. */}
        <div ref={fonte} hidden aria-hidden="true">
          {imagens && <ConteudoDaPrevia previa={previa} imagens={imagens} />}
        </div>
        <div ref={destino} data-testid="previa-paginas" />
      </div>
    </div>,
    document.body,
  );
}
