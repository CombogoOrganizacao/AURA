import type {
  CelulaTabela,
  LinhaTabela,
  NoCitacaoLonga,
  NoFigura,
  NoFormula,
  NoInline,
  NoParagrafo,
  NoTabela,
} from "../../document/types";
import {
  dividirForaDeChaves,
  fechaChave,
  fimDoAmbiente,
  fimDosArgumentos,
  lerGrupo,
  lerNomeDeComando,
  lerOpcional,
  MARCADOR_AURA,
  pularEspacos,
  type Fonte,
} from "./fonte";
import {
  lerAtributos,
  lerInline,
  lerInlineDeCelula,
  paginaDaCitacao,
  PROFUNDIDADE_MAXIMA,
  textoPlano,
  type ContextoInline,
} from "./inline";

// Blocos do `.tex`: a região lida como uma sequência plana de marcadores,
// títulos, mudanças de parte e blocos do schema. Serve ao `.tex` do AURA
// (passo 6.2.4, `lerTex.ts`) e ao de fora (6.2.5, `externo.ts`); quem monta
// seções, apêndices e anexos com os itens é cada um deles. Regras em
// docs/latex-abntex.md §1.5 e §1.6.

// Figura e tabela sem `id`: o `.tex` não guarda o `id` do nó. Quem aplica
// (`reimport.ts`) casa com a figura que já existia ou cria um `id` novo.
// `caminho`: a imagem é um arquivo que não segue o padrão do AURA
// (`figuras/<id>.png`); quem tem o `.zip` a resolve (`reimportZip.ts`).
export type FiguraLida = Omit<NoFigura, "id"> & { caminho?: string };
export type TabelaLida = Omit<NoTabela, "id">;

// Figura ou tabela dentro de apêndice/anexo: o `.tex` do AURA ainda não as
// exporta (`conteudoPosTextual()`), e escreve um aviso no lugar. Na volta, o
// aviso marca a posição, e quem aplica põe de volta o nó que já existia.
export interface NaoExportado {
  type: "nao_exportado";
  tipo: "figura" | "tabela";
}

export type BlocoLido =
  NoParagrafo | NoCitacaoLonga | NoFormula | FiguraLida | TabelaLida | NaoExportado;

export type QualPosTextual = "APENDICE" | "ANEXO";

export type Item =
  | { tipo: "marcador"; qual: "SECTION" | QualPosTextual; id: string; pos: number }
  | { tipo: "titulo"; comando: string; titulo: string; estrela: boolean; pos: number }
  | { tipo: "tituloPos"; titulo: string; pos: number }
  // `\postextual`, `\backmatter`: acabou o texto.
  | { tipo: "parte"; pos: number }
  // `\apendices`, `\anexos`, `\appendix` e os ambientes do abnTeX2; `null`
  // no fim do ambiente.
  | { tipo: "contexto"; qual: QualPosTextual | null; pos: number }
  | { tipo: "bloco"; bloco: BlocoLido; pos: number };

export interface ItensLidos {
  fonte: Fonte;
  itens: Item[];
}

// `aura`: as duas regiões do `.tex` do AURA (6.2.4). `externo`: o corpo
// inteiro de um `.tex` de fora (6.2.5), com as mudanças de parte.
export type ModoLeitura = "textual" | "posTextual" | "externo";

const COMANDOS_DE_TITULO = new Set(["chapter", "section", "subsection", "subsubsection"]);
const PARTE = new Set(["postextual", "backmatter"]);
const CONTEXTO: Record<string, QualPosTextual> = {
  apendices: "APENDICE",
  partapendices: "APENDICE",
  appendix: "APENDICE",
  anexos: "ANEXO",
  partanexos: "ANEXO",
};
const AMBIENTE_DE_CONTEXTO: Record<string, QualPosTextual> = {
  apendicesenv: "APENDICE",
  anexosenv: "ANEXO",
};

