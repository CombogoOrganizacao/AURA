const NORMAS = [
  { codigo: "NBR 14724", descricao: "estrutura do trabalho" },
  { codigo: "NBR 6023", descricao: "referências" },
  { codigo: "NBR 10520", descricao: "citações" },
  { codigo: "NBR 6027", descricao: "sumário" },
  { codigo: "NBR 6024", descricao: "numeração progressiva" },
] as const;

// Faixa "Normas suportadas" — só as cinco NBR que a v1 cobre de verdade
// (docs/aura-decisoes-e-pendencias.md §1.3). Sem link de saída: não existe
// ainda uma página que explique cada norma separadamente, e um link morto
// é peor que nenhum link.
export function FaixaNormas() {
  return (
    <div id="normas" className="border-y border-[var(--border-subtle)] bg-page">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-6 px-8 py-5">
        <span className="font-sans text-2xs tracking-caps text-subtle uppercase">
          Normas suportadas
        </span>
        {NORMAS.map((norma) => (
          <span key={norma.codigo} className="flex flex-col leading-tight">
            <span className="font-mono text-xs text-body">{norma.codigo}</span>
            <span className="font-sans text-2xs text-subtle">{norma.descricao}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
