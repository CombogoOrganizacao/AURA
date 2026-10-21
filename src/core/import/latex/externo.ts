import type { NoInline } from "../../document/types";
import {
  AMBIENTES_DE_RESUMO,
  lerItens,
  type Item,
  type ItensLidos,
  type QualPosTextual,
} from "./blocos";
import {
  dividirEmComandos,
  fimDoAmbiente,
  lerGrupo,
  lerOpcional,
  pularEspacos,
  type Aviso,
  type Fonte,
  type LinhaFonte,
} from "./fonte";
import { textoPlano, type ContextoInline } from "./inline";
import type { MetadadosLidos, PosTextualLido, SecaoLida } from "./lerTex";

// `.tex` que não saiu do AURA (passo 6.2.5, docs/latex-abntex.md §1.6): o TCC
// que o aluno começou em LaTeX, no modelo do abnTeX2 ou numa classe padrão.
// Sem marcadores, a identidade é só a posição: tudo entra como novo.
//
// O que vem antes do texto (capa, folhas, sumário, listas) o AURA refaz a
// partir dos dados do trabalho. Desse trecho, voltam só os dados (título,
// autoria, orientador…) e os elementos que o aluno escreveu: resumo,
// abstract, dedicatória, agradecimentos e epígrafe.

// --- Onde o texto começa -----------------------------------------------------

// Títulos do que vem antes do texto, escritos como `\chapter*{Resumo}`.
const TITULO_PRE_TEXTUAL =
  /^(resumo|abstract|agradecimentos?|dedicat[óo]ria|ep[íi]grafe|sum[áa]rio|lista d[eo]s? .*|errata|folha de aprova[çc][ãa]o|pref[áa]cio)$/i;

const MARCO_DO_TEXTO = /^\s*\\(textual|mainmatter)(?![a-zA-Z])/;
const PRIMEIRO_TITULO = /^\s*\\(chapter|section)\*?\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/;

// Índice da primeira linha do texto: depois do `\textual` (abnTeX2) ou do
// `\mainmatter`; sem eles, o primeiro título que não é de elemento
// pré-textual; sem título nenhum, o corpo inteiro.
export function inicioDoTexto(corpo: readonly LinhaFonte[]): number {
  const marco = corpo.findIndex((linha) => MARCO_DO_TEXTO.test(linha.texto));
  if (marco >= 0) return marco + 1;
  const titulo = corpo.findIndex((linha) => {
    const achado = PRIMEIRO_TITULO.exec(linha.texto);
    return achado !== null && !TITULO_PRE_TEXTUAL.test(achado[2].trim());
  });
  return titulo >= 0 ? titulo : 0;
}

// --- Dados do trabalho -------------------------------------------------------

const COMANDOS_DE_DADOS =
  /\\(titulo|title|autor|author|orientador|coorientador|instituicao|local|data|date|preambulo)(?![a-zA-Z@])/g;

const QUEBRAS_DE_AUTOR = new Set(["and", "par"]);
const QUEBRAS_DE_LINHA = new Set(["par"]);