// Começo de linha que encerra o parágrafo em curso.
const INICIO_DE_BLOCO =
  /^[ \t]*(% AURA-|\\(chapter|section|subsection|subsubsection|paragraph|subparagraph|part|pretextualchapter|phantomsection|postextual|backmatter|apendices|anexos|partapendices|partanexos|appendix)(?![a-zA-Z])|\\begin\{|\\end\{(apendicesenv|anexosenv)\}|\\\[|\$\$)/;

export function lerItens(
  ctx: ContextoInline,
  modo: ModoLeitura,
  inicio = 0,
  fim = ctx.fonte.texto.length,
): ItensLidos {
  const { fonte } = ctx;
  const t = fonte.texto;
  const itens: Item[] = [];
  let i = inicio;
  const avisar = (pos: number, mensagem: string) =>
    ctx.avisos.push({ ...fonte.posicao(pos), mensagem });

  while ((i = pularEspacos(t, i, fim)) < fim) {
    const quebra = t.indexOf("\n", i);
    const fimDaLinha = quebra < 0 || quebra > fim ? fim : quebra;
    const marcador = MARCADOR_AURA.exec(t.slice(i, fimDaLinha));
    if (marcador) {
      itens.push({ tipo: "marcador", qual: marcador[1] as "SECTION", id: marcador[2], pos: i });
      i = fimDaLinha;
      continue;
    }

    // `$$ … $$`: fórmula em bloco, à moda antiga.
    if (t.startsWith("$$", i)) {
      const fecha = t.indexOf("$$", i + 2);
      if (fecha >= 0 && fecha < fim) {
        itens.push({
          tipo: "bloco",
          bloco: { type: "formula", texto: t.slice(i + 2, fecha).trim() },
          pos: i,
        });
        i = fecha + 2;
        continue;
      }
    }

    if (t[i] === "\\") {
      const { nome, depois } = lerNomeDeComando(t, i);

      if (modo === "externo" && PARTE.has(nome)) {
        itens.push({ tipo: "parte", pos: i });
        i = depois;
        continue;
      }
      if (modo === "externo" && Object.hasOwn(CONTEXTO, nome)) {
        itens.push({ tipo: "contexto", qual: CONTEXTO[nome], pos: i });
        i = depois;
        continue;
      }
      if (modo === "externo" && (nome === "begin" || nome === "end")) {
        const grupo = lerGrupo(t, depois, fim);
        const ambiente = grupo ? t.slice(grupo.inicio, grupo.fim) : "";
        if (grupo && Object.hasOwn(AMBIENTE_DE_CONTEXTO, ambiente)) {
          itens.push({
            tipo: "contexto",
            qual: nome === "begin" ? AMBIENTE_DE_CONTEXTO[ambiente] : null,
            pos: i,
          });
          i = grupo.depois;
          continue;
        }
      }

      if (COMANDOS_DE_TITULO.has(nome)) {
        const estrela = t[depois] === "*";
        const opcional = lerOpcional(t, depois + (estrela ? 1 : 0), fim);
        const grupo = lerGrupo(t, opcional?.depois ?? depois + (estrela ? 1 : 0), fim);
        if (grupo) {
          const titulo = textoPlano(ctx, grupo.inicio, grupo.fim, "o título", { titulo: true });
          itens.push({ tipo: "titulo", comando: nome, titulo, estrela, pos: i });
          i = grupo.depois;
          continue;
        }
      }

      // Abaixo do terceiro nível (e `\part`, acima do primeiro): o AURA não
      // tem esse título, e ele vira um parágrafo em negrito.
      if (nome === "paragraph" || nome === "subparagraph" || nome === "part") {
        const estrela = t[depois] === "*" ? 1 : 0;
        const opcional = lerOpcional(t, depois + estrela, fim);
        const grupo = lerGrupo(t, opcional?.depois ?? depois + estrela, fim);
        if (grupo) {
          const titulo = textoPlano(ctx, grupo.inicio, grupo.fim, "o título", { titulo: true });
          avisar(
            i,
            `\\${nome}{${titulo}}: o AURA tem três níveis de seção, e ele virou um parágrafo em negrito.`,
          );
          if (titulo) {
            itens.push({
              tipo: "bloco",
              bloco: {
                type: "paragraph",
                content: [{ type: "text", text: titulo, marks: [{ type: "negrito" }] }],
              },
              pos: i,
            });
          }
          i = grupo.depois;
          continue;
        }
      }

      if (nome === "pretextualchapter" && modo !== "textual") {
        const grupo = lerGrupo(t, depois, fim);
        if (grupo) {
          itens.push({
            tipo: "tituloPos",
            titulo: tituloPosTextual(ctx, grupo.inicio, grupo.fim),
            pos: i,
          });
          i = grupo.depois;
          continue;
        }
      }

      // `\phantomsection\addcontentsline{toc}{chapter}{…}` depois do título
      // de apêndice e anexo: entrada do sumário, derivada.
      if (nome === "phantomsection") {
        let ate = depois;
        if (t.startsWith("\\addcontentsline", ate)) {
          ate = fimDosArgumentos(t, ate + "\\addcontentsline".length, fim);
        }
        i = ate;
        continue;
      }

      if (nome === "begin") {
        const lido = lerAmbiente(ctx, modo, i, depois, fim);
        if (lido) {
          itens.push(...lido.itens);
          i = lido.depois;
          continue;
        }
      }

      if (nome === "[") {
        const fecha = t.indexOf("\\]", depois);
        if (fecha >= 0 && fecha < fim) {
          itens.push({
            tipo: "bloco",
            bloco: { type: "formula", texto: t.slice(depois, fecha).trim() },
            pos: i,
          });
          i = fecha + 2;
          continue;
        }
        avisar(i, "Fórmula \\[ sem o \\] que a fecha: entrou como texto.");
      }
    }

    // Parágrafo: até a linha em branco ou o começo de outro bloco, fora de
    // chaves.
    const ate = fimDoParagrafo(t, i, fim);
    const content = lerInline(ctx, i, ate);
    if (content.length > 0)
      itens.push({ tipo: "bloco", bloco: { type: "paragraph", content }, pos: i });
    i = ate;
  }
  return { fonte, itens };
}

function fimDoParagrafo(t: string, inicio: number, fim: number): number {
  let profundidade = 0;
  for (let i = inicio; i < fim; i++) {
    const c = t[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "{") profundidade++;
    else if (c === "}") profundidade--;
    else if (c === "\n" && profundidade <= 0) {
      const proxima = t.indexOf("\n", i + 1);
      const linha = t.slice(i + 1, proxima < 0 || proxima > fim ? fim : proxima);
      if (linha.trim() === "" || INICIO_DE_BLOCO.test(linha)) return i;
    }
  }
  return fim;
}

// Título de apêndice e anexo: `\texorpdfstring{\protect\MakeUppercase{T}}{T}`
// (`tituloDeApendiceOuAnexo()`). O segundo argumento é o título como o aluno
// o escreveu.
function tituloPosTextual(ctx: ContextoInline, inicio: number, fim: number): string {
  const t = ctx.fonte.texto;
  const comeco = pularEspacos(t, inicio, fim);
  if (t.startsWith("\\texorpdfstring", comeco)) {
    const primeiro = lerGrupo(t, comeco + "\\texorpdfstring".length, fim);
    const segundo = primeiro && lerGrupo(t, primeiro.depois, fim);
    if (segundo) return textoPlano(ctx, segundo.inicio, segundo.fim, "o título", { titulo: true });
  }
  return textoPlano(ctx, inicio, fim, "o título", { titulo: true });
}

// --- Ambientes ---------------------------------------------------------------

interface AmbienteLido {
  itens: Item[];
  depois: number;
}

interface Faixa {
  inicio: number;
  fim: number;
}

export function paragrafoLiteral(texto: string): NoParagrafo {
  return {
    type: "paragraph",
    content: [{ type: "text", text: texto.replace(/\s+/g, " ").trim() }],
  };
}

const LISTAS = new Set(["itemize", "enumerate", "description"]);
const CITACOES_LONGAS = new Set(["citacao", "quote", "quotation"]);
const TABULARES = new Set(["tabular", "tabular*", "tabularx", "tabulary", "longtable"]);
const FIGURAS = new Set(["figure", "figure*"]);
const TABELAS = new Set(["table", "table*"]);

// Fórmula em bloco. As de várias linhas vão dentro de um ambiente que o
// KaTeX da tela desenha sozinho (`aligned`, `gathered`).
const MATEMATICA_EM_BLOCO: Record<string, string | null> = {
  equation: null,
  "equation*": null,
  displaymath: null,
  math: null,
  multline: null,
  "multline*": null,
  align: "aligned",
  "align*": "aligned",
  flalign: "aligned",
  "flalign*": "aligned",
  eqnarray: "aligned",
  "eqnarray*": "aligned",
  gather: "gathered",
  "gather*": "gathered",
};

// Só mudam a forma: o conteúdo é lido como se o ambiente não existisse. Os
// da segunda lista têm argumento depois do nome.
const TRANSPARENTES = new Set([
  "center",
  "flushleft",
  "flushright",
  "small",
  "footnotesize",
  "scriptsize",
  "large",
  "singlespace",
  "SingleSpace",
  "onehalfspace",
  "OnehalfSpace",
  "doublespace",
  "landscape",
]);
const TRANSPARENTES_COM_ARGUMENTO = new Set([
  "minipage",
  "spacing",
  "otherlanguage",
  "otherlanguage*",
  "adjustbox",
]);

// Ambiente dentro de ambiente, lido por dentro (os que só mudam a forma):
// conta na mesma profundidade dos grupos do inline, para um arquivo com
// milhares deles um dentro do outro não estourar a pilha.
function lerAmbiente(
  ctx: ContextoInline,
  modo: ModoLeitura,
  pos: number,
  depoisDoBegin: number,
  limite: number,
): AmbienteLido | null {
  if (ctx.profundidade >= PROFUNDIDADE_MAXIMA) {
    const fecha = fimDoAmbiente(ctx.fonte.texto, pos, limite);
    if (fecha < 0) return null;
    const depois = ctx.fonte.texto.indexOf("}", fecha) + 1;
    ctx.avisos.push({
      ...ctx.fonte.posicao(pos),
      mensagem: "Ambientes aninhados demais: o trecho entrou como texto.",
    });
    return {
      itens: [{ tipo: "bloco", bloco: paragrafoLiteral(ctx.fonte.texto.slice(pos, depois)), pos }],
      depois,
    };
  }
  ctx.profundidade++;
  try {
    return lerAmbienteDentro(ctx, modo, pos, depoisDoBegin, limite);
  } finally {
    ctx.profundidade--;
  }
}

function lerAmbienteDentro(
  ctx: ContextoInline,
  modo: ModoLeitura,
  pos: number,
  depoisDoBegin: number,
  limite: number,
): AmbienteLido | null {
  const t = ctx.fonte.texto;
  const nomeGrupo = lerGrupo(t, depoisDoBegin, limite);
  if (!nomeGrupo) return null;
  const nome = t.slice(nomeGrupo.inicio, nomeGrupo.fim);
  const fecha = fimDoAmbiente(t, pos, limite);
  const avisar = (mensagem: string) => ctx.avisos.push({ ...ctx.fonte.posicao(pos), mensagem });
  if (fecha < 0) {
    avisar(`Ambiente ${nome} sem \\end{${nome}}: entrou como texto.`);
    return null;
  }
  const depois = fecha + `\\end{${nome}}`.length;
  const dentro = { inicio: nomeGrupo.depois, fim: fecha };
  const blocos = (lista: BlocoLido[]): AmbienteLido => ({
    itens: lista.map((bloco) => ({ tipo: "bloco", bloco, pos })),
    depois,
  });

  if (nome === "auracitacaolonga") return blocos([citacaoLonga(ctx, pos, dentro)]);
  if (FIGURAS.has(nome)) return blocos(figura(ctx, pos, dentro));
  if (TABELAS.has(nome)) return blocos(tabelaFlutuante(ctx, pos, dentro));
  if (nome === "longtable") return tabelaLonga(ctx, pos, dentro, depois);
  if (TABULARES.has(nome)) {
    avisar("Tabela sem legenda (fora de um ambiente table): entrou sem título.");
    return blocos([
      { type: "tabela", legenda: "", fonte: "", linhas: grade(ctx, nome, dentro).linhas },
    ]);
  }
  if (LISTAS.has(nome)) {
    avisar(`Lista (${nome}) virou um parágrafo por item: o AURA ainda não tem lista.`);
    return blocos(lista(ctx, nome, dentro, 0));
  }
  if (CITACOES_LONGAS.has(nome)) return blocos([citacaoDeFora(ctx, dentro)]);
  if (Object.hasOwn(MATEMATICA_EM_BLOCO, nome)) {
    return blocos([formulaEmBloco(t.slice(dentro.inicio, dentro.fim), MATEMATICA_EM_BLOCO[nome])]);
  }
  if (nome === "center") {
    const doAura = centroDoAura(ctx, dentro, t.slice(pos, depois));
    if (doAura) return blocos([doAura]);
  }
  if (TRANSPARENTES.has(nome) || TRANSPARENTES_COM_ARGUMENTO.has(nome)) {
    const inicio = TRANSPARENTES_COM_ARGUMENTO.has(nome)
      ? fimDosArgumentos(t, dentro.inicio, dentro.fim)
      : dentro.inicio;
    return { itens: lerItens(ctx, modo, inicio, dentro.fim).itens, depois };
  }
  avisar(`Ambiente ${nome} não reconhecido: entrou como texto.`);
  return blocos([paragrafoLiteral(t.slice(pos, depois))]);
}

// Fórmula: o LaTeX de dentro, como o aluno escreveu, sem o que só numera.
function formulaEmBloco(bruto: string, envolver: string | null): NoFormula {
  const texto = bruto
    .replace(/\\label\s*\{[^{}]*\}/g, "")
    .replace(/\\(nonumber|notag)(?![a-zA-Z])/g, "")
    .trim();
  return {
    type: "formula",
    texto: envolver ? `\\begin{${envolver}}\n${texto}\n\\end{${envolver}}` : texto,
  };
}

// `\begin{auracitacaolonga}[pagina={…}]{refId}` + texto + `\aurachamada{…}`.
function citacaoLonga(ctx: ContextoInline, pos: number, dentro: Faixa): NoCitacaoLonga {
  const t = ctx.fonte.texto;
  const opcional = lerOpcional(t, dentro.inicio, dentro.fim);
  const ref = lerGrupo(t, opcional?.depois ?? dentro.inicio, dentro.fim);
  const refId = ref ? textoPlano(ctx, ref.inicio, ref.fim, "a chave da citação") : "";
  const paginaLida = opcional ? lerAtributos(t, opcional).get("pagina") : undefined;
  const pagina = paginaLida ? textoPlano(ctx, paginaLida.inicio, paginaLida.fim, "a página") : "";

  let inicio = ref?.depois ?? dentro.inicio;
  let fim = dentro.fim;
  // A chamada no fim é derivada: sai do texto e vai para a lista de chamadas.
  const chamada = t.lastIndexOf("\\aurachamada", fim);
  if (chamada >= inicio) {
    const grupo = lerGrupo(t, chamada + "\\aurachamada".length, fim);
    if (grupo && t.slice(grupo.depois, fim).trim() === "") {
      ctx.chamadas.push({
        ...ctx.fonte.posicao(chamada),
        citacao: { refId, pagina: pagina || null },
        texto: textoPlano(ctx, grupo.inicio, grupo.fim, "a chamada"),
      });
      fim = chamada;
    }
  }
  inicio = pularEspacos(t, inicio, fim);
  if (!ref) {
    ctx.avisos.push({
      ...ctx.fonte.posicao(pos),
      mensagem: "Citação longa sem a chave da referência: voltou sem ligação.",
    });
  }
  const content = lerInline(ctx, inicio, fim);
  return {
    type: "citacao_longa",
    refId: refId || null,
    pagina,
    ...(content.length > 0 ? { content } : {}),
  };
}

// `citacao` do abnTeX2, `quote` e `quotation`: citação longa. Um `\cite` no
// fim dá a referência e a página (§1.6).
const CITE_NO_FIM =
  /\\(?:cite|citeonline|parencite|autocite|textcite|citep|citet|footcite)\*?((?:\[[^\]]*\]){0,2})\{([^{}]*)\}[\s.]*$/;

function citacaoDeFora(ctx: ContextoInline, dentro: Faixa): NoCitacaoLonga {
  const t = ctx.fonte.texto;
  let fim = dentro.fim;
  let refId: string | null = null;
  let pagina = "";
  const achado = CITE_NO_FIM.exec(t.slice(dentro.inicio, dentro.fim));
  const chave = achado?.[2]
    .split(",")
    .map((item) => item.trim())
    .find((item) => ctx.chaves.has(item));
  if (achado && chave) {
    refId = chave;
    const opcionais = [...achado[1].matchAll(/\[([^\]]*)\]/g)];
    const ultimo = opcionais.at(-1)?.[1];
    if (ultimo) pagina = paginaDaCitacao(ultimo.replace(/~/g, " "));
    fim = dentro.inicio + achado.index;
  }
  const content = lerInline(ctx, pularEspacos(t, dentro.inicio, fim), fim);
  return { type: "citacao_longa", refId, pagina, ...(content.length > 0 ? { content } : {}) };
}

