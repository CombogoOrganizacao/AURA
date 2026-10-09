<p align="center">
  <img src="./banner.jpg" alt="Combogó AURA" width="100%"/>
</p>

# AURA

**Ambiente Unificado de Revisão Acadêmica.** O AURA é uma ferramenta de
**formatação, revisão e organização** de trabalhos acadêmicos. Edita, formata
segundo a ABNT e exporta para `.docx`. Não escreve nem gera conteúdo: a autoria
do texto é sempre do usuário.

## O que a v1 faz

- **TCC em ABNT**, com interface só em português.
- **Editor** com seções numeradas pela ordem e pelo nível, citação longa,
  figura, tabela, fórmula (LaTeX), nota de rodapé e colagem do Word sanitizada.
- **Dados do trabalho** (capa, folha de rosto, folha de aprovação, resumo,
  abstract e elementos opcionais) como campos de formulário, fora do texto.
- **Referências** em CSL-JSON, cadastradas à mão ou importadas de `.bib`, e
  **citações** ligadas a elas. A chamada "(Silva, 2019, p. 45)" é gerada, nunca
  digitada.
- **Conferência** de conformidade por regras determinísticas, cada uma citando o
  item da NBR.
- **Exportação** para `.docx` (OOXML, biblioteca `docx`) e para `.tex`/`.zip`
  com base no abnTeX2, mais a reimportação do `.tex` e a abertura no Overleaf.
- **Histórico de versões** e autosave.

Os documentos ficam **só no navegador** (IndexedDB) até o login com Firebase
entrar. A IA está fora da v1: a rota `/api/ai` existe como stub e responde `501`.

## Como rodar

Requer Node.js 20.9 ou mais novo (o mínimo do Next.js 16).

```bash
npm install
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000).

### Outros comandos

```bash
npm run build          # build de produção; precisa passar antes de qualquer commit
npm run start          # sobe o build de produção
npm run lint           # ESLint
npm run typecheck      # checagem de tipos
npm test               # Vitest, sobre src/core/
npm run test:coverage  # o mesmo, com relatório de cobertura em coverage/
npm run e2e            # Playwright (sobe o `next dev` sozinho, ou reaproveita um aberto)
```

O CI (`.github/workflows/ci.yml`) roda typecheck, lint, testes com cobertura e
build a cada push no `main` e em todo pull request. O relatório de cobertura
fica como artefato da execução.

## Onde fica cada coisa

| Pasta | O que guarda |
| --- | --- |
| `app/` | Rotas do Next.js (App Router), incluindo `app/api/ai/` |
| `src/core/` | Lógica pura, sem React nem navegador: formato do documento, schema do editor, regras da ABNT, referências, exportação e importação, persistência |
| `src/components/` | Componentes React; o design system está em `src/components/ui/` |
| `src/lib/` | Hooks que dependem do navegador (autosave, conferência, versões) |
| `e2e/` | Testes de ponta a ponta (Playwright) |
| `legacy/` | O site estático original, congelado. Referência de leitura; não é servido nem é padrão a seguir |
| `poc/docx/` | A prova de conceito do exportador `.docx`, congelada como teste de regressão |

## Conferência no Word

Margens, quebras de seção, numeração de página e sumário só valem depois de
abrir o `.docx` no Microsoft Word. Os testes leem o XML gerado, e isso não
substitui a conferência humana.
