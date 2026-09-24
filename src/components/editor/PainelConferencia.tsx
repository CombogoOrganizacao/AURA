"use client";

import { PanelHeading } from "@/components/app/PanelHeading";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Achado, Gravidade } from "@/core/rules/compliance";

interface PainelConferenciaProps {
  achados: readonly Achado[];
  /**
   * O documento mudou depois da última conferência, e ela não vai se refazer
   * sozinha ("Verificar enquanto escrevo" desligado).
   */
  desatualizada: boolean;
  onConferirAgora: () => void;
  /** Leva ao lugar do achado: cursor no texto, ou o campo na coluna esquerda. */
  onIrPara: (achado: Achado) => void;
}

// Painel de Conferência (passo 5.2.3). Mostra o que `conferirDocumento()`
// (src/core/rules/compliance.ts) achou, agrupado por gravidade, com o item da
// norma de cada achado à vista.
//
// **Sem nota e sem "aplicar".** O kit de design desenha uma barra de
// "Conformidade ABNT 87%" e botões de aplicar correção. As duas coisas
// contrariam decisões do projeto: uma nota exigiria pesos que nenhuma norma
// dá (docs/to-do.md, Fase 5), e a conferência aponta, nunca escreve texto
// pelo aluno (CLAUDE.md, "Identidade e limite de produto"). Do kit fica o
// cartão: ícone, item da norma em mono, mensagem.
//
// Achado de regra sem item na norma (`item: null`) é identificado como
// convenção, nunca como exigência da NBR.
//
// Conferência desatualizada (passo 5.2.4): os achados continuam à vista, mas
// sem clique. O trecho de um achado velho pode ter mudado de lugar, e levar o
// cursor para lá selecionaria outro texto.

const GRUPOS: { gravidade: Gravidade; titulo: string; icone: "circle-alert" | "triangle-alert" }[] =
  [
    { gravidade: "erro", titulo: "Erros", icone: "circle-alert" },
    { gravidade: "aviso", titulo: "Avisos", icone: "triangle-alert" },
  ];

const COR: Record<Gravidade, string> = {
  erro: "text-danger",
  aviso: "text-warning",
};

function plural(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

// Onde o clique leva, lido pelo leitor de tela junto com o achado.
function destino(achado: Achado): string | null {
  switch (achado.local.tipo) {
    case "bloco":
      return achado.local.onde.tipo === "secao" ? "Ir para o trecho" : null;
    case "metadado":
      return "Abrir o campo";
    case "referencia":
      return "Abrir as referências";
    case "documento":
      return null;
  }
}

export function PainelConferencia({
  achados,
  desatualizada,
  onConferirAgora,
  onIrPara,
}: PainelConferenciaProps) {
  const erros = achados.filter((achado) => achado.gravidade === "erro").length;
  const avisos = achados.length - erros;

  const aviso = desatualizada && (
    <Alert
      tone="info"
      title="Conferência desatualizada"
      action={
        <Button size="sm" variant="outline" onClick={onConferirAgora}>
          Conferir agora
        </Button>
      }
    >
      O texto mudou depois da última conferência.
    </Alert>
  );

  if (achados.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {aviso}
        <Alert tone="success" title="Nenhuma pendência">
          Nenhum erro nem aviso nas regras conferidas. Margens, fonte e paginação não são conferidas
          aqui: o .docx já sai com os valores da norma.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {aviso}
      <p className="font-sans text-xs text-muted" aria-live="polite">
        {plural(erros, "erro", "erros")} · {plural(avisos, "aviso", "avisos")}
      </p>

      {GRUPOS.map(({ gravidade, titulo, icone }) => {
        const doGrupo = achados.filter((achado) => achado.gravidade === gravidade);
        if (doGrupo.length === 0) return null;

        return (
          <section key={gravidade} aria-label={titulo} className="flex flex-col">
            {/* O mesmo rótulo de agrupamento do painel de seções. */}
            <PanelHeading>{titulo}</PanelHeading>
            <ul className="flex flex-col gap-2">
              {doGrupo.map((achado, indice) => (
                <li key={`${achado.regra}-${indice}`}>
                  <CartaoAchado
                    achado={achado}
                    icone={icone}
                    onIrPara={desatualizada ? null : onIrPara}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CartaoAchado({
  achado,
  icone,
  onIrPara,
}: {
  achado: Achado;
  icone: "circle-alert" | "triangle-alert";
  onIrPara: ((achado: Achado) => void) | null;
}) {
  const conteudo = (
    <>
      {/* Topo, não centro: o item da norma pode quebrar em duas linhas. */}
      <span className="mb-1.5 flex items-start gap-2">
        <span className={`flex shrink-0 pt-px ${COR[achado.gravidade]}`}>
          <Icon name={icone} size={15} />
        </span>
        <span
          className={`font-mono text-2xs ${achado.item ? COR[achado.gravidade] : "text-subtle"}`}
        >
          {achado.item ?? "Convenção, sem item na norma"}
        </span>
      </span>
      <span className="block font-sans text-sm leading-snug text-body">{achado.mensagem}</span>
    </>
  );

  const acao = onIrPara && destino(achado);
  const classes =
    "block w-full rounded-md border border-[var(--border-subtle)] bg-card p-3 text-left";

  if (!acao) {
    return <div className={`${classes} ${onIrPara ? "" : "opacity-60"}`}>{conteudo}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onIrPara(achado)}
      // Mesmo foco e transição do `Button` (src/components/ui/Button.tsx).
      className={`${classes} cursor-pointer transition-[background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-standard)] hover:border-[var(--border-strong)] hover:bg-sunken focus-visible:shadow-focus-ring focus-visible:outline-none`}
    >
      {conteudo}
      {/*
        O destino entra no nome do botão como texto para leitor de tela, e não
        como `aria-label`: um `aria-label` substituiria o conteúdo, e rótulos
        como "O resumo..." colidiriam com o rótulo do próprio campo Resumo.
      */}
      <span className="sr-only"> {acao}.</span>
    </button>
  );
}
