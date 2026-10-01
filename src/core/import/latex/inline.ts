import { MATEMATICA } from "../../export/latex/escape";
import type {
  AtributosCitacao,
  FonteOriginal,
  Marca,
  NoInline,
  NoTexto,
} from "../../document/types";
import { ACENTOS, acentuar, SIMBOLOS as SIMBOLOS_DO_BIB } from "../../references/import/bibtex";
import {
  fechaChave,
  fimDosArgumentos,
  lerGrupo,
  lerNomeDeComando,
  lerOpcional,
  type Aviso,
  type Fonte,
  type Grupo,
} from "./fonte";
import {
  marcadorDeReferencia,
  REFERENCIAS_RESOLUVEIS,
  type ReferenciaCruzadaLida,
} from "./rotulos";

// Inline do `.tex` para o schema: o caminho inverso de
// `trechoLatex()`/`parteLatex()` e de `escaparLatex()` (export/latex/), passo
// 6.2.4, e o LaTeX comum de um TCC que não saiu do AURA, passo 6.2.5
// (docs/latex-abntex.md §1.5 e §1.6).
//
// **Nada é expandido nem executado.** O que o leitor não conhece volta como o
// texto que estava no arquivo, com aviso e a linha: `\hl{x}` entra no
// parágrafo como "\hl{x}". O que só muda a forma (espaçamento, quebra de
// página, tamanho de letra) some: a forma do trabalho é do AURA.

// Uma chamada de citação como estava no arquivo. A chamada é derivada e o
// AURA a recalcula (princípio 3); a lista existe para o relatório dizer
// quando ela foi editada à mão no Overleaf.
export interface ChamadaLida {
  arquivo: string;
  linha: number;
  citacao: Pick<AtributosCitacao, "refId" | "pagina"> & { apud?: FonteOriginal | null };
  texto: string;
}

export interface ContextoInline {
  fonte: Fonte;
  avisos: Aviso[];
  chamadas: ChamadaLida[];
  // Chaves de referência que o `\cite` do aluno pode usar.
  chaves: ReadonlySet<string>;
  // `\ref` e parentes lidos, na ordem: o texto leva um marcador no lugar de
  // cada um, trocado pelo número no fim da leitura (`rotulos.ts`, 6.2.9).
  referencias: ReferenciaCruzadaLida[];
  // Grupos abertos agora, entre todos os leitores do contexto: `textoPlano()`
  // abre outro leitor no meio de um grupo.
  profundidade: number;
}

// --- Tokens ------------------------------------------------------------------

interface Estado {
  negrito: boolean;
  italico: boolean;
  citacao: AtributosCitacao | null;
}

type TokenTexto = { tipo: "texto"; texto: string; estado: Estado };

type Token =
  | TokenTexto
  | { tipo: "nota"; texto: string }
  | {
      tipo: "cite";
      comando: string;
      chaves: string[];
      pagina: string | null;
      bruto: string;
      pos: number;
      estado: Estado;
    };

const SEM_MARCA: Estado = { negrito: false, italico: false, citacao: null };

// Símbolos por nome. Os quatro primeiros são os escapes de `escaparLatex()`;
// o resto, o que um `.tex` escrito à mão costuma trazer. O `{}` que vem
// depois (`\textbackslash{}`, `\LaTeX{}`) é consumido junto.
const SIMBOLOS: Record<string, string> = {
  ...SIMBOLOS_DO_BIB,
  textbackslash: "\\",
  textasciitilde: "~",
  textasciicircum: "^",
  textasciigrave: "`",
  LaTeX: "LaTeX",
  TeX: "TeX",
  LaTeXe: "LaTeX2e",
  textdegree: "°",
  textordmasculine: "º",
  textordfeminine: "ª",
  textregistered: "®",
  textcopyright: "©",
  copyright: "©",
  texteuro: "€",
  euro: "€",
  textbullet: "•",
  textellipsis: "…",
  textbar: "|",
  textless: "<",
  textgreater: ">",
  textunderscore: "_",
  guillemotleft: "«",
  guillemotright: "»",
  slash: "/",
};

const CONTROLE: Record<string, string> = {
  "&": "&",
  "%": "%",
  $: "$",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
  "-": "",
  "/": "",
  "!": "",
};

// Espaço, com o nome que tiver: fino, largo, quebra de linha forçada.
const ESPACO = new Set([
  " ",
  ",",
  ";",
  ":",
  "\\",
  "quad",
  "qquad",
  "enspace",
  "thinspace",
  "newline",
  "linebreak",
  "par",
  "nobreakspace",
]);

