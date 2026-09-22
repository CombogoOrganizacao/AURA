// BibTeX → CSL-JSON — passo 4.6, segunda metade. Recebe as entradas cruas de
// `lerBibtex()` e devolve `Referencia` nos seis tipos da v1 (types.ts), ou o
// motivo de não ter conseguido.
//
// **Três saídas, nenhuma silenciosa.** Cada entrada do arquivo termina em
// exatamente um lugar: `importadas` (com os `avisos` do que o mapeamento teve
// que supor), `descartadas` (com o motivo) ou, se nem a sintaxe fechou,
// `erros`. A prévia do 4.7 mostra as três — a pessoa decide o que entra, e
// uma referência que sumiu sem explicação é pior do que uma que não entrou.
//
// **O `.bib` é mais pobre que o dado do AURA**, e o mapeamento não inventa o
// que falta. BibTeX guarda "Título: subtítulo" num campo só, não diz se o
// `editor` de uma coletânea é organizador ou coordenador, e não separa o nome
// do evento do título dos anais. Onde há convenção razoável, ela é aplicada e
// marcada `CONVENÇÃO`; onde a suposição pode estar errada, vira aviso.

import type {
  CSLDate,
  CSLName,
  Edicao,
  Referencia,
  ReferenciaArtigo,
  ReferenciaCapitulo,
  ReferenciaEvento,
  ReferenciaLivro,
  ReferenciaSite,
  ReferenciaTese,
  TipoParticipacao,
} from "../types";
import {
  decodificarLatex,
  dividirNoNivelZero,
  lerBibtex,
  type EntradaBibtex,
  type ErroBibtex,
} from "./bibtex";

export interface ReferenciaImportada {
  // Chave de citação do `.bib` (`freire1987`). Não vira o `id` — ela só é
  // única dentro de um arquivo, e dois arquivos importados no mesmo documento
  // colidiriam. Fica para a prévia mostrar de onde a referência veio.
  chave: string;
  linha: number;
  referencia: Referencia;
  avisos: string[];
}

export interface EntradaDescartada {
  chave: string;
  tipo: string;
  linha: number;
  motivo: string;
}

export interface ResultadoImportacao {
  importadas: ReferenciaImportada[];
  descartadas: EntradaDescartada[];
  erros: ErroBibtex[];
}

// `gerarId` vem de fora pelo mesmo motivo de `novaReferencia(tipo, id)`:
// `crypto.randomUUID()` é do chamador, e o teste passa um contador.
export function importarBibtex(fonte: string, gerarId: () => string): ResultadoImportacao {
  const { entradas, erros } = lerBibtex(fonte);
  const importadas: ReferenciaImportada[] = [];
  const descartadas: EntradaDescartada[] = [];

  for (const entrada of entradas) {
    const origem = { chave: entrada.chave, linha: entrada.linha };
    try {
      const convertida = converterEntrada(entrada, gerarId);
      if ("motivo" in convertida) {
        descartadas.push({ ...origem, tipo: entrada.tipo, motivo: convertida.motivo });
      } else {
        importadas.push({ ...origem, ...convertida });
      }
    } catch {
      // Defesa contra o caso não previsto: um arquivo de fora não pode
      // derrubar a importação das outras entradas por um bug nosso.
      descartadas.push({
        ...origem,
        tipo: entrada.tipo,
        motivo: "Não foi possível converter esta entrada.",
      });
    }
  }

  return { importadas, descartadas, erros };
}

type Conversao = { referencia: Referencia; avisos: string[] } | { motivo: string };

