// Formatador da NBR 6023:2025 — passo 4.3. Recebe a referência em campos
// separados e devolve o texto da entrada na lista de referências.
//
// **Fonte: docs/auditoria-abnt.md, seção "Auditoria da NBR 6023:2025"**, a
// leitura item a item da 3ª edição (21.05.2025). Cada regra abaixo cita o
// item de onde saiu. O que a auditoria NÃO registra literalmente está marcado
// com `CONVENÇÃO` e listado junto no registro do passo em docs/to-do.md —
// escrever convenção com cara de norma é o defeito que este projeto evita, e
// aqui ele sairia caro: um documento fora da norma com aparência de conforme.
//
// **Um formatador só, nunca caso a caso** (§6.4: a pontuação deve ser uniforme
// em todas as referências). É por isso que tudo passa pelos mesmos montadores:
// duas funções escrevendo imprenta dariam duas pontuações com o tempo.
//
// **A saída é semântica, não tipográfica.** Devolve trechos com PAPEL, não com
// `bold: true` — mesmo princípio de `document/elements/linhaPreTextual.ts`, em
// que o core diz o que a linha é e quem exporta decide como desenhar. Aqui
// vale em dobro, porque a norma deixa a escolha aberta de propósito: §6.7
// manda destacar "o elemento título" por "negrito, itálico ou sublinhado", à
// escolha, desde que uniforme em todas as referências. Quem escolhe é o painel
// (4.5) e a exportação (4.11); o que o core sabe é QUAL trecho é o título.
//
// A caixa alta do sobrenome é outra coisa, e por isso sai daqui já aplicada:
// §8.1.1 não oferece alternativa — o último sobrenome entra em maiúsculas.
// Não é recurso de destaque escolhido pelo documento, é o texto da referência.

import type {
  CSLDate,
  CSLName,
  Edicao,
  Extensao,
  Referencia,
  ReferenciaArtigo,
  ReferenciaCapitulo,
  ReferenciaEvento,
  ReferenciaLivro,
  ReferenciaSite,
  ReferenciaTese,
  Responsabilidade,
  TipoParticipacao,
} from "../types";

// --- A saída -----------------------------------------------------------------

// Só o título tem papel, porque só ele muda de tipografia (§6.7). União de um
// membro, e não `titulo?: boolean`, para caber um segundo papel sem virar um
// booleano por papel.
export type PapelTrecho = "titulo";

export interface TrechoReferencia {
  texto: string;
  papel?: PapelTrecho;
}

// --- Entrada pública ---------------------------------------------------------

export function formatarReferencia(referencia: Referencia): TrechoReferencia[] {
  return juntarPartes(partesDe(referencia));
}

// Texto corrido, sem a marcação de destaque. Serve à busca, à ordenação (4.4)
// e aos testes; quem exibe usa `formatarReferencia()` para não perder o §6.7.
export function referenciaEmTexto(referencia: Referencia): string {
  return formatarReferencia(referencia)
    .map((trecho) => trecho.texto)
    .join("");
}

// --- Montagem por tipo -------------------------------------------------------
// Cada função devolve as PARTES da referência: uma lista de elementos, cada um
// já pontuado por dentro. Quem separa os elementos entre si é `juntarPartes()`,
// num lugar só — o §6.4 de novo.

function partesDe(referencia: Referencia): TrechoReferencia[][] {
  switch (referencia.type) {
    case "book":
      return livro(referencia);
    case "chapter":
      return capitulo(referencia);
    case "article-journal":
      return artigo(referencia);
    case "thesis":
      return tese(referencia);
    case "paper-conference":
      return trabalhoEmEvento(referencia);
    case "webpage":
      return site(referencia);
  }
}

