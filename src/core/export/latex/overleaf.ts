// "Abrir no Overleaf" (passo 6.3.1): os campos do POST para
// `overleaf.com/docs`, a API documentada em overleaf.com/devs (lida de novo
// em 30/09/2026; docs/latex-abntex.md §3.3).
//
// **O trabalho vai dentro do POST, como data URL, e não como link.** A API
// aceita também um endereço de onde o Overleaf baixaria o arquivo, mas isso
// exigiria publicar o trabalho numa URL: o AURA não gera URL pública de
// trabalho nenhum. O `.zip` sai do navegador direto para o Overleaf.
//
// Lógica pura: montar o formulário e enviá-lo é da tela
// (`components/editor/BotaoOverleaf.tsx`).

export const ENDERECO_OVERLEAF = "https://www.overleaf.com/docs";

// Maior corpo de POST que o Overleaf aceita, em bytes. A API não documenta
// limite; medido em 07/10/2026 com corpos sintéticos: 2.090.000 bytes
// passam, 2.110.000 voltam 413, e o Overleaf mostra uma página genérica de
// erro ("Something went wrong"). A medida bate com 2 MiB. Como o base64 e a
// codificação do formulário aumentam o `.zip` em ~42%, cabe um projeto de
// até ~1,4 MB: um TCC com poucas fotos já passa disso.
export const LIMITE_ENVIO_OVERLEAF = 2 * 1024 * 1024;

// `btoa` recebe uma string de bytes; em pedaços, para um `.zip` com figuras
// não estourar o limite de argumentos de `String.fromCharCode`.
export function paraBase64(bytes: Uint8Array): string {
  const PEDACO = 0x8000;
  let binario = "";
  for (let i = 0; i < bytes.length; i += PEDACO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + PEDACO));
  }
  return btoa(binario);
}

// O projeto inteiro (`gerarZipTex()`), compilado com pdfLaTeX (§1.4) a
// partir do `main.tex`.
export function camposOverleaf(zip: Uint8Array): Record<string, string> {
  return {
    snip_uri: `data:application/zip;base64,${paraBase64(zip)}`,
    engine: "pdflatex",
    main_document: "main.tex",
  };
}

// Tamanho exato do corpo que o navegador envia: o formulário é serializado
// como `application/x-www-form-urlencoded`, o mesmo serializador do
// `URLSearchParams` (WHATWG URL). O `+` e a `/` do base64 viram `%2B` e
// `%2F`, e por isso não basta contar o data URL.
export function tamanhoDoEnvio(campos: Record<string, string>): number {
  return new URLSearchParams(campos).toString().length;
}

// Acima do limite, o Overleaf recusa o projeto inteiro: a tela oferece o
// `.zip` para baixar e subir pelo "Upload Project" do próprio Overleaf, sem
// publicar o trabalho em URL nenhuma.
export function cabeNoOverleaf(campos: Record<string, string>): boolean {
  return tamanhoDoEnvio(campos) <= LIMITE_ENVIO_OVERLEAF;
}
