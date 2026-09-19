import { type CSLType, type Referencia } from "./types";

// Quais campos cada tipo de referência tem, em que ordem e com que rótulo —
// passo 4.2. **Este arquivo é a única fonte disso.** O formulário
// (`src/components/referencias/FormReferencia.tsx`) percorre a lista e desenha;
// não existe uma segunda sequência escrita à mão lá dentro, pelo mesmo
// princípio de `document/order.ts` ser a única fonte da ordem dos elementos.
//
// **Mora em `core/`, e não no componente, por três motivos.** O primeiro é a
// regra da casa: campo por tipo é conhecimento de norma, não de interface. O
// segundo é que o painel (4.5) e a prévia da importação (4.7) vão precisar da
// mesma lista. O terceiro é o critério de aceite deste passo — "trocar o tipo
// troca os campos e preserva os compartilhados" — que assim vira Vitest sobre
// função pura, em vez de depender de renderizar React.
//
// **A ordem é a dos modelos da NBR 6023:2025**, não a que fica bonita na tela:
// o formulário pergunta na ordem em que a referência sai impressa, para quem
// está copiando de uma folha de rosto poder ir de cima para baixo. O mapa
// tipo → item da norma está em `types.ts` e em docs/auditoria-abnt.md.

// O que o formulário desenha. Não é o tipo do DADO (isso está em `types.ts`) —
// é a forma de perguntar por ele.
export type TipoCampo =
  | "texto"
  | "url"
  // Lista de `CSLName`: pessoa (sobrenome + prenome, invertida pela norma) ou
  // entidade (`literal`, que a §8.1.2 manda NÃO inverter).
  | "nomes"
  // `CSLDate`: ano/mês/dia, ou a data incerta da §8.6.1.3 ("[ca. 1960]").
  | "data"
  // Os três compostos fora do vocabulário CSL, criados no 4.1 justamente para
  // não guardar string pronta. Cada um vira um grupinho de controles.
  | "edicao"
  | "responsabilidade"
  | "extensao";

// Todas as chaves de todos os membros da união, menos as duas que o formulário
// nunca pergunta: `id` é gerado e `type` é o seletor no topo.
//
// **Derivado, não escrito à mão**: acrescentar um campo a qualquer tipo em
// `types.ts` amplia esta união sozinho, e o `satisfies` do catálogo abaixo
// passa a exigir a entrada nova. Um campo sem rótulo vira erro de compilação,
// não uma caixa que ninguém desenhou.
type ChavesDe<T> = T extends unknown ? keyof T : never;
export type NomeCampo = Exclude<ChavesDe<Referencia>, "id" | "type">;

export interface CampoReferencia {
  nome: NomeCampo;
  rotulo: string;
  tipo: TipoCampo;
  // Obrigatório para a referência ficar completa segundo a norma. Não é
  // validação de formulário (isso é da Fase 5, que confere conformidade): é o
  // asterisco que diz à pessoa o que a banca vai cobrar.
  obrigatorio?: boolean;
  dica?: string;
  exemplo?: string;
}

