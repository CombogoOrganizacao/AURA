import katex from "katex";

import { gerarListaDeAbreviaturas } from "../../document/elements/abreviaturas";
import { gerarAnexos } from "../../document/elements/anexos";
import { gerarApendices } from "../../document/elements/apendices";
import { gerarCapa } from "../../document/elements/capa";
import { gerarFolhaDeAprovacao } from "../../document/elements/folhaDeAprovacao";
import { gerarFolhaDeRosto } from "../../document/elements/folhaDeRosto";
import { textoFonte } from "../../document/elements/legenda";
import type {
  LinhaPreTextual,
  PapelLinhaPreTextual,
} from "../../document/elements/linhaPreTextual";
import { gerarListaDeFiguras, gerarListaDeTabelas } from "../../document/elements/listas";
import {
  gerarAgradecimentos,
  gerarDedicatoria,
  gerarEpigrafe,
} from "../../document/elements/opcionaisPreTextuais";
import { textoTituloPosTextual, type ItemPosTextual } from "../../document/elements/posTextual";
import { gerarListaReferencias } from "../../document/elements/referencias";
import { linhasDeCabecalho } from "../../document/elements/tabela";
import {
  partesDoInline,
  trechosDaCitacaoLonga,
  type ParteInline,
  type Trecho,
} from "../../document/elements/trechos";
import { tamanhoNaFolha, type FormatoImagem } from "../../document/imagem";
import { ORDEM_CANONICA, parteDe, type ElementoDocumento } from "../../document/order";
import type {
  AtributosCitacao,
  Documento,
  ElementoPosTextual,
  Metadados,
  NoCitacaoLonga,
  NoConteudo,
  NoFigura,
  NoFormula,
  NoInline,
  NoTabela,
  Secao,
} from "../../document/types";
import type { Referencia } from "../../references/types";
import { ABNT } from "../docx/constants";
import { escaparLatex } from "./escape";
import {
  linhaDoDocumento,
  MACRO,
  marcadorDeAnexo,
  marcadorDeApendice,
  marcadorDeSecao,
} from "./markers";
import { preambulo } from "./preambulo";

// Gerador do `.tex` (passo 6.2.1). Irmão de `export/docx/fromDocumento.ts`:
// percorre a mesma `ORDEM_CANONICA` e monta cada parte pelas MESMAS funções
// de `document/elements/` (capa, folha de rosto, trechos com a chamada de
// citação, lista de referências, legenda). O que muda é só a marcação. É o
// que garante que o `.tex` e o `.docx` do mesmo trabalho digam a mesma coisa.
//
// Base e decisões em docs/latex-abntex.md: classe `abntex2` para a estrutura,
// preâmbulo do AURA para o que ela faz fora da norma (`preambulo.ts`),
// referências e chamadas formatadas pelo AURA, nunca pelo `abntex2cite`.
//
// Função pura: devolve o texto do `.tex`. As imagens entram só como
// formato e tamanho, para o caminho e a medida; os bytes vão para o `.zip`
// no passo 6.2.3, em `caminhoDaImagem()`.

export interface ImagemParaTex {
  formato: FormatoImagem;
  largura: number;
  altura: number;
}

export type ImagensParaTex = ReadonlyMap<string, ImagemParaTex>;

// Onde a figura mora dentro do projeto LaTeX. O `.tex` avulso aponta para cá
// mesmo sem levar o arquivo (docs/latex-abntex.md §1.4); o `.zip` leva.
export function caminhoDaImagem(id: string, formato: FormatoImagem): string {
  return `figuras/${id}.${formato}`;
}

// --- Inline ------------------------------------------------------------------

function trechoLatex(trecho: Trecho): string {
  if (trecho.papel === "nota") return `\\footnote{${escaparLatex(trecho.texto)}}`;
  let texto = escaparLatex(trecho.texto);
  if (trecho.italico) texto = `\\textit{${texto}}`;
  if (trecho.negrito) texto = `\\textbf{${texto}}`;
  return texto;
}

