import { MATEMATICA } from "../../export/latex/escape";
import type {
  AtributosCitacao,
  FonteOriginal,
  Marca,
  NoInline,
  NoTexto,
} from "../../document/types";
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

// Inline do `.tex` de volta para o schema (passo 6.2.4): o caminho inverso de
// `trechoLatex()`/`parteLatex()` e de `escaparLatex()` (export/latex/). Lê só
// o que o AURA escreve, mais o `\cite` do aluno; as regras estão em
// docs/latex-abntex.md §1.5.
//
// **Nada é interpretado além disso.** Comando desconhecido volta como o
// texto que estava no arquivo, com aviso e a linha: `\hl{x}` entra no
// parágrafo como "\hl{x}". Nada é expandido nem executado.

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

type Token =
  | { tipo: "texto"; texto: string; estado: Estado }
  | { tipo: "nota"; texto: string }
  | {
      tipo: "cite";
      chave: string;
      pagina: string | null;
      bruto: string;
      pos: number;
      estado: Estado;
    };

const SEM_MARCA: Estado = { negrito: false, italico: false, citacao: null };

// Os escapes de `escaparLatex()`, de volta para o caractere. O `{}` que vem
// depois (`\textbackslash{}`) é consumido junto.
const SIMBOLOS: Record<string, string> = {
  textbackslash: "\\",
  textasciitilde: "~",
  textasciicircum: "^",
  textasciigrave: "`",
};

const CONTROLE: Record<string, string> = {
  "&": "&",
  "%": "%",
  $: "$",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
  " ": " ",
  "-": "",
  "/": "",
};

const DE_MATEMATICA = new Map(
  Object.entries(MATEMATICA).map(([caractere, comando]) => [comando, caractere]),
);

// Comandos que só aparecem nos títulos (`\texorpdfstring{\protect\MakeUppercase{…}}`)
// e não mudam o texto: a caixa alta é da impressão, não do título.
const SO_EM_TITULO = new Set(["protect", "MakeUppercase"]);

// O AURA escreve no máximo uns quatro grupos um dentro do outro.
const PROFUNDIDADE_MAXIMA = 64;

export interface OpcoesLeituraInline {
  titulo?: boolean;
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