// --- Listas ------------------------------------------------------------------

const NUMERAIS_ROMANOS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

function rotuloDoItem(lista: string, nivel: number, indice: number): string {
  if (lista === "itemize") return ["•", "–", "·"][Math.min(nivel, 2)];
  if (nivel === 1) return `${String.fromCharCode(97 + (indice % 26))})`;
  if (nivel >= 2) return `${NUMERAIS_ROMANOS[indice % 10]}.`;
  return `${indice + 1}.`;
}

// Os `\item` do nível desta lista, sem os das listas de dentro.
function itensDaLista(t: string, dentro: Faixa) {
  const itens: { inicio: number; fim: number; rotulo: Faixa | null }[] = [];
  let i = dentro.inicio;
  while (i < dentro.fim) {
    const c = t[i];
    if (c === "\\") {
      const { nome, depois } = lerNomeDeComando(t, i);
      if (nome === "item") {
        const anterior = itens.at(-1);
        if (anterior) anterior.fim = i;
        const opcional = lerOpcional(t, depois, dentro.fim);
        itens.push({
          inicio: opcional?.depois ?? depois,
          fim: dentro.fim,
          rotulo: opcional ? { inicio: opcional.inicio, fim: opcional.fim } : null,
        });
        i = opcional?.depois ?? depois;
        continue;
      }
      if (nome === "begin") {
        const fecha = fimDoAmbiente(t, i, dentro.fim);
        const grupo = lerGrupo(t, depois, dentro.fim);
        if (fecha >= 0 && grupo) {
          i = fecha + `\\end{${t.slice(grupo.inicio, grupo.fim)}}`.length;
          continue;
        }
      }
      i = depois;
      continue;
    }
    if (c === "{") {
      const fecha = fechaChave(t, i, dentro.fim);
      i = fecha >= 0 ? fecha + 1 : i + 1;
      continue;
    }
    i++;
  }
  return itens;
}

