// Tipos e classes do botão, fora de `Button.tsx` de propósito: aquele
// arquivo é `"use client"`, e um Server Component que importa constante de
// um módulo de cliente recebe uma referência de cliente, não o valor. O
// `LinkButton` numa página de servidor (landing, Central de editais)
// montava o `class` com o texto de uma função de erro e saía sem estilo
// nenhum (achado no passo 6.4.3). Aqui não há React: serve aos dois lados.

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

// Classes por variante — strings inteiras, nunca montadas por template
// literal: o build de produção poda variável de tema que só aparece via
// interpolação em runtime (achado do passo 2.1, documentado em
// docs/design.md). "Hover sempre escurece" é regra do sistema, nunca clareia.
// Compartilhados com `LinkButton.tsx` (desde o passo 2B.5), que reaproveita
// exatamente as mesmas classes num `<a>` de navegação real — CTA de
// landing e barra superior precisam ser link de verdade (crawlable,
// "abrir em nova aba"), não botão com `onClick={() => router.push(...)}`.
export const classesVariante: Record<ButtonVariant, string> = {
  primary:
    "border border-bordo-700 bg-bordo-700 text-on-bordo hover:border-bordo-800 hover:bg-bordo-800 active:border-bordo-900 active:bg-bordo-900 disabled:border-transparent disabled:bg-[var(--action-disabled)] disabled:text-disabled",
  secondary:
    "border border-creme-400 bg-creme-300 text-on-creme hover:border-creme-500 hover:bg-creme-400 active:bg-creme-500 disabled:border-transparent disabled:bg-[var(--action-disabled)] disabled:text-disabled",
  outline:
    "border border-brand bg-card text-bordo-700 hover:bg-brand-soft disabled:border-[var(--border-subtle)] disabled:bg-transparent disabled:text-disabled",
  ghost:
    "border border-transparent bg-transparent text-bordo-700 hover:bg-brand-soft disabled:bg-transparent disabled:text-disabled",
  quiet:
    "border border-transparent bg-transparent text-muted hover:bg-sunken hover:text-body disabled:bg-transparent disabled:text-disabled",
  danger:
    "border border-danger bg-danger text-white hover:border-[#9c1f18] hover:bg-[#9c1f18] disabled:border-transparent disabled:bg-[var(--action-disabled)] disabled:text-disabled",
};

export const classesTamanho: Record<ButtonSize, string> = {
  sm: "h-[var(--control-h-sm)] gap-1.5 px-[var(--control-pad-x-sm)] text-xs",
  md: "h-[var(--control-h-md)] gap-2 px-[var(--control-pad-x-md)] text-sm",
  lg: "h-[var(--control-h-lg)] gap-2.5 px-[var(--control-pad-x-lg)] text-md",
};

// Classes que independem de variante/tamanho — a base geométrica e de
// movimento que qualquer superfície com a "forma" de botão usa, incluindo
// `LinkButton`. `active:translate-y-px`/`disabled:*` só fazem sentido em
// `<button>`; `LinkButton` (um `<a>`, sem estado `disabled` nativo) usa só
// a primeira linha.
export const CLASSES_BASE_BOTAO =
  "inline-flex items-center justify-center rounded-sm font-sans font-medium tracking-wide transition-[background-color,border-color,color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:shadow-focus-ring";