// §7.1.1 monografia no todo: autor, título, subtítulo, edição, local, editora,
// data. Tradução e volume são complementares (§6.8).
function livro(referencia: ReferenciaLivro): TrechoReferencia[][] {
  const semAutoria = !temAutoria(referencia.author);

  return [
    ...autoria(referencia.author),
    tituloDestacado(referencia.title, referencia.subtitle, semAutoria),
    ...talvez(traducao(referencia.translator)),
    ...talvez(edicao(referencia.edicao)),
    ...talvez(volume(referencia.volume)),
    [texto(imprenta(referencia["publisher-place"], referencia.publisher, referencia.issued))],
    ...disponibilidade(referencia.URL, referencia.accessed),
  ];
}

// §7.3 parte de monografia: autor e título da parte, "In:", a referência da
// monografia inteira, e a paginação da parte ao final.
//
// `CONVENÇÃO` — o destaque vai no título do LIVRO, não no do capítulo. §6.7
// manda destacar "o elemento título" mas não diz qual dos dois quando há parte
// e todo; a leitura adotada é que o destaque marca a obra que se procura na
// estante, e é a mesma em `artigo()` e em `trabalhoEmEvento()`.
function capitulo(referencia: ReferenciaCapitulo): TrechoReferencia[][] {
  // §8.1.1.4: quem responde pelo conjunto leva a abreviação do tipo de
  // participação. Sem responsável declarado, entra o autor do livro (§7.3);
  // sem nenhum dos dois, o "In:" gruda no título, que vira o elemento de
  // entrada da obra contida.
  const responsavel = referencia.responsabilidade
    ? [texto(`In: ${responsabilidade(referencia.responsabilidade)}`)]
    : temAutoria(referencia["container-author"])
      ? [texto(`In: ${nomesInvertidos(referencia["container-author"])}`)]
      : undefined;

  return [
    ...autoria(referencia.author),
    tituloSimples(referencia.title, referencia.subtitle, !temAutoria(referencia.author)),
    ...talvez(responsavel),
    prefixar(
      responsavel ? "" : "In: ",
      tituloDestacado(
        referencia["container-title"],
        referencia["container-subtitle"],
        !responsavel,
      ),
    ),
    ...talvez(edicao(referencia.edicao)),
    [texto(imprenta(referencia["publisher-place"], referencia.publisher, referencia.issued))],
    ...talvez(paginas(referencia.page)),
    ...disponibilidade(referencia.URL, referencia.accessed),
  ];
}

// §7.7.5 artigo de publicação periódica: autor, título do artigo, título do
// periódico, local, volume, número, páginas, data.
//
// `CONVENÇÃO` em dois pontos: o destaque no título do periódico (mesma leitura
// do capítulo) e a vírgula como separador do periódico em diante — a auditoria
// registra a ORDEM desses elementos, não a pontuação entre eles.
function artigo(referencia: ReferenciaArtigo): TrechoReferencia[][] {
  const depoisDoPeriodico = [
    referencia["publisher-place"],
    referencia.volume ? `v. ${referencia.volume}` : undefined,
    referencia.issue ? `n. ${referencia.issue}` : undefined,
    referencia.page ? paginasEmTexto(referencia.page) : undefined,
    referencia.issued ? data(referencia.issued) : undefined,
  ].filter(presente);

  return [
    ...autoria(referencia.author),
    tituloSimples(referencia.title, referencia.subtitle, !temAutoria(referencia.author)),
    [
      { texto: referencia["container-title"], papel: "titulo" },
      ...(depoisDoPeriodico.length > 0 ? [texto(`, ${depoisDoPeriodico.join(", ")}`)] : []),
    ],
    ...disponibilidade(referencia.URL, referencia.accessed),
  ];
}