export function converterEntrada(entrada: EntradaBibtex, gerarId: () => string): Conversao {
  const campo = leitorDeCampos(entrada.campos);
  const avisos: string[] = [];

  const titulo = tituloESubtitulo(entrada.campos.title, campo("subtitle"));
  if (!titulo.title) return { motivo: "Entrada sem título (title)." };

  const autores = nomes(entrada.campos.author, avisos, "autores");
  const base = {
    id: gerarId(),
    author: autores,
    ...titulo,
    issued: dataDePublicacao(campo("date"), campo("year"), campo("month")),
    URL: endereco(entrada.campos),
    accessed: dataIso(campo("urldate")),
  };

  switch (entrada.tipo) {
    case "book": {
      if (!autores && entrada.campos.editor) {
        avisos.push(
          "O .bib traz só editor, sem autor. Livro no AURA não tem campo de organizador: confira a autoria.",
        );
      }
      const referencia: ReferenciaLivro = {
        ...base,
        type: "book",
        edicao: edicao(campo, avisos),
        publisher: campo("publisher"),
        "publisher-place": campo("address") ?? campo("location"),
        translator: nomes(entrada.campos.translator, avisos, "tradutores"),
        volume: campo("volume"),
      };
      return { referencia: limpar(referencia), avisos };
    }

    case "article": {
      const periodico = campo("journal") ?? campo("journaltitle");
      if (!periodico) return { motivo: "Artigo sem o nome do periódico (journal)." };
      const referencia: ReferenciaArtigo = {
        ...base,
        type: "article-journal",
        "container-title": periodico,
        "publisher-place": campo("address") ?? campo("location"),
        volume: campo("volume"),
        issue: campo("number") ?? campo("issue"),
        page: paginas(campo("pages")),
      };
      return { referencia: limpar(referencia), avisos };
    }

    case "incollection":
    case "inbook": {
      // No BibTeX clássico, `@inbook` é o LIVRO no `title` e a parte em
      // `chapter`; no biblatex, é a parte no `title` e o livro em `booktitle`.
      let parte = titulo;
      let livro = campo("booktitle");
      if (!livro && entrada.tipo === "inbook" && campo("chapter")) {
        livro = decodificarLatex(entrada.campos.title);
        parte = tituloESubtitulo(entrada.campos.chapter, undefined);
      }
      if (!livro) return { motivo: "Capítulo sem o título do livro (booktitle)." };
      const livroSeparado = tituloESubtitulo(livro, undefined);

      const referencia: ReferenciaCapitulo = {
        ...base,
        title: parte.title,
        subtitle: parte.subtitle,
        type: "chapter",
        "container-title": livroSeparado.title,
        "container-subtitle": livroSeparado.subtitle,
        responsabilidade: responsabilidade(entrada.campos, avisos),
        edicao: edicao(campo, avisos),
        publisher: campo("publisher"),
        "publisher-place": campo("address") ?? campo("location"),
        page: paginas(campo("pages")),
      };
      return { referencia: limpar(referencia), avisos };
    }

    case "inproceedings":
    case "conference": {
      // `CONVENÇÃO` — o BibTeX clássico não separa o nome do evento (§7.8.4.1,
      // o que sai em maiúsculas depois do "In:") do título dos anais. O
      // biblatex tem `eventtitle`; sem ele, `booktitle` faz o papel de nome
      // do evento, que é o elemento essencial dos dois.
      const nomeEvento = campo("eventtitle") ?? campo("booktitle");
      if (!nomeEvento) return { motivo: "Trabalho em evento sem o nome do evento (booktitle)." };
      if (!campo("eventtitle")) {
        avisos.push(
          "O nome do evento veio de booktitle, que no .bib costuma ser o título dos anais: confira.",
        );
      }
      const referencia: ReferenciaEvento = {
        ...base,
        type: "paper-conference",
        "event-title": nomeEvento,
        "event-place": campo("venue"),
        "event-date": dataIso(campo("eventdate")),
        "container-title": campo("eventtitle") ? campo("booktitle") : undefined,
        publisher: campo("publisher") ?? campo("organization"),
        "publisher-place": campo("address") ?? campo("location"),
        page: paginas(campo("pages")),
      };
      return { referencia: limpar(referencia), avisos };
    }

    case "phdthesis":
    case "mastersthesis":
    case "thesis": {
      const referencia: ReferenciaTese = {
        ...base,
        type: "thesis",
        ...trabalhoAcademico(entrada.tipo, campo("type"), avisos),
        publisher: campo("school") ?? campo("institution"),
        "publisher-place": campo("address") ?? campo("location"),
        orientador: nomes(
          entrada.campos.advisor ?? entrada.campos.supervisor,
          avisos,
          "orientadores",
        ),
        extensao: folhas(campo("pagetotal")),
      };
      return { referencia: limpar(referencia), avisos };
    }

    case "misc":
    case "online":
    case "electronic":
    case "www": {
      // Dos seis tipos, o único que um `@misc` pode ser sem mentir é o site —
      // e só quando tem endereço. Sem URL, forçá-lo em "livro" daria uma
      // referência com cara de conformidade e dado errado.
      if (!base.URL) {
        return {
          motivo: `@${entrada.tipo} sem endereço (url) não corresponde a nenhum dos seis tipos do AURA.`,
        };
      }
      const referencia: ReferenciaSite = {
        ...base,
        type: "webpage",
        URL: base.URL,
        "container-title": campo("organization") ?? campo("publisher"),
      };
      return { referencia: limpar(referencia), avisos };
    }

    default:
      return {
        motivo: `O tipo @${entrada.tipo} não tem correspondente entre os seis tipos do AURA.`,
      };
  }
}

