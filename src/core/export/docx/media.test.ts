import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { novaFigura, novoDocumento } from "../../document/factory";
import type { Documento, NoFigura } from "../../document/types";
import { criarAdaptadorMemoria } from "../../persistence/memory";
import type { ImagemArmazenada } from "../../persistence/types";
import { ABNT } from "./constants";
import { fromDocumento } from "./fromDocumento";
import { carregarImagensDoDocumento, idsDeImagens } from "./media";

// Passo 6.1.2 — "um documento com duas figuras abre no Word com as duas
// visíveis". Aqui, o que o pacote prova: os dois arquivos em `word/media/`,
// cada um ligado ao seu parágrafo por um relacionamento. **Abrir no Word é a
// conferência humana** (CLAUDE.md, "Verificação").

// 1 EMU = 1/914400 de polegada; a biblioteca converte pixels a 96 por polegada.
const EMU_POR_PIXEL = 9525;
const EMU_POR_TWIP = 914400 / 1440;

function imagem(id: string, largura: number, altura: number, byte: number): ImagemArmazenada {
  return {
    id,
    documentoId: "doc",
    formato: "png",
    largura,
    altura,
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, byte, byte, byte]),
  };
}

function figura(legenda: string, imagemId: string | null): NoFigura {
  return { ...novaFigura(), legenda, fonte: "Autoria própria", imagem: imagemId };
}

function documentoComFiguras(...figuras: NoFigura[]): Documento {
  const documento = { ...novoDocumento(), id: "doc" };
  documento.sections = [{ id: "s1", ordem: 0, nivel: 1, titulo: "Resultados", content: figuras }];
  return documento;
}

async function pacote(documento: Documento, imagens: ImagemArmazenada[]) {
  const mapa = new Map(imagens.map((img) => [img.id, img]));
  const zip = await JSZip.loadAsync(await Packer.toBuffer(fromDocumento(documento, mapa)));
  return {
    zip,
    xml: await zip.file("word/document.xml")!.async("string"),
    rels: await zip.file("word/_rels/document.xml.rels")!.async("string"),
  };
}

describe("figura com imagem no .docx", () => {
  it("duas figuras: dois arquivos em word/media, cada um ligado ao seu parágrafo", async () => {
    const { zip, xml, rels } = await pacote(
      documentoComFiguras(figura("Mapa da região", "a"), figura("Gráfico dos dados", "b")),
      [imagem("a", 800, 600, 1), imagem("b", 400, 300, 2)],
    );

    const midias = Object.keys(zip.files).filter(
      (nome) => nome.startsWith("word/media/") && !zip.files[nome].dir,
    );
    expect(midias).toHaveLength(2);

    const embeds = [...xml.matchAll(/<a:blip r:embed="([^"]+)"/g)].map((m) => m[1]);
    expect(embeds).toHaveLength(2);
    for (const id of embeds) {
      const alvo = rels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`))?.[1];
      expect(alvo).toMatch(/^media\//);
      expect(zip.file(`word/${alvo}`)).not.toBeNull();
    }

    // E os bytes gravados são os da imagem de cada figura, na ordem.
    const conteudos = await Promise.all(
      midias.sort().map(async (nome) => Array.from(await zip.file(nome)!.async("uint8array"))),
    );
    expect(conteudos).toContainEqual([0x89, 0x50, 0x4e, 0x47, 1, 1, 1]);
    expect(conteudos).toContainEqual([0x89, 0x50, 0x4e, 0x47, 2, 2, 2]);
  });

  it("a imagem fica entre a legenda e a fonte, com a legenda como texto alternativo", async () => {
    const { xml } = await pacote(documentoComFiguras(figura("Mapa da região", "a")), [
      imagem("a", 100, 100, 1),
    ]);

    const legenda = xml.indexOf("Mapa da região");
    const desenho = xml.indexOf("<w:drawing>");
    const fonte = xml.indexOf("Autoria própria");
    expect(legenda).toBeLessThan(desenho);
    expect(desenho).toBeLessThan(fonte);
    expect(xml).toMatch(/<wp:docPr [^>]*descr="Mapa da região"/);
  });

  it("imagem larga reduzida à largura útil, na proporção; imagem pequena não é ampliada", async () => {
    const { xml } = await pacote(
      documentoComFiguras(figura("Larga", "larga"), figura("Pequena", "pequena")),
      [imagem("larga", 3000, 1500, 1), imagem("pequena", 120, 90, 2)],
    );

    const extents = [...xml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(extents).toHaveLength(2);

    const [[larguraLarga, alturaLarga], [larguraPequena, alturaPequena]] = extents;
    expect(larguraLarga).toBeLessThanOrEqual(ABNT.larguraUtil * EMU_POR_TWIP);
    expect(larguraLarga / alturaLarga).toBeCloseTo(2, 1);
    expect([larguraPequena, alturaPequena]).toEqual([120 * EMU_POR_PIXEL, 90 * EMU_POR_PIXEL]);
  });

  it("figura sem imagem, ou com imagem que não chegou, sai com o espaço reservado", async () => {
    const { zip, xml } = await pacote(
      documentoComFiguras(figura("Sem imagem", null), figura("Imagem perdida", "sumiu")),
      [],
    );

    expect(xml.match(/espaço reservado para a imagem/g)).toHaveLength(2);
    expect(zip.file(/^word\/media\/.+/)).toEqual([]);
  });
});

describe("imagens do documento", () => {
  it("idsDeImagens lista cada imagem uma vez, na ordem de leitura", () => {
    const documento = documentoComFiguras(
      figura("A", "a"),
      figura("Sem", null),
      figura("B", "b"),
      figura("A de novo", "a"),
    );
    expect(idsDeImagens(documento)).toEqual(["a", "b"]);
  });

  it("carregarImagensDoDocumento traz pela persistência as que existem", async () => {
    const persistencia = criarAdaptadorMemoria();
    await persistencia.salvarImagem(imagem("a", 10, 10, 1));
    const documento = documentoComFiguras(figura("A", "a"), figura("Perdida", "sumiu"));

    const imagens = await carregarImagensDoDocumento(persistencia, documento);

    expect([...imagens.keys()]).toEqual(["a"]);
  });
});
