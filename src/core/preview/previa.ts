import {
  TITULO_LISTA_ABREVIATURAS,
  gerarListaDeAbreviaturas,
} from "../document/elements/abreviaturas";
import { gerarAnexos } from "../document/elements/anexos";
import { gerarApendices } from "../document/elements/apendices";
import { gerarCapa } from "../document/elements/capa";
import {
  ESPACO_ANTES_DA_ASSINATURA,
  ESPACOS_CAPA,
  ESPACOS_FOLHA_DE_APROVACAO,
  ESPACOS_FOLHA_DE_ROSTO,
} from "../document/elements/espacosPreTextuais";
import { gerarFolhaDeAprovacao } from "../document/elements/folhaDeAprovacao";
import { gerarFolhaDeRosto } from "../document/elements/folhaDeRosto";
import {
  ROTULO_FIGURA,
  ROTULO_TABELA,
  textoFonte,
  textoLegenda,
} from "../document/elements/legenda";
import type { LinhaPreTextual, PapelLinhaPreTextual } from "../document/elements/linhaPreTextual";
import {
  TITULO_LISTA_FIGURAS,
  TITULO_LISTA_TABELAS,
  gerarListaDeFiguras,
  gerarListaDeTabelas,
} from "../document/elements/listas";
import {
  gerarAgradecimentos,
  gerarDedicatoria,
  gerarEpigrafe,
} from "../document/elements/opcionaisPreTextuais";
import { textoTituloPosTextual } from "../document/elements/posTextual";
import { gerarListaReferencias } from "../document/elements/referencias";
import {
  TITULO_SUMARIO,
  gerarSumarioCompleto,
  textoItemSumario,
} from "../document/elements/sumario";
import {
  linhasDeCabecalho,
  mapaDeMesclas,
  proporcoesDasColunas,
  textosDasCelulas,
} from "../document/elements/tabela";
import { trechosDaCitacaoLonga, trechosDoInline, type Trecho } from "../document/elements/trechos";
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

// Modelo da prévia paginada (passos 8.6.1 e 8.6.2): o trabalho como uma
// sequência de elementos, cada um com os seus blocos, **sem nada de React, DOM
// ou paginação**. Quem desenha (`components/previa/`) e quem quebra em páginas
// (o Paged.js, no navegador) vêm depois; aqui só se decide O QUE vai em cada
// lugar, a partir das mesmas funções que o `.docx` usa. Assim o texto da
// legenda, o indicativo do título, a chamada da citação, a lista de
// referências e a ordem dos elementos não podem sair diferentes na prévia e no
// arquivo.
//
// A ordem vem de `ORDEM_CANONICA` (`document/order.ts`), a única fonte dela.
// Elemento que não se escreve (sem resumo, sem apêndice…) simplesmente não
// entra.
//
// **O número de página não está aqui**, de propósito: só o motor de páginas
// sabe em que folha cada coisa cai. O sumário e as listas levam o alvo de cada
// entrada (`alvo`), e o motor preenche o número.

export interface CelulaPrevia {
  cabecalho: boolean;
  trechos: Trecho[];
  // Célula mesclada (passo 8.5.4). As cobertas não vêm: o vão da âncora ocupa
  // o lugar delas, como no HTML.
  colspan?: number;
  rowspan?: number;
}

