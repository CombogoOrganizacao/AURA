// Página de amostra dos tokens visuais (passo 2.1). Não é tela da v1 — é a
// referência viva do que está em app/globals.css e docs/design.md. Deve
// continuar batendo com os dois sempre que um token mudar.

// Classes escritas por extenso — não geradas de `bg-${nome}-${step}` — porque
// o scanner do Tailwind só retém no build a variável de tema por trás de uma
// classe que aparece como string literal no código-fonte. Uma cor só
// referenciada via `var(--color-...)` construído em runtime (como estava
// aqui antes) fica de fora do CSS final e a amostra sai com buracos — foi
// exatamente o que essa página pegou ao comparar `npm run build` com o dev.
const escalaBordo = [
  { passo: 50, bg: "bg-bordo-50", texto: "text-bordo-900" },
  { passo: 100, bg: "bg-bordo-100", texto: "text-bordo-900" },
  { passo: 200, bg: "bg-bordo-200", texto: "text-bordo-900" },
  { passo: 300, bg: "bg-bordo-300", texto: "text-bordo-900" },
  { passo: 400, bg: "bg-bordo-400", texto: "text-creme-50" },
  { passo: 500, bg: "bg-bordo-500", texto: "text-creme-50" },
  { passo: 600, bg: "bg-bordo-600", texto: "text-creme-50" },
  { passo: 700, bg: "bg-bordo-700", texto: "text-creme-50" },
  { passo: 800, bg: "bg-bordo-800", texto: "text-creme-50" },
  { passo: 900, bg: "bg-bordo-900", texto: "text-creme-50" },
] as const;

const escalaCreme = [
  { passo: 50, bg: "bg-creme-50", texto: "text-bordo-900" },
  { passo: 100, bg: "bg-creme-100", texto: "text-bordo-900" },
  { passo: 200, bg: "bg-creme-200", texto: "text-bordo-900" },
  { passo: 300, bg: "bg-creme-300", texto: "text-bordo-900" },
  { passo: 400, bg: "bg-creme-400", texto: "text-bordo-900" },
  { passo: 500, bg: "bg-creme-500", texto: "text-bordo-900" },
  { passo: 600, bg: "bg-creme-600", texto: "text-creme-50" },
  { passo: 700, bg: "bg-creme-700", texto: "text-creme-50" },
] as const;

const escalaInk = [
  { passo: 50, bg: "bg-ink-50", texto: "text-bordo-900" },
  { passo: 100, bg: "bg-ink-100", texto: "text-bordo-900" },
  { passo: 200, bg: "bg-ink-200", texto: "text-bordo-900" },
  { passo: 300, bg: "bg-ink-300", texto: "text-bordo-900" },
  { passo: 400, bg: "bg-ink-400", texto: "text-bordo-900" },
  { passo: 500, bg: "bg-ink-500", texto: "text-creme-50" },
  { passo: 600, bg: "bg-ink-600", texto: "text-creme-50" },
  { passo: 700, bg: "bg-ink-700", texto: "text-creme-50" },
  { passo: 800, bg: "bg-ink-800", texto: "text-creme-50" },
  { passo: 900, bg: "bg-ink-900", texto: "text-creme-50" },
  { passo: 950, bg: "bg-ink-950", texto: "text-creme-50" },
] as const;

const semanticas = [
  { nome: "success", bg: "bg-success", soft: "bg-success-soft" },
  { nome: "warning", bg: "bg-warning", soft: "bg-warning-soft" },
  { nome: "danger", bg: "bg-danger", soft: "bg-danger-soft" },
  { nome: "info", bg: "bg-info", soft: "bg-info-soft" },
] as const;

const revisoes = [
  { nome: "insert", classe: "bg-revision-insert" },
  { nome: "delete", classe: "bg-revision-delete" },
  { nome: "comment", classe: "bg-revision-comment" },
  { nome: "citation", classe: "bg-revision-citation" },
  { nome: "highlight", classe: "bg-revision-highlight" },
] as const;