// Um parágrafo por item, com o rótulo na frente (§1.6). Lista dentro de item
// vira os parágrafos dela, com o rótulo do nível seguinte.
function lista(ctx: ContextoInline, tipo: string, dentro: Faixa, nivel: number): NoParagrafo[] {
  const t = ctx.fonte.texto;
  if (nivel >= PROFUNDIDADE_MAXIMA) {
    ctx.avisos.push({
      ...ctx.fonte.posicao(dentro.inicio),
      mensagem: "Listas aninhadas demais: o trecho entrou como texto.",
    });
    return [paragrafoLiteral(t.slice(dentro.inicio, dentro.fim))];
  }
  const paragrafos: NoParagrafo[] = [];
  for (const [indice, item] of itensDaLista(t, dentro).entries()) {
    const rotulo = item.rotulo
      ? `${textoPlano(ctx, item.rotulo.inicio, item.rotulo.fim, "o rótulo")}:`
      : rotuloDoItem(tipo, nivel, indice);
    let inicio = item.inicio;
    let primeiro = true;
    const fecharTrecho = (ate: number) => {
      const content = lerInline(ctx, inicio, ate);
      if (content.length === 0 && !primeiro) return;
      paragrafos.push({
        type: "paragraph",
        content: primeiro ? comRotulo(rotulo, content, Boolean(item.rotulo)) : content,
      });
      primeiro = false;
    };
    // Listas de dentro, no nível deste item. A busca fica no trecho do item:
    // procurar até o fim do arquivo, a cada item, seria quadrático.
    const trecho = t.slice(item.inicio, item.fim);
    for (const achado of trecho.matchAll(/\\begin\{(itemize|enumerate|description)\}/g)) {
      const abre = item.inicio + achado.index;
      // Dentro de uma lista de dentro já lida.
      if (abre < inicio) continue;
      const fecha = fimDoAmbiente(t, abre, item.fim);
      if (fecha < 0) break;
      fecharTrecho(abre);
      paragrafos.push(
        ...lista(ctx, achado[1], { inicio: abre + achado[0].length, fim: fecha }, nivel + 1),
      );
      inicio = fecha + `\\end{${achado[1]}}`.length;
    }
    fecharTrecho(item.fim);
  }
  return paragrafos;
}

