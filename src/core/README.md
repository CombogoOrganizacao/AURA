# src/core/

Lógica pura do domínio AURA: parsing de documento, regras ABNT, avaliação de
conformidade, formato canônico (JSON estruturado, referências CSL-JSON).

**Entra:** funções e tipos TypeScript sem dependência de ambiente.
**Não entra:** React, DOM, `window`, `localStorage`, `fetch` — nada que só exista
no navegador ou que exija um componente montado. Se o código importou algo do
navegador, está na camada errada (ver `CLAUDE.md`).

Testado por `npm test` (Vitest), sem mock de DOM.