// --- campos ------------------------------------------------------------------

type LeitorDeCampos = (nome: string) => string | undefined;

// Valor decodificado, ou `undefined` se ausente ou vazio — nunca `""`, que o
// formatador trataria como elemento presente.
function leitorDeCampos(campos: Record<string, string>): LeitorDeCampos {
  return (nome) => {
    const cru = Object.hasOwn(campos, nome) ? campos[nome] : undefined;
    if (cru === undefined) return undefined;
    const valor = decodificarLatex(cru);
    return valor || undefined;
  };
}

// `CONVENÇÃO` — o BibTeX não tem subtítulo; a prática é "Título: subtítulo"
// no `title`. Separar no primeiro dois-pontos em nível zero é o que permite o
// destaque parar onde a §6.7 manda. Um dois-pontos que faz parte do título
// vem protegido por chaves (`{A: B}`), e o `subtitle` do biblatex, quando
// existe, vence.
function tituloESubtitulo(
  cru: string | undefined,
  subtitulo: string | undefined,
): { title: string; subtitle?: string } {
  if (cru === undefined) return { title: "" };
  if (subtitulo) return { title: decodificarLatex(cru), subtitle: subtitulo };

  const [antes, ...depois] = dividirNoNivelZero(cru, /:/);
  const title = decodificarLatex(antes);
  const subtitle = decodificarLatex(depois.join(":"));
  if (!title || !subtitle) return { title: decodificarLatex(cru) };
  return { title, subtitle };
}

function endereco(campos: Record<string, string>): string | undefined {
  if (campos.url) return decodificarUrl(campos.url);
  // Google Acadêmico e exportações antigas põem o endereço em `howpublished`,
  // dentro de `\url{...}`.
  const emHowpublished = campos.howpublished?.match(/\\url\{([^}]*)\}/);
  return emHowpublished ? decodificarUrl(emHowpublished[1]) : undefined;
}