export type BlocoPrevia =
  // Título de seção numerado. `abrePagina`: seção primária que não é a
  // primeira, que o `.docx` abre em página nova (NBR 14724:2024 §5.2.2).
  | { tipo: "titulo"; id: string; nivel: 1 | 2 | 3; texto: string; abrePagina: boolean }
  // Título sem indicativo, centralizado, que ENTRA no sumário: referências,
  // apêndices, anexos.
  | { tipo: "tituloSemIndicativo"; id: string; texto: string }
  // Título sem indicativo, centralizado, que NÃO entra no sumário (NBR 6027
  // §6.3): resumo, listas, sumário, agradecimentos.
  | { tipo: "tituloPreTextual"; texto: string }
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
  | { tipo: "referencia"; trechos: TrechoReferencia[] }
  // Capa, folhas de rosto e de aprovação, agradecimentos: uma linha com o que
  // a norma manda sobre ordem e alinhamento. `espacoAntes`, em pontos, é a
  // distribuição pela folha.
  | { tipo: "linha"; linha: LinhaPreTextual; espacoAntes: number }
  // Dedicatória e epígrafe: no pé da página, da metade da mancha até a
  // margem direita (NBR 14724:2024 §5.2.4).
  | { tipo: "noPe"; linhas: LinhaPreTextual[] }
  // Resumo e abstract: parágrafo único, justificado, sem recuo (NBR 6028).
  | { tipo: "resumo"; texto: string }
  | { tipo: "termos"; rotulo: string; termos: string[] }
  // Linha do sumário ou de uma lista de ilustrações. `nivel` 0 nas listas.
  // `alvo`: o id do bloco para onde a entrada aponta, de onde o motor tira o
  // número da página.
  | { tipo: "entradaIndice"; nivel: 0 | 1 | 2 | 3; texto: string; alvo: string }
  | { tipo: "abreviatura"; sigla: string; significado: string };

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
      const { mesclas, cobertas } = mapaDeMesclas(no.linhas.map((linha) => linha.celulas));
      const celulas = no.linhas.map((linha, l) =>
        linha.celulas.flatMap((celula, c): CelulaPrevia[] => {
          if (cobertas[l][c]) return [];
          const mescla = mesclas.find((m) => m.linha === l && m.coluna === c);
          return [
            {
              cabecalho: celula.cabecalho,
              trechos: trechosDoInline(celula.content, contexto.references),
              ...(mescla && mescla.colunas > 1 ? { colspan: mescla.colunas } : {}),
              ...(mescla && mescla.linhas > 1 ? { rowspan: mescla.linhas } : {}),
            },
          ];
        }),
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

// --- Pré-textuais ------------------------------------------------------------

// A linha vazia que o `.docx` põe antes de cada grupo (um parágrafo em
// entrelinha 1,5 de corpo 12) soma uma linha ao espaço pedido.
const LINHA_VAZIA_EM_PONTOS = 18;
const TWIPS_POR_PONTO = 20;

// `espacos`: o espaço antes da PRIMEIRA linha de cada papel, em twips.
// `cadaAssinatura`: a folha de aprovação põe espaço antes de toda assinatura.
function blocosDeLinhas(
  linhas: readonly LinhaPreTextual[],
  espacos: Partial<Record<PapelLinhaPreTextual, number>>,
  cadaAssinatura = false,
): BlocoPrevia[] {
  const vistos = new Set<PapelLinhaPreTextual>();
  return linhas.map((linha): BlocoPrevia => {
    if (linha.titulo) return { tipo: "tituloPreTextual", texto: linha.texto };
    const primeira = linha.papel !== undefined && !vistos.has(linha.papel);
    if (linha.papel) vistos.add(linha.papel);
    const twips =
      cadaAssinatura && linha.papel === "assinatura"
        ? ESPACO_ANTES_DA_ASSINATURA
        : primeira
          ? espacos[linha.papel!]
          : undefined;
    return {
      tipo: "linha",
      linha,
      espacoAntes: twips ? twips / TWIPS_POR_PONTO + LINHA_VAZIA_EM_PONTOS : 0,
    };
  });
}

function resumoDe(
  titulo: string,
  texto: string,
  rotuloTermos: string,
  termos: string[],
): BlocoPrevia[] {
  if (!texto) return [];
  return [
    { tipo: "tituloPreTextual", texto: titulo },
    { tipo: "resumo", texto },
    ...(termos.length > 0
      ? [{ tipo: "termos", rotulo: rotuloTermos, termos } satisfies BlocoPrevia]
      : []),
  ];
}

function sumario(documento: Documento): BlocoPrevia[] {
  const itens = gerarSumarioCompleto(documento.sections, {
    temReferencias: gerarListaReferencias(documento.references) !== null,
    apendices: gerarApendices(documento.apendices),
    anexos: gerarAnexos(documento.anexos),
  });
  return [
    { tipo: "tituloPreTextual", texto: TITULO_SUMARIO },
    ...itens.map((item): BlocoPrevia => ({
      tipo: "entradaIndice",
      nivel: item.nivel,
      // Sem indicativo é pós-textual: o corpo o escreve em caixa alta, e o
      // sumário repete (`export/docx/toc.ts`).
      texto:
        item.numero === null
          ? textoItemSumario(item).toLocaleUpperCase("pt-BR")
          : textoItemSumario(item),
      alvo: item.id,
    })),
  ];
}

function lista(titulo: string, itens: readonly { id: string; texto: string }[]): BlocoPrevia[] {
  if (itens.length === 0) return [];
  return [
    { tipo: "tituloPreTextual", texto: titulo },
    ...itens.map((item): BlocoPrevia => ({
      tipo: "entradaIndice",
      nivel: 0,
      texto: item.texto,
      alvo: item.id,
    })),
  ];
}

function blocosDe(
  elemento: ElementoDocumento,
  documento: Documento,
  contexto: Contexto,
): BlocoPrevia[] {
  const { metadados } = documento;
  switch (elemento) {
    case "capa":
      return blocosDeLinhas(gerarCapa(metadados), ESPACOS_CAPA);
    case "folhaDeRosto":
      return blocosDeLinhas(gerarFolhaDeRosto(metadados), ESPACOS_FOLHA_DE_ROSTO);
    case "folhaDeAprovacao":
      return blocosDeLinhas(gerarFolhaDeAprovacao(metadados), ESPACOS_FOLHA_DE_APROVACAO, true);
    case "dedicatoria": {
      const linhas = gerarDedicatoria(metadados);
      return linhas.length > 0 ? [{ tipo: "noPe", linhas }] : [];
    }
    case "agradecimentos":
      return blocosDeLinhas(gerarAgradecimentos(metadados), {});
    case "epigrafe": {
      const linhas = gerarEpigrafe(metadados);
      return linhas.length > 0 ? [{ tipo: "noPe", linhas }] : [];
    }
    case "resumo":
      return resumoDe("RESUMO", metadados.resumo, "Palavras-chave", metadados.palavrasChave);
    case "abstract":
      return resumoDe("ABSTRACT", metadados.abstract, "Keywords", metadados.keywords);
    case "listaDeFiguras":
      return lista(TITULO_LISTA_FIGURAS, gerarListaDeFiguras(documento.sections));
    case "listaDeTabelas":
      return lista(TITULO_LISTA_TABELAS, gerarListaDeTabelas(documento.sections));
    case "listaDeAbreviaturas": {
      const siglas = gerarListaDeAbreviaturas(metadados, documento.sections);
      if (siglas.length === 0) return [];
      return [
        { tipo: "tituloPreTextual", texto: TITULO_LISTA_ABREVIATURAS },
        ...siglas.map((item): BlocoPrevia => ({
          tipo: "abreviatura",
          sigla: item.sigla,
          significado: item.significado,
        })),
      ];
    }
    case "sumario":
      return sumario(documento);
    case "corpo":
      return corpo(documento, contexto);
    case "referencias":
      return referencias(documento);
    case "apendices":
    case "anexos":
      // Um elemento por item: ver `elementosPosTextuais()`.
      return [];
  }
}

// Nada a mostrar do que o aluno escreveu: o texto e o que vem depois dele
// (referências, apêndices, anexos) vazios, ou só títulos de seção ainda sem
// título (o documento novo traz uma seção em branco, que sairia como uma
// folha com "1" no alto). A capa e o sumário existem sempre e não contam.
export function previaSemConteudo(previa: Previa): boolean {
  return previa.elementos
    .filter((elemento) => elemento.parte === "textual" || elemento.parte === "posTextual")
    .every((elemento) =>
      elemento.blocos.every((bloco) => bloco.tipo === "titulo" && /^[\d.]*\s*$/.test(bloco.texto)),
    );
}

export function montarPrevia(documento: Documento): Previa {
  const contexto: Contexto = {
    references: documento.references,
    figuras: numerarFiguras(documento.sections),
    tabelas: numerarTabelas(documento.sections),
  };

  const elementos: ElementoPrevia[] = [];
  for (const elemento of ORDEM_CANONICA) {
    if (elemento === "apendices" || elemento === "anexos") {
      elementos.push(...elementosPosTextuais(documento, contexto, elemento));
      continue;
    }
    const blocos = blocosDe(elemento, documento, contexto);
    if (blocos.length > 0) elementos.push({ elemento, parte: parteDe(elemento), blocos });
  }
  return { elementos };
}
