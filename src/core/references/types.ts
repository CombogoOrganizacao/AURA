// Referências em CSL-JSON — passo 4.1. Fonte de verdade do que uma referência
// É; quem transforma isso em "SILVA, Maria. **Título**: subtítulo. 2. ed. São
// Paulo: Editora, 2023." é o formatador da NBR 6023 (passo 4.3), na hora de
// exibir ou exportar.
//
// **Campos separados, nunca texto já formatado** (CLAUDE.md, "Formato e
// dados"). O legado guardava a referência como string pronta, e isso destrói
// a informação de forma irreversível: de "SILVA, Maria. Título. São Paulo:
// Editora, 2023." não se extrai de volta, com segurança, o que é sobrenome, o
// que é editora e o que é local — muito menos se reformata para outra norma.
// Guardado em campos, trocar de norma é trocar de formatador.
//
// **União discriminada por `type`, não uma interface só com tudo opcional.**
// É o que faz o `typecheck` recusar `"event-place"` num livro ou `genre` num
// artigo de periódico — o critério de aceite deste passo. Uma interface larga
// aceitaria qualquer combinação e empurraria a checagem para tempo de
// execução, ou para lugar nenhum.
//
// **Nomes de campo em CSL-JSON, não traduzidos** (`container-title`,
// `publisher-place`): é vocabulário de um padrão externo, como `href` em HTML.
// Traduzi-los faria o importador de `.bib` (4.6) e um futuro exportador CSL
// terem que manter um dicionário de ida e volta. Os identificadores DO AURA
// seguem em inglês e os comentários em pt-BR, como no resto do projeto.
//
// **A NBR 6023:2025 (3ª edição) foi lida na íntegra** — ver
// docs/auditoria-abnt.md, seção "Auditoria da NBR 6023:2025". Ela cancela e
// substitui a 6023:2018, em que a auditoria do 3.1.1 se apoiava por fonte
// secundária. Cada campo abaixo tem item de norma atrás dele, e os que não
// têm estão marcados.
//
// O mapa dos seis tipos para os modelos da norma (ela não tem um tipo "site"):
// `book` = §7.1.1, `chapter` = §7.3, `article-journal` = §7.7.5,
// `thesis` = §7.1.2 e §8.12, `paper-conference` = §7.8.4.1,
// `webpage` = §7.20 mais §6.6.

// --- Vocabulário CSL ---------------------------------------------------------

export interface CSLName {
  family?: string;
  given?: string;
  // Nome que não se divide em sobrenome/nome próprio — uma instituição como
  // autora ("ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS"), que a 6023 trata
  // como autoria corporativa. Separado de `family` de propósito: a 6023 manda
  // inverter o nome pessoal ("SILVA, Maria") e **não** inverter o corporativo,
  // e sem a distinção o formatador teria que adivinhar pela presença de
  // vírgula ou por heurística de maiúsculas.
  literal?: string;
}

export interface CSLDate {
  // `[ano, mês?, dia?]`, como o CSL-JSON define. Ano isolado é o caso normal
  // de uma referência; mês entra em periódico ("jan./mar. 2023") e dia em
  // notícia e material online.
  "date-parts"?: Array<[number, number?, number?]>;
  // Data que não cabe em números — "[entre 1990 e 1995]", "no prelo". A 6023
  // prevê data provável/aproximada, e forçá-la em `date-parts` inventaria
  // precisão que a fonte não tem.
  raw?: string;
}

// Os seis tipos da v1 (critério de aceite do passo). Nomes CSL, não
// traduzidos, pelo mesmo motivo dos campos. Ampliar só quando a NBR 6023
// exigir um tipo que nenhum destes cobre — o legado listava mais tipos do que
// tinha tela para preencher.
export type CSLType =
  | "book"
  | "chapter"
  | "article-journal"
  | "webpage"
  | "thesis"
  | "paper-conference";

// --- Extensões fora do vocabulário CSL --------------------------------------
// Os três tipos abaixo não existem no CSL 1.0.2, e existem aqui pelo mesmo
// motivo de `subtitle`: o CSL guardaria cada um como uma string já pronta
// ("2. ed.", "Dissertação (Mestrado em X)"), e string pronta é exatamente o
// que a Fase 4 existe para não fazer. Todos foram escritos DEPOIS da leitura
// da NBR 6023:2025 na íntegra — ver docs/auditoria-abnt.md, seção "Auditoria
// da NBR 6023:2025".

// Edição (NBR 6023:2025 §8.3). **Não é um número.** A norma manda transcrever
// "as abreviaturas do numeral ordinal e da palavra edição, AMBAS NO IDIOMA DO
// DOCUMENTO" — "2. ed." num livro em português, "5th ed." num em inglês. E o
// §8.3.1 admite emendas e acréscimos ("3. ed. rev. e aum."). Com um `number`,
// o formatador teria que adivinhar o idioma e perderia os acréscimos.
export interface Edicao {
  // Ordinal da edição. Primeira edição não se declara na 6023 — por isso o
  // campo `edicao` inteiro é opcional em vez de nascer com `numero: 1`:
  // ausente significa "não declarada", não "é a primeira".
  numero: number;
  // "rev. e aum.", "rev. atual." — transcrito como consta no documento
  // (§8.3.1), não montado por nós a partir de caixinhas.
  acrescimos?: string;
  // Idioma DO DOCUMENTO referenciado, que decide a grafia do ordinal e da
  // palavra "edição" (§8.3) — não o idioma do trabalho em elaboração. Código
  // ISO 639-1 ("pt", "en", "es"). Ausente: o formatador assume o do trabalho.
  idioma?: string;
}

