import type { CSSProperties, HTMLAttributes } from "react";

export type FonteDocumento = "times" | "arial";

interface PaperSheetProps extends HTMLAttributes<HTMLDivElement> {
  /** Largura CSS da folha. Padrão: `var(--a4-width)` — 210mm reais. */
  width?: string;
  /** Desenha a guia tracejada das margens. */
  showMargins?: boolean;
  /** Número impresso no canto superior direito. */
  pageNumber?: number;
  /**
   * Fonte do corpo — decidida pela NORMA, não pela marca. A NBR 14724
   * admite Times New Roman ou Arial; a escolha é do usuário (caixa na barra
   * do editor, Fase 3.3). Aceita também uma `font-family` CSS literal, para
   * quando outra norma entrar. **Nunca** `--font-doc` (Newsreader) aqui.
   */
  font?: FonteDocumento | string;
  /**
   * Folha que cresce com o texto (o editor). Sem isto, a folha tem a altura
   * de uma A4 e recorta o que passa dela — certo para amostra e mock, errado
   * para o editor, que é rolagem contínua sem quebra de página (decisões,
   * "Um único editor com rolagem contínua").
   */
  continua?: boolean;
}

const FONTES_NORMA: Record<FonteDocumento, string> = {
  times: "var(--doc-font-times)",
  arial: "var(--doc-font-arial)",
};

// As margens da NBR 14724 são 30mm/30mm/20mm/20mm (topo/esquerda/base/
// direita) sobre uma folha de 210×297mm. A área escrita é um filho
// `position: absolute` dentro da folha — e é a regra de **posição**, não a
// de padding, que vale aqui: num elemento posicionado, `top`/`bottom` em
// porcentagem resolvem contra a ALTURA do bloco continente, e `left`/
// `right` contra a LARGURA (CSS Positioned Layout) — ao contrário de
// padding, em que as quatro bordas sempre usam a largura. Por isso `top`/
// `bottom` vêm de `--a4-margin-*` ÷ `--a4-height` e `left`/`right` de
// `--a4-margin-*` ÷ `--a4-width` — bases diferentes, não o mesmo número
// repetido nos quatro lados.
//
// Conferido com Playwright: numa folha de 330px de largura (466,7px de
// altura, mesma proporção 210:297), a margem superior mede 47,14px —
// exatamente `altura × 30/297`, não `largura × 30/210` (que daria 66,67px,
// o valor errado que a primeira versão desta conta produzia).
const MARGEM_SUPERIOR_PCT = (30 / 297) * 100; // --a4-margin-top ÷ --a4-height
const MARGEM_ESQUERDA_PCT = (30 / 210) * 100; // --a4-margin-left ÷ --a4-width
const MARGEM_INFERIOR_PCT = (20 / 297) * 100; // --a4-margin-bottom ÷ --a4-height
const MARGEM_DIREITA_PCT = (20 / 210) * 100; // --a4-margin-right ÷ --a4-width

const AREA_ESCRITA: CSSProperties = {
  position: "absolute",
  top: `${MARGEM_SUPERIOR_PCT}%`,
  left: `${MARGEM_ESQUERDA_PCT}%`,
  right: `${MARGEM_DIREITA_PCT}%`,
  bottom: `${MARGEM_INFERIOR_PCT}%`,
};

// Folha contínua: a área escrita fica no fluxo, e as margens viram padding.
// Padding em porcentagem resolve contra a largura do bloco CONTINENTE (não da
// folha), então as quatro margens saem de `calc()` sobre a largura da própria
// folha — a mesma proporção 30/30/20/20 sobre 210mm. A altura mínima é a de
// uma A4, pela mesma conta.
function areaContinua(width: string): CSSProperties {
  const sobreLargura = (mm: number) => `calc(${width} * ${mm / 210})`;
  return {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    paddingTop: sobreLargura(30),
    paddingLeft: sobreLargura(30),
    paddingBottom: sobreLargura(20),
    paddingRight: sobreLargura(20),
  };
}

// A folha A4: todo editor, prévia e mock de exportação vive dentro de uma.
// Proporção 210×297 fixa via `aspect-ratio`, sombra de papel
// (`--shadow-sheet`), **nunca** canto arredondado, **nunca** tingimento —
// papel é `--surface-sheet` (branco). Escala de documento em pt
// (`--doc-body`, `--doc-caption`), nunca px: um px aqui é erro, do mesmo
// jeito que um pt fora da folha é.
export function PaperSheet({
  width = "var(--a4-width)",
  showMargins = false,
  pageNumber,
  font = "times",
  continua = false,
  className = "",
  style,
  children,
  ...rest
}: PaperSheetProps) {
  const familiaFonte = FONTES_NORMA[font as FonteDocumento] ?? font;

  return (
    <div
      className={[
        "relative shrink-0 bg-sheet shadow-sheet",
        continua ? "flex flex-col" : "",
        className,
      ].join(" ")}
      style={{
        width,
        ...(continua
          ? { minHeight: `calc(${width} * ${297 / 210})` }
          : { aspectRatio: "210 / 297" }),
        ...style,
      }}
      {...rest}
    >
      {showMargins && !continua && (
        <div
          aria-hidden="true"
          className="pointer-events-none border border-dashed border-bordo-200"
          style={AREA_ESCRITA}
        />
      )}

      <div
        style={{
          ...(continua ? areaContinua(width) : { ...AREA_ESCRITA, overflow: "hidden" }),
          fontFamily: familiaFonte,
          fontSize: "var(--doc-body)",
          lineHeight: "var(--leading-doc-abnt)",
          color: "var(--doc-ink)",
          textAlign: "justify",
        }}
      >
        {children}
      </div>

      {pageNumber != null && (
        <span
          className="absolute text-subtle"
          style={{
            top: "4%",
            right: `${MARGEM_DIREITA_PCT}%`,
            fontFamily: familiaFonte,
            fontSize: "var(--doc-caption)",
          }}
        >
          {pageNumber}
        </span>
      )}
    </div>
  );
}
