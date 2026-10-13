# src/core/

Lógica pura do domínio AURA: parsing de documento, regras ABNT, avaliação de
conformidade, formato canônico (JSON estruturado, referências CSL-JSON).

**Entra:** funções e tipos TypeScript sem dependência de ambiente.
**Não entra:** React, DOM, `window`, `localStorage`, `fetch` — nada que só exista
no navegador ou que exija um componente montado. Se o código importou algo do
navegador, está na camada errada (ver `CLAUDE.md`).

**Exceção registrada:** o adaptador IndexedDB (`persistence/indexeddb.ts`)
usa o global `indexedDB`. Fica aqui por decisão (§1.14 de
`docs/aura-decisoes-e-pendencias.md`), ao lado da interface que implementa,
e é testado no Vitest com `fake-indexeddb`. Os componentes não o importam
direto (regra `no-restricted-imports` do ESLint): passam por
`src/lib/persistence-provider.tsx`.

Testado por `npm test` (Vitest), sem mock de DOM.