// Só forma, sem argumento: somem.
const FORMA_SEM_ARGUMENTO = new Set([
  "noindent",
  "indent",
  "centering",
  "raggedright",
  "raggedleft",
  "clearpage",
  "newpage",
  "cleardoublepage",
  "pagebreak",
  "nopagebreak",
  "hfill",
  "vfill",
  "smallskip",
  "medskip",
  "bigskip",
  "protect",
  "relax",
  "phantomsection",
  "normalsize",
  "small",
  "footnotesize",
  "scriptsize",
  "tiny",
  "large",
  "Large",
  "LARGE",
  "huge",
  "Huge",
  "sffamily",
  "ttfamily",
  "scshape",
  "tableofcontents",
  "listoffigures",
  "listoftables",
  "listadesiglas",
  "listadesimbolos",
  "imprimircapa",
  "imprimirfolhaderosto",
  "maketitle",
  "pretextual",
  "textual",
  "mainmatter",
  "frontmatter",
  "printindex",
  "onehalfspacing",
  "doublespacing",
  "singlespacing",
  "OnehalfSpacing",
  "SingleSpacing",
  "DoubleSpacing",
  "sloppy",
  "fussy",
  "null",
  "strut",
  "allowbreak",
]);

// Só forma, ou derivado (a lista de referências), com argumentos: somem
// junto com eles.
const FORMA_COM_ARGUMENTOS = new Set([
  "label",
  "index",
  "vspace",
  "hspace",
  "addcontentsline",
  "markboth",
  "markright",
  "selectlanguage",
  "bibliography",
  "bibliographystyle",
  "printbibliography",
  "addbibresource",
  "nocite",
  "pagestyle",
  "thispagestyle",
  "setlength",
  "addtolength",
  "setcounter",
  "hyphenation",
  "phantompart",
  "imprimirfichacatalografica",
]);

// Formatação declarativa: vale até o fim do grupo (`{\bfseries texto}`).
const DECLARACOES: Record<string, Partial<Estado>> = {
  bfseries: { negrito: true },
  bf: { negrito: true },
  mdseries: { negrito: false },
  itshape: { italico: true },
  it: { italico: true },
  em: { italico: true },
  slshape: { italico: true },
  sl: { italico: true },
  upshape: { italico: false },
  normalfont: { negrito: false, italico: false },
  rm: { negrito: false, italico: false },
};

// O conteúdo fica, sem perda: o comando não muda o texto.
const SO_O_CONTEUDO = new Set([
  "textrm",
  "textnormal",
  "textup",
  "textmd",
  "mbox",
  "hbox",
  "text",
  "url",
  "nolinkurl",
  "MakeUppercase",
  "MakeLowercase",
  "uppercase",
  "lowercase",
]);

// O conteúdo fica, mas a formatação não tem equivalente no AURA.
const CONTEUDO_COM_AVISO = new Set([
  "textsc",
  "underline",
  "uline",
  "texttt",
  "textsf",
  "textsl",
  "sout",
  "textsuperscript",
  "textsubscript",
]);

// Referência cruzada: o AURA ainda não tem.
const REFERENCIAS_CRUZADAS = new Set([
  "ref",
  "autoref",
  "pageref",
  "eqref",
  "cref",
  "Cref",
  "nameref",
  "vref",
]);

// Citação que o AURA representa: a obra, o modo e a página (§1.6).
const CITACOES = new Set([
  "cite",
  "citeonline",
  "parencite",
  "textcite",
  "autocite",
  "citep",
  "citet",
  "Cite",
  "Parencite",
  "Textcite",
  "Autocite",
  "footcite",
]);

const DE_MATEMATICA = new Map(
  Object.entries(MATEMATICA).map(([caractere, comando]) => [comando, caractere]),
);

// Comandos que só aparecem nos títulos (`\texorpdfstring{\protect\MakeUppercase{…}}`)
// e não mudam o texto: a caixa alta é da impressão, não do título.
const SO_EM_TITULO = new Set(["protect", "MakeUppercase"]);

// O AURA escreve no máximo uns quatro grupos um dentro do outro.
export const PROFUNDIDADE_MAXIMA = 64;

export interface OpcoesLeituraInline {
  titulo?: boolean;
}

// "p. 35", "p.~35", "pp. 12-14", "página 3": o número, que o AURA formata.
export function paginaDaCitacao(texto: string): string {
  return texto.replace(/^(?:p{1,2}\.|p[áa]gs?\.|p[áa]ginas?)\s*/i, "").trim();
}

class LeitorInline {
  readonly tokens: Token[] = [];

  constructor(
    private readonly ctx: ContextoInline,
    private readonly opcoes: OpcoesLeituraInline = {},
  ) {}

  private get texto() {
    return this.ctx.fonte.texto;
  }

