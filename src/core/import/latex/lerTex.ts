import { TITULO_REFERENCIAS } from "../../document/elements/posTextual";
import type { Metadados, NivelSecao } from "../../document/types";
import { MACRO, SEPARADOR_TERMOS, VERSAO_FORMATO_TEX } from "../../export/latex/markers";
import { lerItens, paragrafoLiteral, type BlocoLido, type Item, type ItensLidos } from "./blocos";
import { inicioDoTexto, lerMetadadosExternos, montarExterno } from "./externo";
import {
  dividirEmComandos,
  dividirForaDeChaves,
  Fonte,
  lerGrupo,
  liberarPares,
  linhasDe,
  pularEspacos,
  type Aviso,
  type LinhaFonte,
} from "./fonte";
import { textoPlano, type ChamadaLida, type ContextoInline } from "./inline";
import { alvosDosRotulos, resolverReferencias, type ReferenciaCruzadaLida } from "./rotulos";

export type { BlocoLido, FiguraLida, NaoExportado, TabelaLida } from "./blocos";

// Leitor do `.tex` (passo 6.2.4, e 6.2.5 para o de fora do AURA). Devolve o
// que o arquivo diz, na forma do schema, sem tocar no documento: comparar com
// o que está salvo, montar o relatório e aplicar é de `reimport.ts`. Regras
// em docs/latex-abntex.md §1.5 e §1.6.
//
// Dois caminhos, pela primeira linha:
// - **Do AURA** (`% AURA-DOCUMENTO`): lê o subconjunto que o próprio AURA
//   escreve (`export/latex/`), realinhado pelos marcadores.
// - **De fora**: o TCC que o aluno começou em LaTeX, no modelo do abnTeX2 ou
//   numa classe padrão (`externo.ts`). Sem marcadores, tudo entra como novo.
//
// Nos dois, nada é expandido nem executado, e o que não é reconhecido volta
// como texto literal, no lugar onde estava, com aviso e a linha. O que o
// arquivo tem e o AURA deriva (capa, folhas, sumário, listas, referências,
// numeração, chamadas) não é lido: o AURA recalcula.

export type CodigoErro =
  "sem-identificacao" | "versao-nova" | "sem-documento" | "nao-utf8" | "grande-demais";

export interface ErroLeitura {
  codigo: CodigoErro;
  mensagem: string;
}

export interface SecaoLida {
  // `null`: seção sem marcador (nova, ou com o marcador apagado ou repetido).
  id: string | null;
  nivel: NivelSecao;
  titulo: string;
  content: BlocoLido[];
  linha: number;
  arquivo: string;
}

export interface PosTextualLido {
  id: string | null;
  titulo: string;
  content: BlocoLido[];
  linha: number;
  arquivo: string;
}

// Os campos que o arquivo traz: os do bloco `AURA-METADADOS`, ou os
// comandos e ambientes do abnTeX2 num `.tex` de fora. Campo ausente fica
// como está no documento. Os opcionais vêm como texto, com os parágrafos
// separados por quebra de linha; vazio quer dizer desligado.
export type MetadadosLidos = Partial<
  Pick<
    Metadados,
    | "titulo"
    | "subtitulo"
    | "autores"
    | "instituicao"
    | "orientador"
    | "local"
    | "ano"
    | "naturezaTrabalho"
    | "resumo"
    | "palavrasChave"
    | "abstract"
    | "keywords"
  > & { dedicatoria: string; agradecimentos: string; epigrafe: string }
>;

export interface TexLido {
  // `aura`: tem a linha `% AURA-DOCUMENTO`. `externo`: não tem, e
  // `documentoId` e `versaoFormato` são nulos.
  origem: "aura" | "externo";
  documentoId: string | null;
  versaoFormato: number | null;
  metadados: MetadadosLidos | null;
  secoes: SecaoLida[];
  apendices: PosTextualLido[];
  anexos: PosTextualLido[];
  chamadas: ChamadaLida[];
  avisos: Aviso[];
}

