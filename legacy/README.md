# legacy/

Código do site estático original, congelado aqui pela reescrita em Next.js.
Movido sem alteração de conteúdo (ver histórico de `git log --follow`).

**Isto é referência de leitura, não é servido e não é padrão a seguir.** Globais
em `window`, `innerHTML` e handlers inline são exatamente o que a reescrita
elimina — nada nesta pasta deve inspirar código novo em `src/` ou `app/`.

Para entender o que existe aqui — arquitetura, ciclo de render, persistência,
realidade da exportação — ver `docs/legado.md`. Para o que é portado, descartado
ou preservado, e por quê, ver a §1.14 de `docs/aura-decisoes-e-pendencias.md`.

Uma exceção dentro da exceção: `js/engine/noticeParser.js` é preservado de
propósito, não por descuido. Está fora da v1, mas é ativo da futura Central de
Editais (responsabilidade de outra pessoa) — não apagar.