function comRotulo(rotulo: string, content: NoInline[], negrito: boolean): NoInline[] {
  if (negrito) {
    return [{ type: "text", text: `${rotulo} `, marks: [{ type: "negrito" }] }, ...content];
  }
  const [primeiro, ...resto] = content;
  // Texto sem marca logo depois: o rótulo entra nele, num nó só.
  if (primeiro?.type === "text" && !primeiro.marks?.length) {
    return [{ type: "text", text: `${rotulo} ${primeiro.text}` }, ...resto];
  }
  return [{ type: "text", text: `${rotulo} ` }, ...content];
}

// --- Figura e tabela ---------------------------------------------------------

// Comandos dentro de figura e tabela que são só da forma, não do conteúdo.
const SO_FORMA = new Set([
  "auraespacosimples",
  "centering",
  "par",
  "vspace",
  "hspace",
  "hfill",
  "smallskip",
  "medskip",
  "bigskip",
  "noindent",
  "small",
  "footnotesize",
  "scriptsize",
  "label",
  "captionsetup",
  "setlength",
  "renewcommand",
  "toprule",
  "midrule",
  "bottomrule",
  "hline",
]);

// Percorre os comandos de dentro de um ambiente. `tratar` devolve onde o
// comando terminou, ou `null` para o que não conhece. O que sobra (texto,
// grupos `{…}` e comandos desconhecidos) é juntado em trechos contíguos: um
// trecho que começa por "Fonte:" é a fonte (`aoAcharFonte`), que muito TCC
// escreve solta, sem `\legend` — `{\footnotesize Fonte: …}` ou
// `{ \textbf{Fonte:} … }`. O resto volta como parágrafo depois do bloco, lido
// pelo inline (negrito vira negrito, não `\textbf` cru).
function comandosDoAmbiente(
  ctx: ContextoInline,
  pos: number,
  dentro: Faixa,
  onde: string,
  tratar: (nome: string, inicio: number, depois: number) => number | null,
  aoAcharFonte: (fonte: string) => boolean,
): NoParagrafo[] {
  const t = ctx.fonte.texto;
  const sobras: Faixa[] = [];
  const sobrar = (inicio: number, fim: number) => {
    const anterior = sobras.at(-1);
    // Contíguo ao trecho anterior (só espaço entre eles): é o mesmo trecho.
    if (anterior && t.slice(anterior.fim, inicio).trim() === "") anterior.fim = fim;
    else sobras.push({ inicio, fim });
  };
  let i = dentro.inicio;
  while ((i = pularEspacos(t, i, dentro.fim)) < dentro.fim) {
    if (t[i] === "\\") {
      const { nome, depois } = lerNomeDeComando(t, i);
      if (SO_FORMA.has(nome)) {
        i = fimDosArgumentos(t, depois, dentro.fim);
        continue;
      }
      const ate = tratar(nome, i, depois);
      if (ate !== null) {
        i = ate;
        continue;
      }
      // `\begin{center}` e `\end{center}` em volta do conteúdo: só forma.
      if (nome === "begin" || nome === "end") {
        i = lerGrupo(t, depois, dentro.fim)?.depois ?? depois;
        continue;
      }
      const fim = fimDosArgumentos(t, depois, dentro.fim);
      sobrar(i, fim);
      i = fim;
      continue;
    }
    if (t[i] === "{") {
      const fim = lerGrupo(t, i, dentro.fim)?.depois ?? dentro.fim;
      sobrar(i, fim);
      i = fim;
      continue;
    }
    let ate = i;
    while (ate < dentro.fim && t[ate] !== "\\" && t[ate] !== "{") ate++;
    sobrar(i, ate);
    i = ate;
  }

  const paragrafos: NoParagrafo[] = [];
  for (const sobra of sobras) {
    if (pareceFonte(t, sobra)) {
      const fonte = fonteDoTexto(textoDosNos(lerInline(ctx, sobra.inicio, sobra.fim)));
      if (aoAcharFonte(fonte)) continue;
    }
    const content = lerInline(ctx, sobra.inicio, sobra.fim);
    if (content.length === 0) continue;
    ctx.avisos.push({
      ...ctx.fonte.posicao(sobra.inicio),
      mensagem: `Conteúdo não reconhecido dentro d${onde}: entrou como parágrafo logo depois dela.`,
    });
    paragrafos.push({ type: "paragraph", content });
  }
  return paragrafos;
}

