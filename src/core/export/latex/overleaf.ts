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