  avisar(pos: number, mensagem: string) {
    this.ctx.avisos.push({ ...this.ctx.fonte.posicao(pos), mensagem });
  }

  private escrever(texto: string, estado: Estado) {
    if (!texto) return;
    const ultimo = this.tokens.at(-1);
    if (ultimo?.tipo === "texto" && mesmoEstado(ultimo.estado, estado)) ultimo.texto += texto;
    else this.tokens.push({ tipo: "texto", texto, estado });
  }

  // Comando que o leitor não conhece: o texto dele, como está, com os
  // argumentos colados (`*`, `[…]` e `{…}` logo depois do nome).
  private literal(pos: number, depois: number, estado: Estado, mensagem: string): number {
    const fim = fimDosArgumentos(this.texto, depois);
    this.escrever(this.texto.slice(pos, fim), estado);
    this.avisar(pos, mensagem);
    return fim;
  }

  percorrer(inicio: number, fim: number, estado: Estado) {
    // Grupo dentro de grupo além do limite: o arquivo não é do AURA, e seguir
    // estouraria a pilha. O trecho fica como texto.
    if (this.ctx.profundidade >= PROFUNDIDADE_MAXIMA) {
      this.escrever(this.texto.slice(inicio, fim), estado);
      this.avisar(inicio, "Chaves aninhadas demais: o trecho entrou como texto.");
      return;
    }
    this.ctx.profundidade++;
    try {
      this.percorrerFaixa(inicio, fim, estado);
    } finally {
      this.ctx.profundidade--;
    }
  }

  private percorrerFaixa(inicio: number, fim: number, estadoInicial: Estado) {
    const t = this.texto;
    let estado = estadoInicial;
    let i = inicio;
    while (i < fim) {
      const c = t[i];
      if (c === "\\") {
        const { nome, depois } = lerNomeDeComando(t, i);
        if (Object.hasOwn(DECLARACOES, nome)) {
          estado = { ...estado, ...DECLARACOES[nome] };
          i = pularBrancos(t, depois, fim);
          continue;
        }
        i = this.comando(i, fim, estado);
        continue;
      }
      if (c === "{") {
        const fecha = fechaChave(t, i, fim);
        if (fecha < 0) {
          this.escrever("{", estado);
          this.avisar(i, "Chave “{” sem fechamento: entrou como texto.");
          i++;
          continue;
        }
        this.percorrer(i + 1, fecha, estado);
        i = fecha + 1;
        continue;
      }
      if (c === "}") {
        this.escrever("}", estado);
        this.avisar(i, "Chave “}” sem abertura: entrou como texto.");
        i++;
        continue;
      }
      if (c === "$") {
        const fecha = t.indexOf("$", i + 1);
        const ate = fecha >= 0 && fecha < fim ? fecha + 1 : i + 1;
        i = this.matematica(i, ate, estado);
        continue;
      }
      if (/\s/.test(c)) {
        while (i < fim && /\s/.test(t[i])) i++;
        this.escrever(" ", estado);
        continue;
      }
      // Ligaduras que o aluno escreveu como LaTeX. As do AURA vêm quebradas
      // por `{}` (`-{}-`), e por isso não caem aqui.
      if (c === "-" && t.startsWith("---", i) && i + 3 <= fim) {
        this.escrever("—", estado);
        i += 3;
        continue;
      }
      if (c === "-" && t.startsWith("--", i) && i + 2 <= fim) {
        this.escrever("–", estado);
        i += 2;
        continue;
      }
      if (c === "`" && t[i + 1] === "`" && i + 2 <= fim) {
        this.escrever("“", estado);
        i += 2;
        continue;
      }
      if (c === "'" && t[i + 1] === "'" && i + 2 <= fim) {
        this.escrever("”", estado);
        i += 2;
        continue;
      }
      if (c === "~") {
        this.escrever(" ", estado);
        i++;
        continue;
      }
      this.escrever(c, estado);
      i++;
    }
  }

  // `$…$` e `\(…\)`: o AURA não tem fórmula no meio do texto.
  private matematica(pos: number, ate: number, estado: Estado): number {
    this.escrever(this.texto.slice(pos, ate), estado);
    this.avisar(
      pos,
      "Matemática no meio do texto ($…$) não existe no AURA: entrou como texto. Use um bloco de fórmula.",
    );
    return ate;
  }

