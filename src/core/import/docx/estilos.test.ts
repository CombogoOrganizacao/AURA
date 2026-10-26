import { Document, Packer, Paragraph } from "docx";
import mammoth from "mammoth";
import { expect, it } from "vitest";

import { MAPA_DE_ESTILOS } from "./estilos";

// Linha do mapa que o mammoth não entende não quebra nada: ela vira uma
// mensagem e é ignorada, e o estilo deixa de ser reconhecido em silêncio.
it("o mammoth aceita todas as linhas do mapa de estilos", async () => {
  const buffer = await Packer.toBuffer(
    new Document({ sections: [{ children: [new Paragraph("x")] }] }),
  );
  const resultado = await mammoth.convertToHtml({ buffer }, { styleMap: [...MAPA_DE_ESTILOS] });
  expect(resultado.messages).toEqual([]);
});
