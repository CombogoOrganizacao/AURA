// O texto que a reimportação lê (passo 6.2.4), com o caminho de volta de cada
// posição para o arquivo e a linha de onde veio. Todo aviso do relatório diz
// a linha (docs/latex-abntex.md §1.5, princípio 1), e no `.zip` o corpo vem
// de vários arquivos (`sections/*.tex`) costurados no lugar do `\input`.
//
// Os comentários LaTeX saem aqui, antes de qualquer leitura, com a mesma
// regra do TeX: do `%` não escapado até o fim da linha, levando junto a
// quebra de linha e o recuo da linha seguinte. Uma linha só de comentário
// some inteira, e não conta como linha em branco (não separa parágrafo). A
// exceção são os marcadores do AURA (`% AURA-SECTION: …`), que ficam: são
// eles que a leitura procura.

export interface Posicao {
  arquivo: string;
  linha: number;
}

export interface Aviso extends Posicao {
  mensagem: string;
}

export interface LinhaFonte extends Posicao {
  texto: string;
}

export const MARCADOR_AURA = /^\s*% AURA-(SECTION|APENDICE|ANEXO): (\S+)\s*$/;

// Índice do `%` que abre comentário na linha, ou -1. `\%` é o caractere; um
// número par de barras antes do `%` (`\\%`) é quebra de linha e comentário.
export function inicioDoComentario(linha: string): number {
  for (let i = 0; i < linha.length; i++) {
    if (linha[i] !== "%") continue;
    let barras = 0;
    for (let j = i - 1; j >= 0 && linha[j] === "\\"; j--) barras++;
    if (barras % 2 === 0) return i;
  }
  return -1;
}

export class Fonte {
  private constructor(
    readonly texto: string,
    // Início de cada linha no texto, com a origem dela, em ordem crescente.
    private readonly inicios: readonly (Posicao & { inicio: number })[],
  ) {}

  static deLinhas(linhas: readonly LinhaFonte[]): Fonte {
    let texto = "";
    const inicios: (Posicao & { inicio: number })[] = [];
    let juntar = false;
    for (const linha of linhas) {
      let conteudo = linha.texto;
      const marcador = MARCADOR_AURA.test(conteudo);
      let comentario = marcador ? -1 : inicioDoComentario(conteudo);
      const soComentario = comentario >= 0 && conteudo.slice(0, comentario).trim() === "";
      if (soComentario) {
        // Linha inteira de comentário: não existe para o TeX. O "juntar" da
        // linha anterior continua valendo para a próxima.
        continue;
      }
      // Depois de um comentário, a linha em branco continua sendo linha em
      // branco para o TeX: separa parágrafo.
      const emBranco = conteudo.trim() === "";
      if (juntar) conteudo = conteudo.trimStart();
      if (comentario >= 0) {
        comentario = inicioDoComentario(conteudo);
        conteudo = conteudo.slice(0, comentario);
      }
      if (texto.length > 0 && (!juntar || emBranco)) texto += "\n";
      inicios.push({ inicio: texto.length, arquivo: linha.arquivo, linha: linha.linha });
      texto += conteudo;
      juntar = comentario >= 0;
    }
    return new Fonte(texto, inicios);
  }

  posicao(offset: number): Posicao {
    let baixo = 0;
    let alto = this.inicios.length - 1;
    if (alto < 0) return { arquivo: "", linha: 0 };
    while (baixo < alto) {
      const meio = (baixo + alto + 1) >> 1;
      if (this.inicios[meio].inicio <= offset) baixo = meio;
      else alto = meio - 1;
    }
    const { arquivo, linha } = this.inicios[baixo];
    return { arquivo, linha };
  }
}

export function linhasDe(texto: string, arquivo: string, primeira = 1): LinhaFonte[] {
  return texto
    .split("\n")
    .map((linha, indice) => ({ arquivo, linha: primeira + indice, texto: linha }));
}

// --- Varredura ---------------------------------------------------------------
// Primitivas sobre o texto da fonte. Todas recebem a posição e devolvem onde
// terminaram, sem estado: quem lê decide o que fazer com o que achou.

export function pularEspacos(texto: string, pos: number, fim = texto.length): number {
  while (pos < fim && /\s/.test(texto[pos])) pos++;
  return pos;
}

// **Pares calculados uma vez por texto.** Procurar o fechamento varrendo a
// cada chave aberta é quadrático num arquivo com milhares de `{` sem par: a
// aba travaria. Uma pilha, numa passada só, dá o par de toda chave; o texto
// que está sendo lido fica guardado até o próximo.
let pares: { texto: string; chaves: Int32Array; ambientes: Map<number, number> } | null = null;

function paresDe(texto: string) {
  if (pares?.texto === texto) return pares;
  const chaves = new Int32Array(texto.length).fill(-1);
  const abertas: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "\\") i++;
    else if (c === "{") abertas.push(i);
    else if (c === "}" && abertas.length > 0) chaves[abertas.pop()!] = i;
  }
  // `\begin{nome}` → posição do `\end{nome}` que o fecha, com aninhamento
  // do mesmo nome.
  const ambientes = new Map<number, number>();
  const abertos = new Map<string, number[]>();
  for (const achado of texto.matchAll(/\\(begin|end)\{([^{}\n]*)\}/g)) {
    const nome = achado[2];
    if (achado[1] === "begin") {
      const pilha = abertos.get(nome) ?? [];
      pilha.push(achado.index);
      abertos.set(nome, pilha);
    } else {
      const inicio = abertos.get(nome)?.pop();
      if (inicio !== undefined) ambientes.set(inicio, achado.index);
    }
  }
  pares = { texto, chaves, ambientes };
  return pares;
}