  private comando(pos: number, fim: number, estado: Estado): number {
    const t = this.texto;
    const { nome, depois } = lerNomeDeComando(t, pos);

    if (Object.hasOwn(CONTROLE, nome)) {
      this.escrever(CONTROLE[nome], estado);
      return depois;
    }

    if (ESPACO.has(nome)) {
      this.escrever(" ", estado);
      // `\\*` e `\\[2pt]`: a quebra com o espaço extra.
      let i = depois;
      if (nome === "\\" && t[i] === "*") i++;
      if (nome === "\\") i = lerOpcional(t, i, fim)?.depois ?? i;
      return /[a-zA-Z]/.test(nome) ? pularBrancos(t, i, fim) : i;
    }

    if (Object.hasOwn(SIMBOLOS, nome)) {
      this.escrever(SIMBOLOS[nome], estado);
      if (t.startsWith("{}", depois)) return depois + 2;
      return /[a-zA-Z]/.test(nome) ? pularBrancos(t, depois, fim) : depois;
    }

    // Acento à moda antiga: `\'a`, `\'{a}`, `\c{c}`, `\~{a}`, `\'\i`.
    if (Object.hasOwn(ACENTOS, nome) && nome.length === 1) {
      return this.acento(pos, depois, fim, estado, ACENTOS[nome]);
    }

    if (nome === "(") {
      const fecha = t.indexOf("\\)", depois);
      const ate = fecha >= 0 && fecha < fim ? fecha + 2 : depois;
      return this.matematica(pos, ate, estado);
    }

    if (FORMA_SEM_ARGUMENTO.has(nome)) {
      let i = depois;
      if (t[i] === "*") i++;
      i = lerOpcional(t, i, fim)?.depois ?? i;
      if (t.startsWith("{}", i)) return i + 2;
      return pularBrancos(t, i, fim);
    }
    if (FORMA_COM_ARGUMENTOS.has(nome)) return fimDosArgumentos(t, depois, fim);

    if (nome === "textbf" || nome === "textit" || nome === "emph") {
      const grupo = lerGrupo(t, depois, fim);
      if (!grupo)
        return this.literal(pos, depois, estado, `\\${nome} sem argumento: entrou como texto.`);
      const novo = nome === "textbf" ? { ...estado, negrito: true } : { ...estado, italico: true };
      this.percorrer(grupo.inicio, grupo.fim, novo);
      return grupo.depois;
    }

    if (nome === "footnote") {
      const opcional = lerOpcional(t, depois, fim);
      const grupo = lerGrupo(t, opcional?.depois ?? depois, fim);
      if (!grupo)
        return this.literal(pos, depois, estado, "\\footnote sem argumento: entrou como texto.");
      const texto = textoPlano(this.ctx, grupo.inicio, grupo.fim, "a nota de rodapé");
      this.tokens.push({ tipo: "nota", texto });
      return grupo.depois;
    }

    if (nome === "auracite") return this.auracite(pos, depois, fim, estado);

    if (CITACOES.has(nome)) return this.citacao(pos, nome, depois, fim, estado);
    if (nome === "citeauthor" || nome === "citeyear") {
      return this.literal(
        pos,
        depois,
        estado,
        `\\${nome} (só o autor ou só o ano) não tem equivalente no AURA: entrou como texto.`,
      );
    }

    if (nome === "ensuremath") {
      const grupo = lerGrupo(t, depois, fim);
      const dentro = grupo ? t.slice(grupo.inicio, grupo.fim).trim() : "";
      const caractere = DE_MATEMATICA.get(dentro);
      if (grupo && caractere !== undefined) {
        this.escrever(caractere, estado);
        return grupo.depois;
      }
      return this.literal(
        pos,
        depois,
        estado,
        "\\ensuremath com conteúdo que o AURA não escreve: entrou como texto.",
      );
    }

    if (nome === "texttt") {
      // Caractere fora da fonte, que `escaparLatex()` escreveu pelo código.
      const grupo = lerGrupo(t, depois, fim);
      const codigo = grupo
        ? /^\[U\+([0-9A-F]{4,6})\]$/.exec(t.slice(grupo.inicio, grupo.fim))
        : null;
      if (grupo && codigo) {
        this.escrever(String.fromCodePoint(parseInt(codigo[1], 16)), estado);
        return grupo.depois;
      }
    }

    if (this.opcoes.titulo && SO_EM_TITULO.has(nome)) {
      if (nome === "protect") return depois;
      const grupo = lerGrupo(t, depois, fim);
      if (grupo) {
        this.percorrer(grupo.inicio, grupo.fim, estado);
        return grupo.depois;
      }
    }

    if (SO_O_CONTEUDO.has(nome) || CONTEUDO_COM_AVISO.has(nome)) {
      const grupo = lerGrupo(t, depois, fim);
      if (grupo) {
        if (CONTEUDO_COM_AVISO.has(nome)) {
          this.avisar(
            pos,
            `\\${nome} não tem equivalente no AURA: ficou o texto, sem essa formatação.`,
          );
        }
        this.percorrer(grupo.inicio, grupo.fim, estado);
        return grupo.depois;
      }
    }

    // `\enquote{x}`: aspas em volta.
    if (nome === "enquote") {
      const grupo = lerGrupo(t, depois, fim);
      if (grupo) {
        this.escrever("“", estado);
        this.percorrer(grupo.inicio, grupo.fim, estado);
        this.escrever("”", estado);
        return grupo.depois;
      }
    }

    // Dois argumentos, fica o segundo: `\href{url}{texto}`,
    // `\foreignlanguage{english}{texto}`.
    if (nome === "href" || nome === "foreignlanguage") {
      const primeiro = lerGrupo(t, lerOpcional(t, depois, fim)?.depois ?? depois, fim);
      const segundo = primeiro && lerGrupo(t, primeiro.depois, fim);
      if (segundo) {
        this.percorrer(segundo.inicio, segundo.fim, estado);
        return segundo.depois;
      }
    }

    if (REFERENCIAS_RESOLUVEIS.has(nome)) {
      const grupo = lerGrupo(t, depois, fim);
      if (grupo) {
        const indice =
          this.ctx.referencias.push({
            comando: nome,
            rotulo: t.slice(grupo.inicio, grupo.fim).trim(),
            bruto: t.slice(pos, grupo.depois),
            ...this.ctx.fonte.posicao(pos),
          }) - 1;
        this.escrever(marcadorDeReferencia(indice), estado);
        return grupo.depois;
      }
    }

    if (REFERENCIAS_CRUZADAS.has(nome)) {
      return this.literal(
        pos,
        depois,
        estado,
        `Referência cruzada (\\${nome}) não existe no AURA: entrou como texto. Escreva o número (por exemplo, “Figura 2”).`,
      );
    }

    if (nome === "newcommand" || nome === "renewcommand" || nome === "def") {
      return this.literal(
        pos,
        depois,
        estado,
        `\\${nome} no texto não é expandido: entrou como texto.`,
      );
    }
    if (nome === "input" || nome === "include") {
      return this.literal(
        pos,
        depois,
        estado,
        `\\${nome} no meio do texto não é seguido: entrou como texto.`,
      );
    }
    if (nome === "")
      return this.literal(
        pos,
        depois,
        estado,
        "Barra invertida no fim do texto: entrou como texto.",
      );
    return this.literal(
      pos,
      depois,
      estado,
      `Comando \\${nome} não reconhecido: entrou como texto.`,
    );
  }

