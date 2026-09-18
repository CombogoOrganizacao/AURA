import type { Metadados } from "../types";

import { tituloComSubtitulo } from "./capa";
import { type LinhaPreTextual, linhaCentro } from "./linhaPreTextual";

// NBR 14724:2024 §4.2.1.1.1 (anverso) — elementos da folha de rosto, nesta
// ordem (lido na fonte primária em 18/09/2026; a citação anterior, "§5.2",
// vinha de fonte secundária e apontava para "Espaçamento"):
// a) nome do autor (um por linha, quando houver mais de um);
// b)+c) título, com subtítulo subordinado por dois-pontos quando houver;
// d) número do volume — fora da v1, mesma ressalva de `capa.ts`;
// e) natureza (tipo do trabalho, objetivo, instituição, área de
//    concentração) — literal no §4.2.1.1.1-e. Já vem pronta em
//    `metadados.naturezaTrabalho`
//    (formulário 1.3.4 pede a frase inteira, ex.: "Trabalho de Conclusão de
//    Curso apresentado ao curso de X da Universidade Y como requisito
//    parcial para obtenção do título de Z"). É o único elemento recuado, e o
//    recuo é literal no §5.2: "na folha de rosto e na folha de aprovação, a
//    natureza do trabalho deve ser alinhada do meio da mancha gráfica até a
//    margem direita" — o critério de aceite deste passo;
// f) nome do orientador (e coorientador, se houver — `Metadados` não tem
//    campo de coorientador na v1);
// g) local;
// h) ano de depósito.
//
// Sem nome da instituição como linha própria: na folha de rosto ela entra
// dentro da nota de natureza (item "e" acima), não como elemento isolado —
// ao contrário da capa, onde é linha própria e opcional (item "a" de
// `capa.ts`). Conferido na fonte primária: o §4.2.1.1.1 não lista a
// instituição fora da natureza.
//
// O verso da folha de rosto (§4.2.1.1.2) leva os dados internacionais de
// catalogação na publicação — a ficha catalográfica. Fora da v1: quem a emite
// é a biblioteca da instituição, e o §5.3 ainda manda que essa página não seja
// contada nem numerada, o que exigiria uma quarta seção OOXML.
export function gerarFolhaDeRosto(metadados: Metadados): LinhaPreTextual[] {
  const linhas: LinhaPreTextual[] = [];

  for (const autor of metadados.autores) linhas.push(linhaCentro(autor, "autor"));
  linhas.push(linhaCentro(tituloComSubtitulo(metadados), "tituloDoTrabalho"));
  if (metadados.naturezaTrabalho) {
    linhas.push({
      texto: metadados.naturezaTrabalho,
      alinhamento: "recuada-a-direita",
      papel: "natureza",
    });
  }
  linhas.push(linhaCentro(`Orientador: ${metadados.orientador}`, "orientador"));
  linhas.push(linhaCentro(metadados.local, "local"));
  linhas.push(linhaCentro(String(metadados.ano), "ano"));

  return linhas;
}
