# src/lib/

Camada de integração com o ambiente: adaptadores que implementam as interfaces
de persistência (`salvarDocumento`, `carregarDocumento`, `listarDocumentos`,
`salvarVersao` — IndexedDB primeiro, Firestore depois), o exportador `.docx`
portado de `poc/docx/`, e o cliente de `/api/ai`.

**Entra:** código que toca `window`, `localStorage`, IndexedDB, `fetch` ou
qualquer biblioteca de navegador, sempre atrás de uma interface que `src/core/`
e `src/components/` conhecem.
**Não entra:** regra de negócio (`src/core/`) ou JSX (`src/components/`).