// §7.1.2 e §8.12 trabalho acadêmico: autor, título, subtítulo, ano de
// depósito, tipo do trabalho, grau e curso entre parênteses, vinculação
// acadêmica, local e data de defesa.
//
// `CONVENÇÃO`: o travessão entre os parênteses e a vinculação, e a forma
// "Orientação: ..." logo depois do título — §8.1.1.6 diz que orientador é
// acrescentado após o título, mas não fixa a palavra nem a pontuação.
function tese(referencia: ReferenciaTese): TrechoReferencia[][] {
  const grauECurso = [referencia.grau, referencia.curso ? `em ${referencia.curso}` : undefined]
    .filter(presente)
    .join(" ");

  const trabalho = [referencia.tipoTrabalho, grauECurso ? `(${grauECurso})` : undefined]
    .filter(presente)
    .join(" ");

  const instituicao = [
    referencia.publisher,
    referencia["publisher-place"],
    referencia.defesa ? data(referencia.defesa) : undefined,
  ]
    .filter(presente)
    .join(", ");

  return [
    ...autoria(referencia.author),
    tituloDestacado(referencia.title, referencia.subtitle, !temAutoria(referencia.author)),
    ...talvez(orientacao(referencia.orientador)),
    ...talvez(referencia.issued ? [texto(data(referencia.issued))] : undefined),
    ...talvez(referencia.extensao ? [texto(extensao(referencia.extensao))] : undefined),
    [texto([trabalho, instituicao].filter(presente).join(" – "))],
    ...disponibilidade(referencia.URL, referencia.accessed),
  ];
}

// §7.8.4.1 parte de evento em monografia: autor, título do trabalho, "In:",
// nome do evento, numeração, ano e local de realização, título do documento,
// local, editora, data, páginas.
//
// §8.1.3: o nome do evento entra por extenso e EM MAIÚSCULAS, seguido do
// número de ocorrência em arábico com ponto ("10."), do ano e do local.
function trabalhoEmEvento(referencia: ReferenciaEvento): TrechoReferencia[][] {
  const evento = [
    maiusculas(referencia["event-title"]),
    referencia["event-number"] ? numeroDoEvento(referencia["event-number"]) : undefined,
    referencia["event-date"] ? data(referencia["event-date"]) : undefined,
    referencia["event-place"],
  ]
    .filter(presente)
    .join(", ");

  return [
    ...autoria(referencia.author),
    tituloSimples(referencia.title, referencia.subtitle, !temAutoria(referencia.author)),
    [texto(`In: ${evento}`)],
    ...talvez(
      referencia["container-title"]
        ? tituloDestacado(referencia["container-title"], undefined, false)
        : undefined,
    ),
    [texto(imprenta(referencia["publisher-place"], referencia.publisher, referencia.issued))],
    ...talvez(paginas(referencia.page)),
    ...disponibilidade(referencia.URL, referencia.accessed),
  ];
}

// §7.20 documento de acesso exclusivo em meio eletrônico, mais §6.6. A norma
// não tem um tipo "site": o que define este é o par endereço + acesso, que a
// §8.13 manda pôr por último.
//
// `CONVENÇÃO`: a posição do nome do site logo depois do título — §7.20 não o
// lista entre os elementos do modelo.
function site(referencia: ReferenciaSite): TrechoReferencia[][] {
  const contexto = [
    referencia["container-title"],
    referencia.issued ? data(referencia.issued) : undefined,
  ]
    .filter(presente)
    .join(", ");

  return [
    ...autoria(referencia.author),
    tituloDestacado(referencia.title, referencia.subtitle, !temAutoria(referencia.author)),
    ...talvez(contexto ? [texto(contexto)] : undefined),
    ...disponibilidade(referencia.URL, referencia.accessed),
  ];
}

// --- Autoria (§8.1) ----------------------------------------------------------

// Exportada porque a ORDENAÇÃO (4.4) precisa da mesma resposta: é esta função
// que decide se a obra entra pelo autor ou pelo título (§8.1.4), e duas
// implementações da mesma pergunta acabariam discordando num caso de borda —
// a referência sairia formatada por título e ordenada por autor.
export function temAutoria(nomes: readonly CSLName[] | undefined): boolean {
  return !!nomes && nomes.some((nome) => presente(nome.literal ?? nome.family ?? nome.given));
}

