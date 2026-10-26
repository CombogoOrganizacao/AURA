import type { NoHtmlColado } from "@/core/editor/paste";
import { MAPA_DE_ESTILOS } from "@/core/import/docx/estilos";

import { arvoreDoHtml } from "./arvoreHtml";

// O `.docx` em HTML, pelo mammoth (versão exata no package.json), e o HTML na
// árvore neutra que `lerDocx()` (src/core/import/docx/) lê — passos 8.7.1 e
// 8.7.2. O arquivo é lido na memória da aba e não vai a servidor nenhum.
//
// O mammoth só é baixado quando o aluno escolhe um `.docx`: o editor não
// carrega o leitor de Word que quase nunca usa.

export interface DocxConvertido {
  arvore: NoHtmlColado[];
  // O que o mammoth avisou não ter lido, em texto (`lerDocx()` decide o que
  // vira aviso).
  mensagens: string[];
  // Os bytes de cada imagem, pela chave que ficou no `src` do `<img>`.
  // Conferir o formato e dar `id` é de `montarImportacaoDocx()`.
  imagens: Map<string, Uint8Array>;
}

export async function converterDocx(bytes: Uint8Array): Promise<DocxConvertido> {
  const { default: mammoth } = await import("mammoth");
  const imagens = new Map<string, Uint8Array>();
  let contador = 0;
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const resultado = await mammoth.convertToHtml(
    { arrayBuffer: arrayBuffer as ArrayBuffer },
    {
      styleMap: [...MAPA_DE_ESTILOS],
      // A imagem fica no HTML só como uma chave, não em base64: os bytes vão
      // direto para o mapa, sem passar por texto.
      convertImage: mammoth.images.imgElement(async (imagem) => {
        // A chave sai antes de esperar a leitura: duas imagens lidas ao mesmo
        // tempo não podem receber a mesma.
        const chave = `imagem-${++contador}`;
        imagens.set(chave, new Uint8Array(await imagem.readAsArrayBuffer()));
        return { src: chave };
      }),
    },
  );
  return {
    arvore: arvoreDoHtml(resultado.value, { comAtributos: true }),
    mensagens: resultado.messages.map((mensagem) => mensagem.message),
    imagens,
  };
}