// Tipo de participação de quem responde pelo conjunto da obra (§8.1.1.4). A
// norma manda indicar a abreviação "em letras minúsculas e no singular, do
// tipo de participação... entre parênteses" — `(org.)`, `(coord.)`. Guardar só
// os nomes descartaria QUAL era o papel, e o formatador não teria o que
// escrever entre os parênteses.
//
// Lista fechada nos quatro que a norma nomeia. Ela diz "entre outros", então a
// lista dela é aberta; a do AURA é fechada de propósito, para o formulário
// (4.2) oferecer opções em vez de um campo livre onde cada pessoa inventa uma
// abreviação. Cresce quando aparecer um caso real que nenhum dos quatro cobre.
export type TipoParticipacao = "organizador" | "compilador" | "editor" | "coordenador";

export interface Responsabilidade {
  nomes: CSLName[];
  tipo: TipoParticipacao;
}

// Extensão em unidades físicas (§8.7.2.1): "indica-se o número total de
// páginas ou folhas, seguido da abreviatura p. ou f.". A unidade é dado, não
// enfeite — trabalho acadêmico conta FOLHAS ("82 f."), livro conta páginas
// ("204 p."), e guardar a string "82 f." embutiria a abreviatura no dado.
export interface Extensao {
  quantidade: number;
  unidade: "pagina" | "folha";
}

// --- Campos comuns -----------------------------------------------------------

interface ReferenciaBase {
  // Chave estável: é por ela que a marca de citação no editor aponta para a
  // referência (`refId`, passo 4.8) — nunca pelo texto formatado, que muda.
  id: string;

  // Opcional em todos os tipos: a 6023 admite entrada pelo título quando não
  // há autoria conhecida. Ausente não é erro de dado, é um caso previsto.
  author?: CSLName[];

  title: string;

  // **Extensão fora do vocabulário CSL, e deliberada.** O CSL 1.0.2 não tem
  // `subtitle`: a convenção dele é guardar "Título: subtítulo" dentro de
  // `title`. Aqui os dois ficam separados porque a 6023 os trata de forma
  // diferente — o destaque tipográfico (negrito/itálico) recai sobre o
  // título, e o subtítulo vem sem destaque, depois dos dois-pontos. Com os
  // dois na mesma string, o formatador teria que procurar um dois-pontos e
  // torcer para não ser o de um título que já contém um.
  //
  // **Confirmado na fonte primária** (§6.7): "o recurso tipográfico (negrito,
  // itálico ou sublinhado) utilizado para destacar o ELEMENTO TÍTULO deve ser
  // uniforme em todas as referências" — e em todos os exemplos da norma o
  // destaque cobre o título e para no dois-pontos ("**Globalização**: as
  // conseqüências humanas"). §3.26 e §3.28 os definem como termos distintos.
  subtitle?: string;

  issued?: CSLDate;

  // "Disponível em: ... Acesso em: ..." — na base, e não só em `webpage`,
  // porque a 6023 pede os dois para QUALQUER documento consultado online: o
  // livro em PDF, o artigo no portal do periódico, a tese no repositório.
  // Prendê-los ao tipo "site" obrigaria a pessoa a mentir sobre o tipo para
  // conseguir registrar o endereço.
  URL?: string;
  accessed?: CSLDate;
}

// --- Um tipo por forma de documento ------------------------------------------

export interface ReferenciaLivro extends ReferenciaBase {
  type: "book";
  // §7.1.1 monografia no todo: autor, título, subtítulo, edição, local,
  // editora e data de publicação.
  edicao?: Edicao;
  publisher?: string;
  "publisher-place"?: string;
  translator?: CSLName[];
  volume?: string;
}

export interface ReferenciaCapitulo extends ReferenciaBase {
  type: "chapter";
  // Título do livro que contém o capítulo — o que sai depois do "In:".
  "container-title": string;
  "container-subtitle"?: string;
  // Autor do LIVRO, quando é outro que o do capítulo e não é organizador.
  "container-author"?: CSLName[];
  // Quem responde pelo conjunto do livro, com o papel junto (§8.1.1.4) — é o
  // que vira "(org.)" ou "(coord.)" depois do último nome.
  responsabilidade?: Responsabilidade;
  edicao?: Edicao;
  publisher?: string;
  "publisher-place"?: string;
  // "p. 45-67" — intervalo como a fonte o traz, não dois números: a 6023
  // reproduz a paginação do documento, e há capítulo com página em romano.
  page?: string;
}