// Sem autoria a parte simplesmente não existe: §8.1.4 manda entrar pelo
// título, e proíbe por escrito o "Anônimo" e o "Autor desconhecido".
function autoria(nomes: readonly CSLName[] | undefined): TrechoReferencia[][] {
  return temAutoria(nomes) ? [[texto(nomesInvertidos(nomes))]] : [];
}

// §8.1.1: último sobrenome em maiúsculas, seguido do prenome. §8.1.1.1: até
// três, todos. §8.1.1.2: de quatro em diante "convém indicar TODOS", e o
// `et al.` é PERMISSÃO, não obrigação — por isso este formatador nunca corta
// sozinho, ao contrário do que quase toda fonte secundária ensina.
// §8.1.1: separados por ponto e vírgula seguido de espaço.
function nomesInvertidos(nomes: readonly CSLName[] | undefined): string {
  return (nomes ?? [])
    .map((nome) => {
      // §8.1.2: autoria corporativa NÃO se inverte.
      if (presente(nome.literal)) return maiusculas(nome.literal);
      if (!presente(nome.family)) return nome.given ?? "";
      return presente(nome.given)
        ? `${maiusculas(nome.family)}, ${nome.given}`
        : maiusculas(nome.family);
    })
    .filter(presente)
    .join("; ");
}

// Nome na ordem direta, para as responsabilidades complementares da §8.1.1.6
// (tradução, orientação): elas são acréscimo depois do título, não elemento de
// entrada, e o que a norma manda inverter é o elemento de entrada.
function nomeDireto(nome: CSLName): string {
  if (presente(nome.literal)) return nome.literal;
  return [nome.given, nome.family].filter(presente).join(" ");
}

// §8.1.1.4: a abreviação do tipo de participação vai em minúsculas, no
// singular, entre parênteses, DEPOIS DO ÚLTIMO NOME.
const ABREVIACAO_PARTICIPACAO: Record<TipoParticipacao, string> = {
  organizador: "org.",
  compilador: "comp.",
  editor: "ed.",
  coordenador: "coord.",
};

function responsabilidade(responsavel: Responsabilidade): string {
  return `${nomesInvertidos(responsavel.nomes)} (${ABREVIACAO_PARTICIPACAO[responsavel.tipo]})`;
}

function traducao(nomes: readonly CSLName[] | undefined): TrechoReferencia[] | undefined {
  if (!temAutoria(nomes)) return undefined;
  return [texto(`Tradução de ${(nomes ?? []).map(nomeDireto).filter(presente).join("; ")}`)];
}

// `CONVENÇÃO` na palavra: a norma chama o papel de "orientador" (§8.1.1.6),
// mas não fixa como ele aparece impresso. "Orientação" evita supor o gênero de
// uma pessoa real para ganhar nada em conformidade.
function orientacao(nomes: readonly CSLName[] | undefined): TrechoReferencia[] | undefined {
  if (!temAutoria(nomes)) return undefined;
  return [texto(`Orientação: ${(nomes ?? []).map(nomeDireto).filter(presente).join("; ")}`)];
}

// --- Título (§8.2, §6.7) -----------------------------------------------------

// Título com o destaque da §6.7, salvo quando a obra entra pelo título: nesse
// caso a norma troca o recurso tipográfico pela caixa alta da primeira palavra
// ("§6.7 — obra sem autoria: SEM destaque; o destaque é a primeira palavra em
// maiúsculas"). Dois recursos ao mesmo tempo seria destacar duas vezes.
function tituloDestacado(
  titulo: string,
  subtitulo: string | undefined,
  entradaPeloTitulo: boolean,
): TrechoReferencia[] {
  const principal: TrechoReferencia = entradaPeloTitulo
    ? texto(primeirasPalavrasEmCaixaAlta(titulo))
    : { texto: titulo, papel: "titulo" };

  // §8.2: título e subtítulo separados por dois-pontos. O destaque para no
  // dois-pontos — em todos os exemplos da norma o subtítulo vem sem ele.
  return presente(subtitulo) ? [principal, texto(`: ${subtitulo}`)] : [principal];
}

