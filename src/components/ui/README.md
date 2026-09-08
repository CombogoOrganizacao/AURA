# src/components/ui/

Componentes base do design system (passo 2.2 de `docs/to-do.md`): `Button`,
`Input`, `Select`, `Dialog`, `Toast`, `Tabs`, `Tooltip`, mais `Icon` (suporte
interno, ponto único de acesso a ícone) e `CampoShell` (moldura de rótulo/
dica/erro compartilhada por `Input` e `Select`).

Traduzidos da referência da skill `aura-design` (`components/core/`,
`components/forms/`, `components/feedback/`, `components/navigation/`) para
Tailwind com os tokens de `app/globals.css` — ver `docs/design.md` para o
raciocínio de cada tradução e os desvios da referência (`Icon` sem CDN,
`Dialog` com portal/foco/Esc).

**Entra:** primitivas genéricas, sem regra de negócio nem texto fixo de
domínio (o rótulo/placeholder é passado por quem usa). **Não entra:**
componente que já é uma tela ou já sabe de `Documento`/ABNT — isso fica em
`src/components/documento/` e `src/components/editor/`, que consomem daqui.

Importe pelo barrel: `import { Button, Input } from "@/components/ui"`.