// "Fonte:" no começo do trecho, depois de tirar chaves e comandos — a
// checagem barata, no texto cru, antes de ler o trecho de verdade.
function pareceFonte(t: string, faixa: Faixa): boolean {
  const cru = t
    .slice(faixa.inicio, faixa.fim)
    .replace(/\\[a-zA-Z]+\*?/g, " ")
    .replace(/[{}]/g, " ");
  return /^\s*Fonte\s*:/i.test(cru);
}

function textoDosNos(nos: readonly NoInline[]): string {
  return nos
    .map((no) => (no.type === "text" ? no.text : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

// "Fonte: …" de `textoFonte()`. Sem o rótulo, o texto inteiro é a fonte.
function fonteDoTexto(texto: string): string {
  return texto.replace(/^Fonte\s*:\s*/i, "");
}

// A fonte da figura e da tabela: `\aurafonte` no `.tex` do AURA; `\legend`,
// `\fonte` e `\source` nos do abnTeX2.
const COMANDOS_DE_FONTE = new Set(["aurafonte", "legend", "fonte", "source"]);

const IMAGEM_DO_AURA = /^figuras\/([^/\\]+)\.(png|jpe?g)$/i;

function semOpcionalNoComeco(t: string, dentro: Faixa): Faixa {
  if (t[pularEspacos(t, dentro.inicio, dentro.fim)] !== "[") return dentro;
  const opcional = lerOpcional(t, pularEspacos(t, dentro.inicio, dentro.fim), dentro.fim);
  return opcional ? { inicio: opcional.depois, fim: dentro.fim } : dentro;
}

// Legenda (`\caption`, com o opcional do sumário pulado) e fonte, comuns a
// figura e tabela. Devolve onde terminou, ou `null` se não é nenhuma delas.
function legendaOuFonte(
  ctx: ContextoInline,
  nome: string,
  depois: number,
  fim: number,
  lida: { legenda: string; fonte: string },
): number | null {
  const t = ctx.fonte.texto;
  if (nome !== "caption" && !COMANDOS_DE_FONTE.has(nome)) return null;
  const opcional = nome === "caption" ? lerOpcional(t, depois, fim) : null;
  const grupo = lerGrupo(t, opcional?.depois ?? depois, fim);
  if (!grupo) return null;
  if (nome === "caption") lida.legenda = textoPlano(ctx, grupo.inicio, grupo.fim, "a legenda");
  else lida.fonte = fonteDoTexto(textoPlano(ctx, grupo.inicio, grupo.fim, "a fonte"));
  return grupo.depois;
}

// A primeira fonte solta vira a fonte, se nenhum comando trouxe uma.
function guardarFonte(lida: { fonte: string }) {
  return (fonte: string) => {
    if (lida.fonte || !fonte) return false;
    lida.fonte = fonte;
    return true;
  };
}

function figura(ctx: ContextoInline, pos: number, dentro: Faixa): BlocoLido[] {
  const t = ctx.fonte.texto;
  const lida: FiguraLida = { type: "figura", legenda: "", fonte: "", imagem: null };
  dentro = semOpcionalNoComeco(t, dentro);
  let imagens = 0;
  const sobras = comandosDoAmbiente(
    ctx,
    pos,
    dentro,
    "a figura",
    (nome, inicio, depois) => {
      const legenda = legendaOuFonte(ctx, nome, depois, dentro.fim, lida);
      if (legenda !== null) return legenda;
      if (nome === "includegraphics") {
        const estrela = t[depois] === "*" ? 1 : 0;
        const opcional = lerOpcional(t, depois + estrela, dentro.fim);
        const grupo = lerGrupo(t, opcional?.depois ?? depois + estrela, dentro.fim);
        if (!grupo) return null;
        if (++imagens > 1) {
          ctx.avisos.push({
            ...ctx.fonte.posicao(inicio),
            mensagem:
              "Figura com mais de uma imagem: o AURA tem uma por figura, e ficou a primeira.",
          });
          return grupo.depois;
        }
        const caminho = t.slice(grupo.inicio, grupo.fim).trim();
        const doAura = IMAGEM_DO_AURA.exec(caminho);
        if (doAura) lida.imagem = doAura[1];
        else lida.caminho = caminho;
        return grupo.depois;
      }
      // Espaço reservado da figura sem imagem, no `.tex` do AURA.
      if (nome === "fbox") return fimDosArgumentos(t, depois, dentro.fim);
      return null;
    },
    guardarFonte(lida),
  );
  return [lida, ...sobras];
}

// `table`: legenda, fonte e a grade (`tabular`, `tabularx`, `longtable`)
// dentro. Sem grade, a tabela vazia que o AURA escreve.
function tabelaFlutuante(ctx: ContextoInline, pos: number, dentro: Faixa): BlocoLido[] {
  const t = ctx.fonte.texto;
  const lida: TabelaLida = { type: "tabela", legenda: "", fonte: "", linhas: [] };
  dentro = semOpcionalNoComeco(t, dentro);
  const sobras = comandosDoAmbiente(
    ctx,
    pos,
    dentro,
    "a tabela",
    (nome, inicio, depois) => {
      const legenda = legendaOuFonte(ctx, nome, depois, dentro.fim, lida);
      if (legenda !== null) return legenda;
      if (nome !== "begin") return null;
      const grupo = lerGrupo(t, depois, dentro.fim);
      const ambiente = grupo ? t.slice(grupo.inicio, grupo.fim) : "";
      if (!grupo || !TABULARES.has(ambiente)) return null;
      const fecha = fimDoAmbiente(t, inicio, dentro.fim);
      if (fecha < 0) return null;
      const lidaDaGrade = grade(ctx, ambiente, { inicio: grupo.depois, fim: fecha });
      lida.linhas = lidaDaGrade.linhas;
      if (lidaDaGrade.legenda && !lida.legenda) lida.legenda = lidaDaGrade.legenda;
      return fecha + `\\end{${ambiente}}`.length;
    },
    guardarFonte(lida),
  );
  return [lida, ...sobras];
}

// Argumentos depois do nome da grade: `tabular` tem um (as colunas),
// `tabularx` e `tabulary`, dois (largura e colunas). Opcional de posição antes.
function inicioDaGrade(t: string, ambiente: string | null, dentro: Faixa): number {
  if (!ambiente) return dentro.inicio;
  let i = pularEspacos(t, dentro.inicio, dentro.fim);
  i = lerOpcional(t, i, dentro.fim)?.depois ?? i;
  const argumentos =
    ambiente === "tabularx" || ambiente === "tabulary" || ambiente === "tabular*" ? 2 : 1;
  for (let k = 0; k < argumentos; k++) i = lerGrupo(t, i, dentro.fim)?.depois ?? i;
  return i;
}

const REGRA =
  /^\\(toprule|midrule|bottomrule|hline|cline\s*\{[^}]*\}|cmidrule\s*(?:\([^)]*\))?\s*\{[^}]*\}|specialrule\s*\{[^}]*\}\s*\{[^}]*\}\s*\{[^}]*\}|rowcolor\s*(?:\[[^\]]*\])?\s*\{[^}]*\}|endfirsthead|endhead|endfoot|endlastfoot)(?![a-zA-Z])/;

