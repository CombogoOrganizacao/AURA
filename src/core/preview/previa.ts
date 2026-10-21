import { gerarAnexos } from "../document/elements/anexos";
import { gerarApendices } from "../document/elements/apendices";
import {
  ROTULO_FIGURA,
  ROTULO_TABELA,
  textoFonte,
  textoLegenda,
} from "../document/elements/legenda";
import { textoTituloPosTextual } from "../document/elements/posTextual";
import { gerarListaReferencias } from "../document/elements/referencias";
import {
  linhasDeCabecalho,
  proporcoesDasColunas,
  textosDasCelulas,
} from "../document/elements/tabela";
import { trechosDaCitacaoLonga, trechosDoInline, type Trecho } from "../document/elements/trechos";
import { textoItemSumario } from "../document/elements/sumario";
import { numerarFiguras, numerarSecoes, numerarTabelas } from "../document/numbering";
import {
  ORDEM_CANONICA,
  parteDe,
  type ElementoDocumento,
  type ParteDocumento,
} from "../document/order";
import type { Documento, NoConteudo } from "../document/types";
import { semVaziosNasPontas } from "../document/vaziosNasPontas";
import type { TrechoReferencia } from "../references/format/abnt";
import type { Referencia } from "../references/types";

// Modelo da prévia paginada (passo 8.6.1): o trabalho como uma sequência de
// elementos, cada um com os seus blocos, **sem nada de React, DOM ou
// paginação**. Quem desenha (`components/previa/`) e quem quebra em páginas
// (o Paged.js, no navegador) vêm depois; aqui só se decide O QUE vai em cada
// lugar, a partir das mesmas funções que o `.docx` usa. Assim o texto da
// legenda, o indicativo do título, a chamada da citação e a lista de
// referências não podem sair diferentes na prévia e no arquivo.
//
// A ordem vem de `ORDEM_CANONICA` (`document/order.ts`), a única fonte dela.
// Elemento que não se escreve (sem resumo, sem apêndice…) simplesmente não
// entra.

export interface CelulaPrevia {
  cabecalho: boolean;
  trechos: Trecho[];
}

export type BlocoPrevia =
  // Título de seção numerado. `abrePagina`: seção primária que não é a
  // primeira, que o `.docx` abre em página nova (NBR 14724:2024 §5.2.2).
  | { tipo: "titulo"; id: string; nivel: 1 | 2 | 3; texto: string; abrePagina: boolean }
  // Título sem indicativo, centralizado: referências, apêndices, anexos.
  | { tipo: "tituloSemIndicativo"; id: string; texto: string }
  | { tipo: "paragrafo"; trechos: Trecho[] }
  | { tipo: "citacaoLonga"; trechos: Trecho[] }
  | {
      tipo: "figura";
      id: string;
      legenda: string;
      // Id da imagem na persistência; quem desenha troca pelos bytes.
      imagem: string | null;
      fonte: string;
    }
  | {
      tipo: "tabela";
      id: string;
      legenda: string;
      fonte: string;
      cabecalho: CelulaPrevia[][];
      corpo: CelulaPrevia[][];
      // Fração da largura de cada coluna, a mesma conta do `.docx`.
      proporcoes: number[];
    }
  | { tipo: "formula"; texto: string }
  | { tipo: "referencia"; trechos: TrechoReferencia[] };

export interface ElementoPrevia {
  elemento: ElementoDocumento;
  parte: ParteDocumento;
  blocos: BlocoPrevia[];
}

export interface Previa {
  elementos: ElementoPrevia[];
}

interface Contexto {
  references: readonly Referencia[];
  figuras: Map<string, number>;
  tabelas: Map<string, number>;
}

function blocoDeConteudo(no: NoConteudo, contexto: Contexto): BlocoPrevia {
  switch (no.type) {
    case "paragraph":
      return { tipo: "paragrafo", trechos: trechosDoInline(no.content, contexto.references) };
    case "citacao_longa":
      return {
        tipo: "citacaoLonga",
        trechos: trechosDaCitacaoLonga(no, contexto.references),
      };
    case "formula":
      return { tipo: "formula", texto: no.texto };
    case "figura":
      return {
        tipo: "figura",
        id: no.id,
        // `?? 0` como no exportador: nunca acontece com um documento
        // consistente, e evita um `undefined` no meio do texto.
        legenda: textoLegenda(ROTULO_FIGURA, contexto.figuras.get(no.id) ?? 0, no.legenda),
        imagem: no.imagem,
        fonte: textoFonte(no.fonte),
      };
    case "tabela": {
      const celulas = no.linhas.map((linha) =>
        linha.celulas.map((celula) => ({
          cabecalho: celula.cabecalho,
          trechos: trechosDoInline(celula.content, contexto.references),
        })),
      );
      const nCabecalho = linhasDeCabecalho(no.linhas);
      return {
        tipo: "tabela",
        id: no.id,
        legenda: textoLegenda(ROTULO_TABELA, contexto.tabelas.get(no.id) ?? 0, no.legenda),
        fonte: textoFonte(no.fonte),
        cabecalho: celulas.slice(0, nCabecalho),
        corpo: celulas.slice(nCabecalho),
        proporcoes: proporcoesDasColunas(textosDasCelulas(no.linhas)),
      };
    }
  }
}

