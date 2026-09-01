# poc/docx/ — congelada

Prova de conceito do exportador `.docx`, escrita antes do editor para testar se
a fidelidade ABNT é alcançável em OOXML puro. Especificação completa em
`docs/aura-poc-exportador-docx.md`.

**Esta pasta é congelada e permanente a partir do commit que a introduziu.**
Nada aqui é editado depois disso — nem para corrigir bug, nem para melhorar
estilo. Ela serve a dois papéis:

1. **Referência de porte**: é a base para o exportador `.docx` de produção
   (ver `CLAUDE.md` e a §1.14/2.1 de `docs/aura-decisoes-e-pendencias.md`).
2. **Teste de regressão**: se a numeração de página quebrar um dia no
   exportador de produção, `saida.docx` gerado aqui é uma saída sabidamente
   correta para comparar.

## Rodar

```sh
cd poc/docx
npm install
node gerar.js
```

Lê `documento-teste.json` (JSON canônico escrito à mão, cobrindo todos os
elementos difíceis da ABNT ao mesmo tempo — capa, folha de rosto, sumário
como campo `TOC`, citação longa, nota de rodapé, figura/tabela com legenda e
fonte, equação numerada, apêndice, anexo) e escreve `saida.docx` na mesma
pasta.

## Estado da verificação

**Verificado programaticamente:** o script roda sem erro a partir da raiz do
repositório (`node poc/docx/gerar.js`); o `.docx` gerado é um pacote OOXML
válido (abre como zip, contém `document.xml`/`styles.xml`/`header1.xml`/
`footnotes.xml`/`numbering.xml`); a acentuação em português sobrevive
corretamente no XML.

**Não verificado — pendente de conferência humana no Microsoft Word:** todo o
restante da lista de verificação da §3 de
`docs/aura-poc-exportador-docx.md` — margens reais, o bloco crítico de
numeração de página (§3.2), o campo `TOC` funcionando de fato, estilos
nomeados aparecendo no painel de Navegação, citação longa, elementos
flutuantes e robustez do arquivo. Inspecionar o XML não substitui abrir o
arquivo no Word. Nenhum agente pode marcar esses itens como aprovados.