// Catálogo: um rótulo por campo, num lugar só. `satisfies` em vez de anotação
// para o `Record` continuar sendo conferido como completo sem perder o tipo
// literal de cada entrada.
const C = {
  author: {
    nome: "author",
    rotulo: "Autoria",
    tipo: "nomes",
    dica: "Sem autoria conhecida? Deixe vazio — a norma entra pelo título (§8.1.4).",
  },
  title: { nome: "title", rotulo: "Título", tipo: "texto", obrigatorio: true },
  subtitle: {
    nome: "subtitle",
    rotulo: "Subtítulo",
    tipo: "texto",
    dica: "Sai depois de dois-pontos e sem o destaque do título (§6.7). Não digite o dois-pontos.",
  },
  issued: { nome: "issued", rotulo: "Data de publicação", tipo: "data", obrigatorio: true },
  URL: {
    nome: "URL",
    rotulo: "Endereço (URL)",
    tipo: "url",
    dica: "Preencha para qualquer documento consultado online, não só para site (§6.6).",
  },
  accessed: {
    nome: "accessed",
    rotulo: "Data de acesso",
    tipo: "data",
    dica: "Obrigatória quando há endereço — vira o “Acesso em:” (§6.6).",
  },
  edicao: {
    nome: "edicao",
    rotulo: "Edição",
    tipo: "edicao",
    dica: "Primeira edição não se declara. O idioma decide a grafia: “2. ed.”, “5th ed.” (§8.3).",
  },
  publisher: { nome: "publisher", rotulo: "Editora", tipo: "texto", exemplo: "Atlas" },
  "publisher-place": {
    nome: "publisher-place",
    rotulo: "Local",
    tipo: "texto",
    exemplo: "São Paulo",
    dica: "Cidade, como consta no documento. Sem local identificável, a norma escreve [S. l.].",
  },
  translator: { nome: "translator", rotulo: "Tradução", tipo: "nomes" },
  volume: { nome: "volume", rotulo: "Volume", tipo: "texto", exemplo: "3" },
  "container-title": { nome: "container-title", rotulo: "Publicação", tipo: "texto" },
  "container-subtitle": {
    nome: "container-subtitle",
    rotulo: "Subtítulo da publicação",
    tipo: "texto",
  },
  "container-author": { nome: "container-author", rotulo: "Autoria da obra toda", tipo: "nomes" },
  responsabilidade: {
    nome: "responsabilidade",
    rotulo: "Organização da obra",
    tipo: "responsabilidade",
    dica: "Vira “(org.)”, “(coord.)” depois do último nome (§8.1.1.4).",
  },
  page: { nome: "page", rotulo: "Páginas", tipo: "texto", exemplo: "45-67" },
  issue: {
    nome: "issue",
    rotulo: "Número ou fascículo",
    tipo: "texto",
    exemplo: "2",
    dica: "Aceita “esp.”, “supl.”, “2A” — a norma reproduz o que está na fonte.",
  },
  tipoTrabalho: {
    nome: "tipoTrabalho",
    rotulo: "Tipo do trabalho",
    tipo: "texto",
    obrigatorio: true,
    exemplo: "Dissertação",
  },
  grau: { nome: "grau", rotulo: "Grau", tipo: "texto", exemplo: "Mestrado" },
  curso: {
    nome: "curso",
    rotulo: "Curso ou área",
    tipo: "texto",
    exemplo: "Ciência da Computação",
  },
  defesa: { nome: "defesa", rotulo: "Data da defesa", tipo: "data" },
  orientador: { nome: "orientador", rotulo: "Orientação", tipo: "nomes" },
  extensao: {
    nome: "extensao",
    rotulo: "Extensão",
    tipo: "extensao",
    dica: "Trabalho acadêmico conta folhas (“82 f.”); livro conta páginas (§8.7.2.1).",
  },
  "event-title": {
    nome: "event-title",
    rotulo: "Nome do evento",
    tipo: "texto",
    obrigatorio: true,
    exemplo: "Congresso Brasileiro de Biblioteconomia",
    dica: "Sai em maiúsculas na referência (§8.1.3) — digite normalmente.",
  },
  "event-number": {
    nome: "event-number",
    rotulo: "Edição do evento",
    tipo: "texto",
    exemplo: "12",
  },
  "event-place": { nome: "event-place", rotulo: "Local do evento", tipo: "texto" },
  "event-date": { nome: "event-date", rotulo: "Data do evento", tipo: "data" },
} satisfies Record<NomeCampo, CampoReferencia>;

// Um mesmo campo muda de nome conforme o documento: `issued` é "ano de
// publicação" num livro e **ano de depósito** numa dissertação (§7.1.2);
// `publisher` é a editora num livro e a **vinculação acadêmica** numa tese.
// Trocar o rótulo não troca o campo — o dado continua no mesmo lugar, que é o
// que permite preservá-lo ao trocar de tipo.
function com(campo: CampoReferencia, ajustes: Partial<CampoReferencia>): CampoReferencia {
  return { ...campo, ...ajustes };
}

