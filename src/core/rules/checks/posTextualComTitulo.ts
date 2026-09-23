import type { Verificacao } from "../compliance";

// Apêndice e anexo com título — NBR 14724:2024 §4.2.3.3 e §4.2.3.4 (lidos no
// PDF em 18/09/2026): "precedido da palavra APÊNDICE, identificado por letras
// maiúsculas consecutivas, travessão e pelo respectivo título" (e o mesmo
// para ANEXO). A palavra e a letra o AURA deriva (`letrarPorOrdem()`); o
// título é do aluno.

export const posTextualComTitulo: Verificacao = {
  regra: "pos-textual-com-titulo",
  verificar: ({ documento }) =>
    [
      ...documento.apendices.map((elemento) => ({ elemento, tipo: "apendice" as const })),
      ...documento.anexos.map((elemento) => ({ elemento, tipo: "anexo" as const })),
    ]
      .filter(({ elemento }) => !elemento.titulo.trim())
      .map(({ elemento, tipo }) => ({
        gravidade: "erro" as const,
        item: tipo === "apendice" ? "NBR 14724:2024 §4.2.3.3" : "NBR 14724:2024 §4.2.3.4",
        mensagem: `Há ${tipo === "apendice" ? "um apêndice" : "um anexo"} sem título. A norma pede a letra, o travessão e o título.`,
        local: { tipo: "bloco" as const, onde: { tipo, id: elemento.id } },
      })),
};