// Os comandos de dados do abnTeX2 (`\titulo`, `\autor`, `\orientador`…) e da
// classe padrão (`\title`, `\author`, `\date`), no preâmbulo ou no corpo.
// Vale o último de cada um, como no LaTeX.
function lerComandosDeDados(ctx: ContextoInline, lidos: MetadadosLidos) {
  const t = ctx.fonte.texto;
  for (const achado of t.matchAll(COMANDOS_DE_DADOS)) {
    // A definição (`\newcommand{\titulo}`) não é o dado.
    if (/\\(re)?newcommand\s*\{?\s*$/.test(t.slice(Math.max(0, achado.index - 16), achado.index)))
      continue;
    let i = achado.index + achado[0].length;
    if (t[i] === "*") i++;
    const grupo = lerGrupo(t, lerOpcional(t, i)?.depois ?? i);
    if (!grupo) continue;
    const plano = () => textoPlano(ctx, grupo.inicio, grupo.fim, "o campo");
    switch (achado[1]) {
      case "titulo":
      case "title":
        lidos.titulo = plano();
        break;
      case "autor":
      case "author":
        lidos.autores = dividirEmComandos(t, grupo.inicio, grupo.fim, QUEBRAS_DE_AUTOR)
          .map((parte) => textoPlano(ctx, parte.inicio, parte.fim, "o nome do autor"))
          .filter(Boolean);
        break;
      case "orientador":
        lidos.orientador = plano();
        break;
      case "coorientador":
        ctx.avisos.push({
          ...ctx.fonte.posicao(achado.index),
          mensagem: "Coorientador(a) ainda não tem campo no AURA: não foi trazido.",
        });
        break;
      case "instituicao":
        // Universidade, faculdade e curso, uma por linha na capa do abnTeX2.
        lidos.instituicao = dividirEmComandos(t, grupo.inicio, grupo.fim, QUEBRAS_DE_LINHA)
          .map((parte) => textoPlano(ctx, parte.inicio, parte.fim, "a instituição"))
          .filter(Boolean)
          .join(", ");
        break;
      case "local":
        lidos.local = plano();
        break;
      case "data":
      case "date": {
        const ano = /\b(1[89]\d\d|2\d\d\d)\b/.exec(plano());
        if (ano) lidos.ano = Number(ano[1]);
        break;
      }
      case "preambulo":
        lidos.naturezaTrabalho = plano();
        break;
    }
  }
}

const AMBIENTES_PRE_TEXTUAIS = new Set([
  ...AMBIENTES_DE_RESUMO,
  "dedicatoria",
  "agradecimentos",
  "epigrafe",
]);

// --- Resumo, abstract e palavras-chave ---------------------------------------

// O idioma do trabalho, para saber se um `abstract` sem outra pista é o
// Resumo ou o Abstract (passo 8.3.1). Num `.tex` de classe padrão escrito em
// português, o resumo em português vai no `abstract`, que é o único ambiente
// de resumo que a classe tem.
export interface IdiomaDoTex {
  // O babel, a classe ou o polyglossia declaram português.
  portugues: boolean;
  // Há um `resumo` no arquivo: o `abstract` é então o em inglês, como no
  // modelo da SBC, que traz os dois.
  temResumo: boolean;
}

const PORTUGUES = /\b(brazil|brazilian|portuges|portuguese)\b/i;

export function idiomaDoTex(preambulo: Fonte, corpo: readonly Fonte[]): IdiomaDoTex {
  const t = preambulo.texto;
  const opcoes = [
    ...t.matchAll(/\\documentclass\s*\[([^\]]*)\]/g),
    ...t.matchAll(/\\usepackage\s*\[([^\]]*)\]\s*\{[^{}]*\bbabel\b[^{}]*\}/g),
  ].map((achado) => achado[1]);
  const polyglossia = /\\set(default|main)language\s*(\[[^\]]*\])?\s*\{\s*portuguese\s*\}/.test(t);
  return {
    portugues: polyglossia || opcoes.some((lista) => PORTUGUES.test(lista)),
    temResumo: corpo.some((fonte) => /\\begin\s*\{resumo\}/.test(fonte.texto)),
  };
}

// O rótulo das palavras-chave, onde estiver no ambiente. Pode vir embrulhado
// em comandos que o AURA não conhece (`\textbf{\keyword{Palavras-chave:}}`,
// `{\bf Keywords:}`), que saem junto com ele. No começo de um parágrafo ou
// depois de uma quebra de linha (`\\`, `\par`, `\newline`), os dois-pontos
// são opcionais; no meio da frase, são eles que separam o rótulo de uma
// menção às palavras-chave no próprio resumo.
interface Rotulo {
  // Do primeiro comando que o embrulha até depois dos dois-pontos.
  inicio: number;
  fim: number;
  emIngles: boolean;
}