// A lista completa e ordenada de cada tipo. `Record` completo: um `CSLType`
// novo sem lista é erro de compilação, não um formulário que abre vazio.
export const CAMPOS_POR_TIPO: Record<CSLType, readonly CampoReferencia[]> = {
  // §7.1.1 — autor, título, subtítulo, edição, local, editora, data.
  book: [
    C.author,
    C.title,
    C.subtitle,
    C.edicao,
    C["publisher-place"],
    C.publisher,
    com(C.issued, { rotulo: "Ano de publicação" }),
    C.translator,
    C.volume,
    C.URL,
    C.accessed,
  ],
  // §7.3 — autor e título da parte, "In:", a monografia inteira, e a
  // paginação da parte ao final.
  chapter: [
    C.author,
    com(C.title, { rotulo: "Título do capítulo" }),
    com(C.subtitle, { rotulo: "Subtítulo do capítulo" }),
    com(C["container-title"], { rotulo: "Título do livro", obrigatorio: true }),
    com(C["container-subtitle"], { rotulo: "Subtítulo do livro" }),
    C.responsabilidade,
    com(C["container-author"], {
      rotulo: "Autoria do livro",
      dica: "Só quando o livro tem autor próprio, diferente do capítulo e sem ser organizador.",
    }),
    C.edicao,
    C["publisher-place"],
    C.publisher,
    com(C.issued, { rotulo: "Ano de publicação" }),
    com(C.page, { rotulo: "Páginas do capítulo" }),
    C.URL,
    C.accessed,
  ],
  // §7.7.5 — autor, título do artigo, título do periódico, local, volume,
  // número, páginas, data.
  "article-journal": [
    C.author,
    com(C.title, { rotulo: "Título do artigo" }),
    com(C.subtitle, { rotulo: "Subtítulo do artigo" }),
    com(C["container-title"], { rotulo: "Título do periódico", obrigatorio: true }),
    C["publisher-place"],
    C.volume,
    C.issue,
    com(C.page, { rotulo: "Páginas do artigo" }),
    com(C.issued, {
      rotulo: "Data do fascículo",
      dica: "Mês entra abreviado no idioma da publicação; “maio” não abrevia (Anexo A).",
    }),
    C.URL,
    C.accessed,
  ],
  // §7.20 mais §6.6 — a norma não tem um tipo "site": é documento em meio
  // eletrônico, e o que o define é o par endereço + acesso.
  webpage: [
    C.author,
    C.title,
    C.subtitle,
    com(C["container-title"], {
      rotulo: "Site ou portal",
      dica: "Quem hospeda a página, quando não é o próprio título.",
    }),
    com(C.issued, { rotulo: "Data de publicação" }),
    com(C.URL, { obrigatorio: true }),
    com(C.accessed, { obrigatorio: true }),
  ],
  // §7.1.2 e §8.12 — a ordem da norma põe o ANO DE DEPÓSITO logo depois do
  // título e a DATA DE DEFESA no fim, e são elementos distintos.
  thesis: [
    C.author,
    C.title,
    C.subtitle,
    com(C.issued, {
      rotulo: "Ano de depósito",
      dica: "O ano da entrega, que vem logo depois do título — não é a data da defesa.",
    }),
    C.tipoTrabalho,
    C.grau,
    C.curso,
    com(C.publisher, {
      rotulo: "Vinculação acadêmica",
      exemplo: "Faculdade de Medicina, Universidade de São Paulo",
    }),
    C["publisher-place"],
    C.defesa,
    C.orientador,
    C.extensao,
    C.URL,
    C.accessed,
  ],
  // §7.8.4.1 — autor, título do trabalho, "In:", evento com número, ano e
  // local, título dos anais, imprenta e páginas.
  "paper-conference": [
    C.author,
    com(C.title, { rotulo: "Título do trabalho" }),
    com(C.subtitle, { rotulo: "Subtítulo do trabalho" }),
    C["event-title"],
    C["event-number"],
    C["event-place"],
    C["event-date"],
    com(C["container-title"], {
      rotulo: "Título da publicação",
      exemplo: "Anais [...]",
    }),
    C["publisher-place"],
    C.publisher,
    com(C.issued, { rotulo: "Ano da publicação" }),
    com(C.page, { rotulo: "Páginas do trabalho" }),
    C.URL,
    C.accessed,
  ],
};