// As linhas de uma grade (§1.6). Cabeçalho: as linhas antes do primeiro
// `\midrule`; sem ele, a primeira. `linhasDeCabecalho` fixa a conta, para a
// `longtable` do AURA, que separa cabeçalho e corpo por outro meio.
// `ambiente` nulo: a faixa já começa depois dos argumentos da grade.
function grade(
  ctx: ContextoInline,
  ambiente: string | null,
  dentro: Faixa,
  linhasDeCabecalho?: number,
): { linhas: LinhaTabela[]; legenda: string } {
  const t = ctx.fonte.texto;
  let legenda = "";
  const linhas: { celulas: Faixa[]; depoisDoMidrule: boolean }[] = [];
  for (const parte of dividirForaDeChaves(
    t,
    inicioDaGrade(t, ambiente, dentro),
    dentro.fim,
    "\\\\",
  )) {
    let comeco = parte.inicio;
    let midrule = false;
    for (;;) {
      comeco = pularEspacos(t, comeco, parte.fim);
      if (t[comeco] === "[" && linhas.length > 0) {
        // `\\[2pt]`: o espaço extra da linha anterior.
        const opcional = lerOpcional(t, comeco, parte.fim);
        if (opcional) {
          comeco = opcional.depois;
          continue;
        }
      }
      const regra = REGRA.exec(t.slice(comeco, parte.fim));
      if (regra) {
        if (regra[1] === "midrule") midrule = true;
        comeco += regra[0].length;
        continue;
      }
      if (t.startsWith("\\caption", comeco) || t.startsWith("\\label", comeco)) {
        const nome = t.startsWith("\\caption", comeco) ? "\\caption" : "\\label";
        const grupo = lerGrupo(
          t,
          lerOpcional(t, comeco + nome.length, parte.fim)?.depois ?? comeco + nome.length,
          parte.fim,
        );
        if (grupo) {
          if (nome === "\\caption") legenda = textoPlano(ctx, grupo.inicio, grupo.fim, "a legenda");
          comeco = grupo.depois;
          continue;
        }
      }
      break;
    }
    if (t.slice(comeco, parte.fim).trim() === "") continue;
    linhas.push({
      celulas: dividirForaDeChaves(t, comeco, parte.fim, "&"),
      depoisDoMidrule: midrule,
    });
  }
  const primeiroMidrule = linhas.findIndex((linha, indice) => indice > 0 && linha.depoisDoMidrule);
  const cabecalho =
    linhasDeCabecalho ?? (primeiroMidrule > 0 ? primeiroMidrule : linhas.length > 1 ? 1 : 0);
  return {
    legenda,
    linhas: linhas.map((linha, indice) => ({
      celulas: linha.celulas.map((celula) => lerCelula(ctx, celula, indice < cabecalho)),
    })),
  };
}