  private percorrerFaixa(inicio: number, fim: number, estado: Estado) {
    const t = this.texto;
    let i = inicio;
    while (i < fim) {
      const c = t[i];
      if (c === "\\") {
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
        this.escrever(t.slice(i, ate), estado);
        this.avisar(
          i,
          "Matemática no meio do texto ($…$) não existe no AURA: entrou como texto. Use um bloco de fórmula.",
        );
        i = ate;
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

  private comando(pos: number, fim: number, estado: Estado): number {
    const t = this.texto;
    const { nome, depois } = lerNomeDeComando(t, pos);

    if (Object.hasOwn(CONTROLE, nome)) {
      this.escrever(CONTROLE[nome], estado);
      return depois;
    }

    if (Object.hasOwn(SIMBOLOS, nome)) {
      this.escrever(SIMBOLOS[nome], estado);
      if (t.startsWith("{}", depois)) return depois + 2;
      let i = depois;
      while (i < fim && (t[i] === " " || t[i] === "\t")) i++;
      return i;
    }

    if (nome === "textbf" || nome === "textit" || nome === "emph") {
      const grupo = lerGrupo(t, depois, fim);
      if (!grupo)
        return this.literal(pos, depois, estado, `\\${nome} sem argumento: entrou como texto.`);
      const novo = nome === "textbf" ? { ...estado, negrito: true } : { ...estado, italico: true };
      this.percorrer(grupo.inicio, grupo.fim, novo);
      return grupo.depois;
    }

    if (nome === "footnote") {
      const grupo = lerGrupo(t, depois, fim);
      if (!grupo)
        return this.literal(pos, depois, estado, "\\footnote sem argumento: entrou como texto.");
      const texto = textoPlano(this.ctx, grupo.inicio, grupo.fim, "a nota de rodapé");
      this.tokens.push({ tipo: "nota", texto });
      return grupo.depois;
    }

    if (nome === "auracite") return this.auracite(pos, depois, fim, estado);

    if (nome === "cite") {
      const opcional = lerOpcional(t, depois, fim);
      const grupo = lerGrupo(t, opcional?.depois ?? depois, fim);
      if (!grupo) return this.literal(pos, depois, estado, "\\cite sem chave: entrou como texto.");
      const chave = t.slice(grupo.inicio, grupo.fim).trim();
      const pagina = opcional ? t.slice(opcional.inicio, opcional.fim).trim() || null : null;
      this.tokens.push({
        tipo: "cite",
        chave,
        pagina,
        bruto: t.slice(pos, grupo.depois),
        pos,
        estado,
      });
      return grupo.depois;
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
  const textos = tokens.filter(
    (token): token is Extract<Token, { tipo: "texto" }> => token.tipo === "texto",
  );
  const primeiro = textos[0];
  const ultimo = textos.at(-1);
  if (primeiro?.texto.startsWith("“")) primeiro.texto = primeiro.texto.slice(1);
  if (ultimo?.texto.endsWith("”")) ultimo.texto = ultimo.texto.slice(0, -1);
}

// --- `\cite` do aluno --------------------------------------------------------

// Fim de frase: ponto, exclamação ou interrogação, aspas ou parêntese de
// fechamento, e espaço.
const FIM_DE_FRASE = /[.!?][”"’)]*\s+/g;

// `\cite{chave}` com chave conhecida vira citação indireta sobre o texto
// logo antes dele, até o começo da frase (§1.5). O aluno confere pelo aviso.
function resolverCites(ctx: ContextoInline, tokens: Token[]): Token[] {
  const saida: Token[] = [];
  for (const token of tokens) {
    if (token.tipo !== "cite") {
      saida.push(token);
      continue;
    }
    const posicao = ctx.fonte.posicao(token.pos);
    const conhecida = ctx.chaves.has(token.chave);
    const marcados = conhecida ? marcarAntes(saida, token) : 0;
    if (!conhecida || marcados === 0) {
      saida.push({ tipo: "texto", texto: token.bruto, estado: token.estado });
      ctx.avisos.push({
        ...posicao,
        mensagem: conhecida
          ? `\\cite{${token.chave}} sem texto antes dele: entrou como texto.`
          : `\\cite{${token.chave}}: a chave não está nas referências. Entrou como texto.`,
      });
      continue;
    }
    ctx.avisos.push({
      ...posicao,
      mensagem: token.pagina
        ? `\\cite{${token.chave}} virou citação indireta, página ${token.pagina}, sobre o trecho antes dele. Confira o trecho e o modo.`
        : `\\cite{${token.chave}} virou citação indireta sobre o trecho antes dele. Confira o trecho.`,
    });
  }
  return saida;
}

function marcarAntes(tokens: Token[], cite: Extract<Token, { tipo: "cite" }>): number {
  const attrs: AtributosCitacao = {
    refId: cite.chave,
    modo: "indireta",
    pagina: cite.pagina,
    apud: null,
  };
  let marcados = 0;
  for (let j = tokens.length - 1; j >= 0; j--) {
    const token = tokens[j];
    if (token.tipo !== "texto" || token.estado.citacao) break;
    if (j === tokens.length - 1) token.texto = token.texto.replace(/\s+$/, "");
    let corte = -1;
    for (const achado of token.texto.matchAll(FIM_DE_FRASE)) {
      if (achado.index + achado[0].length < token.texto.length)
        corte = achado.index + achado[0].length;
    }
    const estado = { ...token.estado, citacao: attrs };
    if (corte >= 0) {
      const marcado: Token = { tipo: "texto", texto: token.texto.slice(corte), estado };
      token.texto = token.texto.slice(0, corte);
      tokens.splice(j + 1, 0, marcado);
      marcados++;
      break;
    }
    if (token.texto.trim()) marcados++;
    token.estado = estado;
  }
  return marcados;
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
function aparar(nos: NoInline[]): NoInline[] {
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
  return texto.trim();
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
