import type { NoHtmlColado } from "@/core/editor/paste";
import { MAPA_DE_ESTILOS } from "@/core/import/docx/estilos";

import { arvoreDoHtml } from "./arvoreHtml";

// O `.docx` em HTML, pelo mammoth (versão exata no package.json), e o HTML na
// árvore neutra que `lerDocx()` (src/core/import/docx/) lê — passo 8.7.1. O
// arquivo é lido na memória da aba e não vai a servidor nenhum.
//
// O mammoth só é baixado quando o aluno escolhe um `.docx`: o editor não
// carrega o leitor de Word que quase nunca usa.

export interface DocxConvertido {
  arvore: NoHtmlColado[];
  // O que o mammoth avisou não ter lido, em texto (`lerDocx()` decide o que
  // vira aviso).
  mensagens: string[];
}

export async function converterDocx(bytes: Uint8Array): Promise<DocxConvertido> {
  const { default: mammoth } = await import("mammoth");
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const resultado = await mammoth.convertToHtml(
    { arrayBuffer: arrayBuffer as ArrayBuffer },
    {
      styleMap: [...MAPA_DE_ESTILOS],
      // A imagem fica marcada no lugar, sem os bytes: ainda não entra no
      // documento, e o relatório a conta.
      convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
    },
  );
  return {
    arvore: arvoreDoHtml(resultado.value, { comAtributos: true }),
    mensagens: resultado.messages.map((mensagem) => mensagem.message),
  };
}
