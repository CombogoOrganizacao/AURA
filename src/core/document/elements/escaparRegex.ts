// Escapa os metacaracteres de expressão regular de um texto vindo do
// usuário, para ele ser procurado como literal. Mora num arquivo próprio
// porque `abreviaturas.ts` o usa para montar a busca da sigla e nada mais do
// núcleo deveria reescrever esta linha por conta própria.
export function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