  private acento(pos: number, depois: number, fim: number, estado: Estado, marca: string) {
    const t = this.texto;
    const { nome } = lerNomeDeComando(t, pos);
    let i = /[a-zA-Z]/.test(nome) ? pularBrancos(t, depois, fim) : depois;
    let base = "";
    if (t[i] === "{") {
      const grupo = lerGrupo(t, i, fim);
      if (!grupo)
        return this.literal(pos, depois, estado, "Acento sem a letra: entrou como texto.");
      const dentro = t.slice(grupo.inicio, grupo.fim).trim();
      base = dentro.startsWith("\\") ? (SIMBOLOS_DO_BIB[dentro.slice(1)] ?? dentro) : dentro;
      i = grupo.depois;
    } else if (t[i] === "\\") {
      const letra = lerNomeDeComando(t, i);
      base = SIMBOLOS_DO_BIB[letra.nome] ?? "";
      i = letra.depois;
    } else if (i < fim) {
      base = t[i];
      i++;
    }
    this.escrever(acentuar(base, marca), estado);
    return i;
  }

  // `\cite[p.~35]{chave}` e as variantes (§1.6). Até dois opcionais (o
  // biblatex e o natbib aceitam antes e depois); a página é o último.
  private citacao(pos: number, nome: string, depois: number, fim: number, estado: Estado) {
    const t = this.texto;
    let i = t[depois] === "*" ? depois + 1 : depois;
    const opcionais: Grupo[] = [];
    for (let k = 0; k < 2; k++) {
      const opcional = lerOpcional(t, i, fim);
      if (!opcional) break;
      opcionais.push(opcional);
      i = opcional.depois;
    }
    const grupo = lerGrupo(t, i, fim);
    if (!grupo) return this.literal(pos, depois, estado, `\\${nome} sem chave: entrou como texto.`);
    const chaves = t
      .slice(grupo.inicio, grupo.fim)
      .split(",")
      .map((chave) => chave.trim())
      .filter(Boolean);
    const ultimo = opcionais.at(-1);
    const pagina = ultimo
      ? paginaDaCitacao(textoPlano(this.ctx, ultimo.inicio, ultimo.fim, "a página")) || null
      : null;
    this.tokens.push({
      tipo: "cite",
      comando: nome,
      chaves,
      pagina,
      bruto: t.slice(pos, grupo.depois),
      pos,
      estado,
    });
    return grupo.depois;
  }

