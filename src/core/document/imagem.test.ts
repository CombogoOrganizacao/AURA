import { describe, expect, it } from "vitest";

import { lerCabecalhoImagem, tamanhoNaFolha } from "./imagem";

// Passo 6.1.2 — o formato e as dimensões vêm dos bytes. Os arquivos aqui são
// montados à mão, só com o cabeçalho: é tudo o que a leitura consulta.

function png(largura: number, altura: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13], 8); // tamanho do bloco IHDR
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(bytes.buffer).setUint32(16, largura);
  new DataView(bytes.buffer).setUint32(20, altura);
  return bytes;
}

// SOI, um APP0 (JFIF) de 16 bytes, e o SOF pedido com altura e largura.
function jpeg(largura: number, altura: number, sof = 0xc0): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  const sofSegmento = [
    0xff,
    sof,
    0x00,
    0x11,
    0x08,
    altura >> 8,
    altura & 0xff,
    largura >> 8,
    largura & 0xff,
    0x03,
    ...new Array(9).fill(0),
  ];
  return new Uint8Array([0xff, 0xd8, ...app0, sofSegmento, 0xff, 0xd9].flat());
}

describe("lerCabecalhoImagem", () => {
  it("lê formato e dimensões de um PNG", () => {
    expect(lerCabecalhoImagem(png(640, 480))).toEqual({
      formato: "png",
      largura: 640,
      altura: 480,
    });
  });

  it("lê formato e dimensões de um JPEG, pulando os segmentos antes do SOF", () => {
    expect(lerCabecalhoImagem(jpeg(1920, 1080))).toEqual({
      formato: "jpg",
      largura: 1920,
      altura: 1080,
    });
  });

  it("aceita JPEG progressivo (SOF2)", () => {
    expect(lerCabecalhoImagem(jpeg(800, 600, 0xc2))).toMatchObject({ largura: 800, altura: 600 });
  });

  it("não confunde a tabela de Huffman (C4) com um SOF", () => {
    const comDht = jpeg(300, 200);
    // Troca o APP0 por um DHT de mesmo tamanho: continua pulando até o SOF.
    comDht[3] = 0xc4;
    expect(lerCabecalhoImagem(comDht)).toMatchObject({ largura: 300, altura: 200 });
  });

  it("recusa o que não é PNG nem JPEG, mesmo com nome de imagem", () => {
    const texto = new TextEncoder().encode("isto é um texto renomeado para foto.png");
    const gif = new TextEncoder().encode("GIF89a\u0001\u0000\u0001\u0000");

    expect(lerCabecalhoImagem(texto)).toBeNull();
    expect(lerCabecalhoImagem(gif)).toBeNull();
    expect(lerCabecalhoImagem(new Uint8Array())).toBeNull();
  });

  it("recusa arquivo cortado antes das dimensões", () => {
    expect(lerCabecalhoImagem(png(10, 10).slice(0, 20))).toBeNull();
    expect(lerCabecalhoImagem(jpeg(10, 10).slice(0, 25))).toBeNull();
  });

  it("recusa dimensão zero", () => {
    expect(lerCabecalhoImagem(png(0, 10))).toBeNull();
  });
});

describe("tamanhoNaFolha", () => {
  const maximo = { largura: 600, altura: 700 };

  it("reduz a imagem larga até a largura útil, mantendo a proporção", () => {
    expect(tamanhoNaFolha({ largura: 1200, altura: 600 }, maximo)).toEqual({
      largura: 600,
      altura: 300,
    });
  });

  it("reduz a imagem alta até a altura máxima", () => {
    expect(tamanhoNaFolha({ largura: 700, altura: 1400 }, maximo)).toEqual({
      largura: 350,
      altura: 700,
    });
  });

  it("nunca amplia uma imagem pequena", () => {
    expect(tamanhoNaFolha({ largura: 120, altura: 80 }, maximo)).toEqual({
      largura: 120,
      altura: 80,
    });
  });
});
