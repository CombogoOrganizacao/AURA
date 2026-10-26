import type { NivelSecao, NoParagrafo } from "../../document/types";
import type { NoHtmlColado } from "../../editor/paste";
import type { BlocoLido } from "../latex/blocos";
import type { Aviso } from "../latex/fonte";
import type { MetadadosLidos, PosTextualLido, SecaoLida, TexLido } from "../latex/lerTex";
import { CLASSE } from "./estilos";
import {
  figura,
  fonteDe,
  imagensNoTexto,
  imagensSozinhas,
  legendaDe,
  tabelaDe,
  type Legenda,
} from "./ilustracoes";
import { normal, paragrafosDe, separarNotas, textoDe, textoDoParagrafo, type Notas } from "./texto";

// Leitor do `.docx` (passos 8.7.1 e 8.7.2, docs/to-do-correcoes.md). Recebe o
// HTML que o mammoth fez do arquivo, já na árvore neutra da colagem
// (`NoHtmlColado`, montada no navegador por `src/lib/lerDocx.ts`), e devolve o
// que o arquivo diz na mesma forma da leitura do `.tex` (`TexLido`). Comparar
// com o trabalho de destino, montar o relatório e aplicar é de
// `import/latex/reimport.ts`, o mesmo da importação de LaTeX: o mesmo
// relatório, os mesmos destinos, a mesma versão "Antes da reimportação".
//
// **O texto passa pela regra da colagem.** Cada parágrafo vira nó do editor
// por `mapearHtmlColado()` (src/core/editor/paste.ts): só texto, negrito e
// itálico, mais a nota de rodapé no lugar da chamada (`texto.ts`). Nenhum
// HTML do arquivo chega ao documento (CLAUDE.md, "Segurança").
//
// **Títulos pelos estilos do Word** (decisão da usuária, 16/10/2026): Título 1
// a 3 viram seções de nível 1 a 3. O que só parece título (parágrafo curto,
// todo em negrito, sem estilo) entra como parágrafo, e o relatório o aponta
// como "possível título". O AURA nunca promove um parágrafo a título sozinho.
//
// **O que o AURA deriva não é lido**, como no `.tex`: capa, folhas, sumário,
// listas e numeração. Do que vem antes do texto, voltam o resumo, o abstract
// e as palavras-chave. A lista de referências vira aviso: texto já formatado
// não é referência (CLAUDE.md, "Formato e dados"), e convertê-la seria
// adivinhar campos.

export interface OpcoesLeituraDocx {
  // As mensagens do mammoth (`result.messages`), em texto: dizem o que ele
  // não leu (equações, caixas de texto…).
  mensagens?: readonly string[];
}

// --- Títulos -----------------------------------------------------------------

// Numeração digitada no título ("2.1 Método", "3. Resultados"): o AURA
// numera sozinho, pela ordem e pelo nível (CLAUDE.md, "Formato e dados").
const NUMERACAO_DIGITADA = /^\d{1,2}(?:\.\d{1,2}){0,4}\.?\s+(?=\p{L})/u;

// Os títulos sem indicativo numérico da NBR 14724:2024 §5.2.3, que o aluno
// escreve à mão ou com o estilo de título.
const TITULO_RESUMO = /^resumo$/i;
const TITULO_ABSTRACT = /^abstract$/i;
// O que vem antes do texto e o AURA não lê: refaz (sumário, listas, folhas)
// ou recebe no painel (dedicatória, agradecimentos, epígrafe).
const TITULO_PRE_IGNORADO =
  /^(agradecimentos?|dedicat[óo]ria|ep[íi]grafe|sum[áa]rio|lista d[eo]s? .+|errata|folha de aprova[çc][ãa]o|ficha catalogr[áa]fica|pref[áa]cio|resumen|r[ée]sum[ée])$/i;
const TITULO_REFERENCIAS = /^refer[êe]ncias(?: bibliogr[áa]ficas)?$/i;
const TITULO_APENDICE_ANEXO = /^(ap[êe]ndice|anexo)\s+([a-z]{1,2}|\d{1,2})(?:\s*[-–—:.]\s*(.*))?$/i;

// Parágrafo comprido não é título, nem com o texto de um.
const TAMANHO_MAXIMO_DE_TITULO = 100;