function trechosLatex(trechos: readonly Trecho[]): string {
  return trechos.map(trechoLatex).join("");
}

// Atributos da citação no argumento opcional do `\auracite`, como
// `chave={valor}`. Cada valor entre chaves para vírgula e colchete do valor
// não quebrarem o argumento. O `apud` tem autoria e data em campos (CSL), e
// vai como JSON escapado: a reimportação desfaz o escape e lê o JSON.
function atributosLatex(attrs: AtributosCitacao): string {
  const pares = [`modo={${attrs.modo}}`];
  if (attrs.pagina) pares.push(`pagina={${escaparLatex(attrs.pagina)}}`);
  if (attrs.apud) pares.push(`apud={${escaparLatex(JSON.stringify(attrs.apud))}}`);
  return pares.join(", ");
}

function parteLatex(parte: ParteInline): string {
  if (parte.tipo === "trecho") return trechoLatex(parte.trecho);
  const trecho = parte.trechos.filter((item) => item.papel !== "chamada");
  const chamada = parte.trechos.filter((item) => item.papel === "chamada");
  return (
    `\\auracite[${atributosLatex(parte.attrs)}]{${escaparLatex(parte.attrs.refId)}}` +
    `{${trechosLatex(trecho)}}{${trechosLatex(chamada)}}`
  );
}

function inlineLatex(content: readonly NoInline[] | undefined, references: readonly Referencia[]) {
  return partesDoInline(content, references).map(parteLatex).join("");
}

// --- Blocos ------------------------------------------------------------------

function paragrafo(texto: string): string {
  return `${texto}\n`;
}

function citacaoLonga(no: NoCitacaoLonga, references: readonly Referencia[]): string {
  const trechos = trechosDaCitacaoLonga(no, references);
  // Sem `refId`, `trechosDaCitacaoLonga()` não acrescenta chamada.
  const chamada = no.refId ? trechos.at(-1) : undefined;
  const corpo = chamada ? trechos.slice(0, -1) : trechos;
  const opcional = no.pagina ? `[pagina={${escaparLatex(no.pagina)}}]` : "";
  return [
    `\\begin{auracitacaolonga}${opcional}{${escaparLatex(no.refId ?? "")}}`,
    trechosLatex(corpo) + (chamada ? `\\aurachamada{${trechoLatex(chamada)}}` : ""),
    "\\end{auracitacaolonga}",
  ].join("\n");
}

// Fórmula: o LaTeX do aluno entra como está, é a fonte dele. Só se o KaTeX
// (o mesmo da tela) o aceitar: LaTeX quebrado faria a compilação inteira
// parar. Inválido, sai como texto, como no `.docx` (passo 6.1.4).
function formula(no: NoFormula): string {
  try {
    katex.renderToString(no.texto, { throwOnError: true, strict: false, trust: false });
  } catch {
    return `\\begin{center}\n\\texttt{${escaparLatex(no.texto)}}\n\\end{center}`;
  }
  return `\\[\n${no.texto}\n\\]`;
}

function fonteDe(no: NoFigura | NoTabela): string {
  const texto = textoFonte(no.fonte);
  return texto ? `\\aurafonte{${escaparLatex(texto)}}` : "";
}

// Mesmo tamanho do `.docx`: a imagem em pixels a 96 por polegada, reduzida
// para caber na largura útil e na altura máxima (`export/docx/media.ts`).
// 1 pixel a 96 dpi = 0,75 pt.
const PIXELS_POR_TWIP = 96 / 1440;
const MAXIMO_NA_FOLHA = {
  largura: Math.floor(ABNT.larguraUtil * PIXELS_POR_TWIP),
  altura: Math.floor(ABNT.alturaMaximaFigura * PIXELS_POR_TWIP),
};

