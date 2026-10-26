import type { Marca, NivelSecao, NoParagrafo, NoTexto } from "../../document/types";
import { mapearHtmlColado, type NoHtmlColado } from "../../editor/paste";
import type { BlocoLido } from "../latex/blocos";
import type { Aviso } from "../latex/fonte";
import type { MetadadosLidos, PosTextualLido, SecaoLida, TexLido } from "../latex/lerTex";
import { CLASSE } from "./estilos";

// Leitor do `.docx` (passo 8.7.1, docs/to-do-correcoes.md). Recebe o HTML que
// o mammoth fez do arquivo, já na árvore neutra da colagem (`NoHtmlColado`,
// montada no navegador por `src/lib/lerDocx.ts`), e devolve o que o arquivo
// diz na mesma forma da leitura do `.tex` (`TexLido`). Comparar com o
// trabalho de destino, montar o relatório e aplicar é de
// `import/latex/reimport.ts`, o mesmo da importação de LaTeX: o mesmo
// relatório, os mesmos destinos, a mesma versão "Antes da reimportação".
//
// **O texto passa pela regra da colagem.** Cada parágrafo vira nó do editor
// por `mapearHtmlColado()` (src/core/editor/paste.ts): só texto, negrito e
// itálico. Nenhum HTML do arquivo chega ao documento (CLAUDE.md, "Segurança").
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

// --- Texto -------------------------------------------------------------------

function textoDe(no: NoHtmlColado): string {
  return no.tipo === "texto" ? no.texto : no.filhos.map(textoDe).join("");
}