// Título de PARTE (capítulo, artigo, trabalho em evento): nunca leva destaque,
// porque nesses modelos ele recai sobre a obra que contém a parte. Continua
// valendo a caixa alta da §6.7 quando a parte não tem autoria própria.
function tituloSimples(
  titulo: string,
  subtitulo: string | undefined,
  entradaPeloTitulo: boolean,
): TrechoReferencia[] {
  const principal = texto(entradaPeloTitulo ? primeirasPalavrasEmCaixaAlta(titulo) : titulo);
  return presente(subtitulo) ? [principal, texto(`: ${subtitulo}`)] : [principal];
}

// Artigos definidos e indefinidos do português. §6.7 manda a caixa alta cobrir
// "a primeira palavra, incluindo artigo e monossílabo iniciais" — quando o
// título abre com artigo, ele não conta sozinho como a primeira palavra.
// Exportada para a chamada no texto (`inText.ts`, 4.9), que entra pelo título
// com a mesma "primeira palavra" — duas listas de artigo acabariam
// discordando sobre onde a primeira palavra termina.
export const ARTIGOS_INICIAIS: ReadonlySet<string> = new Set([
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "uns",
  "umas",
]);

// LIMITAÇÃO conhecida: a regra da §6.7 fala em "artigo E MONOSSÍLABO
// iniciais", e monossílabo não se detecta sem contar sílabas. Fica só o
// artigo, que é o caso comum e verificável; um título aberto por monossílabo
// que não seja artigo sai com uma palavra a menos em caixa alta.
function primeirasPalavrasEmCaixaAlta(titulo: string): string {
  const palavras = titulo.split(" ");
  if (palavras.length === 0) return titulo;

  const quantas = ARTIGOS_INICIAIS.has(palavras[0].toLocaleLowerCase("pt-BR")) ? 2 : 1;
  return palavras
    .map((palavra, indice) => (indice < quantas ? maiusculas(palavra) : palavra))
    .join(" ");
}

// --- Edição (§8.3) -----------------------------------------------------------

// §8.3: as abreviaturas do numeral ordinal e da palavra edição vão AMBAS no
// idioma do documento — "2. ed." num livro em português, "5th ed." num em
// inglês.
//
// LIMITAÇÃO conhecida: só pt e en têm forma conferida (a auditoria registra os
// dois exemplos). O formulário do 4.2 oferece seis idiomas, então es, fr, de e
// it caem na forma portuguesa — que está errada para fr ("2e éd.") e de
// ("2. Aufl."). Corrigir exige fonte para cada idioma; até lá, o que o AURA
// escreve para eles é convenção, não norma. Registrado no passo 4.3.
const EDICAO_POR_IDIOMA: Record<string, (numero: number) => string> = {
  pt: (numero) => `${numero}. ed.`,
  en: (numero) => `${ordinalIngles(numero)} ed.`,
};

function edicao(valor: Edicao | undefined): TrechoReferencia[] | undefined {
  if (!valor || !Number.isFinite(valor.numero)) return undefined;

  const escrever = EDICAO_POR_IDIOMA[valor.idioma ?? "pt"] ?? EDICAO_POR_IDIOMA.pt;
  // §8.3.1: emendas e acréscimos de forma abreviada, como consta no documento
  // — "3. ed. rev. e aum.".
  const base = escrever(valor.numero);
  return [texto(presente(valor.acrescimos) ? `${base} ${valor.acrescimos}` : base)];
}

function ordinalIngles(numero: number): string {
  const dezena = numero % 100;
  if (dezena >= 11 && dezena <= 13) return `${numero}th`;

  const sufixo = { 1: "st", 2: "nd", 3: "rd" }[numero % 10] ?? "th";
  return `${numero}${sufixo}`;
}

// --- Imprenta (§8.4, §8.5, §8.6) ---------------------------------------------

