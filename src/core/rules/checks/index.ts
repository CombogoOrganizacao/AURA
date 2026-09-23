import type { Verificacao } from "../compliance";

// Registro das regras de verificação, na ordem em que o painel as lista
// dentro de cada gravidade. Uma regra por arquivo nesta pasta, com o item da
// norma no cabeçalho — passo 5.2.2. Vazio até lá: o 5.2.1 entrega o motor e a
// forma do achado.
export const VERIFICACOES: readonly Verificacao[] = [];
