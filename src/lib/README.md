# src/lib/

Camada de integração com o navegador e o React: o provider que escolhe o
adaptador de persistência (`persistence-provider.tsx`; a interface e o
adaptador IndexedDB ficam em `src/core/persistence/`), os hooks de
autosave, conferência, versão automática e tela estreita, e `exportar.ts`,
que carrega as imagens e chama os exportadores de `src/core/export/` para
gerar o arquivo de download. O cliente de `/api/ai` entra aqui quando a IA
entrar.

**Entra:** código que toca `window`, `localStorage`, IndexedDB, `fetch` ou
qualquer biblioteca de navegador, sempre atrás de uma interface que `src/core/`
e `src/components/` conhecem.
**Não entra:** regra de negócio (`src/core/`) ou JSX (`src/components/`).
