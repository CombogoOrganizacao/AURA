import { Document, Paragraph, type FileChild } from "docx";

import { montarSecoes } from "./sections";
import { ESTILOS_DOCUMENTO } from "./styles";

// Porte de poc/docx/gerar.js (passo 1.4.1) — o que ficou de fora deste porte
// está registrado em docs/porte-poc.md, pra ninguém supor que ele cobre mais
// do que cobre.
//
// A montagem das três seções OOXML (capa fora da contagem; pré-textuais com
// contagem reiniciada e número oculto; corpo com contagem contínua e número
// exibido) está em `sections.ts` (passo 1.4.3); os estilos nomeados estão em
// `styles.ts` (fatorado daqui no passo 3.2.5, cresce nos passos seguintes) —
// aqui fica só a montagem do `Document` como um todo. Os estilos são os
// mesmos que `poc/docx/gerar.js` já tem verificados como OOXML válido.
//
// Corpo real desde o passo 1.4.2 (`fromDocumento.ts` converte `Documento`
// canônico pra `ConteudoExportacao`). Resumo/abstract reais desde o passo
// 3.5.2 (`preTextuais`, ver `docx/preTextuais.ts`); sumário como campo `TOC`
// desde o 3.6.2 (`docx/toc.ts`). Capa continua placeholder (ver
// `sections.ts`): depende de layout próprio que ninguém ligou ainda. Os
// geradores dos demais blocos (lista, figura, tabela, fórmula), referências
// e notas chegam um de cada vez, nos passos da Fase 3/4 que os implementam
// de verdade no editor primeiro.

export interface ConteudoExportacao {
  // Corpo já convertido para nós do `docx` — quem faz essa conversão a
  // partir do `Documento` canônico é `fromDocumento.ts` (passo 1.4.2).
  corpo: Paragraph[];
  // Pré-textuais já convertidos: resumo/abstract e opcionais (3.5.2/3.5.3,
  // `docx/preTextuais.ts`) mais as listas de figuras, tabelas e abreviaturas
  // (3.6.4, `docx/listas.ts`) — `fromDocumento.ts` compõe os dois na ordem
  // canônica. `FileChild` e não `Paragraph` porque as listas de figuras e
  // tabelas são campos `TableOfContents`, que não são parágrafo. Opcional
  // porque a capa continua sem gerador próprio: quem só testa o corpo
  // (`index.test.ts`) não precisa passar nada aqui.
  preTextuais?: FileChild[];
}

// Só monta o `Document` (docx) — não empacota. Quem chama escolhe o
// `Packer` certo pro ambiente: `Packer.toBuffer()` no Node (testes, um
// futuro servidor), `Packer.toBlob()` no navegador (download real —
// `BotaoExportar.tsx`, passo 1.4.4). `toBuffer()` depende do `Buffer` do
// Node, que não existe no navegador sem polyfill — mesmo cuidado que já
// vale pra `fs.readFileSync` (docs/porte-poc.md).
export function montarDocumento({ corpo, preTextuais = [] }: ConteudoExportacao): Document {
  return new Document({
    // `<w:updateFields/>` em `word/settings.xml` — porte do mesmo `features`
    // de `poc/docx/gerar.js` (passo 3.6.2), que só passou a ter efeito agora
    // que existe campo no documento. Faz o Word oferecer atualizar os campos
    // ao abrir, e é o que enche o sumário (`toc.ts`) com os números de página
    // sem a pessoa precisar achar "Atualizar sumário" sozinha. O campo já vai
    // marcado `w:dirty="true"`; isto é o outro lado do mesmo par.
    features: { updateFields: true },
    styles: ESTILOS_DOCUMENTO,
    sections: montarSecoes(corpo, preTextuais),
  });
}