  // `\auracite[modo={…}, pagina={…}, apud={…}]{refId}{trecho}{chamada}`
  // (`parteLatex()` em export/latex/document.ts).
  private auracite(pos: number, depois: number, fim: number, estado: Estado): number {
    const t = this.texto;
    const opcional = lerOpcional(t, depois, fim);
    const ref = lerGrupo(t, opcional?.depois ?? depois, fim);
    const trecho = ref && lerGrupo(t, ref.depois, fim);
    const chamada = trecho && lerGrupo(t, trecho.depois, fim);
    if (!ref || !trecho || !chamada) {
      return this.literal(
        pos,
        depois,
        estado,
        "\\auracite incompleto (faltam argumentos): entrou como texto.",
      );
    }

    const valores = opcional ? lerAtributos(t, opcional) : new Map<string, Grupo>();
    const refId = textoPlano(this.ctx, ref.inicio, ref.fim, "a chave da citação");
    const modoBruto = valores.get("modo");
    const modoLido = modoBruto ? t.slice(modoBruto.inicio, modoBruto.fim).trim() : "";
    let modo: AtributosCitacao["modo"] = "indireta";
    if (modoLido === "direta_curta" || modoLido === "indireta") modo = modoLido;
    else
      this.avisar(
        pos,
        `Modo de citação “${modoLido}” desconhecido: a citação voltou como indireta.`,
      );

    const paginaLida = valores.get("pagina");
    const pagina = paginaLida
      ? textoPlano(this.ctx, paginaLida.inicio, paginaLida.fim, "a página") || null
      : null;

    let apud: FonteOriginal | null = null;
    const apudLido = valores.get("apud");
    if (apudLido) {
      const json = textoPlano(this.ctx, apudLido.inicio, apudLido.fim, "o apud");
      try {
        apud = JSON.parse(json) as FonteOriginal;
      } catch {
        this.avisar(pos, "Dados do apud ilegíveis: a citação voltou sem o apud.");
      }
    }

    const attrs: AtributosCitacao = { refId, modo, pagina, apud };
    const antes = this.tokens.length;
    this.percorrer(trecho.inicio, trecho.fim, { ...estado, citacao: attrs });
    if (modo === "direta_curta") tirarAspas(this.tokens.slice(antes));

    this.ctx.chamadas.push({
      ...this.ctx.fonte.posicao(pos),
      citacao: { refId, pagina, apud },
      texto: textoPlano(this.ctx, chamada.inicio, chamada.fim, "a chamada"),
    });
    return chamada.depois;
  }
}

// Espaço e tabulação depois de um comando-palavra: o TeX os come.
function pularBrancos(texto: string, pos: number, fim: number): number {
  while (pos < fim && (texto[pos] === " " || texto[pos] === "\t")) pos++;
  return pos;
}

function mesmoEstado(a: Estado, b: Estado): boolean {
  return a.negrito === b.negrito && a.italico === b.italico && a.citacao === b.citacao;
}

// `chave={valor}, chave={valor}` do argumento opcional do `\auracite`.
export function lerAtributos(texto: string, opcional: Grupo): Map<string, Grupo> {
  const valores = new Map<string, Grupo>();
  let i = opcional.inicio;
  while (i < opcional.fim) {
    while (i < opcional.fim && /[\s,]/.test(texto[i])) i++;
    const chave = /^[a-zA-Z]+/.exec(texto.slice(i, opcional.fim));
    if (!chave) break;
    i += chave[0].length;
    while (i < opcional.fim && /\s/.test(texto[i])) i++;
    if (texto[i] !== "=") break;
    i++;
    while (i < opcional.fim && /\s/.test(texto[i])) i++;
    if (texto[i] === "{") {
      const fecha = fechaChave(texto, i, opcional.fim);
      if (fecha < 0) break;
      valores.set(chave[0], { inicio: i + 1, fim: fecha, depois: fecha + 1 });
      i = fecha + 1;
    } else {
      let fim = i;
      while (fim < opcional.fim && texto[fim] !== ",") fim++;
      valores.set(chave[0], { inicio: i, fim, depois: fim });
      i = fim;
    }
  }
  return valores;
}

// As aspas da citação direta são do AURA (`fecharCitacao()`), não do texto
// do aluno: saem antes de o trecho virar marca.
function tirarAspas(tokens: Token[]) {
  const textos = tokens.filter((token): token is TokenTexto => token.tipo === "texto");
  const primeiro = textos[0];
  const ultimo = textos.at(-1);
  if (primeiro?.texto.startsWith("“")) primeiro.texto = primeiro.texto.slice(1);
  if (ultimo?.texto.endsWith("”")) ultimo.texto = ultimo.texto.slice(0, -1);
}

