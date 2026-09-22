// Leitor de `.bib` — passo 4.6, primeira metade. Transforma o texto do arquivo
// em entradas cruas (`tipo`, `chave`, `campos`), sem saber nada de CSL-JSON
// nem de ABNT: quem decide o que cada campo VIRA é `bibtexToCsl.ts`.
//
// **Escrito à mão, sem dependência.** A gramática do BibTeX é pequena, e o
// doc de decisões (§1.9) aponta o parser de `.bib` como superfície de ataque —
// um arquivo vindo de fora, montado por qualquer ferramenta. Um leitor linear,
// sem recursão sobre a entrada e sem `eval`/regex catastrófica, é mais fácil
// de conferir do que uma biblioteca inteira.
//
// **Uma entrada ruim não derruba o arquivo** (critério de aceite do passo).
// Erro de sintaxe vira um `ErroBibtex` com a linha, e a leitura recomeça na
// próxima `@` que abre uma linha — é onde, na prática, a próxima entrada
// começa. Um `.bib` exportado do Zotero com uma entrada quebrada no meio
// continua trazendo as outras quarenta.
//
// **O valor volta com as chaves internas preservadas** (`{ABNT}`, `{\'e}`).
// Elas ainda carregam informação que o mapeamento precisa: um nome inteiro
// entre chaves é entidade, não pessoa; um dois-pontos entre chaves não separa
// subtítulo. `decodificarLatex()` é quem as tira, no fim.

export interface EntradaBibtex {
  // Minúsculo: `@Book` e `@book` são o mesmo tipo.
  tipo: string;
  chave: string;
  // Nome do campo em minúsculas → valor cru (delimitadores externos tirados,
  // concatenação `#` resolvida, macros `@string` substituídas).
  campos: Record<string, string>;
  // Linha (1-base) do `@` que abre a entrada — para a prévia (4.7) apontar
  // onde está o problema no arquivo da pessoa.
  linha: number;
}

// Escrito para quem vai abrir o `.bib` e corrigir, não para quem escreveu o
// parser: diz QUAL entrada (a chave, e a linha em que ela começa) e, em
// palavras, o que provavelmente falta. A linha em que a leitura parou vem à
// parte porque quase nunca é a do defeito — uma chave sem fechar só é
// percebida lá na frente, quando a próxima entrada já começou.
export interface ErroBibtex {
  // Linha do `@` que abre a entrada com problema.
  linha: number;
  // Ausente quando o defeito é antes da chave (`@book{, ...}`).
  chave?: string;
  mensagem: string;
  linhaDaParada: number;
}

export interface ResultadoBibtex {
  entradas: EntradaBibtex[];
  erros: ErroBibtex[];
}

// Macros de mês que o BibTeX define sem `@string`. Resolvidas direto para o
// número: é o que o mapeamento precisa, e evita um segundo dicionário de nomes
// de mês em inglês só para desfazer este.
const MACROS_PADRAO: Record<string, string> = {
  jan: "1",
  feb: "2",
  mar: "3",
  apr: "4",
  may: "5",
  jun: "6",
  jul: "7",
  aug: "8",
  sep: "9",
  oct: "10",
  nov: "11",
  dec: "12",
};

// O que cada `esperar()` quer dizer, em palavras. A vírgula é o caso comum e
// o mais enganoso: quase sempre ela "falta" porque uma chave do valor
// anterior não fechou e engoliu o resto da entrada.
const ESPERADO: Record<string, string> = {
  ",": 'faltou uma vírgula entre dois campos — ou uma chave "}" ficou sem fechar antes',
  "=": 'faltou "=" entre o nome do campo e o valor',
  "}": 'faltou o "}" que fecha a entrada',
  ")": 'faltou o ")" que fecha a entrada',
};

class ErroLeitura extends Error {
  constructor(
    mensagem: string,
    readonly posicao: number,
  ) {
    super(mensagem);
  }
}