export function camposDe(tipo: CSLType): readonly CampoReferencia[] {
  return CAMPOS_POR_TIPO[tipo];
}

// Os campos que dois tipos têm em comum — é o conjunto que sobrevive a uma
// troca. Existe como função exportada, e não só dentro de `trocarTipo()`,
// porque o formulário avisa antes o que vai perder.
export function camposCompartilhados(origem: CSLType, destino: CSLType): NomeCampo[] {
  const nomesDoDestino = new Set(camposDe(destino).map((campo) => campo.nome));
  return camposDe(origem)
    .map((campo) => campo.nome)
    .filter((nome) => nomesDoDestino.has(nome));
}

// O que cada tipo exige para existir como objeto. Só entram os campos que a
// união marca como obrigatórios em `types.ts` — não é a lista de "preencha
// isto", é o mínimo para o valor ser do tipo.
const ESQUELETO: Record<CSLType, () => Omit<Referencia, "id">> = {
  book: () => ({ type: "book", title: "" }),
  chapter: () => ({ type: "chapter", title: "", "container-title": "" }),
  "article-journal": () => ({ type: "article-journal", title: "", "container-title": "" }),
  webpage: () => ({ type: "webpage", title: "", URL: "" }),
  thesis: () => ({ type: "thesis", title: "", tipoTrabalho: "" }),
  "paper-conference": () => ({ type: "paper-conference", title: "", "event-title": "" }),
};

// Se o campo é exigido pelo TIPO (não pela norma). São coisas diferentes: a
// §7.1.1 considera a editora essencial num livro, mas `ReferenciaLivro` aceita
// um livro sem ela — o que a união exige é o mínimo para o valor existir.
// Quem apaga um campo no formulário precisa saber a diferença: campo opcional
// some do objeto, campo exigido pelo tipo fica como string vazia.
export function exigidoPeloTipo(tipo: CSLType, nome: NomeCampo): boolean {
  return nome in ESQUELETO[tipo]();
}

// Referência vazia de um tipo. O `id` vem de fora porque `crypto.randomUUID()`
// é do navegador, e `src/core/` não fala com o navegador (CLAUDE.md).
export function novaReferencia(tipo: CSLType, id: string): Referencia {
  return { ...ESQUELETO[tipo](), id } as Referencia;
}

// **Troca o tipo preservando o que os dois tipos têm em comum** — o critério
// de aceite deste passo, como função pura.
//
// Preservar é o ponto: quem cadastrou um livro e percebeu que era capítulo não
// pode perder autor, título, editora e ano no caminho. O que **não** existe no
// destino cai, e cai de propósito — manter `event-place` escondido dentro de um
// livro seria guardar dado que nenhum formatador vai ler e que vai reaparecer
// se a pessoa voltar atrás, dando a impressão de que nada se perdeu.
//
// A lista do que sobrevive sai de `CAMPOS_POR_TIPO`, não de um segundo mapa
// aqui: é a mesma tabela que o formulário desenha, então o que a tela mostra e
// o que a troca guarda não têm como divergir.
export function trocarTipo(referencia: Referencia, destino: CSLType): Referencia {
  if (referencia.type === destino) return referencia;

  // `as unknown` antes: uma interface sem assinatura de índice não é
  // comparável a `Record<string, unknown>` direto, ainda que suas chaves
  // sejam todas strings. A leitura logo abaixo é restrita a nomes que
  // `camposCompartilhados()` devolveu.
  const origem = referencia as unknown as Record<string, unknown>;
  const preservados: Record<string, unknown> = {};

  for (const nome of camposCompartilhados(referencia.type, destino)) {
    if (origem[nome] !== undefined) preservados[nome] = origem[nome];
  }

  // A asserção está confinada a esta linha, e é o preço de montar um membro de
  // união discriminada a partir de uma tabela em vez de seis `switch`. O que a
  // torna segura: `ESQUELETO` entra primeiro e garante os obrigatórios do
  // destino, `preservados` só contém chaves que `CAMPOS_POR_TIPO[destino]`
  // declara, e `campos.test.ts` percorre as trinta transições possíveis.
  return { ...ESQUELETO[destino](), ...preservados, id: referencia.id } as Referencia;
}