type Especial =
  | { tipo: "resumo" | "abstract" | "referencias" }
  | { tipo: "preIgnorado"; texto: string }
  | { tipo: "apendice" | "anexo"; titulo: string };

type Elemento = Extract<NoHtmlColado, { tipo: "elemento" }>;

function eTituloDoWord(no: NoHtmlColado): boolean {
  return no.tipo === "elemento" && /^h[1-6]$/.test(no.tag);
}

// O título sem número que o bloco é, ou `null`. Reconhece pelo texto, com
// qualquer estilo: "RESUMO" sozinho num parágrafo é o título do resumo,
// esteja ele em negrito, em Título 1 ou no estilo do AURA.
function especialDe(no: NoHtmlColado): Especial | null {
  if (no.tipo !== "elemento" || !["p", "h1", "h2", "h3", "h4", "h5", "h6"].includes(no.tag)) {
    return null;
  }
  const texto = normal(textoDe(no)).replace(/[.:]$/, "");
  if (!texto || texto.length > TAMANHO_MAXIMO_DE_TITULO) return null;
  if (TITULO_RESUMO.test(texto)) return { tipo: "resumo" };
  if (TITULO_ABSTRACT.test(texto)) return { tipo: "abstract" };
  if (TITULO_REFERENCIAS.test(texto)) return { tipo: "referencias" };
  if (TITULO_PRE_IGNORADO.test(texto)) return { tipo: "preIgnorado", texto };
  const posTextual = TITULO_APENDICE_ANEXO.exec(texto);
  if (posTextual) {
    return {
      tipo: /^anexo$/i.test(posTextual[1]) ? "anexo" : "apendice",
      titulo: (posTextual[3] ?? "").trim(),
    };
  }
  return null;
}

function nivelDe(tag: string): number {
  return Number(tag.slice(1));
}

// --- Resumo e palavras-chave -------------------------------------------------

const PALAVRAS_CHAVE = /^palavras?[- ]chaves?\s*:\s*(.*)$/i;
const KEYWORDS = /^key[- ]?words?\s*:\s*(.*)$/i;

// "educação; escola; leitura." A NBR 6028 separa por ponto e vírgula; quem
// separa por vírgula ou por ponto também é lido.
function termos(texto: string): string[] {
  const separador = texto.includes(";") ? ";" : texto.includes(",") ? "," : /\.\s+/;
  return texto
    .split(separador)
    .map((termo) => termo.trim().replace(/\.$/, "").trim())
    .filter(Boolean);
}

// --- Citações escritas à mão -------------------------------------------------

// "(Freire, 1987)", "(SILVA; SOUZA, 2020, p. 35)": a chamada que o aluno
// digitou. Só para o aviso: o AURA monta a chamada da referência, e o texto
// digitado não diz qual referência é (CLAUDE.md, "Formato e dados").
const CHAMADA_DIGITADA =
  /\(\p{Lu}[^()]{0,80}?,\s*(?:1[5-9]|20)\d{2}[a-z]?(?:,\s*p\.\s*\d[\d–-]*)?\)/gu;

// --- Leitura -----------------------------------------------------------------

type Zona =
  // Antes do primeiro título: capa, folha de rosto.
  | { tipo: "inicio" }
  // Sumário, listas, agradecimentos…: não entram.
  | { tipo: "ignorada" }
  | { tipo: "resumo" | "abstract" }
  | { tipo: "corpo"; secao: SecaoLida }
  | { tipo: "referencias" }
  | { tipo: "posTextual"; elemento: PosTextualLido }
  // Título desconhecido depois das referências (glossário, índice).
  | { tipo: "depois" };

interface Estado {
  zona: Zona;
  // Do documento sem estilo de título: tudo o que não é resumo, abstract,
  // referências, apêndice ou anexo vai para uma seção só.
  semTitulos: boolean;
  notas: Notas;
  secoes: SecaoLida[];
  apendices: PosTextualLido[];
  anexos: PosTextualLido[];
  resumo: string[];
  abstract: string[];
  metadados: MetadadosLidos;
  avisos: Aviso[];
  // O que ficou de fora, para os avisos do fim.
  antesDoPrimeiroTitulo: number;
  preIgnorados: string[];
  paragrafosDeReferencias: number;
  itensDeLista: number;
  numeracoesRemovidas: number;
  chamadasDigitadas: number;
  ilustracaoNoPosTextual: boolean;
}