function figura(no: NoFigura, imagens: ImagensParaTex): string {
  const imagem = no.imagem ? imagens.get(no.imagem) : undefined;
  let objeto: string;
  if (no.imagem && imagem) {
    const tamanho = tamanhoNaFolha(imagem, MAXIMO_NA_FOLHA);
    objeto =
      `\\includegraphics[width=${tamanho.largura * 0.75}pt,height=${tamanho.altura * 0.75}pt]` +
      `{${caminhoDaImagem(no.imagem, imagem.formato)}}`;
  } else {
    // Mesmo aviso honesto do `.docx` para figura sem imagem.
    objeto = "\\fbox{\\parbox{.6\\textwidth}{\\centering\\textit{[ espaço reservado para a imagem ]}}}";
  }
  return [
    "\\begin{figure}[H]",
    // Legenda e fonte em espaço simples (14724 §5.2).
    "\\auraespacosimples",
    "\\centering",
    `\\caption{${escaparLatex(no.legenda)}}`,
    objeto,
    // 6 pt depois da imagem, como o `after` dela no `.docx` (`media.ts`).
    "\\par\\vspace{6pt}",
    fonteDe(no),
    "\\end{figure}",
  ]
    .filter(Boolean)
    .join("\n");
}

// Tabela no padrão do IBGE, como o `.docx` do passo 6.1.3: traço acima, traço
// abaixo do cabeçalho e traço no fim, sem laterais. O cabeçalho se repete na
// página seguinte (`\endhead`). Colunas de largura igual, como no `.docx`.
function tabela(no: NoTabela, references: readonly Referencia[]): string {
  if (no.linhas.length === 0) {
    return [
      "\\begin{table}[H]",
      `\\caption{${escaparLatex(no.legenda)}}`,
      fonteDe(no),
      "\\end{table}",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const colunas = Math.max(1, ...no.linhas.map((linha) => linha.celulas.length));
  const largura = `\\dimexpr(\\linewidth-${2 * colunas}\\tabcolsep)/${colunas}\\relax`;
  const cabecalho = linhasDeCabecalho(no.linhas);

  const linhaLatex = (indice: number) => {
    const linha = no.linhas[indice];
    const celulas = Array.from({ length: colunas }, (_, coluna) => {
      const celula = linha.celulas[coluna];
      if (!celula) return "";
      const texto = inlineLatex(celula.content, references);
      return celula.cabecalho && texto ? `\\textbf{${texto}}` : texto;
    });
    return `${celulas.join(" & ")} \\\\`;
  };

  const linhasDoCabecalho = Array.from({ length: cabecalho }, (_, indice) => linhaLatex(indice));
  const linhasDoCorpo = no.linhas.slice(cabecalho).map((_, indice) => linhaLatex(cabecalho + indice));
  const abaixoDoCabecalho = cabecalho > 0 ? ["\\midrule"] : [];

  return [
    `\\begin{longtable}{*{${colunas}}{p{${largura}}}}`,
    `\\caption{${escaparLatex(no.legenda)}} \\\\`,
    "\\toprule",
    ...linhasDoCabecalho,
    ...abaixoDoCabecalho,
    "\\endfirsthead",
    ...(cabecalho > 0 ? ["\\toprule", ...linhasDoCabecalho, "\\midrule"] : []),
    "\\endhead",
    "\\bottomrule",
    "\\endlastfoot",
    ...linhasDoCorpo,
    "\\end{longtable}",
    fonteDe(no),
  ]
    .filter(Boolean)
    .join("\n");
}

function bloco(no: NoConteudo, references: readonly Referencia[], imagens: ImagensParaTex): string {
  switch (no.type) {
    case "paragraph":
      return paragrafo(inlineLatex(no.content, references));
    case "citacao_longa":
      return citacaoLonga(no, references);
    case "formula":
      return formula(no);
    case "figura":
      return figura(no, imagens);
    case "tabela":
      return tabela(no, references);
  }
}

// --- Corpo -------------------------------------------------------------------

const COMANDO_DE_NIVEL = ["chapter", "section", "subsection"] as const;

// O indicativo numérico sai do LaTeX, na mesma ordem e com a mesma regra de
// `numerarSecoes()`: 1, 1.1, 1.1.1, contínuo. O título do capítulo vai em
// caixa alta também no sumário (argumento opcional), como no `.docx`; o
// `\texorpdfstring` deixa o marcador do PDF sem o comando.
function tituloDeSecao(secao: Secao): string {
  const titulo = escaparLatex(secao.titulo);
  const comando = COMANDO_DE_NIVEL[secao.nivel - 1];
  if (secao.nivel === 1) {
    return `\\${comando}[\\texorpdfstring{\\protect\\MakeUppercase{${titulo}}}{${titulo}}]{${titulo}}`;
  }
  return `\\${comando}{${titulo}}`;
}

export interface Capitulo {
  // A seção de nível 1 que abre o capítulo (ou a primeira seção, se o corpo
  // começar abaixo do nível 1).
  secao: Secao;
  tex: string;
}

// O corpo em capítulos: cada seção de nível 1 com as subseções que a
// seguem. No `.tex` avulso eles saem em sequência; no `.zip` (6.2.3), cada um
// num arquivo de `sections/`.
export function capitulosDoCorpo(documento: Documento, imagens: ImagensParaTex): Capitulo[] {
  const secoes = [...documento.sections].sort((a, b) => a.ordem - b.ordem);
  const capitulos: { secao: Secao; partes: string[] }[] = [];
  for (const secao of secoes) {
    const tex = [
      `${marcadorDeSecao(secao.id)}\n${tituloDeSecao(secao)}`,
      ...secao.content.map((no) => bloco(no, documento.references, imagens)),
    ].join("\n\n");
    if (secao.nivel === 1 || capitulos.length === 0) capitulos.push({ secao, partes: [tex] });
    else capitulos.at(-1)!.partes.push(tex);
  }
  return capitulos.map(({ secao, partes }) => ({ secao, tex: partes.join("\n\n") }));
}

function corpo(documento: Documento, imagens: ImagensParaTex): string {
  return capitulosDoCorpo(documento, imagens)
    .map((capitulo) => capitulo.tex)
    .join("\n\n");
}

// --- Pré-textuais ------------------------------------------------------------

// Mesmo destaque do `.docx` (`export/docx/preTextuais.ts`, `ENFASE`).
const ENFASE: Partial<Record<PapelLinhaPreTextual, { negrito?: boolean; caixaAlta?: boolean }>> = {
  instituicao: { negrito: true },
  autor: { caixaAlta: true },
  tituloDoTrabalho: { negrito: true, caixaAlta: true },
};

// Twips (`.docx`) para pontos: 20 twips = 1 pt.
const pontos = (twips: number) => `${twips / 20}pt`;

// Texto da linha com cada campo trocado pelo comando do bloco de metadados
// (`markers.ts`, passo 6.2.2), e o que sobra ("Orientador: ", ": " entre
// título e subtítulo) escapado como texto. Campo vazio ou que não está na
// linha fica como texto: não há onde pôr o comando.
function comCampos(texto: string, campos: readonly (readonly [string, string])[]): string {
  let resto = texto;
  let saida = "";
  for (const [valor, macro] of campos) {
    const posicao = valor ? resto.indexOf(valor) : -1;
    if (posicao < 0) continue;
    saida += escaparLatex(resto.slice(0, posicao)) + macro;
    resto = resto.slice(posicao + valor.length);
  }
  return saida + escaparLatex(resto);
}

function fonteDaLinha(linha: LinhaPreTextual, metadados: Metadados): string {
  switch (linha.papel) {
    case "autor":
      // Todos os autores num comando só, um por linha (`linhasComEspacos()`).
      return MACRO.autores;
    case "instituicao":
      return comCampos(linha.texto, [[metadados.instituicao, MACRO.instituicao]]);
    case "tituloDoTrabalho":
      return comCampos(linha.texto, [
        [metadados.titulo, MACRO.titulo],
        [metadados.subtitulo ?? "", MACRO.subtitulo],
      ]);
    case "natureza":
      return comCampos(linha.texto, [[metadados.naturezaTrabalho, MACRO.naturezaTrabalho]]);
    case "orientador":
      return comCampos(linha.texto, [[metadados.orientador, MACRO.orientador]]);
    case "local":
      return comCampos(linha.texto, [[metadados.local, MACRO.local]]);
    case "ano":
      return comCampos(linha.texto, [[String(metadados.ano), MACRO.ano]]);
    default:
      return escaparLatex(linha.texto);
  }
}

// A caixa alta vem do LaTeX, e não do texto: o texto é o comando do bloco.
function textoDeLinha(linha: LinhaPreTextual, metadados: Metadados): string {
  const enfase = linha.papel ? ENFASE[linha.papel] : undefined;
  let texto = fonteDaLinha(linha, metadados);
  if (enfase?.caixaAlta) texto = `\\MakeUppercase{${texto}}`;
  if (enfase?.negrito) texto = `\\textbf{${texto}}`;
  return texto;
}

// Uma linha pré-textual. Recuada: bloco do meio da mancha até a margem
// direita (14724 §5.2), em espaço simples na natureza.
function linhaLatex(linha: LinhaPreTextual, metadados: Metadados): string {
  const texto = textoDeLinha(linha, metadados);
  if (linha.alinhamento === "recuada-a-direita") {
    const simples = linha.papel === "natureza" ? "\\auraespacosimples " : "";
    return `\\noindent\\hfill\\begin{minipage}[t]{.5\\textwidth}${simples}${texto}\\end{minipage}\\par`;
  }
  if (linha.alinhamento === "centro") return `{\\centering ${texto}\\par}`;
  return `\\noindent ${texto}\\par`;
}

// Mesmos espaços do `.docx`: antes da primeira linha de cada papel. As linhas
// de autor seguintes à primeira não saem: a primeira já imprime todos
// (`\auraautores`, um por linha), e os geradores as põem sempre juntas.
function linhasComEspacos(
  linhas: readonly LinhaPreTextual[],
  metadados: Metadados,
  espacos: Partial<Record<PapelLinhaPreTextual, number>>,
  espacoSempre: Partial<Record<PapelLinhaPreTextual, number>> = {},
): string {
  const vistos = new Set<PapelLinhaPreTextual>();
  return linhas
    .flatMap((linha) => {
      const primeira = linha.papel !== undefined && !vistos.has(linha.papel);
      if (linha.papel === "autor" && !primeira) return [];
      if (linha.papel) vistos.add(linha.papel);
      const espaco = linha.papel
        ? (espacoSempre[linha.papel] ?? (primeira ? espacos[linha.papel] : undefined))
        : undefined;
      return [`${espaco ? `\\vspace*{${pontos(espaco)}}\n` : ""}${linhaLatex(linha, metadados)}`];
    })
    .join("\n");
}

function capa(metadados: Metadados): string {
  const linhas = gerarCapa(metadados);
  if (linhas.length === 0) return "";
  return [
    "\\begin{capa}",
    linhasComEspacos(linhas, metadados, { autor: 3000, tituloDoTrabalho: 3000, local: 4000 }),
    "\\end{capa}",
  ].join("\n");
}

function folhaDeRosto(metadados: Metadados): string {
  const linhas = gerarFolhaDeRosto(metadados);
  if (linhas.length === 0) return "";
  return [
    "\\renewcommand{\\folhaderostocontent}{%",
    linhasComEspacos(linhas, metadados, {
      tituloDoTrabalho: 2400,
      natureza: 1200,
      orientador: 600,
      local: 2400,
    }),
    "}",
    "\\imprimirfolhaderosto",
  ].join("\n");
}

function folhaDeAprovacao(metadados: Metadados): string {
  const linhas = gerarFolhaDeAprovacao(metadados);
  if (linhas.length === 0) return "";
  return [
    "\\begin{folhadeaprovacao}",
    linhasComEspacos(
      linhas,
      metadados,
      { tituloDoTrabalho: 1200, natureza: 600, dataAprovacao: 600 },
      { assinatura: 720 },
    ),
    "\\end{folhadeaprovacao}",
  ].join("\n");
}

// Dedicatória e epígrafe: sem título, do meio da mancha à margem direita, na
// parte inferior da página (14724 §5.2.4). O texto é o comando do bloco de
// metadados, com os parágrafos já separados por `\par` (`markers.ts`).
function noPeDaPagina(ambiente: string, linhas: readonly LinhaPreTextual[], macro: string): string {
  if (linhas.length === 0) return "";
  return [
    `\\begin{${ambiente}}`,
    "\\vspace*{\\fill}",
    `\\noindent\\hfill\\begin{minipage}{.5\\textwidth}\n${macro}\\par\n\\end{minipage}`,
    `\\end{${ambiente}}`,
  ].join("\n");
}

// Parágrafos sem recuo, como a linha justificada de antes do 6.2.2: o
// `\parindent` zerado vale para todos os parágrafos do comando.
function agradecimentos(metadados: Metadados): string {
  const linhas = gerarAgradecimentos(metadados);
  const titulo = linhas.find((linha) => linha.titulo);
  if (!titulo) return "";
  return [
    `\\pretextualchapter{${escaparLatex(titulo.texto)}}`,
    `{\\setlength{\\parindent}{0pt}${MACRO.agradecimentos}\\par}`,
  ].join("\n");
}

// Resumo e abstract como no `.docx` (`paragrafosResumo()`): título, texto sem
// recuo, uma linha e as palavras-chave separadas por ponto e vírgula e
// finalizadas por ponto (6028:2021 §4.1.7). Texto e termos são os comandos do
// bloco de metadados; se sai ou não, decide o valor no momento da exportação.
function resumo(
  titulo: string,
  texto: string,
  macroTexto: string,
  rotulo: string,
  termos: readonly string[],
  macroTermos: string,
  idioma?: string,
): string {
  if (!texto) return "";
  const partes = [`\\noindent ${macroTexto}\\par`];
  if (termos.length > 0) {
    partes.push(
      "\\vspace{\\baselineskip}",
      `\\noindent\\textbf{${escaparLatex(rotulo)}:} ${macroTermos}.\\par`,
    );
  }
  const conteudo = idioma
    ? [`\\begin{otherlanguage*}{${idioma}}`, ...partes, "\\end{otherlanguage*}"]
    : partes;
  return [`\\pretextualchapter{${escaparLatex(titulo)}}`, ...conteudo].join("\n");
}

function listaDeAbreviaturas(documento: Documento): string {
  const itens = gerarListaDeAbreviaturas(documento.metadados, documento.sections);
  if (itens.length === 0) return "";
  return [
    "\\begin{siglas}",
    ...itens.map((item) => `\\item[${escaparLatex(item.sigla)}] ${escaparLatex(item.significado)}`),
    "\\end{siglas}",
  ].join("\n");
}

// --- Pós-textuais ------------------------------------------------------------

// Título sem indicativo, centralizado (14724 §5.2.3), e no sumário
// (6027 §5.2), como o `TituloPosTextual` do `.docx`.
function tituloPosTextual(texto: string): string {
  const titulo = escaparLatex(texto);
  return `\\pretextualchapter{${titulo}}\n\\phantomsection\\addcontentsline{toc}{chapter}{${titulo}}`;
}

// Espaço simples, alinhadas à esquerda e separadas por uma linha em branco
// (14724 §5.2; 6023:2025 §6.3). Título da obra em negrito, como no `.docx`.
function referencias(documento: Documento): string {
  const lista = gerarListaReferencias(documento.references);
  if (!lista) return "";
  const entradas = lista.entradas.map((entrada) =>
    entrada.trechos
      .map((trecho) => {
        const texto = escaparLatex(trecho.texto);
        return trecho.papel === "titulo" ? `\\textbf{${texto}}` : texto;
      })
      .join(""),
  );
  return [
    tituloPosTextual(lista.titulo),
    "\\begin{SingleSpace}",
    "\\raggedright",
    "\\setlength{\\parindent}{0pt}",
    entradas.join("\\par\n\\vspace{\\baselineskip}\n") + "\\par",
    "\\end{SingleSpace}",
  ].join("\n");
}

// Conteúdo de apêndice e anexo: o mesmo que o `.docx` exporta ali. Figura e
// tabela ainda não têm numeração definida dentro deles (`posTextuais.ts`), e
// saem com o mesmo aviso. A fórmula sai como equação: é o formato nativo
// dela aqui (o `.docx` ainda a escreve como texto nos pós-textuais).
function conteudoPosTextual(no: NoConteudo, references: readonly Referencia[]): string {
  if (no.type === "figura" || no.type === "tabela") {
    return `\\begin{center}\\textit{[ ${no.type} dentro de apêndice/anexo ainda não exportada --- numeração não definida ]}\\end{center}`;
  }
  return bloco(no, references, new Map());
}

// Título de apêndice e anexo em caixa alta, como no `.docx`
// (`blocoDeElemento()`, que explica a origem). Aqui a caixa alta é do LaTeX,
// e o fonte guarda o título como o aluno o escreveu: é esse texto que a
// reimportação (6.2.4) lê, depois do marcador.
function tituloDeApendiceOuAnexo(texto: string): string {
  const titulo = escaparLatex(texto);
  const emCaixaAlta = `\\texorpdfstring{\\protect\\MakeUppercase{${titulo}}}{${titulo}}`;
  return `\\pretextualchapter{${emCaixaAlta}}\n\\phantomsection\\addcontentsline{toc}{chapter}{${emCaixaAlta}}`;
}

function posTextuais(
  elementos: readonly ElementoPosTextual[],
  gerar: (lista: readonly ElementoPosTextual[]) => ItemPosTextual[],
  marcador: (id: string) => string,
  references: readonly Referencia[],
): string {
  return gerar(elementos)
    .map((item, indice) =>
      [
        `${marcador(item.id)}\n${tituloDeApendiceOuAnexo(textoTituloPosTextual(item))}`,
        ...elementos[indice].content.map((no) => conteudoPosTextual(no, references)),
      ].join("\n\n"),
    )
    .join("\n\n");
}

// --- Montagem ----------------------------------------------------------------

type Gerador = (documento: Documento, imagens: ImagensParaTex) => string;

const GERADORES: Record<ElementoDocumento, Gerador> = {
  capa: (documento) => capa(documento.metadados),
  folhaDeRosto: (documento) => folhaDeRosto(documento.metadados),
  folhaDeAprovacao: (documento) => folhaDeAprovacao(documento.metadados),
  dedicatoria: (documento) =>
    noPeDaPagina("dedicatoria", gerarDedicatoria(documento.metadados), MACRO.dedicatoria),
  agradecimentos: (documento) => agradecimentos(documento.metadados),
  epigrafe: (documento) =>
    noPeDaPagina("epigrafe", gerarEpigrafe(documento.metadados), MACRO.epigrafe),
  resumo: ({ metadados }) =>
    resumo(
      "RESUMO",
      metadados.resumo,
      MACRO.resumo,
      "Palavras-chave",
      metadados.palavrasChave,
      MACRO.palavrasChave,
    ),
  abstract: ({ metadados }) =>
    resumo(
      "ABSTRACT",
      metadados.abstract,
      MACRO.abstract,
      "Keywords",
      metadados.keywords,
      MACRO.keywords,
      "english",
    ),
  listaDeFiguras: (documento) =>
    gerarListaDeFiguras(documento.sections).length > 0 ? "\\listoffigures*" : "",
  listaDeTabelas: (documento) =>
    gerarListaDeTabelas(documento.sections).length > 0 ? "\\listoftables*" : "",
  listaDeAbreviaturas: listaDeAbreviaturas,
  sumario: () => "\\tableofcontents*",
  corpo: corpo,
  referencias: referencias,
  apendices: (documento) =>
    posTextuais(documento.apendices, gerarApendices, marcadorDeApendice, documento.references),
  anexos: (documento) =>
    posTextuais(documento.anexos, gerarAnexos, marcadorDeAnexo, documento.references),
};

// Onde cada parte começa na classe: `\textual` liga a numeração arábica das
// páginas (14724 §5.3); `\postextual` fecha o corpo. No pós-textual, a caixa
// alta que a opção `chapter=TITLE` impõe fica desligada: o título de apêndice
// e anexo já tem o próprio `\MakeUppercase` (`tituloDeApendiceOuAnexo()`), e
// REFERÊNCIAS já é escrito em maiúsculas.
const ABERTURA_DA_PARTE = {
  textual: "\\textual",
  posTextual: "\\postextual\n\\setboolean{ABNTEXupperchapter}{false}",
} as const;

export function gerarTex(documento: Documento, imagens: ImagensParaTex = new Map()): string {
  return montarTex(documento, imagens, corpo);
}

export interface ArquivoTex {
  caminho: string;
  conteudo: string;
}

export interface ProjetoTex {
  main: string;
  secoes: ArquivoTex[];
}

// Nome do arquivo do capítulo: posição e título sem acento, para quem abre o
// projeto no Overleaf se achar. A reimportação não depende dele: a identidade
// é o marcador de dentro (docs/latex-abntex.md §1.5).
function nomeDoCapitulo(indice: number, secao: Secao): string {
  const slug = secao.titulo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `sections/${String(indice + 1).padStart(2, "0")}-${slug || "secao"}.tex`;
}

// O `.tex` do projeto (`.zip`, passo 6.2.3): o mesmo arquivo do avulso, com
// cada capítulo num arquivo de `sections/` e um `\input` no lugar dele.
export function gerarProjetoTex(
  documento: Documento,
  imagens: ImagensParaTex = new Map(),
): ProjetoTex {
  const secoes = capitulosDoCorpo(documento, imagens).map((capitulo, indice) => ({
    caminho: nomeDoCapitulo(indice, capitulo.secao),
    conteudo: `% Capítulo do trabalho, incluído pelo main.tex (gerado pelo AURA).\n\n${capitulo.tex}\n`,
  }));
  const main = montarTex(documento, imagens, () =>
    secoes.map((arquivo) => `\\input{${arquivo.caminho.replace(/\.tex$/, "")}}`).join("\n"),
  );
  return { main, secoes };
}

function montarTex(documento: Documento, imagens: ImagensParaTex, gerarCorpo: Gerador): string {
  const partes: string[] = [];
  let parteAtual: string | null = null;
  for (const elemento of ORDEM_CANONICA) {
    const parte = parteDe(elemento);
    if (parte !== parteAtual && (parte === "textual" || parte === "posTextual")) {
      partes.push(ABERTURA_DA_PARTE[parte]);
    }
    parteAtual = parte;
    const texto = (elemento === "corpo" ? gerarCorpo : GERADORES[elemento])(documento, imagens);
    if (!texto) continue;
    // Cada elemento pré-textual em página própria, como o `.docx`
    // (`comQuebrasEntreBlocos()`). A quebra vem DEPOIS do elemento: a página
    // sai com o estilo da parte a que pertence. Sem ela, o `\textual` logo
    // depois do sumário trocaria o estilo antes de a página do sumário ser
    // impressa, e ela sairia numerada. Duas quebras seguidas não criam página
    // em branco.
    partes.push(parte === "capa" || parte === "preTextual" ? `${texto}\n\\cleardoublepage` : texto);
  }

  return [
    // Primeira linha do arquivo: é por ela que a reimportação reconhece um
    // `.tex` do AURA (docs/latex-abntex.md §1.5).
    `${linhaDoDocumento(documento.id)}\n${preambulo(documento.metadados)}`,
    "\\begin{document}",
    partes.join("\n\n"),
    "\\end{document}",
    "",
  ].join("\n\n");
}