export function lerBibtex(fonte: string): ResultadoBibtex {
  const entradas: EntradaBibtex[] = [];
  const erros: ErroBibtex[] = [];
  const macros = new Map(Object.entries(MACROS_PADRAO));
  const linhaDe = contadorDeLinhas(fonte);
  let pos = 0;
  // Chave da entrada em leitura, para o erro dizer QUAL entrada quebrou.
  let chaveAtual: string | undefined;

  // --- primitivas -----------------------------------------------------------

  function pularEspacos() {
    while (pos < fonte.length && /\s/.test(fonte[pos])) pos++;
  }

  function esperar(caractere: string) {
    pularEspacos();
    if (fonte[pos] !== caractere) {
      throw new ErroLeitura(ESPERADO[caractere] ?? `faltou "${caractere}"`, pos);
    }
    pos++;
  }

  // Identificador BibTeX: tudo que não é espaço nem pontuação da gramática.
  function lerIdentificador(): string {
    const inicio = pos;
    while (pos < fonte.length && !/[\s=,{}()"#@%]/.test(fonte[pos])) pos++;
    return fonte.slice(inicio, pos);
  }

  // Conteúdo de um grupo balanceado, a partir do caractere logo DEPOIS do
  // delimitador de abertura. Devolve o miolo, sem os delimitadores externos.
  // `\{` e `\}` são literais e não contam para o balanceamento — o BibTeX
  // clássico os contaria, e quebraria no mesmo arquivo que o biber aceita.
  function lerBalanceado(fecha: "}" | ")" | '"', inicioGrupo: number): string {
    const inicio = pos;
    let profundidade = 0;
    while (pos < fonte.length) {
      const c = fonte[pos];
      if (c === "\\") {
        pos += 2;
        continue;
      }
      if (profundidade === 0 && c === fecha) {
        const miolo = fonte.slice(inicio, pos);
        pos++;
        return miolo;
      }
      if (c === "{") profundidade++;
      else if (c === "}") {
        if (profundidade === 0)
          throw new ErroLeitura('há um "}" sobrando, sem "{" que ele feche', pos);
        profundidade--;
      }
      pos++;
    }
    throw new ErroLeitura('uma chave "{" ou aspas abertas aqui nunca foram fechadas', inicioGrupo);
  }

  // Um valor de campo: pedaços `{...}`, `"..."`, número ou macro, unidos por `#`.
  function lerValor(): string {
    const pedacos: string[] = [];
    for (;;) {
      pularEspacos();
      const c = fonte[pos];
      const inicio = pos;
      if (c === "{") {
        pos++;
        pedacos.push(lerBalanceado("}", inicio));
      } else if (c === '"') {
        pos++;
        pedacos.push(lerBalanceado('"', inicio));
      } else if (c !== undefined && /[0-9]/.test(c)) {
        pedacos.push(lerIdentificador());
      } else {
        const nome = lerIdentificador();
        if (!nome) throw new ErroLeitura('um campo ficou sem valor depois do "="', pos);
        const valor = macros.get(nome.toLowerCase());
        if (valor === undefined) {
          throw new ErroLeitura(
            `o valor ${nome} não está entre chaves nem foi definido por @string`,
            inicio,
          );
        }
        pedacos.push(valor);
      }
      pularEspacos();
      if (fonte[pos] !== "#") return pedacos.join("");
      pos++;
    }
  }

  // --- blocos ---------------------------------------------------------------

  function lerEntrada(tipo: string, linha: number, fecha: "}" | ")") {
    pularEspacos();
    const chave = lerIdentificador();
    chaveAtual = chave || undefined;
    if (!chave) throw new ErroLeitura("a entrada não tem chave de citação", pos);

    // Sem protótipo: um campo chamado `__proto__` ou `constructor` num arquivo
    // vindo de fora vira campo comum, não mexe no objeto.
    const campos: Record<string, string> = Object.create(null);
    for (;;) {
      pularEspacos();
      if (fonte[pos] === fecha) {
        pos++;
        break;
      }
      esperar(",");
      pularEspacos();
      // Vírgula depois do último campo é permitida.
      if (fonte[pos] === fecha) {
        pos++;
        break;
      }
      const nome = lerIdentificador().toLowerCase();
      if (!nome) throw new ErroLeitura("esperava o nome de um campo depois da vírgula", pos);
      esperar("=");
      const valor = lerValor();
      // Campo repetido: vale o primeiro, como no BibTeX.
      if (!Object.hasOwn(campos, nome)) campos[nome] = valor;
    }

    entradas.push({ tipo, chave, campos, linha });
  }

  function lerMacro(fecha: "}" | ")") {
    pularEspacos();
    const nome = lerIdentificador();
    if (!nome) throw new ErroLeitura("um @string ficou sem nome", pos);
    esperar("=");
    macros.set(nome.toLowerCase(), lerValor());
    esperar(fecha);
  }

  // Recomeço depois de um erro: a próxima `@` no começo de uma linha.
  function recomecarDepois(posicao: number) {
    const proxima = fonte.slice(posicao + 1).search(/\n\s*@/);
    pos = proxima === -1 ? fonte.length : posicao + 1 + proxima + 1;
  }

  // --- laço principal -------------------------------------------------------
  // Texto fora de `@...` é comentário, pela definição do próprio BibTeX.
  while (pos < fonte.length) {
    const arroba = fonte.indexOf("@", pos);
    if (arroba === -1) break;
    pos = arroba + 1;
    const linha = linhaDe(arroba);
    chaveAtual = undefined;

    // `%` antes do `@` na mesma linha: entrada comentada, do jeito que se
    // desliga uma referência no Overleaf. O BibTeX clássico a leria mesmo
    // assim; quem comentou a linha não espera que ela volte.
    const inicioDaLinha = fonte.lastIndexOf("\n", arroba) + 1;
    if (fonte.slice(inicioDaLinha, arroba).includes("%")) continue;

    try {
      const tipo = lerIdentificador().toLowerCase();
      pularEspacos();
      const abre = fonte[pos];
      // "@" sem tipo ou sem "{" logo depois é texto de comentário (um e-mail,
      // uma menção a "@string" num cabeçalho), não uma entrada malformada.
      if (!tipo || (abre !== "{" && abre !== "(")) continue;
      const fecha = abre === "{" ? "}" : ")";
      const inicioGrupo = pos;
      pos++;

      if (tipo === "comment" || tipo === "preamble") {
        lerBalanceado(fecha, inicioGrupo);
      } else if (tipo === "string") {
        lerMacro(fecha);
      } else {
        lerEntrada(tipo, linha, fecha);
      }
    } catch (erro) {
      if (!(erro instanceof ErroLeitura)) throw erro;
      erros.push({
        linha,
        ...(chaveAtual ? { chave: chaveAtual } : {}),
        mensagem: erro.message,
        linhaDaParada: linhaDe(erro.posicao),
      });
      recomecarDepois(arroba);
    }
  }

  return { entradas, erros };
}

function contadorDeLinhas(fonte: string): (posicao: number) => number {
  const inicios = [0];
  for (let i = 0; i < fonte.length; i++) if (fonte[i] === "\n") inicios.push(i + 1);
  return (posicao) => {
    let baixo = 0;
    let alto = inicios.length - 1;
    while (baixo < alto) {
      const meio = (baixo + alto + 1) >> 1;
      if (inicios[meio] <= posicao) baixo = meio;
      else alto = meio - 1;
    }
    return baixo + 1;
  };
}

// --- Decodificação de LaTeX --------------------------------------------------
// Um `.bib` escrito à mão (ou exportado do Google Acadêmico) traz acento como
// comando: `Jo{\~a}o`, `\c{c}`, `{\'\i}`. O do Zotero já vem em UTF-8. Os dois
// precisam chegar ao CSL-JSON como o mesmo texto — "João", não "Jo{\~a}o" —,
// senão a ordenação (§9.1) põe a referência no lugar errado.
//
// Cobre os acentos e letras que aparecem em nome e título reais. Comando
// desconhecido perde o nome e mantém o argumento (`\textit{X}` → "X"):
// formatação dentro do título não sobrevive ao CSL-JSON, e o destaque da
// referência é decisão do formatador (§6.7), não do arquivo importado.

// Acento → marca combinante Unicode, recomposta por `normalize("NFC")`.
const ACENTOS: Record<string, string> = {
  "'": "́",
  "`": "̀",
  "^": "̂",
  '"': "̈",
  "~": "̃",
  "=": "̄",
  ".": "̇",
  c: "̧",
  u: "̆",
  v: "̌",
  H: "̋",
  k: "̨",
  r: "̊",
  d: "̣",
  b: "̱",
};

const SIMBOLOS: Record<string, string> = {
  ss: "ß",
  o: "ø",
  O: "Ø",
  aa: "å",
  AA: "Å",
  ae: "æ",
  AE: "Æ",
  oe: "œ",
  OE: "Œ",
  l: "ł",
  L: "Ł",
  i: "ı",
  j: "ȷ",
  textendash: "–",
  textemdash: "—",
  ldots: "…",
  dots: "…",
  textquoteleft: "‘",
  textquoteright: "’",
  textquotedblleft: "“",
  textquotedblright: "”",
  S: "§",
};

// `\ı` com acento vira "í", não "ı́": o `\i` existe só para o acento não
// cair em cima do pingo.
const SEM_PINGO: Record<string, string> = { ı: "i", ȷ: "j" };

export function decodificarLatex(valor: string): string {
  let pos = 0;

  // Um argumento de comando: `{grupo}` ou um único "caractere" (que pode ser
  // outro comando, como em `\'\i`).
  function lerArgumento(): string {
    while (valor[pos] === " ") pos++;
    if (valor[pos] === "{") {
      pos++;
      return lerAte("}");
    }
    if (valor[pos] === "\\") return lerComando();
    return valor[pos++] ?? "";
  }

  function lerComando(): string {
    pos++; // a barra
    const c = valor[pos];
    if (c === undefined) return "";

    if (/[a-zA-Z]/.test(c)) {
      const inicio = pos;
      while (pos < valor.length && /[a-zA-Z]/.test(valor[pos])) pos++;
      const nome = valor.slice(inicio, pos);
      // Espaço depois de comando-palavra é separador do TeX, não texto.
      if (valor[pos] === " ") pos++;

      if (nome.length === 1 && Object.hasOwn(ACENTOS, nome))
        return acentuar(lerArgumento(), ACENTOS[nome]);
      if (Object.hasOwn(SIMBOLOS, nome)) return SIMBOLOS[nome];
      if (nome === "href") {
        lerArgumento();
        return lerArgumento();
      }
      // Comando com argumento → o argumento; sem argumento → nada.
      return valor[pos] === "{" ? lerArgumento() : "";
    }

    pos++;
    if (Object.hasOwn(ACENTOS, c)) return acentuar(lerArgumento(), ACENTOS[c]);
    if (c === "\\") return " ";
    // `\&`, `\%`, `\$`, `\#`, `\_`, `\{`, `\}`, `\ ` — o próprio caractere.
    return c;
  }

  function lerAte(fecha: string | null): string {
    let saida = "";
    while (pos < valor.length) {
      const c = valor[pos];
      if (fecha !== null && c === fecha) {
        pos++;
        return saida;
      }
      if (c === "\\") saida += lerComando();
      else if (c === "{") {
        pos++;
        saida += lerAte("}");
      } else if (c === "}" || c === "$") {
        // "}" solto só aparece se o valor já veio desbalanceado; "$" de modo
        // matemático não tem significado fora do TeX.
        pos++;
      } else if (c === "~") {
        saida += " ";
        pos++;
      } else {
        saida += c;
        pos++;
      }
    }
    return saida;
  }

  return lerAte(null)
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC");
}

function acentuar(texto: string, marca: string): string {
  if (!texto) return marca.normalize("NFC");
  const primeiro = SEM_PINGO[texto[0]] ?? texto[0];
  return (primeiro + marca + texto.slice(1)).normalize("NFC");
}

// Divide `texto` em `separador` só no nível zero de chaves — `{Ciência and
// Tecnologia}` não é dois autores, `{A: B}` não é título e subtítulo.
export function dividirNoNivelZero(texto: string, separador: RegExp): string[] {
  const partes: string[] = [];
  let profundidade = 0;
  let inicio = 0;
  const global = new RegExp(
    separador.source,
    separador.flags.includes("g") ? separador.flags : separador.flags + "g",
  );

  // Posições de chave em nível zero, para filtrar os casamentos do separador.
  const nivel: number[] = new Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "\\") {
      nivel[i] = profundidade;
      if (i + 1 < texto.length) nivel[++i] = profundidade;
      continue;
    }
    if (c === "{") profundidade++;
    nivel[i] = profundidade;
    if (c === "}") profundidade = Math.max(0, profundidade - 1);
  }

  for (const casamento of texto.matchAll(global)) {
    const i = casamento.index;
    if (nivel[i] !== 0 || casamento[0].length === 0) continue;
    partes.push(texto.slice(inicio, i));
    inicio = i + casamento[0].length;
  }
  partes.push(texto.slice(inicio));
  return partes;
}
