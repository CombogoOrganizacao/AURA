import {
  AlignJustify,
  ArrowLeft,
  ArrowRight,
  Bold,
  BookMarked,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  CircleQuestionMark,
  CloudCheck,
  Ellipsis,
  FileDown,
  FileSearch,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  History,
  Info,
  Italic,
  ListOrdered,
  Loader,
  LogOut,
  PanelLeft,
  PanelRight,
  Plus,
  Quote,
  Redo2,
  Ruler,
  Search,
  Settings,
  Sparkles,
  SpellCheck2,
  Star,
  Superscript,
  Table,
  Trash2,
  TriangleAlert,
  Underline,
  Undo2,
  User,
  WandSparkles,
  X,
} from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";

// Ponto único de acesso a ícone (regra da skill `aura-design`): nenhum outro
// arquivo do sistema desenha SVG à mão. Só os glifos que algum componente
// realmente usa entram no mapa — nada de importar o pacote inteiro.
//
// O vocabulário recorrente está fixado no readme da skill (seção
// ICONOGRAPHY): `file-text` documento, `ruler` normas, `quote` citações,
// `spell-check-2` revisão de texto, `list-ordered` sumário, `book-marked`
// biblioteca de normas, `wand-sparkles` aplicar formatação. Não inventar
// sinônimo para conceito que já tem glifo aqui.
const icones = {
  // Navegação e casca
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "panel-left": PanelLeft,
  "panel-right": PanelRight,
  x: X,
  plus: Plus,
  search: Search,
  ellipsis: Ellipsis,
  user: User,
  settings: Settings,
  "circle-question-mark": CircleQuestionMark,
  "log-out": LogOut,
  star: Star,
  "trash-2": Trash2,

  // Estado e feedback
  info: Info,
  check: Check,
  "check-check": CheckCheck,
  "circle-alert": CircleAlert,
  "circle-check-big": CircleCheckBig,
  "triangle-alert": TriangleAlert,
  loader: Loader,
  "cloud-check": CloudCheck,

  // Documento e normas
  "file-text": FileText,
  "file-down": FileDown,
  "file-search": FileSearch,
  ruler: Ruler,
  quote: Quote,
  "spell-check-2": SpellCheck2,
  "list-ordered": ListOrdered,
  "book-marked": BookMarked,
  "wand-sparkles": WandSparkles,
  history: History,
  sparkles: Sparkles,

  // Formatação
  bold: Bold,
  italic: Italic,
  underline: Underline,
  "align-justify": AlignJustify,
  "heading-1": Heading1,
  "heading-2": Heading2,
  "heading-3": Heading3,
  "undo-2": Undo2,
  "redo-2": Redo2,
  table: Table,
  superscript: Superscript,
} satisfies Record<string, LucideIcon>;

export type NomeIcone = keyof typeof icones;

// Todos os nomes do mapa, na ordem de declaração. Existe só para a amostra
// em `/design` conseguir listar o vocabulário inteiro: assim nenhum glifo
// entra aqui sem aparecer lá.
export const NOMES_ICONES = Object.keys(icones) as NomeIcone[];

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
