import type { Documento } from "@/core/document/types";

// Baixar um arquivo gerado no navegador: o `.docx`, o `.tex` e o `.zip` do
// projeto LaTeX (`ModalExportar` no editor, `AcoesDocumento` na lista).

// Nome de arquivo não aceita todo caractere em todo SO — troca qualquer
// coisa fora de letra/número/espaço/hífen por espaço.
export function nomeArquivo(documento: Documento): string {
  const base = documento.metadados.titulo.trim() || "documento";
  return (
    base
      .replace(/[^\p{L}\p{N} -]/gu, " ")
      .replace(/\s+/g, " ")
      .trim() || "documento"
  );
}

export function baixar(conteudo: Blob, nome: string): void {
  const url = URL.createObjectURL(conteudo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