const escalaInterfacePx = [
  { nome: "2xs", classe: "text-2xs", valor: "11px" },
  { nome: "xs", classe: "text-xs", valor: "12px" },
  { nome: "sm", classe: "text-sm", valor: "13px" },
  { nome: "base", classe: "text-base", valor: "14px" },
  { nome: "md", classe: "text-md", valor: "16px" },
  { nome: "lg", classe: "text-lg", valor: "18px" },
  { nome: "xl", classe: "text-xl", valor: "22px" },
  { nome: "2xl", classe: "text-2xl", valor: "27px" },
  { nome: "3xl", classe: "text-3xl", valor: "34px" },
  { nome: "4xl", classe: "text-4xl", valor: "44px" },
  { nome: "5xl", classe: "text-5xl", valor: "56px" },
] as const;

const escalaDocumentoPt = [
  { nome: "--doc-caption", valor: "10pt" },
  { nome: "--doc-body", valor: "12pt (mínimo NBR 14724)" },
  { nome: "--doc-body-lg", valor: "13pt" },
  { nome: "--doc-h3", valor: "12pt" },
  { nome: "--doc-h2", valor: "14pt" },
  { nome: "--doc-h1", valor: "16pt" },
  { nome: "--doc-title", valor: "20pt" },
] as const;

const espacamento = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const;

const raios = [
  { nome: "xs", classe: "rounded-xs", uso: "—" },
  { nome: "sm", classe: "rounded-sm", uso: "controles: botão, campo, tag, aba" },
  { nome: "md", classe: "rounded-md", uso: "avisos" },
  { nome: "lg", classe: "rounded-lg", uso: "cartões" },
  { nome: "xl", classe: "rounded-xl", uso: "painéis grandes" },
  { nome: "2xl", classe: "rounded-2xl", uso: "—" },
  { nome: "squircle", classe: "rounded-squircle", uso: "só o ícone da marca" },
  { nome: "full", classe: "rounded-full", uso: "cápsula: badge, progresso" },
] as const;

const sombras = [
  { nome: "xs", classe: "shadow-xs" },
  { nome: "sm", classe: "shadow-sm" },
  { nome: "md", classe: "shadow-md" },
  { nome: "lg", classe: "shadow-lg" },
  { nome: "sheet", classe: "shadow-sheet" },
  { nome: "brand", classe: "shadow-brand" },
] as const;

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-ink-200 pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

interface PassoEscala {
  passo: number;
  bg: string;
  texto: string;
}

