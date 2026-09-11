import { AlignmentType, HeadingLevel, type Document, Paragraph, TextRun } from "docx";

import type { Documento, NoConteudo, Secao } from "../../document/types";
import { ABNT } from "./constants";
import { montarDocumento } from "./index";

// Liga o exportador ao `Documento` canônico de verdade (passo 1.4.2) — não
// mais ao JSON de teste da PoC. Só o corpo: capa e pré-textuais ainda são
// placeholder em `index.ts` (ver comentário lá e docs/porte-poc.md) porque
// dependem de layout de metadados que é o passo 3.5.1.
//
// `NoConteudo` cobre `paragraph` (desde 1.3.3) e `citacao_longa` (desde
// 3.4.1, estilo nomeado `CitacaoLonga` desde 3.4.2 — ver
// src/core/document/types.ts e docx/styles.ts). Lista, figura, tabela e
// fórmula entram aqui na mesma hora em que ganham nó no editor
// (docs/schema-tiptap.md §7) — não antes.
//
// **Sem a "chamada" de autoria ao final** (ex.: "(SOBRENOME, ano, p. 42)")
// que `poc/docx/gerar.js` já sabe montar: lá ela vem de `no.chamada` +
// `no.refId` resolvido contra uma lista de referências de verdade — aqui
// `refId` é sempre `null` na prática (`Documento.references` não tem UI que
// escreva nele, ver `longQuote.ts`), então não há do que montar a chamada
// ainda. Fica para quando a Fase 4 ligar `refId` a uma referência real.
//
// Devolve o `Document` (docx), não empacotado — mesmo motivo de
// `montarDocumento()` em `index.ts`: quem chama escolhe `Packer.toBuffer()`
// (Node) ou `Packer.toBlob()` (navegador, passo 1.4.4).

const NIVEL_PARA_HEADING = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
] as const;

// Sem numeração no título (§2 de docs/schema-tiptap.md): "1.2 Metodologia"
// é derivado, não digitado — e ainda não há de onde derivar aqui (passo
// 3.2.1). Título sai só com o texto por ora.
function paragrafoTitulo(secao: Secao): Paragraph {
  return new Paragraph({ text: secao.titulo, heading: NIVEL_PARA_HEADING[secao.nivel - 1] });
}

function paragrafoCorpo(no: NoConteudo): Paragraph {
  const texto = (no.content ?? []).map((noTexto) => noTexto.text).join("");

  if (no.type === "citacao_longa") {
    // Estilo nomeado carrega recuo/fonte/espaçamento sozinho (styles.ts) —
    // nada repetido aqui, ao contrário do parágrafo comum abaixo, que ainda
    // não tem estilo nomeado próprio (isso é "Corpo" em 6.1.1).
    return new Paragraph({ children: [new TextRun(texto)], style: "CitacaoLonga" });
  }

  return new Paragraph({
    children: [new TextRun(texto)],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: ABNT.espacamento15 },
    indent: { firstLine: ABNT.recuoParagrafo },
  });
}

export function fromDocumento(documento: Documento): Document {
  const secoesEmOrdem = [...documento.sections].sort((a, b) => a.ordem - b.ordem);

  const corpo: Paragraph[] = [];
  for (const secao of secoesEmOrdem) {
    corpo.push(paragrafoTitulo(secao));
    for (const no of secao.content) {
      corpo.push(paragrafoCorpo(no));
    }
  }

  return montarDocumento({ corpo });
}
