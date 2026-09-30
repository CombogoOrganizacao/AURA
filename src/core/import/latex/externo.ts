import type { NoInline } from "../../document/types";
import { lerItens, type ItensLidos, type QualPosTextual } from "./blocos";
import {
  dividirEmComandos,
  fimDoAmbiente,
  lerGrupo,
  lerOpcional,
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
  "resumo",
  "abstract",
  "dedicatoria",
  "agradecimentos",
  "epigrafe",
]);

const PALAVRAS_CHAVE = /^(palavras?[- ]?chaves?|key-?words?)\s*[:.]?\s*/i;

function textoDe(content: readonly NoInline[] | undefined): string {
  return (content ?? [])
    .map((no) => (no.type === "text" ? no.text : ""))
    .join("")
    .trim();
}

// Os parágrafos de dentro de um ambiente, só com o texto.
function paragrafos(ctx: ContextoInline, inicio: number, fim: number): string[] {
  return lerItens(ctx, "externo", inicio, fim)
    .itens.flatMap((item) =>
      item.tipo === "bloco" && item.bloco.type === "paragraph" ? [textoDe(item.bloco.content)] : [],
    )
    .filter(Boolean);
}

// `resumo` (e o `abstract` da classe padrão): o texto e a linha de
// palavras-chave. É abstract o `resumo[Abstract]` ou o escrito em inglês.
function lerResumo(
  ctx: ContextoInline,
  nome: string,
  opcional: string,
  bruto: string,
  inicio: number,
  fim: number,
  lidos: MetadadosLidos,
) {
  const emIngles =
    nome === "abstract" ||
    /abstract|english|ingl[êe]s/i.test(opcional) ||
    /\\(begin\{otherlanguage\*?\}|selectlanguage)\s*\{english\}/.test(bruto) ||
    lidos.resumo !== undefined;
  const texto: string[] = [];
  let termos: string[] | undefined;
  for (const paragrafo of paragrafos(ctx, inicio, fim)) {
    const rotulo = PALAVRAS_CHAVE.exec(paragrafo);
    if (rotulo) {
      termos = paragrafo
        .slice(rotulo[0].length)
        .split(/\s*[;.,]\s*/)
        .map((termo) => termo.trim())
        .filter(Boolean);
    } else texto.push(paragrafo);
  }
  if (emIngles) {
    lidos.abstract = texto.join("\n");
    if (termos) lidos.keywords = termos;
  } else {
    lidos.resumo = texto.join("\n");
    if (termos) lidos.palavrasChave = termos;
  }
}

// O que o aluno escreveu antes do texto: resumo, abstract, dedicatória,
// agradecimentos e epígrafe. O resto (capa, folhas, listas) o AURA refaz, e
// o aviso diz o que não foi trazido.
function lerAmbientesPreTextuais(ctx: ContextoInline, lidos: MetadadosLidos) {
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
    if (nome === "resumo" || nome === "abstract") {
      lerResumo(
        ctx,
        nome,
        opcional ? t.slice(opcional.inicio, opcional.fim) : "",
        t.slice(inicio, fecha),
        inicio,
        fecha,
        lidos,
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
  contexto: (fonte: Fonte) => ContextoInline,
): MetadadosLidos {
  const lidos: MetadadosLidos = {};
  lerComandosDeDados(contexto(preambulo), lidos);
  const ctx = contexto(preTextual);
  lerComandosDeDados(ctx, lidos);
  lerAmbientesPreTextuais(ctx, lidos);
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
  return { secoes, apendices, anexos };
}
