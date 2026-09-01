# src/components/

Componentes React: editor (TipTap), painéis de conformidade, formulários,
elementos de UI.

**Entra:** componentes e hooks que renderizam e capturam interação.
**Não entra:** regra de negócio ou formatação ABNT — isso é `src/core/`, chamado
daqui, nunca duplicado aqui. Acesso a armazenamento ou rede passa por
`src/lib/`, nunca direto no componente.
