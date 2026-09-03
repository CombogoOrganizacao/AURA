import { AlignmentType, HeadingLevel, Paragraph, TextRun } from "docx";

import type { Documento, NoParagrafo, Secao } from "../../document/types";
import { ABNT } from "./constants";
import { gerarDocx } from "./index";

// Liga o exportador ao `Documento` canônico de verdade (passo 1.4.2) — não
// mais ao JSON de teste da PoC. Só o corpo: capa e pré-textuais ainda são
// placeholder em `index.ts` (ver comentário lá e docs/porte-poc.md) porque
// dependem de layout de metadados que é o passo 3.5.1.
//
// `NoConteudo` só cobre `paragraph` por ora (fechado em 1.3.3); citação,
// lista, figura, tabela e fórmula entram aqui na mesma hora em que ganham
// nó no editor (docs/schema-tiptap.md §7) — não antes.

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

function paragrafoCorpo(no: NoParagrafo): Paragraph {
  const texto = (no.content ?? []).map((noTexto) => noTexto.text).join("");
  return new Paragraph({
    children: [new TextRun(texto)],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: ABNT.espacamento15 },
    indent: { firstLine: ABNT.recuoParagrafo },
  });
}

export async function fromDocumento(documento: Documento): Promise<Buffer> {
  const secoesEmOrdem = [...documento.sections].sort((a, b) => a.ordem - b.ordem);

  const corpo: Paragraph[] = [];
  for (const secao of secoesEmOrdem) {
    corpo.push(paragrafoTitulo(secao));
    for (const no of secao.content) {
      corpo.push(paragrafoCorpo(no));
    }
  }

  return gerarDocx({ corpo });
}