export type ResultadoLeitura = { ok: true; tex: TexLido } | { ok: false; erro: ErroLeitura };

export interface OpcoesLeitura {
  // Nome do arquivo nos avisos.
  arquivo?: string;
  // Conteúdo de um arquivo do `.zip`, pelo caminho a partir da raiz do
  // projeto, para o `\input` e o `\include`. No `.tex` do AURA, só
  // `sections/`; num de fora, qualquer caminho dentro do pacote (§1.6). Sem
  // esta função (`.tex` avulso), nenhum é seguido.
  lerArquivo?: (caminho: string) => string | null;
  // Chaves que o `\cite{chave}` do aluno pode usar: as referências do
  // documento e as do `.bib` do pacote.
  chavesDeReferencia?: ReadonlySet<string>;
}

const PRIMEIRA_LINHA = /^% AURA-DOCUMENTO: (\S+) v(\d+)\s*$/;

// O `id` do documento, só pela primeira linha: quem reimporta precisa saber o
// destino (e as referências dele) antes da leitura completa. `null` num
// arquivo de fora.
export function idDoDocumento(conteudo: string): string | null {
  const primeira = conteudo
    .replace(/^﻿/, "")
    .split(/\r?\n/, 50)
    .find((linha) => linha.trim() !== "");
  return primeira ? (PRIMEIRA_LINHA.exec(primeira.trim())?.[1] ?? null) : null;
}

