// Imagem de figura — passo 6.1.2. Lógica pura: reconhecer o formato e as
// dimensões pelos bytes do arquivo, e calcular o tamanho na folha. Sem DOM:
// o navegador saberia medir a imagem, mas o exportador roda também fora dele
// e precisa das mesmas medidas.
//
// **Só PNG e JPEG.** São os formatos de foto e de captura de tela, e os que o
// Word e a biblioteca `docx` embutem sem conversão. O formato é conferido
// pela assinatura dos bytes, e não pela extensão nem pelo tipo que o
// navegador declara: um arquivo renomeado não passa.

export type FormatoImagem = "png" | "jpg";

export interface DadosImagem {
  formato: FormatoImagem;
  // Em pixels.
  largura: number;
  altura: number;
}

// Teto por imagem. O trabalho fica no navegador (IndexedDB) e depois no
// Cloud Storage (docs/aura-decisoes-e-pendencias.md §1.11); uma foto de
// celular sem compressão passa disso, e o aluno é avisado para reduzi-la.
export const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024;

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function uint16(bytes: Uint8Array, i: number): number {
  return (bytes[i] << 8) | bytes[i + 1];
}

function uint32(bytes: Uint8Array, i: number): number {
  return ((bytes[i] << 24) >>> 0) + (bytes[i + 1] << 16) + (bytes[i + 2] << 8) + bytes[i + 3];
}

// O formato e as dimensões, ou `null` se não for PNG nem JPEG legível.
export function lerCabecalhoImagem(bytes: Uint8Array): DadosImagem | null {
  return lerPng(bytes) ?? lerJpeg(bytes);
}

// PNG: a assinatura de 8 bytes, e logo depois o bloco IHDR, com largura e
// altura em 32 bits cada.
function lerPng(bytes: Uint8Array): DadosImagem | null {
  if (bytes.length < 24) return null;
  if (!ASSINATURA_PNG.every((byte, i) => bytes[i] === byte)) return null;
  if (String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  const largura = uint32(bytes, 16);
  const altura = uint32(bytes, 20);
  return largura > 0 && altura > 0 ? { formato: "png", largura, altura } : null;
}

// JPEG: começa em FF D8 e é uma sequência de segmentos `FF <marcador>
// <tamanho>`. As dimensões estão no primeiro segmento SOF (C0 a CF, menos C4,
// C8 e CC, que são outras coisas com número parecido).
function lerJpeg(bytes: Uint8Array): DadosImagem | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marcador = bytes[i + 1];
    // Bytes de preenchimento: vários FF seguidos.
    if (marcador === 0xff) {
      i += 1;
      continue;
    }
    // Marcadores sem tamanho: RST0–RST7, SOI, e TEM.
    if ((marcador >= 0xd0 && marcador <= 0xd8) || marcador === 0x01) {
      i += 2;
      continue;
    }
    // Fim da imagem, ou início dos dados comprimidos: não há mais cabeçalho.
    if (marcador === 0xd9 || marcador === 0xda) return null;

    const tamanho = uint16(bytes, i + 2);
    const ehSof = marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador);
    if (ehSof) {
      if (i + 8 >= bytes.length) return null;
      const altura = uint16(bytes, i + 5);
      const largura = uint16(bytes, i + 7);
      return largura > 0 && altura > 0 ? { formato: "jpg", largura, altura } : null;
    }
    i += 2 + tamanho;
  }
  return null;
}

// O tamanho na folha, em pixels a 96 por polegada (a unidade que a
// biblioteca `docx` recebe): cabe na largura útil e numa altura máxima,
// mantém a proporção, e **nunca amplia**. Uma imagem pequena ampliada sairia
// borrada, e o aluno veria no impresso o que a tela não mostrou.
export function tamanhoNaFolha(
  imagem: Pick<DadosImagem, "largura" | "altura">,
  maximo: { largura: number; altura: number },
): { largura: number; altura: number } {
  const escala = Math.min(1, maximo.largura / imagem.largura, maximo.altura / imagem.altura);
  return {
    largura: Math.max(1, Math.round(imagem.largura * escala)),
    altura: Math.max(1, Math.round(imagem.altura * escala)),
  };
}
