import { Check, ChevronDown, CircleAlert, Info, X } from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";

// Ponto único de acesso a ícone (regra da skill `aura-design`): nenhum outro
// arquivo do sistema desenha SVG à mão. Só os glifos que os componentes de
// 2.2 realmente usam entram no mapa — nada de importar o pacote inteiro.
const icones = {
  "chevron-down": ChevronDown,
  x: X,
  info: Info,
  check: Check,
  "circle-alert": CircleAlert,
} satisfies Record<string, LucideIcon>;

export type NomeIcone = keyof typeof icones;

interface IconProps extends Omit<LucideProps, "ref"> {
  name: NomeIcone;
}

// Desvio deliberado da referência da skill: lá, `Icon` busca o SVG do CDN
// `unpkg.com` em `mask-image`. A CSP deste app (`next.config.ts`) restringe
// `img-src` a `'self' data:` e `connect-src` a `'self'` — não haveria como
// buscar de `unpkg.com` sem afrouxar a CSP, e a invariante de segurança em
// CLAUDE.md pede o oposto. `lucide-react` traz o mesmo conjunto Lucide
// (mesmo traço 2px, mesmos terminais arredondados) embutido no bundle: sem
// requisição de rede, funciona offline e em teste. Ver docs/design.md.
export function Icon({ name, size = 18, strokeWidth = 2, ...rest }: IconProps) {
  const Glifo = icones[name];
  return <Glifo size={size} strokeWidth={strokeWidth} aria-hidden="true" {...rest} />;
}