// --- `\cite` do aluno --------------------------------------------------------

// Fim de frase: ponto, exclamação ou interrogação, aspas ou parêntese de
// fechamento, e espaço.
const FIM_DE_FRASE = /[.!?][”"’)]*\s+/g;

// `\cite{chave}` com chave conhecida vira citação sobre o texto logo antes
// dele (§1.5 e §1.6): entre aspas, direta sobre o que está entre elas; sem
// aspas, indireta até o começo da frase. O aluno confere pelo aviso.
function resolverCites(ctx: ContextoInline, tokens: Token[]): Token[] {
  const saida: Token[] = [];
  for (const token of tokens) {
    if (token.tipo !== "cite") {
      saida.push(token);
      continue;
    }
    const posicao = ctx.fonte.posicao(token.pos);
    const comando = `\\${token.comando}{${token.chaves.join(",")}}`;
    const chave = token.chaves.find((item) => ctx.chaves.has(item));
    const modo = chave ? marcarAntes(saida, chave, token.pagina) : null;
    if (!chave || !modo) {
      saida.push({ tipo: "texto", texto: token.bruto, estado: token.estado });
      ctx.avisos.push({
        ...posicao,
        mensagem: chave
          ? `${comando} sem texto antes dele: entrou como texto.`
          : `${comando}: a chave não está nas referências. Entrou como texto.`,
      });
      continue;
    }
    const tipo = modo === "direta_curta" ? "direta" : "indireta";
    const onde =
      modo === "direta_curta"
        ? "sobre o trecho entre aspas antes dele"
        : "sobre o trecho antes dele";
    ctx.avisos.push({
      ...posicao,
      mensagem: token.pagina
        ? `${comando} virou citação ${tipo}, página ${token.pagina}, ${onde}. Confira o trecho e o modo.`
        : `${comando} virou citação ${tipo} ${onde}. Confira o trecho.`,
    });
    if (token.chaves.length > 1) {
      ctx.avisos.push({
        ...posicao,
        mensagem: `Citação de várias obras (${token.chaves.join(", ")}): só ${chave} ficou ligada. Cite as outras à parte no AURA.`,
      });
    }
  }
  return saida;
}

// Marca o texto antes do `\cite` e devolve o modo, ou `null` se não havia
// texto. Trabalha sobre os tokens de texto seguidos, sem citação, do fim da
// lista: juntos, eles são o trecho candidato.
function marcarAntes(
  tokens: Token[],
  chave: string,
  pagina: string | null,
): AtributosCitacao["modo"] | null {
  let k = tokens.length;
  while (k > 0) {
    const token = tokens[k - 1];
    if (token.tipo !== "texto" || token.estado.citacao) break;
    k--;
  }
  const candidatos = tokens.slice(k) as TokenTexto[];
  if (candidatos.length === 0) return null;
  const ultimo = candidatos.at(-1)!;
  ultimo.texto = ultimo.texto.replace(/\s+$/, "");
  const texto = candidatos.map((token) => token.texto).join("");

  let inicio = 0;
  let fim = texto.length;
  let modo: AtributosCitacao["modo"] = "indireta";
  // Posições das aspas que saem: a citação direta ganha as do AURA.
  const tirar = new Set<number>();
  const fecha = texto.at(-1);
  const abre =
    fecha === "”"
      ? texto.lastIndexOf("“", texto.length - 2)
      : fecha === '"'
        ? texto.lastIndexOf('"', texto.length - 2)
        : -1;
  if (abre >= 0 && abre < texto.length - 2) {
    modo = "direta_curta";
    inicio = abre + 1;
    fim = texto.length - 1;
    tirar.add(abre).add(texto.length - 1);
  } else {
    for (const achado of texto.matchAll(FIM_DE_FRASE)) {
      if (achado.index + achado[0].length < texto.length) inicio = achado.index + achado[0].length;
    }
  }
  while (inicio < fim && /\s/.test(texto[inicio])) inicio++;
  if (inicio >= fim) return null;

  const attrs: AtributosCitacao = { refId: chave, modo, pagina, apud: null };
  const novos: TokenTexto[] = [];
  let deslocamento = 0;
  for (const token of candidatos) {
    const a = deslocamento;
    const b = deslocamento + token.texto.length;
    deslocamento = b;
    const pedacos: [number, number, boolean][] = [
      [a, Math.min(b, inicio), false],
      [Math.max(a, inicio), Math.min(b, fim), true],
      [Math.max(a, fim), b, false],
    ];
    for (const [de, ate, marcado] of pedacos) {
      if (de >= ate) continue;
      let parte = "";
      for (let p = de; p < ate; p++) if (!tirar.has(p)) parte += texto[p];
      if (!parte) continue;
      novos.push({
        tipo: "texto",
        texto: parte,
        estado: marcado ? { ...token.estado, citacao: attrs } : token.estado,
      });
    }
  }
  tokens.splice(k, candidatos.length, ...novos);
  return modo;
}

// --- Saída -------------------------------------------------------------------

function marcasDe(estado: Estado): Marca[] {
  const marcas: Marca[] = [];
  if (estado.negrito) marcas.push({ type: "negrito" });
  if (estado.italico) marcas.push({ type: "italico" });
  if (estado.citacao) marcas.push({ type: "citacao", attrs: estado.citacao });
  return marcas;
}

function paraNos(tokens: readonly Token[]): NoInline[] {
  const nos: NoInline[] = [];
  for (const token of tokens) {
    if (token.tipo === "nota") {
      nos.push({ type: "nota_rodape", texto: token.texto });
      continue;
    }
    if (token.tipo !== "texto" || !token.texto) continue;
    const marcas = marcasDe(token.estado);
    const anterior = nos.at(-1);
    if (
      anterior?.type === "text" &&
      JSON.stringify(anterior.marks ?? []) === JSON.stringify(marcas)
    ) {
      anterior.text += token.texto;
      continue;
    }
    nos.push(
      marcas.length
        ? { type: "text", text: token.texto, marks: marcas }
        : { type: "text", text: token.texto },
    );
  }
  return nos;
}

// Tira o espaço do começo e do fim do bloco, e os nós que ficarem vazios.
// Dentro do bloco, espaço repetido (de um comando que sumiu) vira um só.
function aparar(nos: NoInline[]): NoInline[] {
  for (const [indice, no] of nos.entries()) {
    if (no.type !== "text") continue;
    no.text = no.text.replace(/ {2,}/g, " ");
    const anterior = nos[indice - 1];
    if (anterior?.type === "text" && anterior.text.endsWith(" ") && no.text.startsWith(" ")) {
      no.text = no.text.slice(1);
    }
  }
  const primeiro = nos[0];
  if (primeiro?.type === "text") primeiro.text = primeiro.text.trimStart();
  const ultimo = nos.at(-1);
  if (ultimo?.type === "text") ultimo.text = ultimo.text.trimEnd();
  return nos.filter((no) => no.type !== "text" || no.text.length > 0);
}

// O inline de um parágrafo, de uma citação longa ou de uma célula.
export function lerInline(ctx: ContextoInline, inicio: number, fim: number): NoInline[] {
  const leitor = new LeitorInline(ctx);
  leitor.percorrer(inicio, fim, SEM_MARCA);
  return aparar(paraNos(resolverCites(ctx, leitor.tokens)));
}

// Só texto, para campo que não tem marca: título, legenda, fonte, metadado.
// Formatação e nota que vierem aqui não têm onde ficar; o texto fica, e o
// aviso diz o que se perdeu.
export function textoPlano(
  ctx: ContextoInline,
  inicio: number,
  fim: number,
  onde: string,
  opcoes: OpcoesLeituraInline = {},
): string {
  const leitor = new LeitorInline(ctx, opcoes);
  leitor.percorrer(inicio, fim, SEM_MARCA);
  let perdeu = false;
  let texto = "";
  for (const token of leitor.tokens) {
    if (token.tipo === "texto") {
      texto += token.texto;
      if (token.estado.negrito || token.estado.italico) perdeu = true;
    } else if (token.tipo === "nota") {
      texto += ` (${token.texto})`;
      perdeu = true;
    } else {
      texto += token.bruto;
      perdeu = true;
    }
  }
  if (perdeu) {
    leitor.avisar(
      inicio,
      `Formatação, nota ou citação dentro d${onde} não voltam: ficou só o texto.`,
    );
  }
  return texto.replace(/ {2,}/g, " ").trim();
}

// Só os nós de texto, para a célula de tabela, que não tem nota de rodapé
// (`CelulaTabela`). Uma nota escrita ali vira texto entre parênteses.
export function lerInlineDeCelula(ctx: ContextoInline, inicio: number, fim: number): NoTexto[] {
  return lerInline(ctx, inicio, fim).map((no) => {
    if (no.type === "text") return no;
    ctx.avisos.push({
      ...ctx.fonte.posicao(inicio),
      mensagem:
        "Nota de rodapé dentro de célula de tabela não existe no AURA: virou texto entre parênteses.",
    });
    return { type: "text", text: ` (${no.texto})` };
  });
}
