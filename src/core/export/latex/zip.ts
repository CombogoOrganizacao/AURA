import JSZip from "jszip";

import type { ImagemArmazenada } from "../../persistence/types";
import { gerarBib } from "./bib";
import { caminhoDaImagem, gerarProjetoTex } from "./document";

// `.zip` do projeto LaTeX (passo 6.2.3): `main.tex`, um arquivo por capítulo
// em `sections/`, `referencias.bib` e as imagens em `figuras/`. É o que abre
// no Overleaf com "Upload Project" e o que a reimportação (6.2.4) lê —
// só estes caminhos (docs/latex-abntex.md §1.5, limites do `.zip`).
//
// Lógica pura, como o `.docx`: quem exporta carrega as imagens pela
// persistência antes (`carregarImagensDoDocumento`) e as passa aqui. Devolve
// bytes; virar download é da tela (passo 6.3.2).

export async function gerarZipTex(
  documento: Parameters<typeof gerarProjetoTex>[0],
  imagens: ReadonlyMap<string, ImagemArmazenada> = new Map(),
): Promise<Uint8Array> {
  const projeto = gerarProjetoTex(documento, imagens);
  const zip = new JSZip();
  zip.file("main.tex", projeto.main);
  for (const arquivo of projeto.secoes) zip.file(arquivo.caminho, arquivo.conteudo);
  zip.file("referencias.bib", gerarBib(documento.references));
  for (const [id, imagem] of imagens) {
    zip.file(caminhoDaImagem(id, imagem.formato), imagem.bytes);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
