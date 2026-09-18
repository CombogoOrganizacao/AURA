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
// **A NBR 6023:2018 não foi lida integralmente** (docs/auditoria-abnt.md, nota
// de escopo): a auditoria do 3.1.1 se apoiou em fontes secundárias para o
// formato de referência. Isto pesa no 4.3, que decide pontuação e ordem; aqui
// pesa menos — o risco de um campo a mais é ele ficar sem uso, e o de um campo
// a menos é perder dado que a pessoa digitou. Na dúvida, o campo existe.

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
  // Juntar é irreversível; separar não custa nada. Se o destaque só no título
  // não se confirmar quando a 6023 for lida na íntegra (pendência 1 de
  // docs/auditoria-abnt.md), o formatador junta os dois — e o dado continua
  // inteiro.
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
  // "2. ed." — guardado como número, formatado pelo 4.3. Primeira edição não
  // se declara na 6023, e é por isso que o campo é opcional em vez de ter
  // `1` como padrão: ausente significa "não declarada", não "é a primeira".
  edition?: number;
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
  // Organizador/coordenador do livro — a 6023 pede a indicação do tipo de
  // responsabilidade ("(org.)", "(coord.)") junto do nome.
  editor?: CSLName[];
  edition?: number;
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

export interface ReferenciaTese extends ReferenciaBase {
  type: "thesis";
  // "Dissertação (Mestrado em Ciência da Computação)" — a 6023 pede o tipo do
  // trabalho e a área. Campo CSL padrão para isto, e obrigatório: é ele que
  // distingue uma tese de doutorado de uma monografia de especialização, e
  // sem ele a referência sai ambígua.
  genre: string;
  // Instituição onde foi defendida.
  publisher?: string;
  "publisher-place"?: string;
  // Número de folhas ("120 f."), que a 6023 pede para tese e dissertação e
  // não pede para livro.
  "number-of-pages"?: string;
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