function Escala({ nome, passos }: { nome: string; passos: readonly PassoEscala[] }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-muted">{nome}</h3>
      <div className="flex flex-wrap gap-2">
        {passos.map((item) => (
          <div key={item.passo} className="flex flex-col items-center gap-1">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-sm border border-ink-200 font-mono text-2xs ${item.bg} ${item.texto}`}
            >
              {item.passo}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DesignPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-1 flex-col gap-10 p-10">
      <div>
        <h1 className="font-serif text-3xl font-bold">Design tokens — AURA</h1>
        <p className="mt-1 text-sm text-muted">
          Referência viva de app/globals.css. Ver docs/design.md para o raciocínio completo.
        </p>
      </div>

      <Secao titulo="Cor — paleta de marca">
        <p className="max-w-prose text-sm text-muted">
          Bordô <code className="font-mono text-xs">#70001b</code> (bordo-700) é a cor de
          autoridade: rail, botão primário, títulos. Creme{" "}
          <code className="font-mono text-xs">#fed488</code> (creme-300) é o par de destaque. As
          duas nunca competem na mesma superfície com o mesmo peso.
        </p>
        <div className="flex flex-col gap-6">
          <Escala nome="bordo" passos={escalaBordo} />
          <Escala nome="creme" passos={escalaCreme} />
          <Escala nome="ink" passos={escalaInk} />
        </div>
      </Secao>

      <Secao titulo="Cor — aliases semânticos">
        <p className="max-w-prose text-sm text-muted">
          Preferir estes à paleta bruta ao escrever componente — é o que sobrevive se a paleta
          mudar.
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { nome: "title", classe: "bg-title" },
            { nome: "body", classe: "bg-body" },
            { nome: "muted", classe: "bg-muted" },
            { nome: "subtle", classe: "bg-subtle" },
            { nome: "disabled", classe: "bg-disabled" },
            { nome: "link", classe: "bg-link" },
            { nome: "brand", classe: "bg-brand" },
            { nome: "brand-soft", classe: "bg-brand-soft" },
            { nome: "accent", classe: "bg-accent" },
            { nome: "accent-soft", classe: "bg-accent-soft" },
            { nome: "page", classe: "bg-page" },
            { nome: "card", classe: "bg-card" },
            { nome: "sunken", classe: "bg-sunken" },
          ].map((item) => (
            <div key={item.nome} className="flex flex-col items-center gap-1">
              <div className={`h-14 w-20 rounded-sm border border-ink-200 ${item.classe}`} />
              <span className="font-mono text-2xs text-subtle">{item.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Cor — semânticas e marcas de revisão">
        <div className="flex flex-wrap gap-6">
          {semanticas.map((item) => (
            <div key={item.nome} className="flex flex-col items-center gap-1">
              <div className="flex gap-1">
                <div className={`h-14 w-14 rounded-sm ${item.bg}`} />
                <div className={`h-14 w-14 rounded-sm border border-ink-200 ${item.soft}`} />
              </div>
              <span className="font-mono text-2xs text-subtle">{item.nome}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">
          Marcas de revisão — exclusivas do texto do documento, não aparecem fora dele:
        </p>
        <div className="flex flex-wrap gap-6">
          {revisoes.map((item) => (
            <div key={item.nome} className="flex flex-col items-center gap-1">
              <div className={`h-14 w-14 rounded-sm border border-ink-200 ${item.classe}`} />
              <span className="font-mono text-2xs text-subtle">{item.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tipografia — famílias">
        <div className="flex flex-col gap-3">
          <p className="font-serif text-2xl">Newsreader — títulos e texto do documento</p>
          <p className="font-sans text-base">Work Sans — interface, rótulos e botões</p>
          <p className="font-mono text-base">IBM Plex Mono — números, DOIs, chaves de citação</p>
          <p className="font-brand text-2xl font-bold text-brand">
            AURA — Roboto 700, só o logotipo
          </p>
        </div>
      </Secao>

      <Secao titulo="Tipografia — escala de interface (px, base 14)">
        <div className="flex flex-col gap-2">
          {escalaInterfacePx.map((item) => (
            <div key={item.nome} className="flex items-baseline gap-4">
              <span className="w-16 shrink-0 font-mono text-xs text-subtle">{item.valor}</span>
              <span className={item.classe}>Formatação, revisão e organização — {item.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tipografia — escala de documento (pt, dentro da folha A4)">
        <p className="max-w-prose text-sm text-muted">
          Escala paralela, nunca intercambiável com a de interface. Fonte da folha é Times New Roman
          ou Arial (a norma decide, não a marca) — a amostra abaixo usa o corpo do documento
          (Newsreader) só para mostrar a proporção.
        </p>
        <div className="flex flex-col gap-2">
          {escalaDocumentoPt.map((item) => (
            <div key={item.nome} className="flex items-baseline gap-4">
              <span className="w-40 shrink-0 font-mono text-xs text-subtle">{item.nome}</span>
              <span className="font-serif" style={{ fontSize: `var(${item.nome})` }}>
                {item.valor}
              </span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Espaçamento (base 4px)">
        <p className="text-sm text-muted">
          É a escala numérica padrão do Tailwind — <code className="font-mono text-xs">p-4</code> já
          é <code className="font-mono text-xs">--space-4</code> (16px).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {espacamento.map((n) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div className="bg-brand" style={{ width: `${n * 4}px`, height: "12px" }} />
              <span className="font-mono text-2xs text-subtle">{n * 4}px</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Raios">
        <div className="flex flex-wrap gap-6">
          {raios.map((item) => (
            <div key={item.nome} className="flex flex-col items-center gap-1">
              <div className={`h-16 w-16 border-2 border-bordo-700 ${item.classe}`} />
              <span className="font-mono text-2xs text-subtle">{item.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Elevação">
        <div className="flex flex-wrap gap-8 pb-4">
          {sombras.map((item) => (
            <div key={item.nome} className="flex flex-col items-center gap-2">
              <div className={`h-16 w-16 rounded-lg bg-card ${item.classe}`} />
              <span className="font-mono text-2xs text-subtle">{item.nome}</span>
            </div>
          ))}
        </div>
      </Secao>
    </div>
  );
}
