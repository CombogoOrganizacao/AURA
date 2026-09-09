import { PanelHeading } from "@/components/app/PanelHeading";
import type { Secao } from "@/core/document/types";

interface PainelSecoesProps {
  sections: Secao[];
}

// Coluna esquerda do editor (passo 2B.10) — lista as seções que existem de
// verdade, sem numeração progressiva (3.2.1), sem navegação por âncora
// (3.2.3) e sem reordenar (3.2.4): esses três passos ainda não têm código
// por trás, e um item clicável que não faz nada é o mesmo erro já evitado
// em 2B.7/2B.9. Só apresentação.
//
// Hoje isso normalmente mostra **uma linha**: a UI ainda não tem "nova
// seção" nem edição de título de seção (`Secao.titulo` só existe como
// atributo do nó, sem representação visível no editor — `novaSecao()`
// semeia sempre `titulo: ""`). Refletir com honestidade o que existe é
// melhor que fabricar uma árvore de seções que a v1 não tem ainda.
export function PainelSecoes({ sections }: PainelSecoesProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-4">
        <PanelHeading>Seções</PanelHeading>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-4">
        {sections.length === 0 ? (
          <p className="px-2 py-1.5 font-sans text-xs text-subtle">Nenhuma seção ainda.</p>
        ) : (
          sections.map((secao) => (
            <div
              key={secao.id}
              style={{ paddingLeft: 8 + (secao.nivel - 1) * 14 }}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 font-serif text-sm text-body"
            >
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-[var(--border-default)]"
              />
              <span className="truncate">{secao.titulo || "Seção sem título"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