// Local e editora, com as marcas que a norma dá ao que não se identifica:
// `[S. l.]` (§8.4.4), `[s. n.]` (§8.5.5) e `[S. l.: s. n.]` quando falta o par
// inteiro (§8.5.6).
//
// Escrevê-las quando o campo está vazio é uma decisão, e não a única possível:
// o vazio pode significar "não identifiquei" ou "ainda não preenchi", e a
// referência afirma o primeiro. Escolhido assim porque é o que a norma pede de
// uma referência completa, e porque a Fase 5 é quem avisa que falta dado —
// calar os dois casos produziria referência incompleta sem ninguém notar.
//
// NÃO IMPLEMENTADO de propósito: a supressão de palavras que designam natureza
// jurídica ou comercial ("Editora Atlas S.A." vira "Editora Atlas", §8.5).
// Feita por lista de palavras, ela estragaria nomes conhecidos em que a
// palavra é parte do nome — "Companhia das Letras". Fica para o dado de
// entrada, com a dica no formulário.
function imprenta(
  local: string | undefined,
  editora: string | undefined,
  quando: CSLDate | undefined,
): string {
  const temLocal = presente(local);
  const temEditora = presente(editora);

  const lugar =
    !temLocal && !temEditora
      ? "[S. l.: s. n.]"
      : `${temLocal ? local : "[S. l.]"}: ${temEditora ? editora : "[s. n.]"}`;

  const quandoTexto = quando ? data(quando) : "";
  return presente(quandoTexto) ? `${lugar}, ${quandoTexto}` : lugar;
}

// --- Data (§8.6) -------------------------------------------------------------

// Anexo A (normativo), em pt-BR. "maio" é o único que não abrevia.
const MESES_PT = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "maio",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];

// §8.6.1: ano em arábico. §8.6.2: mês abreviado antes do ano. §8.6.3: dia em
// arábico antes do mês, separado por espaço.
//
// §8.6.1.3: a data incerta ("[ca. 1960]", "[entre 1906 e 1912]") sai como a
// pessoa digitou — é o `raw` de `CSLDate`, que existe justamente porque esses
// valores não cabem em números. Quem os escreve já escreve com colchetes.
function data(valor: CSLDate): string {
  if (presente(valor.raw)) return valor.raw;

  const partes = valor["date-parts"]?.[0];
  if (!partes || !Number.isFinite(partes[0])) return "";

  const [ano, mes, dia] = partes;
  const nomeDoMes = mes && mes >= 1 && mes <= 12 ? MESES_PT[mes - 1] : undefined;

  if (!nomeDoMes) return String(ano);
  return dia ? `${dia} ${nomeDoMes} ${ano}` : `${nomeDoMes} ${ano}`;
}

// --- Descrição física (§8.7) -------------------------------------------------

// §8.7.2.1: número total seguido da abreviatura `p.` ou `f.`.
function extensao(valor: Extensao): string {
  return `${valor.quantidade} ${valor.unidade === "folha" ? "f." : "p."}`;
}

// §8.7.2.4: páginas inicial e final precedidas de `p.` ("p. 31-40").
function paginas(valor: string | undefined): TrechoReferencia[] | undefined {
  return presente(valor) ? [texto(paginasEmTexto(valor))] : undefined;
}

// Quem digitou "p. 31-40" no campo não ganha um segundo "p.". O campo pede só
// o intervalo, mas é caixa de texto livre e a norma reproduz a paginação como
// a fonte a traz — inclusive em romanos.
function paginasEmTexto(valor: string): string {
  return /^[pf]\.\s/i.test(valor.trim()) ? valor.trim() : `p. ${valor.trim()}`;
}

function volume(valor: string | undefined): TrechoReferencia[] | undefined {
  return presente(valor) ? [texto(`v. ${valor}`)] : undefined;
}

// --- Disponibilidade (§6.6, §8.13) -------------------------------------------

