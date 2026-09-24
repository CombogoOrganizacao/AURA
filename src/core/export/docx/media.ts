import { AlignmentType, ImageRun, Paragraph } from "docx";

import { tamanhoNaFolha } from "../../document/imagem";
import type { Documento, NoFigura } from "../../document/types";
import type { AdaptadorPersistencia, ImagemArmazenada } from "../../persistence/types";
import { ABNT } from "./constants";

// Imagem da figura no `.docx` — passo 6.1.2. A biblioteca `docx` grava o
// arquivo em `word/media/` e o relacionamento que o liga ao parágrafo; nada
// de OOXML escrito à mão (CLAUDE.md, "Exportação").
//
// O exportador é lógica pura e não lê a persistência: quem exporta carrega
// as imagens antes (`carregarImagensDoDocumento`) e as passa a
// `fromDocumento()`. Uma figura cuja imagem não chegou sai com o espaço
// reservado de sempre, em vez de derrubar a exportação inteira.

export type ImagensDoDocumento = ReadonlyMap<string, ImagemArmazenada>;

// Twips para pixels a 96 por polegada, a unidade que a biblioteca recebe
// (1 polegada = 1440 twips).
const pixels = (twips: number) => Math.floor((twips * 96) / 1440);

// A imagem cabe na largura útil da folha. A altura máxima deixa, na mesma
// página, lugar para a legenda acima e a fonte abaixo: a mancha útil de uma
// A4 com margens 3 e 2 tem 24,7 cm de altura.
const MAXIMO_NA_FOLHA = {
  largura: pixels(ABNT.larguraUtil),
  altura: pixels(ABNT.alturaMaximaFigura),
};

// Os ids de imagem que o corpo usa, na ordem de leitura, sem repetição.
// Apêndice e anexo ainda não exportam figura (ver `posTextuais.ts`).
export function idsDeImagens(documento: Pick<Documento, "sections">): string[] {
  const ids = documento.sections.flatMap((secao) =>
    secao.content.flatMap((no) => (no.type === "figura" && no.imagem ? [no.imagem] : [])),
  );
  return [...new Set(ids)];
}

// Carrega pela interface de persistência as imagens que o documento usa. A
// imagem que não existir mais simplesmente não entra no mapa.
export async function carregarImagensDoDocumento(
  persistencia: Pick<AdaptadorPersistencia, "carregarImagem">,
  documento: Documento,
): Promise<ImagensDoDocumento> {
  const imagens = new Map<string, ImagemArmazenada>();
  for (const id of idsDeImagens(documento)) {
    const imagem = await persistencia.carregarImagem(documento.id, id);
    if (imagem) imagens.set(id, imagem);
  }
  return imagens;
}

// O parágrafo da imagem, centralizado entre a legenda e a fonte, com o
// texto alternativo tirado da legenda: quem lê o `.docx` com leitor de tela
// ouve do que a figura trata. `keepNext` prende a imagem à linha de fonte
// logo abaixo, como já prendia o espaço reservado.
export function paragrafoImagem(imagem: ImagemArmazenada, figura: NoFigura): Paragraph {
  const tamanho = tamanhoNaFolha(imagem, MAXIMO_NA_FOLHA);
  const descricao = figura.legenda.trim() || "Figura";
  return new Paragraph({
    children: [
      new ImageRun({
        type: imagem.formato,
        data: imagem.bytes,
        transformation: { width: tamanho.largura, height: tamanho.altura },
        altText: { name: descricao, title: descricao, description: descricao },
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { line: ABNT.espacamento1, before: 120, after: 120 },
    keepNext: true,
  });
}