// Só UTF-8 (§1.5). `fatal` faz o decodificador recusar em vez de trocar o
// byte inválido por "�" em silêncio.
export function decodificarUtf8(
  bytes: Uint8Array,
): { ok: true; texto: string } | { ok: false; erro: ErroLeitura } {
  try {
    return { ok: true, texto: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return {
      ok: false,
      erro: {
        codigo: "nao-utf8",
        mensagem:
          "O arquivo não está em UTF-8. Salve-o em UTF-8 (é o padrão do Overleaf) e tente de novo.",
      },
    };
  }
}

function falha(codigo: CodigoErro, mensagem: string): ResultadoLeitura {
  return { ok: false, erro: { codigo, mensagem } };
}

// Texto do `.tex`, com os capítulos do `.zip` somados. Um TCC inteiro fica
// abaixo de 1 MB; o limite existe para um arquivo que não é TCC não travar a
// aba (o limite do `.zip` é maior por causa das imagens).
export const TAMANHO_MAXIMO_TEX = 10 * 1024 * 1024;

const GRANDE_DEMAIS =
  "O texto do arquivo passa de 10 MB, muito mais do que um TCC tem. Confira se é o arquivo certo.";

export function lerTex(conteudo: string, opcoes: OpcoesLeitura = {}): ResultadoLeitura {
  if (conteudo.length > TAMANHO_MAXIMO_TEX) return falha("grande-demais", GRANDE_DEMAIS);
  try {
    return ler(conteudo, opcoes);
  } finally {
    liberarPares();
  }
}

function ler(conteudo: string, opcoes: OpcoesLeitura): ResultadoLeitura {
  const arquivo = opcoes.arquivo ?? "main.tex";
  const texto = conteudo.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const linhas = linhasDe(texto, arquivo);

  const primeira = linhas.find((linha) => linha.texto.trim() !== "");
  const identidade = primeira ? PRIMEIRA_LINHA.exec(primeira.texto.trim()) : null;
  const versaoFormato = identidade ? Number(identidade[2]) : null;
  if (versaoFormato !== null && versaoFormato > VERSAO_FORMATO_TEX) {
    return falha(
      "versao-nova",
      "Este arquivo foi gerado por uma versão mais nova do AURA. Atualize a página e tente de novo.",
    );
  }

  const inicio = linhas.findIndex((linha) => /^\s*\\begin\{document\}/.test(linha.texto));
  if (inicio < 0) {
    return falha(
      "sem-documento",
      identidade
        ? "O arquivo não tem \\begin{document}. Sem ele não há como saber onde o texto começa."
        : "O arquivo não tem \\begin{document}: parece um capítulo solto. Importe o arquivo principal do projeto, ou o .zip com todos os arquivos.",
    );
  }

  const avisos: Aviso[] = [];
  const chamadas: ChamadaLida[] = [];
  const chaves = opcoes.chavesDeReferencia ?? new Set<string>();
  const referencias: ReferenciaCruzadaLida[] = [];
  const contexto = (fonte: Fonte): ContextoInline => ({
    fonte,
    avisos,
    chamadas,
    chaves,
    referencias,
    profundidade: 0,
  });

  let fim = linhas.findLastIndex((linha) => /^\s*\\end\{document\}/.test(linha.texto));
  if (fim < inicio) {
    avisos.push({
      ...posicaoDe(linhas.at(-1)!),
      mensagem: "Falta o \\end{document}: o texto foi lido até o fim do arquivo.",
    });
    fim = linhas.length;
  }
  const preambulo = linhas.slice(0, inicio);
  const corpo = linhas.slice(inicio + 1, fim);

  if (!identidade) {
    const expandido = expandirInputs(corpo, opcoes, avisos, "externo");
    if (expandido.reduce((soma, linha) => soma + linha.texto.length + 1, 0) > TAMANHO_MAXIMO_TEX) {
      return falha("grande-demais", GRANDE_DEMAIS);
    }
    const comeco = inicioDoTexto(expandido);
    const metadados = lerMetadadosExternos(
      Fonte.deLinhas(preambulo),
      Fonte.deLinhas(expandido.slice(0, comeco)),
      contexto,
    );
    const lidos = lerItens(contexto(Fonte.deLinhas(expandido.slice(comeco))), "externo");
    const { secoes, apendices, anexos, secaoDoTitulo } = montarExterno(lidos, avisos);
    const tex: TexLido = {
      origem: "externo",
      documentoId: null,
      versaoFormato: null,
      metadados,
      secoes,
      apendices,
      anexos,
      chamadas,
      avisos,
    };
    resolverReferencias(tex, referencias, alvosDosRotulos(lidos, secoes, secaoDoTitulo), avisos);
    return { ok: true, tex };
  }

  const metadados = lerMetadados(preambulo, contexto, avisos);
  const { textual, posTextual } = dividirCorpo(corpo, avisos);

  const fonteTextual = Fonte.deLinhas(expandirInputs(textual, opcoes, avisos, "aura"));
  if (fonteTextual.texto.length > TAMANHO_MAXIMO_TEX) return falha("grande-demais", GRANDE_DEMAIS);
  const secoes = montarSecoes(lerItens(contexto(fonteTextual), "textual"), avisos);

  const fontePos = Fonte.deLinhas(posTextual);
  const { apendices, anexos } = montarPosTextuais(
    lerItens(contexto(fontePos), "posTextual"),
    avisos,
  );

  const tex: TexLido = {
    origem: "aura",
    documentoId: identidade[1],
    versaoFormato,
    metadados,
    secoes,
    apendices,
    anexos,
    chamadas,
    avisos,
  };
  // O `.tex` do AURA não escreve `\ref`; um que o aluno tenha posto fica como
  // texto, com o aviso.
  resolverReferencias(tex, referencias, new Map(), avisos);
  return { ok: true, tex };
}

function posicaoDe(linha: LinhaFonte) {
  return { arquivo: linha.arquivo, linha: linha.linha };
}

// --- Metadados do AURA -------------------------------------------------------

const CAMPO_DA_MACRO = new Map(
  (Object.keys(MACRO) as (keyof typeof MACRO)[]).map((campo) => [MACRO[campo], campo]),
);

function lerMetadados(
  preambulo: readonly LinhaFonte[],
  contexto: (fonte: Fonte) => ContextoInline,
  avisos: Aviso[],
): MetadadosLidos | null {
  const abre = preambulo.findIndex((linha) => linha.texto.trim() === "% AURA-METADADOS: início");
  const fecha = preambulo.findIndex((linha) => linha.texto.trim() === "% AURA-METADADOS: fim");
  if (abre < 0 || fecha < abre) {
    avisos.push({
      arquivo: preambulo[0]?.arquivo ?? "",
      linha: 1,
      mensagem:
        "O bloco AURA-METADADOS não foi encontrado no preâmbulo: capa, resumo e demais dados ficam como estão no AURA.",
    });
    return null;
  }

  const fonte = Fonte.deLinhas(preambulo.slice(abre + 1, fecha));
  const ctx = contexto(fonte);
  const t = fonte.texto;
  const lidos: MetadadosLidos = {};
  let i = 0;
  for (;;) {
    i = pularEspacos(t, i);
    if (i >= t.length) break;
    const nomeGrupo = t.startsWith("\\newcommand", i)
      ? lerGrupo(t, i + "\\newcommand".length)
      : null;
    const valor = nomeGrupo && lerGrupo(t, nomeGrupo.depois);
    if (!nomeGrupo || !valor) {
      const fimDaLinha = t.indexOf("\n", i) < 0 ? t.length : t.indexOf("\n", i);
      avisos.push({
        ...fonte.posicao(i),
        mensagem: "Linha do bloco de metadados que não é um \\newcommand do AURA: ignorada.",
      });
      i = fimDaLinha;
      continue;
    }
    const macro = t.slice(nomeGrupo.inicio, nomeGrupo.fim).trim();
    const campo = CAMPO_DA_MACRO.get(macro as (typeof MACRO)[keyof typeof MACRO]);
    if (!campo) {
      avisos.push({
        ...fonte.posicao(i),
        mensagem: `Comando ${macro} no bloco de metadados não é do AURA: ignorado.`,
      });
    } else {
      atribuirCampo(lidos, campo, ctx, valor.inicio, valor.fim);
    }
    i = valor.depois;
  }
  return lidos;
}

const PAR = new Set(["par"]);

function atribuirCampo(
  lidos: MetadadosLidos,
  campo: keyof typeof MACRO,
  ctx: ContextoInline,
  inicio: number,
  fim: number,
) {
  const t = ctx.fonte.texto;
  const plano = () => textoPlano(ctx, inicio, fim, "o campo");
  switch (campo) {
    case "autores":
      lidos.autores = dividirForaDeChaves(t, inicio, fim, "\\\\")
        .map((parte) => textoPlano(ctx, parte.inicio, parte.fim, "o nome do autor"))
        .filter(Boolean);
      return;
    case "palavrasChave":
    case "keywords":
      lidos[campo] = plano()
        .split(SEPARADOR_TERMOS.trim())
        .map((termo) => termo.trim())
        .filter(Boolean);
      return;
    case "ano": {
      const ano = Number.parseInt(plano(), 10);
      if (Number.isFinite(ano)) lidos.ano = ano;
      else
        ctx.avisos.push({
          ...ctx.fonte.posicao(inicio),
          mensagem: "O ano não é um número: ficou o do AURA.",
        });
      return;
    }
    case "dedicatoria":
    case "agradecimentos":
    case "epigrafe":
      // Parágrafos separados por `\par` (`paragrafosDe()` em markers.ts).
      lidos[campo] = dividirEmComandos(t, inicio, fim, PAR)
        .map((parte) => textoPlano(ctx, parte.inicio, parte.fim, "o campo"))
        .filter(Boolean)
        .join("\n");
      return;
    default:
      lidos[campo] = plano();
  }
}

// --- Corpo do AURA -----------------------------------------------------------

const TEXTUAL = /^\s*\\textual\s*$/;
const POS_TEXTUAL = /^\s*\\postextual\s*$/;
const TITULO_DE_SECAO = /^\s*\\(chapter|section|subsection|subsubsection)\b/;

// O corpo em duas regiões: as seções (entre `\textual` e `\postextual`) e
// os apêndices e anexos. O que vem antes de `\textual` é pré-textual,
// derivado dos metadados; não é lido.
function dividirCorpo(corpo: readonly LinhaFonte[], avisos: Aviso[]) {
  let textual = corpo.findIndex((linha) => TEXTUAL.test(linha.texto));
  let pos = corpo.findIndex((linha) => POS_TEXTUAL.test(linha.texto));

  if (textual < 0) {
    const primeira = corpo.findIndex(
      (linha) => /^\s*% AURA-SECTION:/.test(linha.texto) || TITULO_DE_SECAO.test(linha.texto),
    );
    textual = primeira < 0 ? (pos < 0 ? corpo.length : pos) : primeira - 1;
    avisos.push({
      ...posicaoDe(corpo[Math.max(textual, 0)] ?? { arquivo: "", linha: 0, texto: "" }),
      mensagem: "Falta o \\textual: as seções foram lidas a partir do primeiro título.",
    });
  }
  if (pos < 0 || pos < textual) {
    const primeiro = corpo.findIndex(
      (linha, indice) => indice > textual && /^\s*% AURA-(APENDICE|ANEXO):/.test(linha.texto),
    );
    pos = primeiro < 0 ? corpo.length : primeiro - 1;
    avisos.push({
      ...posicaoDe(corpo[Math.min(pos, corpo.length - 1)] ?? { arquivo: "", linha: 0, texto: "" }),
      mensagem:
        "Falta o \\postextual: o fim das seções foi deduzido pelo primeiro apêndice ou anexo.",
    });
  }

  // Depois do `\postextual` vêm as referências, derivadas. Os apêndices e
  // anexos começam no primeiro marcador ou no primeiro título que não é o
  // das referências.
  const depois = corpo.slice(pos + 1);
  const primeiroElemento = depois.findIndex(
    (linha) =>
      /^\s*% AURA-(APENDICE|ANEXO):/.test(linha.texto) ||
      (/^\s*\\pretextualchapter\{/.test(linha.texto) &&
        !linha.texto.includes(`{${TITULO_REFERENCIAS}}`)),
  );

  return {
    textual: corpo.slice(textual + 1, pos),
    posTextual: primeiroElemento < 0 ? [] : depois.slice(primeiroElemento),
  };
}

// --- `\input` e `\include` ---------------------------------------------------

const INPUT = /^\s*\\(input|include)\s*\{([^{}]+)\}\s*$/;

// Níveis de `\input` dentro de `\input` que um projeto de fora pode ter.
const PROFUNDIDADE_DE_INPUT = 5;

// Caminho de dentro do pacote, a partir da raiz do projeto: sem `..` que saia
// dela, sem caminho absoluto, com `.tex` quando não tem extensão. `null` se
// sai do projeto.
export function caminhoNoProjeto(pedido: string): string | null {
  const limpo = pedido.trim().replace(/\\/g, "/");
  if (limpo.startsWith("/") || /^[a-zA-Z]:/.test(limpo)) return null;
  const partes: string[] = [];
  for (const parte of limpo.split("/")) {
    if (parte === "" || parte === ".") continue;
    if (parte === "..") {
      if (partes.length === 0) return null;
      partes.pop();
    } else partes.push(parte);
  }
  if (partes.length === 0) return null;
  const caminho = partes.join("/");
  return /\.[a-zA-Z0-9]+$/.test(caminho) ? caminho : `${caminho}.tex`;
}

// O conteúdo de cada `\input` entra no lugar da linha, com a linha e o nome
// do arquivo para os avisos. No `.tex` do AURA, só `sections/`, um nível
// (§1.5). Num de fora, qualquer caminho dentro do projeto, até
// `PROFUNDIDADE_DE_INPUT` níveis, sem ciclo (§1.6).
function expandirInputs(
  linhas: readonly LinhaFonte[],
  opcoes: OpcoesLeitura,
  avisos: Aviso[],
  modo: "aura" | "externo",
  pilha: readonly string[] = [],
): LinhaFonte[] {
  const saida: LinhaFonte[] = [];
  for (const linha of linhas) {
    const achado = INPUT.exec(linha.texto);
    if (!achado) {
      saida.push(linha);
      continue;
    }
    const comando = `\\${achado[1]}{${achado[2]}}`;
    const avisar = (mensagem: string) => avisos.push({ ...posicaoDe(linha), mensagem });
    const caminho = caminhoNoProjeto(achado[2]);
    if (!opcoes.lerArquivo) {
      avisar(
        `${comando} não é seguido num .tex avulso. Para trazer os capítulos, importe o .zip do projeto.`,
      );
      continue;
    }
    const permitido =
      caminho !== null && (modo === "externo" || /^sections\/[^/]+\.tex$/.test(caminho));
    if (!permitido) {
      avisar(
        modo === "aura"
          ? `${comando} não é seguido: só os arquivos de sections/ que o AURA escreve são lidos.`
          : `${comando} não é seguido: o caminho sai da pasta do projeto.`,
      );
      continue;
    }
    if (pilha.includes(caminho) || pilha.length >= PROFUNDIDADE_DE_INPUT) {
      avisar(
        `${comando} não é seguido: ${pilha.includes(caminho) ? "o arquivo inclui a si mesmo" : "arquivos incluídos uns nos outros em níveis demais"}.`,
      );
      continue;
    }
    const conteudo = opcoes.lerArquivo(caminho);
    if (conteudo === null) {
      avisar(`${comando}: o arquivo não está no pacote.`);
      continue;
    }
    const incluidas = linhasDe(conteudo.replace(/^﻿/, "").replace(/\r\n?/g, "\n"), caminho);
    saida.push(
      ...(modo === "externo"
        ? expandirInputs(incluidas, opcoes, avisos, modo, [...pilha, caminho])
        : incluidas),
    );
  }
  return saida;
}

// --- Montagem do AURA --------------------------------------------------------

const NIVEL: Record<string, NivelSecao> = {
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 3,
};

function montarSecoes({ fonte, itens }: ItensLidos, avisos: Aviso[]): SecaoLida[] {
  const secoes: SecaoLida[] = [];
  const vistos = new Set<string>();
  let marcador: Extract<Item, { tipo: "marcador" }> | null = null;
  const avisar = (pos: number, mensagem: string) =>
    avisos.push({ ...fonte.posicao(pos), mensagem });

  for (const item of itens) {
    if (item.tipo !== "titulo" && marcador) {
      avisar(marcador.pos, `Marcador da seção ${marcador.id} sem título logo depois: ignorado.`);
      marcador = null;
    }
    switch (item.tipo) {
      case "marcador":
        if (item.qual === "SECTION") marcador = item;
        else
          avisar(
            item.pos,
            `Marcador de ${item.qual === "APENDICE" ? "apêndice" : "anexo"} no meio das seções: ignorado.`,
          );
        break;
      case "titulo": {
        if (item.comando === "subsubsection") {
          avisar(
            item.pos,
            `O AURA tem três níveis de seção: “${item.titulo}” (\\subsubsection) voltou como nível 3.`,
          );
        }
        let id = marcador?.id ?? null;
        if (id && vistos.has(id)) {
          avisar(item.pos, `Marcador repetido (${id}): “${item.titulo}” voltou como seção nova.`);
          id = null;
        }
        if (id) vistos.add(id);
        secoes.push({
          id,
          nivel: NIVEL[item.comando],
          titulo: item.titulo,
          content: [],
          ...fonte.posicao(item.pos),
        });
        marcador = null;
        break;
      }
      case "bloco":
        if (secoes.length === 0) {
          avisar(item.pos, "Texto antes do primeiro título: entrou numa seção sem título.");
          secoes.push({ id: null, nivel: 1, titulo: "", content: [], ...fonte.posicao(item.pos) });
        }
        secoes.at(-1)!.content.push(item.bloco);
        break;
      default:
        break;
    }
  }
  if (marcador)
    avisar(marcador.pos, `Marcador da seção ${marcador.id} sem título logo depois: ignorado.`);
  return secoes;
}

// "APÊNDICE A — " / "ANEXO B — ": derivados da posição (§1.5, princípio 3).
// Sem travessão, só quando o título acaba ali: "Apêndice sobre X" é título.
const ROTULO_POS_TEXTUAL = /^(ap[êe]ndice|anexo)(?:\s+[a-z]{1,3})?\s*(?:(?:—|–|-{1,3})\s*|$)/iu;

function montarPosTextuais({ fonte, itens }: ItensLidos, avisos: Aviso[]) {
  const apendices: PosTextualLido[] = [];
  const anexos: PosTextualLido[] = [];
  const vistos = { APENDICE: new Set<string>(), ANEXO: new Set<string>() };
  let marcador: Extract<Item, { tipo: "marcador" }> | null = null;
  let atual: PosTextualLido | null = null;
  let ultimoTipo: "APENDICE" | "ANEXO" = "APENDICE";
  const avisar = (pos: number, mensagem: string) =>
    avisos.push({ ...fonte.posicao(pos), mensagem });

  for (const item of itens) {
    if (item.tipo !== "tituloPos" && marcador) {
      avisar(marcador.pos, `Marcador ${marcador.id} sem título logo depois: ignorado.`);
      marcador = null;
    }
    switch (item.tipo) {
      case "marcador":
        if (item.qual === "SECTION")
          avisar(item.pos, "Marcador de seção depois do fim das seções: ignorado.");
        else marcador = item;
        break;
      case "tituloPos": {
        const rotulo = ROTULO_POS_TEXTUAL.exec(item.titulo);
        const peloRotulo = rotulo
          ? rotulo[1].toLowerCase() === "anexo"
            ? "ANEXO"
            : "APENDICE"
          : null;
        const tipo: "APENDICE" | "ANEXO" =
          (marcador?.qual as "APENDICE" | "ANEXO" | undefined) ?? peloRotulo ?? ultimoTipo;
        let id = marcador?.id ?? null;
        if (!marcador) {
          avisar(
            item.pos,
            `“${item.titulo}” sem marcador: entra como ${tipo === "ANEXO" ? "anexo" : "apêndice"} novo.`,
          );
        } else if (id && vistos[tipo].has(id)) {
          avisar(item.pos, `Marcador repetido (${id}): “${item.titulo}” entra como novo.`);
          id = null;
        }
        if (id) vistos[tipo].add(id);
        atual = {
          id,
          titulo: rotulo ? item.titulo.slice(rotulo[0].length) : item.titulo,
          content: [],
          ...fonte.posicao(item.pos),
        };
        (tipo === "ANEXO" ? anexos : apendices).push(atual);
        ultimoTipo = tipo;
        marcador = null;
        break;
      }
      case "titulo":
        avisar(
          item.pos,
          `Título de seção “${item.titulo}” depois das referências: entrou como texto.`,
        );
        atual?.content.push(paragrafoLiteral(item.titulo));
        break;
      case "bloco":
        if (!atual) {
          avisar(item.pos, "Texto depois das referências, fora de apêndice ou anexo: não volta.");
          break;
        }
        atual.content.push(item.bloco);
        break;
      default:
        break;
    }
  }
  if (marcador) avisar(marcador.pos, `Marcador ${marcador.id} sem título logo depois: ignorado.`);
  return { apendices, anexos };
}
