import type { Metadados } from "../types";

import { type LinhaPreTextual, linhaCentro } from "./linhaPreTextual";

// Capa e folha de rosto (NBR 14724 §5.1/5.2) não são texto corrido nem nós do
// editor (docs/schema-tiptap.md §1) — são derivadas de `Metadados` toda vez
// que alguém precisa exibi-las (tela ou exportador), nunca editadas
// diretamente. Esta função só monta a lista ordenada de linhas; quem
// consome decide a tipografia real (tamanho, negrito, caixa alta) — aqui só
// o que a norma manda sobre ORDEM e ALINHAMENTO.
//
// `LinhaPreTextual`/`linhaCentro` moraram aqui até o passo 3.5.3, quando
// `opcionaisPreTextuais.ts` virou o terceiro consumidor e os levou para
// `linhaPreTextual.ts` — exatamente a condição que o 3.5.1 registrou para
// essa extração acontecer, nem antes nem depois.

// "Subtítulo, se houver, deve ser precedido de dois-pontos, evidenciando a
// sua subordinação ao título" (NBR 14724 §5.1-d/§5.2-c) — por isso uma linha
// só, não duas: o dois-pontos É a subordinação, não um separador entre duas
// linhas independentes.
export function tituloComSubtitulo(metadados: Metadados): string {
  return metadados.subtitulo ? `${metadados.titulo}: ${metadados.subtitulo}` : metadados.titulo;
}

// NBR 14724 §5.1 — elementos da capa, nesta ordem:
// a) nome da instituição (opcional — só a instituição, o resto da lista é
//    obrigatório se a capa existir);
// b) nome do autor (um por linha, quando houver mais de um);
// c)+d) título, com subtítulo subordinado por dois-pontos quando houver;
// e) número do volume — fora da v1, `Metadados` não tem campo de volume;
// f) local (cidade) da instituição;
// g) ano de depósito.
export function gerarCapa(metadados: Metadados): LinhaPreTextual[] {
  const linhas: LinhaPreTextual[] = [];

  if (metadados.instituicao) linhas.push(linhaCentro(metadados.instituicao));
  for (const autor of metadados.autores) linhas.push(linhaCentro(autor));
  linhas.push(linhaCentro(tituloComSubtitulo(metadados)));
  linhas.push(linhaCentro(metadados.local));
  linhas.push(linhaCentro(String(metadados.ano)));

  return linhas;
}
