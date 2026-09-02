# AURA

AURA é uma ferramenta de **formatação, revisão e organização** de trabalhos
acadêmicos. Edita, formata segundo a ABNT e exporta para `.docx` — não
escreve nem gera conteúdo; a autoria do texto é sempre do usuário.

## Como rodar

```bash
npm install
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000).

### Outros comandos

```bash
npm run build      # build de produção — precisa passar antes de qualquer commit
npm run start      # sobe o build de produção
npm run lint       # ESLint
npm run typecheck  # checagem de tipos
npm test           # Vitest, sobre src/core/
```