function normal(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

function mesmasMarcas(a: NoTexto, b: NoTexto): boolean {
  const tipos = (no: NoTexto) =>
    (no.marks ?? [])
      .map((marca) => marca.type)
      .sort()
      .join();
  return tipos(a) === tipos(b);
}

// O espaço do Word como o editor o guarda: espaços seguidos viram um (o
// tabulador do recuo também), as pontas saem, e trechos vizinhos com as
// mesmas marcas se juntam.
function limparInline(nos: readonly NoTexto[]): NoTexto[] {
  const saida: NoTexto[] = [];
  for (const no of nos) {
    let texto = no.text.replace(/\s+/g, " ");
    const anterior = saida.at(-1);
    if (anterior?.text.endsWith(" ")) texto = texto.replace(/^ /, "");
    if (!texto) continue;
    if (anterior && mesmasMarcas(anterior, no)) anterior.text += texto;
    else
      saida.push(
        no.marks ? { type: "text", text: texto, marks: no.marks } : { type: "text", text: texto },
      );
  }
  if (saida[0]) saida[0].text = saida[0].text.trimStart();
  const ultimo = saida.at(-1);
  if (ultimo) ultimo.text = ultimo.text.trimEnd();
  return saida.filter((no) => no.text.length > 0);
}

// Os parágrafos de um bloco do HTML, pela regra da colagem. Um `<br>` do
// Word (quebra de linha manual) separa parágrafos, como na colagem.
function paragrafosDe(no: NoHtmlColado): NoParagrafo[] {
  return mapearHtmlColado([no]).flatMap((paragrafo): NoParagrafo[] => {
    const content = limparInline(
      (paragrafo.content ?? []).map((texto) => ({
        type: "text" as const,
        text: texto.text ?? "",
        ...(texto.marks ? { marks: texto.marks as Marca[] } : {}),
      })),
    );
    return content.length > 0 ? [{ type: "paragraph", content }] : [];
  });
}

function textoDoParagrafo(paragrafo: NoParagrafo): string {
  return (paragrafo.content ?? []).map((no) => (no.type === "text" ? no.text : "")).join("");
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
  tabelas: number;
  imagens: number;
}

function aviso(estado: Estado, mensagem: string) {
  estado.avisos.push({ arquivo: "", linha: 0, mensagem });
}

// Onde o aviso aconteceu, para o aluno achar no arquivo.
function onde(estado: Estado): string {
  const { zona } = estado;
  if (zona.tipo === "corpo") return zona.secao.titulo ? ` em “${zona.secao.titulo}”` : "";
  if (zona.tipo === "posTextual")
    return zona.elemento.titulo ? ` em “${zona.elemento.titulo}”` : "";
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

// Notas de rodapé: o mammoth põe a chamada como `<sup><a href="#footnote-1">`
// e o texto numa lista no fim. Ainda não entram no documento.
function eChamadaDeNota(no: NoHtmlColado): boolean {
  return (
    no.tipo === "elemento" &&
    no.tag === "sup" &&
    no.filhos.some(
      (filho) =>
        filho.tipo === "elemento" &&
        filho.tag === "a" &&
        /^#(footnote|endnote)-/.test(filho.atributos?.href ?? ""),
    )
  );
}

function eListaDeNotas(no: NoHtmlColado): boolean {
  return (
    no.tipo === "elemento" &&
    no.tag === "ol" &&
    no.filhos.length > 0 &&
    no.filhos.every(
      (item) => item.tipo === "elemento" && /^(footnote|endnote)-/.test(item.atributos?.id ?? ""),
    )
  );
}

function semChamadasDeNota(no: NoHtmlColado): NoHtmlColado {
  if (no.tipo === "texto") return no;
  return {
    ...no,
    filhos: no.filhos.filter((filho) => !eChamadaDeNota(filho)).map(semChamadasDeNota),
  };
}

function contarImagens(no: NoHtmlColado): number {
  if (no.tipo === "texto") return 0;
  return (
    (no.tag === "img" ? 1 : 0) + no.filhos.reduce((soma, filho) => soma + contarImagens(filho), 0)
  );
}

function contarItens(no: NoHtmlColado): number {
  if (no.tipo === "texto") return 0;
  return (
    (no.tag === "li" ? 1 : 0) + no.filhos.reduce((soma, filho) => soma + contarItens(filho), 0)
  );
}

// Entra no conteúdo da seção (ou do apêndice) o que o bloco tem de texto.
function guardarConteudo(estado: Estado, no: NoHtmlColado, conteudo: BlocoLido[]) {
  if (no.tipo === "elemento" && (no.tag === "ul" || no.tag === "ol")) {
    estado.itensDeLista += contarItens(no);
  }
  const imagens = contarImagens(no);
  if (imagens > 0) {
    estado.imagens += imagens;
    aviso(
      estado,
      `${imagens === 1 ? "Uma imagem" : `${imagens} imagens`}${onde(estado)} ainda não ${imagens === 1 ? "vem" : "vêm"} do .docx.`,
    );
  }
  const citacaoLonga = no.tipo === "elemento" && no.classe === CLASSE.citacaoLonga;
  for (const paragrafo of paragrafosDe(no)) {
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

function abrirTitulo(estado: Estado, no: Extract<NoHtmlColado, { tipo: "elemento" }>) {
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
  for (const paragrafo of paragrafosDe(no)) {
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
  const paragrafos = paragrafosDe(no).length;
  if (estado.zona.tipo === "inicio") estado.antesDoPrimeiroTitulo += paragrafos;
  else if (estado.zona.tipo === "referencias") estado.paragrafosDeReferencias += paragrafos;
}

export function lerDocx(raiz: readonly NoHtmlColado[], opcoes: OpcoesLeituraDocx = {}): TexLido {
  const notas = raiz.filter(eListaDeNotas).reduce((soma, lista) => soma + contarItens(lista), 0);
  const blocos = raiz.filter((no) => !eListaDeNotas(no)).map(semChamadasDeNota);

  const estado: Estado = {
    zona: { tipo: "inicio" },
    semTitulos: !blocos.some((no) => eTituloDoWord(no) && especialDe(no) === null),
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
    tabelas: 0,
    imagens: 0,
  };

  for (const no of blocos) {
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

    if (no.tag === "table") {
      estado.tabelas++;
      aviso(estado, `Uma tabela${onde(estado)} ainda não vem do .docx.`);
      continue;
    }

    if (estado.zona.tipo === "resumo" || estado.zona.tipo === "abstract") {
      guardarNoResumo(estado, no);
      continue;
    }
    const conteudo = conteudoAtual(estado);
    if (conteudo) guardarConteudo(estado, no, conteudo);
    else ignorar(estado, no);
  }

  // --- Metadados e avisos do fim ---
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
  if (notas > 0) {
    aviso(
      estado,
      notas === 1
        ? "A nota de rodapé ainda não vem do .docx."
        : `As ${notas} notas de rodapé ainda não vêm do .docx.`,
    );
  }
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