// §6.6: endereço precedido de "Disponível em:" e data de acesso precedida de
// "Acesso em:", para QUALQUER documento consultado online — não só para site.
// §8.13: são os últimos elementos da referência.
function disponibilidade(
  url: string | undefined,
  acesso: CSLDate | undefined,
): TrechoReferencia[][] {
  const partes: TrechoReferencia[][] = [];
  if (presente(url)) partes.push([texto(`Disponível em: ${url}`)]);

  const quando = acesso ? data(acesso) : "";
  if (presente(quando)) partes.push([texto(`Acesso em: ${quando}`)]);

  return partes;
}

// --- Evento (§8.1.3) ---------------------------------------------------------

// §8.1.3: número de ocorrência em arábico seguido de ponto ("10."). Quem já
// digitou o ponto não ganha o segundo.
function numeroDoEvento(valor: string): string {
  const limpo = valor.trim();
  return limpo.endsWith(".") ? limpo : `${limpo}.`;
}

// --- Cozinha -----------------------------------------------------------------

function texto(valor: string): TrechoReferencia {
  return { texto: valor };
}

function presente(valor: string | undefined | null): valor is string {
  return typeof valor === "string" && valor.trim() !== "";
}

// Parte opcional: `[]` some na desestruturação, `[parte]` entra.
function talvez(parte: TrechoReferencia[] | undefined): TrechoReferencia[][] {
  return parte ? [parte] : [];
}

function prefixar(prefixo: string, trechos: TrechoReferencia[]): TrechoReferencia[] {
  return prefixo === "" ? trechos : [texto(prefixo), ...trechos];
}

function maiusculas(valor: string): string {
  return valor.toLocaleUpperCase("pt-BR");
}

// Junta os elementos da referência e fecha com ponto.
//
// **A regra de não duplicar ponto vale o arquivo inteiro.** Vários elementos
// já terminam em ponto por abreviação — "2. ed.", "82 f.", "(org.)", "12." —
// e o separador de elementos também é ponto. Somar os dois daria "2. ed.. ",
// que é o tipo de defeito que ninguém vê numa referência e todo mundo vê em
// vinte. Resolvido num lugar só, como manda o §6.4.
//
// **O separador entra como trecho próprio, nunca somado ao trecho anterior.**
// Quando o elemento termina no título — o capítulo é assim, o título do livro
// é o penúltimo elemento — somar o ". " ao trecho do título poria o ponto e o
// espaço DENTRO do destaque da §6.7. Em negrito, num `.docx`, isso é um ponto
// gordo visível depois do título.
function juntarPartes(partes: TrechoReferencia[][]): TrechoReferencia[] {
  const usaveis = partes.filter((parte) => parte.some((trecho) => presente(trecho.texto)));
  const saida: TrechoReferencia[] = [];

  usaveis.forEach((parte, indice) => {
    if (indice > 0) {
      const anterior = saida[saida.length - 1];
      saida.push(texto(anterior.texto.endsWith(".") ? " " : ". "));
    }
    // Cópia: os trechos vêm dos montadores, e `fundirVizinhos()` escreve no
    // que recebe. Sem copiar, escreveria no objeto de quem montou.
    parte.forEach((trecho) => saida.push({ ...trecho }));
  });

  const ultimo = saida[saida.length - 1];
  if (ultimo && !ultimo.texto.endsWith(".")) saida.push(texto("."));

  return fundirVizinhos(saida);
}

// Separador e elemento viram um trecho só quando têm o mesmo papel. É cosmético
// para quem lê o texto corrido e não é para quem exporta: cada trecho vira um
// `TextRun` no `.docx`, e sem isto uma referência simples sairia partida em uma
// dúzia deles.
function fundirVizinhos(trechos: readonly TrechoReferencia[]): TrechoReferencia[] {
  return trechos.reduce<TrechoReferencia[]>((juntos, trecho) => {
    const anterior = juntos[juntos.length - 1];
    if (anterior && anterior.papel === trecho.papel) anterior.texto += trecho.texto;
    else juntos.push({ ...trecho });
    return juntos;
  }, []);
}
