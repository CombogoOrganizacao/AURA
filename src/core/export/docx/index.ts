import { Document, Paragraph } from "docx";

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
// canônico pra `ConteudoExportacao`). Capa e pré-textuais continuam
// placeholder (ver `sections.ts`): dependem dos metadados ganharem layout de
// verdade no passo 3.5.1. Os geradores de cada tipo de bloco (citação,
// lista, figura, tabela, fórmula), referências, notas e sumário chegam um
// de cada vez, nos passos da Fase 3/4 que os implementam de verdade no
// editor primeiro.

export interface ConteudoExportacao {
  // Corpo já convertido para nós do `docx` — quem faz essa conversão a
  // partir do `Documento` canônico é `fromDocumento.ts` (passo 1.4.2).
  // Capa e pré-textuais continuam placeholder aqui: dependem dos metadados
  // ganharem layout de verdade no passo 3.5.1.
  corpo: Paragraph[];
}

// Só monta o `Document` (docx) — não empacota. Quem chama escolhe o
// `Packer` certo pro ambiente: `Packer.toBuffer()` no Node (testes, um
// futuro servidor), `Packer.toBlob()` no navegador (download real —
// `BotaoExportar.tsx`, passo 1.4.4). `toBuffer()` depende do `Buffer` do
// Node, que não existe no navegador sem polyfill — mesmo cuidado que já
// vale pra `fs.readFileSync` (docs/porte-poc.md).
export function montarDocumento({ corpo }: ConteudoExportacao): Document {
  return new Document({
    styles: ESTILOS_DOCUMENTO,
    sections: montarSecoes(corpo),
  });
}