function aviso(estado: Estado, mensagem: string) {
  estado.avisos.push({ arquivo: "", linha: 0, mensagem });
}

// Onde o aviso aconteceu, para o aluno achar no arquivo.
function onde(estado: Estado): string {
  const { zona } = estado;
  if (zona.tipo === "corpo") return zona.secao.titulo ? ` em “${zona.secao.titulo}”` : "";
  if (zona.tipo === "posTextual") {
    return zona.elemento.titulo ? ` em “${zona.elemento.titulo}”` : "";
  }
  return "";
}

function novaSecao(titulo: string, nivel: NivelSecao): SecaoLida {
  return { id: null, nivel, titulo, content: [], linha: 0, arquivo: "" };
}

function novoPosTextual(titulo: string): PosTextualLido {
  return { id: null, titulo, content: [], linha: 0, arquivo: "" };
}

// A seção única do documento sem estilos, criada no primeiro parágrafo.
function secaoUnica(estado: Estado): SecaoLida {
  if (estado.secoes.length === 0) estado.secoes.push(novaSecao("", 1));
  return estado.secoes[0];
}

function conteudoAtual(estado: Estado): BlocoLido[] | null {
  const { zona } = estado;
  if (zona.tipo === "corpo") return zona.secao.content;
  if (zona.tipo === "posTextual") return zona.elemento.content;
  if (estado.semTitulos && (zona.tipo === "inicio" || zona.tipo === "ignorada")) {
    return secaoUnica(estado).content;
  }
  return null;
}

function contarItens(no: NoHtmlColado): number {
  if (no.tipo === "texto") return 0;
  return (
    (no.tag === "li" ? 1 : 0) + no.filhos.reduce((soma, filho) => soma + contarItens(filho), 0)
  );
}

// Entra no conteúdo da seção (ou do apêndice) o que o bloco tem de texto, e,
// depois dele, as imagens que estavam no meio do texto.
function guardarConteudo(estado: Estado, no: NoHtmlColado, conteudo: BlocoLido[]) {
  if (no.tipo === "elemento" && (no.tag === "ul" || no.tag === "ol")) {
    estado.itensDeLista += contarItens(no);
  }
  const citacaoLonga = no.tipo === "elemento" && no.classe === CLASSE.citacaoLonga;
  for (const paragrafo of paragrafosDe(no, estado.notas)) {
    const texto = textoDoParagrafo(paragrafo);
    estado.chamadasDigitadas += texto.match(CHAMADA_DIGITADA)?.length ?? 0;
    if (citacaoLonga) {
      conteudo.push({ type: "citacao_longa", refId: null, pagina: "", content: paragrafo.content });
      continue;
    }
    if (possivelTitulo(paragrafo, texto)) {
      aviso(
        estado,
        `Possível título${onde(estado)}: “${texto}” está em negrito, mas sem o estilo de Título do Word, e entrou como parágrafo. Se for título, aplique o estilo Título no Word e importe de novo, ou crie a seção no AURA.`,
      );
    }
    conteudo.push(paragrafo);
  }
  for (const chave of imagensNoTexto(no)) {
    conteudo.push(figura(chave, "", ""));
    aviso(
      estado,
      `Uma imagem no meio do texto${onde(estado)} entrou como figura sem legenda, logo depois do parágrafo.`,
    );
  }
}

// Parágrafo curto, todo em negrito e sem ponto final: o título feito à mão.
function possivelTitulo(paragrafo: NoParagrafo, texto: string): boolean {
  const trechos = paragrafo.content ?? [];
  return (
    texto.length <= TAMANHO_MAXIMO_DE_TITULO &&
    /\p{L}/u.test(texto) &&
    !/[.;:,!?]$/.test(texto) &&
    trechos.length > 0 &&
    trechos.every(
      (no) => no.type === "text" && (no.marks ?? []).some((marca) => marca.type === "negrito"),
    )
  );
}

// --- Figura e tabela ---------------------------------------------------------

type Objeto = { tipo: "imagens"; chaves: (string | null)[] } | { tipo: "tabela"; no: Elemento };

