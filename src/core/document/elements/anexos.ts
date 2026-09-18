import type { ElementoPosTextual } from "../types";
import { gerarPosTextuais, type ItemPosTextual } from "./posTextual";

// Anexos (NBR 14724) — passo 3.7.1. **Material de terceiro**, não elaborado
// pelo autor: a legislação citada, o parecer do comitê de ética, o material
// institucional reproduzido. Mesma forma do apêndice (`./apendices.ts`),
// origem do texto diferente — e é só isso que a norma separa.
//
// Sequência própria, que começa em "ANEXO A" independentemente de quantos
// apêndices existam antes: esta função recebe `documento.anexos` e nada mais,
// então não há contador compartilhado que possa vazar de uma lista para a
// outra (ver `./posTextual.ts`).

export const ROTULO_ANEXO = "ANEXO";

export function gerarAnexos(anexos: readonly ElementoPosTextual[]): ItemPosTextual[] {
  return gerarPosTextuais(anexos, ROTULO_ANEXO);
}