export interface ReferenciaArtigo extends ReferenciaBase {
  type: "article-journal";
  // Título do periódico.
  "container-title": string;
  "publisher-place"?: string;
  volume?: string;
  // Fascículo/número. String, e não número, porque existe "2A", "esp." e
  // "supl.".
  issue?: string;
  page?: string;
}

export interface ReferenciaSite extends ReferenciaBase {
  type: "webpage";
  // Nome do site ou portal que hospeda a página, quando não é o próprio
  // título — a 6023 pede a indicação do local de publicação online.
  "container-title"?: string;
  // `URL` é obrigatório aqui, ao contrário da base: uma página web sem
  // endereço não é localizável, e a 6023 exige o "Disponível em:".
  URL: string;
}

// §7.1.2 (e §8.12) enumera os elementos essenciais do trabalho acadêmico um a
// um: "autor, título, subtítulo (se houver), ANO DE DEPÓSITO, TIPO DO TRABALHO
// (tese, dissertação, trabalho de conclusão de curso e outros), GRAU
// (especialização, doutorado, entre outros) E CURSO entre parênteses,
// VINCULAÇÃO ACADÊMICA, local e DATA DE APRESENTAÇÃO OU DEFESA".
//
// São sete campos, não um. A primeira versão deste tipo (passo 4.1, escrito
// antes de a norma ser lida) tinha um `genre: string` com
// "Dissertação (Mestrado em Ciência da Computação)" dentro — uma string já
// formatada, exatamente o que esta fase existe para impedir. Corrigido depois
// da leitura; ver docs/auditoria-abnt.md, "Correções exigidas no passo 4.1".
export interface ReferenciaTese extends ReferenciaBase {
  type: "thesis";
  // "Tese", "Dissertação", "Trabalho de Conclusão de Curso". String livre, e
  // não união: a norma diz "e outros", e há instituição que usa "Monografia"
  // ou "Relatório de estágio". Obrigatório porque é ele que distingue um
  // doutorado de uma especialização — sem ele a referência sai ambígua.
  tipoTrabalho: string;
  // "Doutorado", "Mestrado", "Bacharelado", "Especialização" — o que abre os
  // parênteses.
  grau?: string;
  // "Cardiologia", "Engenharia Industrial Mecânica" — o que fecha os
  // parênteses, depois de "em". Separado de `grau` porque a norma os enumera
  // separados, e porque a lista de graus é curta e a de cursos não é.
  curso?: string;
  // Vinculação acadêmica: "Faculdade de Medicina, Universidade de São Paulo".
  // Reaproveita `publisher`, que é o campo CSL de instituição responsável.
  publisher?: string;
  "publisher-place"?: string;
  // **`issued` (na base) é o ANO DE DEPÓSITO**, que vem logo depois do título.
  // `defesa` é a data de apresentação, que fecha a referência. No exemplo da
  // própria norma os dois são 2009, mas são elementos distintos e podem
  // divergir — juntá-los perderia a distinção sem ganhar nada.
  defesa?: CSLDate;
  // §8.1.1.6: orientador é "outro tipo de responsabilidade", acrescentado
  // depois do título. Elemento complementar, não essencial.
  orientador?: CSLName[];
  // "82 f." — folhas, não páginas (§8.7.2.1). Complementar.
  extensao?: Extensao;
}

export interface ReferenciaEvento extends ReferenciaBase {
  type: "paper-conference";
  // Nome do evento — "CONGRESSO BRASILEIRO DE X". Separado de
  // `container-title` (que é o título da publicação: "Anais [...]") porque a
  // 6023 pede os dois, e em ordens diferentes.
  "event-title": string;
  // Número da edição do evento ("12.", em "12. CONGRESSO..."), local e ano em
  // que ocorreu — que podem não ser os da publicação dos anais.
  "event-number"?: string;
  "event-place"?: string;
  "event-date"?: CSLDate;
  "container-title"?: string;
  publisher?: string;
  "publisher-place"?: string;
  page?: string;
}

// A referência, como o resto do sistema a vê. A união é o que dá ao
// `typecheck` o poder de recusar campo que não pertence ao tipo — estreitar
// por `referencia.type` devolve exatamente os campos daquela forma de
// documento.
export type Referencia =
  | ReferenciaLivro
  | ReferenciaCapitulo
  | ReferenciaArtigo
  | ReferenciaSite
  | ReferenciaTese
  | ReferenciaEvento;

// Rótulos em pt-BR dos seis tipos, num lugar só: o formulário (4.2), o painel
// (4.5) e a prévia da importação (4.7) mostram a mesma palavra. `Record`
// completo — tipo novo sem rótulo é erro de compilação, não uma caixa de
// seleção com um item em branco.
export const ROTULO_TIPO: Record<CSLType, string> = {
  book: "Livro",
  chapter: "Capítulo de livro",
  "article-journal": "Artigo de periódico",
  webpage: "Site",
  thesis: "Dissertação ou tese",
  "paper-conference": "Trabalho em evento",
};