function objetoDe(no: NoHtmlColado | undefined): Objeto | null {
  if (!no || no.tipo !== "elemento") return null;
  if (no.tag === "table") return { tipo: "tabela", no };
  const chaves = imagensSozinhas(no);
  return chaves ? { tipo: "imagens", chaves } : null;
}

// O bloco `i` e, se ele é legenda, figura ou tabela, os vizinhos que vão
// junto. Devolve o índice do último bloco usado.
function guardarBloco(
  estado: Estado,
  blocos: readonly NoHtmlColado[],
  i: number,
  conteudo: BlocoLido[],
): number {
  const no = blocos[i];
  const legenda = legendaDe(no);
  if (legenda) {
    const objeto = objetoDe(blocos[i + 1]);
    if (objeto) return guardarIlustracao(estado, blocos, i + 1, objeto, legenda, conteudo);
    if (legenda.doEstilo) {
      aviso(
        estado,
        `A legenda “${legenda.texto}”${onde(estado)} não tem imagem nem tabela logo abaixo e entrou como parágrafo.`,
      );
    }
  } else {
    const objeto = objetoDe(no);
    if (objeto) return guardarIlustracao(estado, blocos, i, objeto, null, conteudo);
  }
  guardarConteudo(estado, no, conteudo);
  return i;
}

function guardarIlustracao(
  estado: Estado,
  blocos: readonly NoHtmlColado[],
  j: number,
  objeto: Objeto,
  acima: Legenda | null,
  conteudo: BlocoLido[],
): number {
  let fim = j;
  let legenda = acima;
  // No trabalho feito à mão, a legenda às vezes vem embaixo. Só é dela se não
  // for a legenda do objeto seguinte.
  if (!legenda) {
    const abaixo = legendaDe(blocos[j + 1]);
    if (abaixo && !objetoDe(blocos[j + 2])) {
      legenda = abaixo;
      fim = j + 1;
    }
  }
  const fonte = fonteDe(blocos[fim + 1]);
  if (fonte !== null) fim++;
  const titulo = legenda?.titulo ?? "";
  if (estado.zona.tipo === "posTextual") estado.ilustracaoNoPosTextual = true;

  if (objeto.tipo === "tabela") {
    const lida = tabelaDe(objeto.no);
    const nome = titulo ? `A tabela “${titulo}”` : "Uma tabela sem legenda";
    if (!lida) {
      aviso(estado, `${nome}${onde(estado)} não tem texto e não entrou.`);
      return fim;
    }
    conteudo.push({ ...lida.tabela, legenda: titulo, fonte: fonte ?? "" });
    if (!legenda)
      aviso(estado, `Uma tabela${onde(estado)} veio sem legenda: escreva a legenda nela.`);
    else if (legenda.rotulo === "figura") {
      aviso(estado, `“${legenda.texto}” está acima de uma tabela e entrou como Tabela.`);
    } else if (!/^tabela$/i.test(legenda.palavra)) {
      aviso(
        estado,
        `“${legenda.texto}” entrou como Tabela: o AURA ainda não separa quadro de tabela.`,
      );
    }
    if (lida.mesclada) {
      aviso(
        estado,
        `${nome}${onde(estado)} tinha células mescladas, e elas entraram separadas: o AURA ainda não mescla células.`,
      );
    }
    if (lida.semCabecalho) {
      aviso(
        estado,
        `${nome}${onde(estado)} entrou sem linha de cabeçalho: marque o cabeçalho no AURA.`,
      );
    }
    return fim;
  }

  const { chaves } = objeto;
  chaves.forEach((chave, k) => {
    conteudo.push(
      figura(chave, k === 0 ? titulo : "", k === chaves.length - 1 ? (fonte ?? "") : ""),
    );
  });
  if (!legenda)
    aviso(estado, `Uma imagem${onde(estado)} veio sem legenda: escreva a legenda na figura.`);
  else if (legenda.rotulo === "tabela") {
    aviso(estado, `“${legenda.texto}” é uma imagem no Word e entrou como Figura.`);
  } else if (!/^figura$/i.test(legenda.palavra)) {
    aviso(estado, `“${legenda.texto}” entrou como Figura: o AURA chama toda ilustração de Figura.`);
  }
  if (chaves.length > 1) {
    aviso(
      estado,
      `${chaves.length} imagens lado a lado${onde(estado)} entraram como ${chaves.length} figuras, uma embaixo da outra.`,
    );
  }
  return fim;
}