// Solta o texto guardado. Chamada no fim de cada leitura: um `.tex` grande
// não fica ocupando memória na aba depois de lido.
export function liberarPares() {
  pares = null;
}

// Com `texto[pos] === "{"`: posição do `}` que fecha, antes de `fim`, ou -1.
// `\{` e `\}` são caracteres, não contam.
export function fechaChave(texto: string, pos: number, fim = texto.length): number {
  if (texto[pos] !== "{") return -1;
  const fecha = paresDe(texto).chaves[pos];
  return fecha >= 0 && fecha < fim ? fecha : -1;
}

// O argumento opcional é curto no que o AURA escreve (atributos da citação,
// medidas da imagem). O limite deixa a busca linear num `[` sem par.
const TAMANHO_MAXIMO_OPCIONAL = 2_000;

// Com `texto[pos] === "["`: posição do `]` que fecha, fora de chaves, ou -1.
export function fechaColchete(texto: string, pos: number, fim = texto.length): number {
  let profundidade = 0;
  fim = Math.min(fim, pos + TAMANHO_MAXIMO_OPCIONAL);
  for (let i = pos + 1; i < fim; i++) {
    const c = texto[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "{") profundidade++;
    else if (c === "}") profundidade--;
    else if (c === "]" && profundidade === 0) return i;
  }
  return -1;
}

export interface Grupo {
  // Conteúdo, sem os delimitadores.
  inicio: number;
  fim: number;
  // Posição logo depois do delimitador de fechamento.
  depois: number;
}

// Argumento obrigatório `{…}` a partir de `pos`, pulando espaços antes.
export function lerGrupo(texto: string, pos: number, fim = texto.length): Grupo | null {
  const abre = pularEspacos(texto, pos, fim);
  if (texto[abre] !== "{") return null;
  const fecha = fechaChave(texto, abre, fim);
  if (fecha < 0) return null;
  return { inicio: abre + 1, fim: fecha, depois: fecha + 1 };
}

// Argumento opcional `[…]` a partir de `pos`, sem pular espaços (como o
// LaTeX2e, que só o reconhece colado).
export function lerOpcional(texto: string, pos: number, fim = texto.length): Grupo | null {
  if (texto[pos] !== "[") return null;
  const fecha = fechaColchete(texto, pos, fim);
  if (fecha < 0) return null;
  return { inicio: pos + 1, fim: fecha, depois: fecha + 1 };
}

// Com `texto[pos] === "\\"`: nome do comando (letras, ou um caractere só) e
// a posição logo depois dele.
export function lerNomeDeComando(texto: string, pos: number): { nome: string; depois: number } {
  let i = pos + 1;
  if (i >= texto.length) return { nome: "", depois: i };
  if (/[a-zA-Z@]/.test(texto[i])) {
    while (i < texto.length && /[a-zA-Z@]/.test(texto[i])) i++;
    return { nome: texto.slice(pos + 1, i), depois: i };
  }
  return { nome: texto[i], depois: i + 1 };
}

// Com o `\begin{nome}` em `pos`: posição do `\end{nome}` que o fecha, com
// aninhamento do mesmo nome, ou -1.
export function fimDoAmbiente(texto: string, pos: number, fim = texto.length): number {
  const fecha = paresDe(texto).ambientes.get(pos);
  return fecha !== undefined && fecha < fim ? fecha : -1;
}

// Divide `texto[inicio, fim)` num separador, só fora de chaves. `\&` e `\\`
// dentro de um comando não dividem.
export function dividirForaDeChaves(
  texto: string,
  inicio: number,
  fim: number,
  separador: "&" | "\\\\",
): { inicio: number; fim: number }[] {
  const partes: { inicio: number; fim: number }[] = [];
  let profundidade = 0;
  let parte = inicio;
  for (let i = inicio; i < fim; i++) {
    const c = texto[i];
    if (c === "\\") {
      if (separador === "\\\\" && texto[i + 1] === "\\" && profundidade === 0) {
        partes.push({ inicio: parte, fim: i });
        parte = i + 2;
      }
      i++;
      continue;
    }
    if (c === "{") profundidade++;
    else if (c === "}") profundidade--;
    else if (separador === "&" && c === "&" && profundidade === 0) {
      partes.push({ inicio: parte, fim: i });
      parte = i + 1;
    }
  }
  partes.push({ inicio: parte, fim });
  return partes;
}

// Fim de um comando desconhecido com os argumentos colados ao nome: `*`,
// `[…]` e `{…}` em sequência, sem espaço entre eles. É o trecho que volta
// como texto literal (docs/latex-abntex.md §1.5).
export function fimDosArgumentos(texto: string, depois: number, fim = texto.length): number {
  let pos = depois;
  if (texto[pos] === "*") pos++;
  for (;;) {
    let grupo = lerOpcional(texto, pos, fim);
    if (!grupo && texto[pos] === "{") {
      const fecha = fechaChave(texto, pos, fim);
      if (fecha >= 0) grupo = { inicio: pos + 1, fim: fecha, depois: fecha + 1 };
    }
    if (!grupo) return pos;
    pos = grupo.depois;
  }
}