// URL não passa por `decodificarLatex`: `~` e `--` são texto em endereço, não
// espaço e travessão. Só o escape de `%`, `_`, `&` e `#` sai.
function decodificarUrl(cru: string): string | undefined {
  const url = cru.replace(/\\([%_&#~])/g, "$1").trim();
  return url || undefined;
}

function paginas(valor: string | undefined): string | undefined {
  // "45--67" → decodificado "45–67" → "45-67", a forma da §8.9 ("p. 45-67").
  return valor?.replace(/\s*[-–—]+\s*/g, "-");
}

function folhas(valor: string | undefined): ReferenciaTese["extensao"] {
  const quantidade = valor ? Number.parseInt(valor, 10) : Number.NaN;
  return Number.isFinite(quantidade) && quantidade > 0
    ? { quantidade, unidade: "folha" }
    : undefined;
}

// --- nomes -------------------------------------------------------------------

// Grau de parentesco entra no sobrenome (NBR 6023:2025 §8.1.1.3: ASSAF NETO).
const PARENTESCO = new Set([
  "filho",
  "filha",
  "neto",
  "neta",
  "sobrinho",
  "sobrinha",
  "júnior",
  "junior",
  "jr",
  "jr.",
]);

function nomes(cru: string | undefined, avisos: string[], rotulo: string): CSLName[] | undefined {
  if (!cru) return undefined;
  const lista: CSLName[] = [];
  for (const pedaco of dividirNoNivelZero(cru.trim(), /\s+and\s+/i)) {
    const nome = pedaco.trim();
    if (!nome) continue;
    if (nome.toLowerCase() === "others") {
      // §8.1.1.2: com quatro ou mais, "convém indicar todos" — o `et al.` é
      // permissão da norma, e o `.bib` que o usa escondeu nomes.
      avisos.push(`A lista de ${rotulo} termina em "and others": faltam nomes, complete à mão.`);
      continue;
    }
    const convertido = nomeUnico(nome);
    if (convertido) lista.push(convertido);
  }
  return lista.length > 0 ? lista : undefined;
}

function nomeUnico(cru: string): CSLName | undefined {
  // Nome inteiro entre UM par de chaves é entidade (`{Associação Brasileira
  // de Normas Técnicas}`): o BibTeX o protege exatamente para não ser
  // invertido, que é o mesmo que a 6023 pede para autoria corporativa.
  if (/^\{[\s\S]*\}$/.test(cru) && dividirNoNivelZero(cru.slice(1, -1), /\}/).length === 1) {
    const literal = decodificarLatex(cru);
    return literal ? { literal } : undefined;
  }

  const partes = dividirNoNivelZero(cru, /,/).map((parte) => parte.trim());
  let sobrenome: string[];
  let prenome: string[];

  if (partes.length === 1) {
    // "Prenome Sobrenome". O último token é o sobrenome — com o grau de
    // parentesco, os dois últimos.
    const tokens = palavras(partes[0]);
    const corte =
      tokens.length >= 3 && PARENTESCO.has(decodificarLatex(tokens.at(-1)!).toLowerCase())
        ? tokens.length - 2
        : tokens.length - 1;
    sobrenome = tokens.slice(corte);
    prenome = tokens.slice(0, corte);
  } else {
    // "Sobrenome, Prenome" ou "Sobrenome, Jr, Prenome".
    sobrenome = palavras(partes[0]);
    if (partes.length >= 3) sobrenome.push(...palavras(partes[1]));
    prenome = palavras(partes.at(-1)!);
  }

  // `CONVENÇÃO` — partícula em minúscula no começo do sobrenome ("da Silva",
  // "van Gogh") passa para depois do prenome: SILVA, João da. É a entrada
  // usual para sobrenome brasileiro e português; a 6023 §8.1.1.3 trata o
  // prefixo caso a caso, e o formulário permite corrigir.
  while (sobrenome.length > 1 && /^\p{Ll}/u.test(decodificarLatex(sobrenome[0]))) {
    prenome.push(sobrenome.shift()!);
  }

  const family = decodificarLatex(sobrenome.join(" "));
  const given = decodificarLatex(prenome.join(" "));
  if (!family && !given) return undefined;
  return limpar({ family: family || undefined, given: given || undefined });
}

function palavras(texto: string): string[] {
  return dividirNoNivelZero(texto.trim(), /\s+/).filter(Boolean);
}

// Quem responde pelo livro de um capítulo (§8.1.1.4). O biblatex diz o papel
// em `editortype`; o BibTeX clássico, não — e aí "editor" é o que o arquivo
// afirma, com aviso, porque em livro brasileiro o comum é organizador.
function responsabilidade(
  campos: Record<string, string>,
  avisos: string[],
): ReferenciaCapitulo["responsabilidade"] {
  const lista = nomes(campos.editor, avisos, "responsáveis pelo livro");
  if (!lista) return undefined;

  const PAPEIS: Record<string, TipoParticipacao> = {
    editor: "editor",
    organizer: "organizador",
    compiler: "compilador",
    coordinator: "coordenador",
  };
  const declarado = campos.editortype?.trim().toLowerCase();
  const tipo = declarado && Object.hasOwn(PAPEIS, declarado) ? PAPEIS[declarado] : undefined;
  if (!tipo) {
    avisos.push(
      "O .bib não diz o papel do responsável pelo livro; entrou como editor (ed.). Troque se for organizador.",
    );
  }
  return { nomes: lista, tipo: tipo ?? "editor" };
}

// --- tese --------------------------------------------------------------------

function trabalhoAcademico(
  tipoEntrada: string,
  tipoDeclarado: string | undefined,
  avisos: string[],
): Pick<ReferenciaTese, "tipoTrabalho" | "grau"> {
  // O `@thesis` do biblatex diz o grau no `type`, com palavra-chave.
  const chave = tipoDeclarado?.toLowerCase();
  const doutorado = tipoEntrada === "phdthesis" || chave === "phdthesis";
  const mestrado =
    tipoEntrada === "mastersthesis" || chave === "mathesis" || chave === "mastersthesis";
  const padrao = doutorado
    ? { tipoTrabalho: "Tese", grau: "Doutorado" }
    : mestrado
      ? { tipoTrabalho: "Dissertação", grau: "Mestrado" }
      : undefined;

  // `type` em texto livre ("Trabalho de Conclusão de Curso") é o que o
  // arquivo afirma e vence o padrão. Se já traz os parênteses ("Tese
  // (Doutorado em X)"), o grau está dentro dele e não se repete.
  const livre = chave && !["phdthesis", "mathesis", "mastersthesis"].includes(chave);
  if (livre) {
    return tipoDeclarado!.includes("(") || !padrao
      ? { tipoTrabalho: tipoDeclarado! }
      : { tipoTrabalho: tipoDeclarado!, grau: padrao.grau };
  }
  if (padrao) return padrao;

  avisos.push("O .bib não diz o tipo do trabalho (tese, dissertação, TCC): preencha à mão.");
  return { tipoTrabalho: "Trabalho acadêmico" };
}

// --- edição ------------------------------------------------------------------

const ORDINAIS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};

const IDIOMAS: Record<string, string> = {
  english: "en",
  american: "en",
  british: "en",
  en: "en",
  portuguese: "pt",
  portugues: "pt",
  brazil: "pt",
  brazilian: "pt",
  pt: "pt",
  "pt-br": "pt",
  spanish: "es",
  es: "es",
  french: "fr",
  fr: "fr",
  german: "de",
  ngerman: "de",
  de: "de",
  italian: "it",
  it: "it",
};

function edicao(campo: LeitorDeCampos, avisos: string[]): Edicao | undefined {
  const valor = campo("edition");
  if (!valor) return undefined;

  const numero = /^\d+/.test(valor)
    ? Number.parseInt(valor, 10)
    : ORDINAIS[valor.toLowerCase().replace(/\s*(ed\.?|edition)$/, "")];
  if (!numero) {
    avisos.push(`Edição "${valor}" não reconhecida: preencha à mão.`);
    return undefined;
  }
  // Primeira edição não se declara (§8.3) — ausente é "não declarada".
  if (numero === 1) return undefined;

  const declarado = (campo("langid") ?? campo("language"))?.toLowerCase();
  const idioma = declarado && Object.hasOwn(IDIOMAS, declarado) ? IDIOMAS[declarado] : undefined;
  return limpar({ numero, idioma });
}

// --- datas -------------------------------------------------------------------

const MESES: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function mes(valor: string | undefined): number | undefined {
  if (!valor) return undefined;
  const texto = valor.toLowerCase().replace(/\.$/, "");
  const numero = /^\d{1,2}$/.test(texto) ? Number(texto) : undefined;
  if (numero && numero >= 1 && numero <= 12) return numero;
  // Abreviado ("Mar", "set") casa pelo prefixo de três letras.
  for (const [nome, n] of Object.entries(MESES)) {
    if (texto.length >= 3 && nome.startsWith(texto)) return n;
  }
  return undefined;
}

function dataDePublicacao(
  date: string | undefined,
  year: string | undefined,
  month: string | undefined,
): CSLDate | undefined {
  // `date` do biblatex é ISO e vence `year`/`month`.
  const iso = dataIso(date);
  if (iso) return iso;
  if (!year) return undefined;
  if (!/^\d{4}$/.test(year)) {
    // "no prelo", "[199-]", "2020/2021": a fonte não tem a precisão de um
    // número, e forçá-la inventaria (types.ts, `CSLDate.raw`).
    return { raw: year };
  }
  const m = mes(month);
  return { "date-parts": [m ? [Number(year), m] : [Number(year)]] };
}

function dataIso(valor: string | undefined): CSLDate | undefined {
  if (!valor) return undefined;
  const iso = valor.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!iso) return { raw: valor };
  const [ano, m, d] = iso.slice(1).map((parte) => (parte ? Number(parte) : undefined));
  const partes: [number, number?, number?] =
    d !== undefined ? [ano!, m, d] : m !== undefined ? [ano!, m] : [ano!];
  return { "date-parts": [partes] };
}

// --- utilidade ---------------------------------------------------------------

// Tira as chaves `undefined`: o objeto guardado no IndexedDB fica com a mesma
// forma do que o formulário (4.2) cria, sem campo presente e vazio.
function limpar<T extends object>(objeto: T): T {
  return Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined)) as T;
}
