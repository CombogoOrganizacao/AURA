import type { ElementoPosTextual } from "../types";
import { gerarPosTextuais, type ItemPosTextual } from "./posTextual";

// Apêndices (NBR 14724) — passo 3.7.1. **Material elaborado pelo próprio
// autor**: o questionário que ele escreveu, o roteiro de entrevista que ele
// montou, a tabela de dados que ele levantou. É o que separa apêndice de
// anexo (`./anexos.ts`), que é material de terceiro — a forma dos dois é a
// mesma, a origem do texto não.
//
// Arquivo fino de propósito. A montagem inteira está em `./posTextual.ts`; o
// que existe aqui é o rótulo e a lista de onde contar. É isso que torna as
// duas sequências independentes uma FUNÇÃO da assinatura, e não uma regra
// que alguém precisa lembrar de respeitar: esta função só enxerga
// `documento.apendices`, nunca os anexos.

export const ROTULO_APENDICE = "APÊNDICE";

export function gerarApendices(apendices: readonly ElementoPosTextual[]): ItemPosTextual[] {
  return gerarPosTextuais(apendices, ROTULO_APENDICE);
}
