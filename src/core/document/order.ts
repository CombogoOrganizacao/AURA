// Ordem canônica dos elementos do trabalho (NBR 14724 §4) — passo 3.7.2.
//
// **Este arquivo é a única fonte da ordem.** O exportador não tem uma
// sequência escrita à mão em paralelo: ele percorre `ORDEM_CANONICA` e
// pergunta, elemento a elemento, o que sai. Mudar a ordem aqui muda o
// `.docx`; não existe segundo lugar para esquecer de atualizar. É o mesmo
// princípio de `numerarSecoes()` ser a única fonte do "2.1".
//
// **A lista diz ORDEM, não presença.** Quem decide se um elemento sai é o
// gerador dele — `paragrafosResumo()` devolve `[]` sem resumo,
// `gerarDedicatoria()` devolve `[]` desligada, `gerarApendices()` devolve
// `[]` sem apêndice. Duplicar aqui a pergunta "existe?" criaria duas
// respostas capazes de divergir.
//
// **A NBR 14724 não passou pela auditoria do passo 3.1.1 nesta parte.** O que
// a auditoria cobriu foi QUAIS elementos existem (`elements.preTextual` e
// `elements.postTextual`, ver docs/auditoria-abnt.md), não a sequência entre
// eles. A ordem abaixo é a que o §4.1 enumera e que toda fonte secundária
// repete — e por isso, como em `sumario.ts` e `legenda.ts`, **nenhum item da
// norma é citado aqui por número de seção**.
//
// Fora da v1, registrados para ninguém supor que foram esquecidos: errata,
// folha de aprovação, lista de símbolos, glossário e índice. Os cinco são
// elementos reais da norma sem tela que os alimente (o mesmo motivo pelo qual
// a auditoria classificou a lista do legado como "incompleta, não errada").

export type ElementoDocumento =
  | "capa"
  | "folhaDeRosto"
  | "dedicatoria"
  | "agradecimentos"
  | "epigrafe"
  | "resumo"
  | "abstract"
  | "listaDeFiguras"
  | "listaDeTabelas"
  | "listaDeAbreviaturas"
  | "sumario"
  | "corpo"
  | "referencias"
  | "apendices"
  | "anexos";

export const ORDEM_CANONICA: readonly ElementoDocumento[] = [
  "capa",
  "folhaDeRosto",
  "dedicatoria",
  "agradecimentos",
  "epigrafe",
  "resumo",
  "abstract",
  // As três listas, na ordem da norma: ilustrações, tabelas, abreviaturas.
  "listaDeFiguras",
  "listaDeTabelas",
  "listaDeAbreviaturas",
  // Último pré-textual (NBR 6027) — ver `elements/sumario.ts`.
  "sumario",
  "corpo",
  "referencias",
  "apendices",
  "anexos",
];

// As quatro partes do trabalho. Não é classificação decorativa: cada uma tem
// regra PRÓPRIA de paginação, e é ela que decide em qual seção OOXML o
// elemento cai (`export/docx/sections.ts`).
//
// - `capa`: fora da contagem de páginas;
// - `preTextual`: contado a partir de 1, número NÃO exibido — a contagem
//   começa na folha de rosto, não na capa;
// - `textual`: contagem contínua, número exibido (NBR 14724 §5.3);
// - `posTextual`: segue o textual, mesma paginação.
export type ParteDocumento = "capa" | "preTextual" | "textual" | "posTextual";

const PARTES: Record<ElementoDocumento, ParteDocumento> = {
  capa: "capa",
  folhaDeRosto: "preTextual",
  dedicatoria: "preTextual",
  agradecimentos: "preTextual",
  epigrafe: "preTextual",
  resumo: "preTextual",
  abstract: "preTextual",
  listaDeFiguras: "preTextual",
  listaDeTabelas: "preTextual",
  listaDeAbreviaturas: "preTextual",
  sumario: "preTextual",
  corpo: "textual",
  referencias: "posTextual",
  apendices: "posTextual",
  anexos: "posTextual",
};

export function parteDe(elemento: ElementoDocumento): ParteDocumento {
  return PARTES[elemento];
}

// Os elementos de uma parte, na ordem canônica. É por aqui que o exportador
// monta cada seção OOXML sem reescrever a sequência.
export function elementosDaParte(parte: ParteDocumento): ElementoDocumento[] {
  return ORDEM_CANONICA.filter((elemento) => parteDe(elemento) === parte);
}