function corpo(documento: Documento, contexto: Contexto): BlocoPrevia[] {
  const secoes = [...documento.sections].sort((a, b) => a.ordem - b.ordem);
  const numeracao = numerarSecoes(documento.sections);

  return secoes.flatMap((secao, indice): BlocoPrevia[] => [
    {
      tipo: "titulo",
      id: secao.id,
      nivel: secao.nivel,
      texto: textoItemSumario({ numero: numeracao.get(secao.id) ?? null, titulo: secao.titulo }),
      abrePagina: secao.nivel === 1 && indice > 0,
    },
    ...semVaziosNasPontas(secao.content).map((no) => blocoDeConteudo(no, contexto)),
  ]);
}

function referencias(documento: Documento): BlocoPrevia[] {
  const lista = gerarListaReferencias(documento.references);
  if (!lista) return [];
  return [
    { tipo: "tituloSemIndicativo", id: "sumario:referencias", texto: lista.titulo },
    ...lista.entradas.map((entrada): BlocoPrevia => ({
      tipo: "referencia",
      trechos: entrada.trechos,
    })),
  ];
}

// Um elemento por apêndice ou anexo, para cada um abrir a sua folha, como no
// `.docx`. `elemento` é o da ordem canônica ("apendices"/"anexos"). Como lá, o
// título vai em caixa alta, e figura e tabela de dentro ainda não entram (a
// numeração delas não está definida fora do corpo): ficam de fora, e não
// fabricadas.
function elementosPosTextuais(
  documento: Documento,
  contexto: Contexto,
  tipo: "apendices" | "anexos",
): ElementoPrevia[] {
  const elementos = tipo === "apendices" ? documento.apendices : documento.anexos;
  const itens = tipo === "apendices" ? gerarApendices(elementos) : gerarAnexos(elementos);
  return itens.map((item, indice) => ({
    elemento: tipo,
    parte: "posTextual",
    blocos: [
      {
        tipo: "tituloSemIndicativo",
        id: item.id,
        texto: textoTituloPosTextual(item).toLocaleUpperCase("pt-BR"),
      },
      ...semVaziosNasPontas(elementos[indice].content)
        .filter((no) => no.type !== "figura" && no.type !== "tabela")
        .map((no) => blocoDeConteudo(no, contexto)),
    ],
  }));
}

// Nada a mostrar: nenhum elemento, ou só títulos de seção ainda sem título
// (o documento novo traz uma seção em branco, que sairia como uma folha com
// "1" no alto).
export function previaSemConteudo(previa: Previa): boolean {
  return previa.elementos.every((elemento) =>
    elemento.blocos.every((bloco) => bloco.tipo === "titulo" && /^[\d.]*\s*$/.test(bloco.texto)),
  );
}

// A prévia do trabalho. Os elementos pré-textuais (capa, folha de rosto,
// resumo, listas, sumário…) entram no passo 8.6.2; até lá a sequência começa
// no corpo.
export function montarPrevia(documento: Documento): Previa {
  const contexto: Contexto = {
    references: documento.references,
    figuras: numerarFiguras(documento.sections),
    tabelas: numerarTabelas(documento.sections),
  };

  const elementos: ElementoPrevia[] = [];
  for (const elemento of ORDEM_CANONICA) {
    switch (elemento) {
      case "corpo": {
        const blocos = corpo(documento, contexto);
        if (blocos.length > 0) elementos.push({ elemento, parte: parteDe(elemento), blocos });
        break;
      }
      case "referencias": {
        const blocos = referencias(documento);
        if (blocos.length > 0) elementos.push({ elemento, parte: parteDe(elemento), blocos });
        break;
      }
      case "apendices":
      case "anexos":
        elementos.push(...elementosPosTextuais(documento, contexto, elemento));
        break;
      default:
        break;
    }
  }
  return { elementos };
}