// `longtable`. A do AURA: legenda e cabeçalho antes de `\endfirsthead`,
// cabeçalho repetido até `\endhead` (ignorado), corpo depois de
// `\endlastfoot`, e a fonte logo depois do ambiente. A de fora é lida como
// qualquer grade.
function tabelaLonga(
  ctx: ContextoInline,
  pos: number,
  dentro: Faixa,
  depoisDoAmbiente: number,
): AmbienteLido {
  const t = ctx.fonte.texto;
  const inicio = inicioDaGrade(t, "longtable", dentro);
  const achar = (comando: string) => {
    const achado = t.indexOf(comando, inicio);
    return achado >= 0 && achado < dentro.fim ? achado : -1;
  };
  const primeiraCabeca = achar("\\endfirsthead");
  const cabeca = achar("\\endhead");
  const pe = achar("\\endlastfoot");

  let legenda = "";
  let linhas: LinhaTabela[];
  if (primeiraCabeca < 0) {
    const lida = grade(ctx, "longtable", dentro);
    legenda = lida.legenda;
    linhas = lida.linhas;
  } else {
    const inicioDoCorpo =
      pe >= 0
        ? pe + "\\endlastfoot".length
        : cabeca >= 0
          ? cabeca + "\\endhead".length
          : primeiraCabeca + "\\endfirsthead".length;
    if (pe < 0) {
      ctx.avisos.push({
        ...ctx.fonte.posicao(pos),
        mensagem: "Tabela sem \\endlastfoot: as linhas foram lidas a partir do fim do cabeçalho.",
      });
    }
    const cabecalho = grade(ctx, null, { inicio, fim: primeiraCabeca }, Number.POSITIVE_INFINITY);
    const corpo = grade(ctx, null, { inicio: inicioDoCorpo, fim: dentro.fim }, 0);
    legenda = cabecalho.legenda;
    linhas = [...cabecalho.linhas, ...corpo.linhas];
  }

  let depois = depoisDoAmbiente;
  let fonte = "";
  const seguinte = pularEspacos(t, depois);
  for (const comando of COMANDOS_DE_FONTE) {
    if (!t.startsWith(`\\${comando}`, seguinte)) continue;
    const grupo = lerGrupo(t, seguinte + comando.length + 1);
    if (grupo) {
      fonte = fonteDoTexto(textoPlano(ctx, grupo.inicio, grupo.fim, "a fonte"));
      depois = grupo.depois;
    }
    break;
  }
  // `{\footnotesize Fonte: …}` logo depois da tabela, sem comando de fonte.
  if (!fonte && t[seguinte] === "{") {
    const grupo = lerGrupo(t, seguinte);
    if (grupo && pareceFonte(t, { inicio: seguinte, fim: grupo.depois })) {
      fonte = fonteDoTexto(textoDosNos(lerInline(ctx, seguinte, grupo.depois)));
      depois = grupo.depois;
    }
  }
  return {
    itens: [{ tipo: "bloco", bloco: { type: "tabela", legenda, fonte, linhas }, pos }],
    depois,
  };
}

// Célula de cabeçalho sai com o texto inteiro em `\textbf{}`. Célula toda em
// negrito também volta como cabeçalho: é a mesma marcação, e a mesma
// aparência. `\multicolumn` e `\multirow` ficam com o texto.
function lerCelula(ctx: ContextoInline, faixa: Faixa, linhaDeCabecalho: boolean): CelulaTabela {
  const t = ctx.fonte.texto;
  let inicio = pularEspacos(t, faixa.inicio, faixa.fim);
  let fim = faixa.fim;
  while (fim > inicio && /\s/.test(t[fim - 1])) fim--;
  for (const [comando, argumentos] of [
    ["\\multicolumn", 3],
    ["\\multirow", 3],
  ] as const) {
    if (!t.startsWith(comando, inicio)) continue;
    let i = inicio + comando.length;
    let ultimo = null;
    for (let k = 0; k < argumentos; k++) {
      ultimo = lerGrupo(t, lerOpcional(t, pularEspacos(t, i, fim), fim)?.depois ?? i, fim);
      if (!ultimo) break;
      i = ultimo.depois;
    }
    if (ultimo) {
      ctx.avisos.push({
        ...ctx.fonte.posicao(inicio),
        mensagem: `Célula mesclada (${comando}): o AURA não mescla células, e ficou o texto numa célula só.`,
      });
      inicio = ultimo.inicio;
      fim = ultimo.fim;
    }
  }
  let cabecalho = linhaDeCabecalho;
  if (t.startsWith("\\textbf{", inicio)) {
    const grupo = lerGrupo(t, inicio + "\\textbf".length, fim);
    if (grupo && grupo.depois === fim) {
      cabecalho = true;
      inicio = grupo.inicio;
      fim = grupo.fim;
    }
  }
  const content = lerInlineDeCelula(ctx, inicio, fim);
  return content.length > 0 ? { cabecalho, content } : { cabecalho };
}

const NAO_EXPORTADO = /\[ (figura|tabela) dentro de apêndice\/anexo ainda não exportada/;

// `center` do AURA: a fórmula que o KaTeX recusou (`\texttt{…}`) ou o aviso
// de figura/tabela em apêndice. Outro `center` é só forma.
function centroDoAura(ctx: ContextoInline, dentro: Faixa, bruto: string): BlocoLido | null {
  const t = ctx.fonte.texto;
  const inicio = pularEspacos(t, dentro.inicio, dentro.fim);
  const naoExportado = NAO_EXPORTADO.exec(bruto);
  if (naoExportado) return { type: "nao_exportado", tipo: naoExportado[1] as "figura" | "tabela" };
  if (t.startsWith("\\texttt", inicio)) {
    const grupo = lerGrupo(t, inicio + "\\texttt".length, dentro.fim);
    if (grupo && t.slice(grupo.depois, dentro.fim).trim() === "") {
      return { type: "formula", texto: textoPlano(ctx, grupo.inicio, grupo.fim, "a fórmula") };
    }
  }
  return null;
}