const PALAVRA_DO_ROTULO = /(?<!\p{L})(palavras?[- ]?chaves?|key-?words?)(?!\p{L})/giu;
const EMBRULHO_A_ESQUERDA = /(\\[a-zA-Z]+\s*\{|\{\s*\\[a-zA-Z]+\s*|\{)\s*$/;
const QUEBRA_A_ESQUERDA =
  /(^|\n[ \t]*\n|\\(\\|par|newline|linebreak)(?![a-zA-Z])(\s*\[[^\]]*\])?)\s*$/;

// Vale o último rótulo: as palavras-chave fecham o resumo.
function acharRotulo(t: string, inicio: number, fim: number): Rotulo | null {
  let achado: Rotulo | null = null;
  for (const palavra of t.slice(inicio, fim).matchAll(PALAVRA_DO_ROTULO)) {
    let comeco = inicio + palavra.index;
    let abertos = 0;
    for (
      let embrulho = EMBRULHO_A_ESQUERDA.exec(t.slice(inicio, comeco));
      embrulho;
      embrulho = EMBRULHO_A_ESQUERDA.exec(t.slice(inicio, comeco))
    ) {
      comeco = inicio + embrulho.index;
      abertos++;
    }
    let i = inicio + palavra.index + palavra[0].length;
    let fechados = 0;
    let pontuado = false;
    let doisPontos = false;
    for (let j = pularEspacos(t, i, fim); j < fim; j = pularEspacos(t, i, fim)) {
      if (t[j] === "}" && fechados < abertos) fechados++;
      else if ((t[j] === ":" || t[j] === ".") && !pontuado) {
        pontuado = true;
        doisPontos = t[j] === ":";
      } else break;
      i = j + 1;
    }
    // O comando embrulha também os termos (`\textbf{Palavras-chave: a; b}`):
    // não é o rótulo sozinho.
    if (fechados < abertos) continue;
    if (!doisPontos && !QUEBRA_A_ESQUERDA.test(t.slice(inicio, comeco))) continue;
    achado = { inicio: comeco, fim: i, emIngles: /^key/i.test(palavra[1]) };
  }
  return achado;
}

// `\and` (classes de revista) e `\sep` (elsarticle) separam termos, como o
// ponto e vírgula.
const SEPARADORES_DE_TERMOS = new Set(["and", "sep", "par", "newline"]);

function lerTermos(ctx: ContextoInline, inicio: number, fim: number): string[] {
  return dividirEmComandos(ctx.fonte.texto, inicio, fim, SEPARADORES_DE_TERMOS)
    .flatMap((parte) =>
      textoPlano(ctx, parte.inicio, parte.fim, "as palavras-chave").split(/\s*[;.,]\s*/),
    )
    .map((termo) => termo.trim())
    .filter(Boolean);
}

function textoDe(content: readonly NoInline[] | undefined): string {
  return (content ?? [])
    .map((no) => (no.type === "text" ? no.text : ""))
    .join("")
    .trim();
}

interface Paragrafo {
  texto: string;
  // Onde o parágrafo está no texto bruto.
  inicio: number;
  fim: number;
}

// Os parágrafos de dentro de um ambiente, só com o texto.
function paragrafosComFaixa(ctx: ContextoInline, inicio: number, fim: number): Paragrafo[] {
  return lerItens(ctx, "externo", inicio, fim).itens.flatMap((item) =>
    item.tipo === "bloco" && item.bloco.type === "paragraph" && textoDe(item.bloco.content)
      ? [{ texto: textoDe(item.bloco.content), inicio: item.pos, fim: item.fim ?? fim }]
      : [],
  );
}

function paragrafos(ctx: ContextoInline, inicio: number, fim: number): string[] {
  return paragrafosComFaixa(ctx, inicio, fim).map((paragrafo) => paragrafo.texto);
}

// Resumo ou Abstract. Primeiro o que o arquivo diz do próprio trecho (o
// `[Abstract]` do abnTeX2, o `otherlanguage` em inglês), depois o rótulo das
// palavras-chave, e só então o ambiente e o idioma do trabalho.
function resumoEmIngles(
  nome: string,
  opcional: string,
  bruto: string,
  rotulo: Rotulo | null,
  idioma: IdiomaDoTex,
  lidos: MetadadosLidos,
): boolean {
  if (nome === "IEEEkeywords") return true;
  if (
    /abstract|english|ingl[êe]s/i.test(opcional) ||
    /\\(begin\{otherlanguage\*?\}|selectlanguage)\s*\{english\}/.test(bruto)
  )
    return true;
  if (rotulo) return rotulo.emIngles;
  if (nome === "abstract") return idioma.temResumo || !idioma.portugues;
  // O segundo `resumo` sem pista nenhuma é o em inglês.
  if (nome === "resumo") return lidos.resumo !== undefined;
  return !idioma.portugues;
}

type CampoDeResumo = "Resumo" | "Palavras-chave" | "Abstract" | "Keywords";

// `resumo` e `abstract`: o texto e as palavras-chave. `keywords`,
// `IEEEkeywords` e `\keywords{}`: só as palavras-chave, com ou sem rótulo.
// Devolve os campos que preencheu, para o aviso.
//
// O rótulo é procurado dentro de cada parágrafo, no texto bruto: ele pode
// vir no começo ou no meio, embrulhado em comandos que o leitor de parágrafo
// não entende. O que vem antes dele no parágrafo é resumo; o que vem depois
// são os termos.
function lerResumo(
  ctx: ContextoInline,
  nome: string,
  opcional: string,
  inicio: number,
  fim: number,
  lidos: MetadadosLidos,
  idioma: IdiomaDoTex,
): CampoDeResumo[] {
  const t = ctx.fonte.texto;
  const soTermos = nome === "keywords" || nome === "IEEEkeywords";
  const avisosAntes = ctx.avisos.length;
  const lista = paragrafosComFaixa(ctx, inicio, fim);
  const rotulos = lista.map((paragrafo) => acharRotulo(t, paragrafo.inicio, paragrafo.fim));
  const rotulo = rotulos.findLast(Boolean) ?? (soTermos ? acharRotulo(t, inicio, fim) : null);

  // O rótulo e os termos são lidos de novo logo abaixo, pelo texto bruto:
  // os avisos da primeira leitura, nessas linhas, ficariam repetidos ou
  // falariam do comando que embrulha o rótulo (`\keyword`).
  const lidasDeNovo = lista.flatMap((paragrafo, i) => {
    const achado = rotulos[i];
    return achado
      ? [
          [
            ctx.fonte.posicao(achado.inicio).linha,
            ctx.fonte.posicao(Math.max(achado.inicio, paragrafo.fim - 1)).linha,
          ],
        ]
      : [];
  });
  const mantidos = ctx.avisos
    .splice(avisosAntes)
    .filter((aviso) => !lidasDeNovo.some(([de, ate]) => aviso.linha >= de && aviso.linha <= ate));
  ctx.avisos.push(...mantidos);

  const texto: string[] = [];
  let termos: string[] = [];
  lista.forEach((paragrafo, i) => {
    const achado = rotulos[i];
    if (!achado) {
      if (!soTermos) texto.push(paragrafo.texto);
      return;
    }
    const antes = textoPlano(ctx, paragrafo.inicio, achado.inicio, "o resumo").trim();
    if (antes && !soTermos) texto.push(antes);
    termos = lerTermos(ctx, achado.fim, paragrafo.fim);
  });
  if (soTermos && !rotulo) termos = lerTermos(ctx, inicio, fim);

  const emIngles = resumoEmIngles(nome, opcional, t.slice(inicio, fim), rotulo, idioma, lidos);
  const campos: CampoDeResumo[] = [];
  if (!soTermos) {
    lidos[emIngles ? "abstract" : "resumo"] = texto.join("\n");
    campos.push(emIngles ? "Abstract" : "Resumo");
  }
  if (termos.length > 0) {
    lidos[emIngles ? "keywords" : "palavrasChave"] = termos;
    campos.push(emIngles ? "Keywords" : "Palavras-chave");
  }
  return campos;
}

// Resumo, abstract e palavras-chave no meio do texto (passo 8.3.1). Num
// modelo de relatório, o `abstract` vem depois do primeiro título
// (`\section{Equipe}`), e caía como texto cru na seção. Vai para os campos,
// como se estivesse antes do texto, e o aviso diz para onde foi.
export function lerResumosDoCorpo(
  { fonte, itens }: ItensLidos,
  lidos: MetadadosLidos,
  idioma: IdiomaDoTex,
  contexto: (fonte: Fonte) => ContextoInline,
) {
  const ctx = contexto(fonte);
  for (const item of itens) {
    if (item.tipo !== "resumo") continue;
    const opcional = item.opcional
      ? fonte.texto.slice(item.opcional.inicio, item.opcional.fim)
      : "";
    const campos = lerResumo(
      ctx,
      item.nome,
      opcional,
      item.dentro.inicio,
      item.dentro.fim,
      lidos,
      idioma,
    );
    const trecho = fonte.texto.startsWith("\\begin", item.pos)
      ? `\\begin{${item.nome}}`
      : `\\${item.nome}`;
    ctx.avisos.push({
      ...fonte.posicao(item.pos),
      mensagem:
        campos.length === 0
          ? `${trecho} no meio do texto estava vazio: não foi trazido.`
          : `${trecho} no meio do texto: foi para ${campos.length === 1 ? "o campo" : "os campos"} ${campos.join(" e ")}.`,
    });
  }
}

// O que o aluno escreveu antes do texto: resumo, abstract, dedicatória,
// agradecimentos e epígrafe. O resto (capa, folhas, listas) o AURA refaz, e
// o aviso diz o que não foi trazido.
function lerAmbientesPreTextuais(
  ctx: ContextoInline,
  lidos: MetadadosLidos,
  idioma: IdiomaDoTex,
) {
  const t = ctx.fonte.texto;
  const naoTrazidos = new Set<string>();
  const abre = /\\begin\s*\{([^{}]+)\}/g;
  for (let achado = abre.exec(t); achado; achado = abre.exec(t)) {
    const nome = achado[1];
    const fecha = fimDoAmbiente(t, achado.index);
    if (fecha < 0) continue;
    abre.lastIndex = fecha + `\\end{${nome}}`.length;
    const dentro = achado.index + achado[0].length;
    if (!AMBIENTES_PRE_TEXTUAIS.has(nome)) {
      naoTrazidos.add(nome);
      continue;
    }
    const opcional = lerOpcional(t, dentro);
    const inicio = opcional?.depois ?? dentro;
    if (AMBIENTES_DE_RESUMO.has(nome)) {
      lerResumo(
        ctx,
        nome,
        opcional ? t.slice(opcional.inicio, opcional.fim) : "",
        inicio,
        fecha,
        lidos,
        idioma,
      );
    } else {
      lidos[nome as "dedicatoria" | "agradecimentos" | "epigrafe"] = paragrafos(
        ctx,
        inicio,
        fecha,
      ).join("\n");
    }
  }
  if (naoTrazidos.size > 0) {
    ctx.avisos.push({
      ...ctx.fonte.posicao(0),
      mensagem:
        `O AURA refaz capa, folhas, sumário e listas a partir dos dados do trabalho. Do que vinha antes do texto, não foram trazidos: ${[...naoTrazidos].join(", ")}.` +
        (naoTrazidos.has("siglas") ? " Cadastre as siglas em “Abreviaturas e siglas”." : ""),
    });
  }
}

export function lerMetadadosExternos(
  preambulo: Fonte,
  preTextual: Fonte,
  idioma: IdiomaDoTex,
  contexto: (fonte: Fonte) => ContextoInline,
): MetadadosLidos {
  const lidos: MetadadosLidos = {};
  lerComandosDeDados(contexto(preambulo), lidos);
  const ctx = contexto(preTextual);
  lerComandosDeDados(ctx, lidos);
  lerAmbientesPreTextuais(ctx, lidos, idioma);
  return lidos;
}

// --- Seções, apêndices e anexos ----------------------------------------------

const REFERENCIAS = /^(refer[êe]ncias( bibliogr[áa]ficas)?|bibliografia)$/i;

// "APÊNDICE A — ": o abnTeX2 põe sozinho; se o aluno escreveu, sai.
const ROTULO_POS_TEXTUAL = /^(ap[êe]ndice|anexo)(?:\s+[a-z]{1,3})?\s*(?:(?:—|–|-{1,3})\s*|$)/iu;

// Monta o trabalho a partir dos itens do corpo (§1.6). O nível vem do
// comando mais alto usado: com `\chapter`, capítulo é nível 1; sem ele
// (classe `article`), `\section` é nível 1. Depois de `\postextual`,
// `\backmatter` ou `\appendix`, cada título do nível mais alto é um apêndice
// ou anexo, conforme o contexto.
export function montarExterno({ fonte, itens }: ItensLidos, avisos: Aviso[]) {
  // A seção que cada título do texto virou: é por ela que um `\label` logo
  // depois do título acha o número (`alvosDosRotulos()`, rotulos.ts).
  const secaoDoTitulo = new Map<Item, SecaoLida>();
  const temCapitulo = itens.some((item) => item.tipo === "titulo" && item.comando === "chapter");
  const niveis: Record<string, 1 | 2 | 3> = temCapitulo
    ? { chapter: 1, section: 2, subsection: 3, subsubsection: 3 }
    : { section: 1, subsection: 2, subsubsection: 3 };
  const topo = temCapitulo ? "chapter" : "section";
  const avisar = (pos: number, mensagem: string) =>
    avisos.push({ ...fonte.posicao(pos), mensagem });

  const secoes: SecaoLida[] = [];
  const apendices: PosTextualLido[] = [];
  const anexos: PosTextualLido[] = [];
  let noTexto = true;
  let contexto: QualPosTextual | null = null;
  let atual: PosTextualLido | null = null;
  let ignorando = false;
  let avisouSobra = false;

  const novoPosTextual = (titulo: string, pos: number) => {
    if (!noTexto && !contexto && REFERENCIAS.test(titulo)) {
      // A lista de referências o AURA monta das referências cadastradas.
      atual = null;
      ignorando = true;
      return;
    }
    let qual = contexto;
    if (!qual) {
      avisar(
        pos,
        `“${titulo}” vem depois do fim do texto, fora de \\apendices ou \\anexos: entrou como apêndice.`,
      );
      qual = "APENDICE";
    }
    const rotulo = ROTULO_POS_TEXTUAL.exec(titulo);
    atual = {
      id: null,
      titulo: rotulo ? titulo.slice(rotulo[0].length) : titulo,
      content: [],
      ...fonte.posicao(pos),
    };
    (qual === "ANEXO" ? anexos : apendices).push(atual);
    ignorando = false;
  };

  for (const item of itens) {
    switch (item.tipo) {
      case "marcador":
        break;
      case "parte":
        noTexto = false;
        atual = null;
        break;
      case "contexto":
        noTexto = false;
        contexto = item.qual;
        atual = null;
        ignorando = false;
        break;
      case "tituloPos":
        if (noTexto) break;
        novoPosTextual(item.titulo, item.pos);
        break;
      case "titulo":
        if (!noTexto) {
          if (item.comando === topo) novoPosTextual(item.titulo, item.pos);
          else if (atual && item.titulo) {
            // Apêndice e anexo não têm subdivisão no AURA.
            (atual as PosTextualLido).content.push({
              type: "paragraph",
              content: [{ type: "text", text: item.titulo, marks: [{ type: "negrito" }] }],
            });
          }
          break;
        }
        if (item.comando === "subsubsection" && temCapitulo) {
          avisar(
            item.pos,
            `O AURA tem três níveis de seção: “${item.titulo}” (\\subsubsection) entrou como nível 3.`,
          );
        }
        if (item.estrela) {
          avisar(
            item.pos,
            `“${item.titulo}” era um título sem número (*): no AURA, toda seção do texto é numerada.`,
          );
        }
        secoes.push({
          id: null,
          nivel: niveis[item.comando] ?? 3,
          titulo: item.titulo,
          content: [],
          ...fonte.posicao(item.pos),
        });
        secaoDoTitulo.set(item, secoes.at(-1)!);
        break;
      case "bloco":
        if (!noTexto) {
          if (atual) (atual as PosTextualLido).content.push(item.bloco);
          else if (!ignorando) {
            // Texto solto depois do fim do texto: não some; vai para o fim
            // da última seção.
            if (!avisouSobra) {
              avisar(
                item.pos,
                "Texto depois do fim do texto, fora de apêndice ou anexo: entrou no fim da última seção.",
              );
              avisouSobra = true;
            }
            if (secoes.length === 0) {
              secoes.push({
                id: null,
                nivel: 1,
                titulo: "",
                content: [],
                ...fonte.posicao(item.pos),
              });
            }
            secoes.at(-1)!.content.push(item.bloco);
          }
          break;
        }
        if (secoes.length === 0) {
          avisar(item.pos, "Texto antes do primeiro título: entrou numa seção sem título.");
          secoes.push({ id: null, nivel: 1, titulo: "", content: [], ...fonte.posicao(item.pos) });
        }
        secoes.at(-1)!.content.push(item.bloco);
        break;
    }
  }
  return { secoes, apendices, anexos, secaoDoTitulo };
}