// --- Títulos e zonas ---------------------------------------------------------

function abrirTitulo(estado: Estado, no: Elemento) {
  let titulo = normal(textoDe(no));
  if (!titulo) return;
  const semNumero = titulo.replace(NUMERACAO_DIGITADA, "");
  if (semNumero !== titulo) {
    estado.numeracoesRemovidas++;
    titulo = semNumero;
  }
  const nivelDoWord = nivelDe(no.tag);

  // Dentro de apêndice e anexo não há seção: o subtítulo vira parágrafo em
  // negrito, no lugar.
  if (estado.zona.tipo === "posTextual") {
    estado.zona.elemento.content.push({
      type: "paragraph",
      content: [{ type: "text", text: titulo, marks: [{ type: "negrito" }] }],
    });
    aviso(
      estado,
      `O subtítulo “${titulo}”${onde(estado)} entrou como parágrafo em negrito: apêndice e anexo não têm seções no AURA.`,
    );
    return;
  }
  if (estado.zona.tipo === "referencias" || estado.zona.tipo === "depois") {
    estado.zona = { tipo: "depois" };
    aviso(
      estado,
      `“${titulo}”, depois das referências, não tem lugar no AURA e não foi importado.`,
    );
    return;
  }

  const nivel = Math.min(nivelDoWord, 3) as NivelSecao;
  if (nivelDoWord > 3) {
    aviso(
      estado,
      `O título “${titulo}” está em Título ${nivelDoWord} e entrou como seção de nível 3, o último que o AURA tem.`,
    );
  }
  const secao = novaSecao(titulo, nivel);
  estado.secoes.push(secao);
  estado.zona = { tipo: "corpo", secao };
}

function abrirEspecial(estado: Estado, especial: Especial) {
  switch (especial.tipo) {
    case "resumo":
    case "abstract":
      estado.zona = { tipo: especial.tipo };
      return;
    case "referencias":
      estado.zona = { tipo: "referencias" };
      return;
    case "preIgnorado":
      estado.preIgnorados.push(especial.texto);
      estado.zona = { tipo: "ignorada" };
      return;
    case "apendice":
    case "anexo": {
      const elemento = novoPosTextual(especial.titulo);
      (especial.tipo === "apendice" ? estado.apendices : estado.anexos).push(elemento);
      estado.zona = { tipo: "posTextual", elemento };
      if (!especial.titulo) {
        aviso(
          estado,
          `${especial.tipo === "apendice" ? "Um apêndice" : "Um anexo"} veio sem título. Dê um título a ele no AURA.`,
        );
      }
      return;
    }
  }
}

// Bloco dentro do resumo ou do abstract: texto, ou a linha de palavras-chave,
// que fecha o elemento.
function guardarNoResumo(estado: Estado, no: NoHtmlColado) {
  // O resumo é texto simples: a nota que estiver nele não entra.
  for (const paragrafo of paragrafosDe(no, { textos: estado.notas.textos, usadas: new Set() })) {
    const texto = normal(textoDoParagrafo(paragrafo));
    const chave = PALAVRAS_CHAVE.exec(texto);
    const keywords = KEYWORDS.exec(texto);
    if (chave || keywords) {
      if (chave) estado.metadados.palavrasChave = termos(chave[1]);
      if (keywords) estado.metadados.keywords = termos(keywords[1]);
      // Depois das palavras-chave, o que vier até o próximo título não é
      // mais o resumo.
      estado.zona = estado.semTitulos ? { tipo: "inicio" } : { tipo: "ignorada" };
      continue;
    }
    if (estado.zona.tipo === "resumo") estado.resumo.push(texto);
    else if (estado.zona.tipo === "abstract") estado.abstract.push(texto);
    else conteudoAtual(estado)?.push(paragrafo);
  }
}

// Tudo o que não tem lugar fica contado, para o aviso do fim.
function ignorar(estado: Estado, no: NoHtmlColado) {
  if (no.tipo === "elemento" && no.tag === "table") return;
  const paragrafos = paragrafosDe(no, { textos: estado.notas.textos, usadas: new Set() }).length;
  if (estado.zona.tipo === "inicio") estado.antesDoPrimeiroTitulo += paragrafos;
  else if (estado.zona.tipo === "referencias") estado.paragrafosDeReferencias += paragrafos;
}

