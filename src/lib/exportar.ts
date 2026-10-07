import { Packer } from "docx";

import type { Documento } from "@/core/document/types";
import { fromDocumento } from "@/core/export/docx/fromDocumento";
import { carregarImagensDoDocumento } from "@/core/export/docx/media";
import { gerarTex } from "@/core/export/latex/document";
import { gerarZipTex } from "@/core/export/latex/zip";
import type { AdaptadorPersistencia } from "@/core/persistence/types";

// Os arquivos que o AURA entrega, a partir de um `Documento` e da
// persistência (as imagens das figuras moram fora do documento, 6.1.2, e os
// exportadores, que são lógica pura, as recebem já carregadas). Servem ao
// editor (`ModalExportar`) e à lista de documentos.

type ComImagens = Pick<AdaptadorPersistencia, "carregarImagem">;

// `Packer.toBlob()` é a escolha certa no navegador (`Packer.toBuffer()` é pra
// Node — ver o comentário em `src/core/export/docx/index.ts`).
export async function docxDoDocumento(persistencia: ComImagens, documento: Documento) {
  const imagens = await carregarImagensDoDocumento(persistencia, documento);
  return Packer.toBlob(fromDocumento(documento, imagens));
}

// O projeto LaTeX inteiro (`gerarZipTex()`): `main.tex`, capítulos,
// `referencias.bib` e figuras.
export async function zipLatexDoDocumento(persistencia: ComImagens, documento: Documento) {
  const imagens = await carregarImagensDoDocumento(persistencia, documento);
  return gerarZipTex(documento, imagens);
}

// Só o `main.tex`, num arquivo. As figuras ficam referenciadas
// (`figuras/<id>`, com o tamanho de cada uma), sem os arquivos: a tela de
// exportação avisa que elas só vêm no `.zip` (docs/latex-abntex.md §1.4).
export async function texDoDocumento(persistencia: ComImagens, documento: Documento) {
  const imagens = await carregarImagensDoDocumento(persistencia, documento);
  return gerarTex(documento, imagens);
}

export function blobDoZip(zip: Uint8Array): Blob {
  return new Blob([zip as BlobPart], { type: "application/zip" });
}
