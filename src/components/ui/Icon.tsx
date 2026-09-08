import {
  Bold,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Info,
  Italic,
  PanelLeft,
  PanelRight,
  X,
} from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";

// Ponto único de acesso a ícone (regra da skill `aura-design`): nenhum outro
// arquivo do sistema desenha SVG à mão. Só os glifos que algum componente
// realmente usa entram no mapa — nada de importar o pacote inteiro.
const icones = {
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  x: X,
  info: Info,
  check: Check,
  "circle-alert": CircleAlert,
  "file-text": FileText,
  "panel-left": PanelLeft,
  "panel-right": PanelRight,
  bold: Bold,
  italic: Italic,
  "heading-1": Heading1,
  "heading-2": Heading2,
  "heading-3": Heading3,
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