export function lerDocx(raiz: readonly NoHtmlColado[], opcoes: OpcoesLeituraDocx = {}): TexLido {
  const { blocos, notas } = separarNotas(raiz);

  const estado: Estado = {
    zona: { tipo: "inicio" },
    semTitulos: !blocos.some((no) => eTituloDoWord(no) && especialDe(no) === null),
    notas,
    secoes: [],
    apendices: [],
    anexos: [],
    resumo: [],
    abstract: [],
    metadados: {},
    avisos: [],
    antesDoPrimeiroTitulo: 0,
    preIgnorados: [],
    paragrafosDeReferencias: 0,
    itensDeLista: 0,
    numeracoesRemovidas: 0,
    chamadasDigitadas: 0,
    ilustracaoNoPosTextual: false,
  };

  for (let i = 0; i < blocos.length; i++) {
    const no = blocos[i];
    // Texto solto fora de parágrafo: o que o Word guarda de um campo (o
    // sumário já montado, por exemplo). Não é texto do aluno.
    if (no.tipo === "texto") continue;

    // Os títulos do que vem antes do texto só valem antes dele: depois, uma
    // seção chamada "Resumo" é uma seção.
    const especial = especialDe(no);
    const antesDoTexto =
      !estado.secoes.some((secao) => secao.titulo) && estado.zona.tipo !== "corpo";
    if (
      especial &&
      (especial.tipo === "referencias" ||
        especial.tipo === "apendice" ||
        especial.tipo === "anexo" ||
        antesDoTexto)
    ) {
      // Sem estilos de título, o título de um elemento que não entra fica no
      // texto, para a seção única não perder o lugar dele.
      if (especial.tipo === "preIgnorado" && estado.semTitulos) {
        estado.zona = { tipo: "inicio" };
        guardarConteudo(estado, no, secaoUnica(estado).content);
        continue;
      }
      abrirEspecial(estado, especial);
      continue;
    }

    if (eTituloDoWord(no)) {
      abrirTitulo(estado, no);
      continue;
    }

    if (estado.zona.tipo === "resumo" || estado.zona.tipo === "abstract") {
      if (no.tag !== "table") guardarNoResumo(estado, no);
      continue;
    }
    const conteudo = conteudoAtual(estado);
    if (conteudo) i = guardarBloco(estado, blocos, i, conteudo);
    else ignorar(estado, no);
  }

  avisosDoFim(estado);
  estado.avisos.push(...avisosDoMammoth(opcoes.mensagens ?? []));

  const temMetadados = Object.keys(estado.metadados).length > 0;
  return {
    origem: "externo",
    documentoId: null,
    versaoFormato: null,
    metadados: temMetadados ? estado.metadados : null,
    secoes: estado.secoes,
    apendices: estado.apendices,
    anexos: estado.anexos,
    chamadas: [],
    avisos: estado.avisos,
  };
}

