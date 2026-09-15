import type { Metadados } from "../types";

import { type LinhaPreTextual, linhaCentro, tituloComSubtitulo } from "./capa";

// NBR 14724 §5.2 — elementos da folha de rosto, nesta ordem:
// a) nome do autor (um por linha, quando houver mais de um);
// b)+c) título, com subtítulo subordinado por dois-pontos quando houver;
// d) número do volume — fora da v1, mesma ressalva de `capa.ts`;
// e) natureza (tipo do trabalho, objetivo, instituição, área de
//    concentração) — já vem pronta em `metadados.naturezaTrabalho`
//    (formulário 1.3.4 pede a frase inteira, ex.: "Trabalho de Conclusão de
//    Curso apresentado ao curso de X da Universidade Y como requisito
//    parcial para obtenção do título de Z"). É o único elemento recuado:
//    "alinhada do centro da mancha gráfica para a margem direita" — o
//    critério de aceite deste passo;
// f) nome do orientador (e coorientador, se houver — `Metadados` não tem
//    campo de coorientador na v1);
// g) local;
// h) ano de depósito.
//
// Sem nome da instituição como linha própria: na folha de rosto ela entra
// dentro da nota de natureza (item "e" acima), não como elemento isolado —
// ao contrário da capa, onde é linha própria (item "a" de `capa.ts`).
export function gerarFolhaDeRosto(metadados: Metadados): LinhaPreTextual[] {
  const linhas: LinhaPreTextual[] = [];

  for (const autor of metadados.autores) linhas.push(linhaCentro(autor));
  linhas.push(linhaCentro(tituloComSubtitulo(metadados)));
  if (metadados.naturezaTrabalho) {
    linhas.push({ texto: metadados.naturezaTrabalho, alinhamento: "recuada-a-direita" });
  }
  linhas.push(linhaCentro(`Orientador: ${metadados.orientador}`));
  linhas.push(linhaCentro(metadados.local));
  linhas.push(linhaCentro(String(metadados.ano)));

  return linhas;
}
