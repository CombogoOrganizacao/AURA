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
// **Auditada contra a fonte primária em 18/09/2026** (NBR 14724:2024, lida na
// íntegra — docs/auditoria-abnt.md). A ordem abaixo bate item a item com o
// Esquema 1 e com os itens §4.1.1 a §4.2.3.5: capa (§4.1.1), folha de rosto
// (§4.2.1.1), folha de aprovação (§4.2.1.3, desde o 4B.3), dedicatória
// (§4.2.1.4), agradecimentos (§4.2.1.5), epígrafe (§4.2.1.6), resumo vernáculo (§4.2.1.7), resumo estrangeiro (§4.2.1.8), as
// três listas (§4.2.1.9 a §4.2.1.11), sumário (§4.2.1.13), corpo (§4.2.2),
// referências (§4.2.3.1), apêndice (§4.2.3.3) e anexo (§4.2.3.4). Este passo
// foi escrito antes da leitura e registrava a ressalva; ela caiu.
//
// Fora da v1, registrados para ninguém supor que foram esquecidos: errata
// (§4.2.1.2), lista de símbolos (§4.2.1.12), glossário (§4.2.3.2) e índice
// (§4.2.3.5). Os quatro são opcionais na norma.
//
// **A folha de aprovação (§4.2.1.3) entrou no passo 4B.3.** É obrigatória, e
// estava fora sob o argumento de que a banca a preenche depois da defesa. O
// próprio §4.2.1.3 separa as duas coisas: só "a data de aprovação e as
// assinaturas... devem ser colocadas após a aprovação". O resto sai antes.

export type ElementoDocumento =
  | "capa"
  | "folhaDeRosto"
  | "folhaDeAprovacao"
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
  // "Deve ser inserida após a folha de rosto" (§4.2.1.3).
  "folhaDeAprovacao",
  "dedicatoria",
  "agradecimentos",
  "epigrafe",
  "resumo",
  "abstract",
  // As três listas, na ordem da norma: ilustrações, tabelas, abreviaturas.
  "listaDeFiguras",
  "listaDeTabelas",
  "listaDeAbreviaturas",
  // Último pré-textual (NBR 6027:2012 §4.1-a, literal) — ver
  // `elements/sumario.ts`.
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
// - `textual`: contagem contínua, número exibido (NBR 14724:2024 §5.3);
// - `posTextual`: segue o textual, mesma paginação — literal no §5.3: "se
//   houver apêndice e anexo, as suas folhas ou páginas devem ser numeradas de
//   maneira contínua, e sua paginação deve dar seguimento à do texto
//   principal".
export type ParteDocumento = "capa" | "preTextual" | "textual" | "posTextual";

const PARTES: Record<ElementoDocumento, ParteDocumento> = {
  capa: "capa",
  folhaDeRosto: "preTextual",
  folhaDeAprovacao: "preTextual",
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