function avisosDoFim(estado: Estado) {
  if (estado.resumo.length > 0) estado.metadados.resumo = estado.resumo.join(" ");
  if (estado.abstract.length > 0) estado.metadados.abstract = estado.abstract.join(" ");
  for (const [rotulo, paragrafos] of [
    ["O resumo", estado.resumo],
    ["O abstract", estado.abstract],
  ] as const) {
    if (paragrafos.length > 1) {
      aviso(
        estado,
        `${rotulo} tinha ${paragrafos.length} parágrafos e entrou num só: a NBR 6028 pede parágrafo único.`,
      );
    }
  }

  if (estado.semTitulos && estado.secoes.length > 0) {
    aviso(
      estado,
      "O arquivo não usa os estilos de Título do Word, e o texto entrou numa seção só, sem título, com a capa e o sumário digitados junto, se houver. Aplique Título 1, 2 e 3 nos títulos no Word e importe de novo, ou crie as seções no AURA.",
    );
  }
  if (estado.antesDoPrimeiroTitulo > 0) {
    aviso(
      estado,
      `${estado.antesDoPrimeiroTitulo === 1 ? "Um parágrafo" : `${estado.antesDoPrimeiroTitulo} parágrafos`} antes do primeiro título (capa, folha de rosto) não ${estado.antesDoPrimeiroTitulo === 1 ? "foi importado" : "foram importados"}: o AURA monta capa e folhas com os dados do trabalho.`,
    );
  }
  if (estado.preIgnorados.length > 0) {
    aviso(
      estado,
      `Não ${estado.preIgnorados.length === 1 ? "foi importado" : "foram importados"}: ${estado.preIgnorados.join(", ")}. O AURA refaz sumário e listas sozinho; dedicatória, agradecimentos e epígrafe se escrevem em Elementos opcionais.`,
    );
  }
  if (estado.paragrafosDeReferencias > 0) {
    aviso(
      estado,
      `A lista de referências (${estado.paragrafosDeReferencias} ${estado.paragrafosDeReferencias === 1 ? "parágrafo" : "parágrafos"}) não foi convertida: o AURA guarda cada referência em campos, e não lê texto já formatado. Cadastre as referências (ou importe um .bib) no painel Referências.`,
    );
  }
  if (estado.chamadasDigitadas > 0) {
    aviso(
      estado,
      `${estado.chamadasDigitadas === 1 ? "Uma citação digitada" : `${estado.chamadasDigitadas} citações digitadas`}, como “(Autor, ano)”, ${estado.chamadasDigitadas === 1 ? "entrou" : "entraram"} como texto. No AURA a chamada vem da referência: ligue cada citação com o botão de citação.`,
    );
  }
  if (estado.numeracoesRemovidas > 0) {
    aviso(
      estado,
      `A numeração digitada em ${estado.numeracoesRemovidas === 1 ? "um título saiu" : `${estado.numeracoesRemovidas} títulos saiu`}: o AURA numera as seções sozinho.`,
    );
  }
  if (estado.itensDeLista > 0) {
    aviso(
      estado,
      `As listas (${estado.itensDeLista} ${estado.itensDeLista === 1 ? "item" : "itens"}) viraram um parágrafo por item: o AURA ainda não tem lista.`,
    );
  }
  const notasDeFora = estado.notas.textos.size - estado.notas.usadas.size;
  if (notasDeFora > 0) {
    aviso(
      estado,
      `${notasDeFora === 1 ? "Uma nota de rodapé ficou" : `${notasDeFora} notas de rodapé ficaram`} de fora: no AURA, a nota só entra no texto da seção, do apêndice ou do anexo, e não num título, no resumo ou numa tabela.`,
    );
  }
  if (estado.ilustracaoNoPosTextual) {
    aviso(
      estado,
      "As figuras e tabelas de apêndice e anexo entraram no trabalho, mas o AURA ainda não as mostra no editor nem as exporta.",
    );
  }
}

// --- O que o mammoth não leu -------------------------------------------------

const ELEMENTO_IGNORADO = /^An unrecognised element was ignored: (?:\{[^}]*\})?(\S+)/;

// Só o que perde conteúdo vira aviso. Estilo que o mammoth não conhece é o
// caso de quase todo parágrafo (o `Corpo` do AURA, por exemplo) e não perde
// nada; o campo simples (`w:fldSimple`) é o número das legendas do AURA, que
// o AURA recalcula.
function avisosDoMammoth(mensagens: readonly string[]): Aviso[] {
  const elementos = new Set(
    mensagens.flatMap((mensagem) => ELEMENTO_IGNORADO.exec(mensagem)?.[1] ?? []),
  );
  elementos.delete("w:fldSimple");
  const avisos: Aviso[] = [];
  const equacoes = [elementos.delete("oMath"), elementos.delete("oMathPara")].includes(true);
  if (equacoes) {
    avisos.push({
      arquivo: "",
      linha: 0,
      mensagem:
        "O arquivo tem equações do Word, e o AURA não as lê: elas não vieram. Recrie cada uma com o botão de fórmula.",
    });
  }
  if (elementos.size > 0) {
    avisos.push({
      arquivo: "",
      linha: 0,
      mensagem:
        "O arquivo tem elementos que o AURA não lê (caixas de texto, desenhos ou objetos incorporados), e eles não vieram.",
    });
  }
  return avisos;
}
