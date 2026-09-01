# app/

Rotas do Next.js (App Router) — páginas, layouts, route handlers.

**Entra:** o mínimo para compor a rota: busca dados, chama `src/lib/`, renderiza
`src/components/`.
**Não entra:** regra de negócio (`src/core/`) ou acesso direto a armazenamento —
isso passa por `src/lib/`, mesmo quando chamado de dentro de `app/`.
