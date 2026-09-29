import type {
  CSLDate,
  CSLName,
  Edicao,
  Referencia,
  ReferenciaTese,
  TipoParticipacao,
} from "../../references/types";

// `referencias.bib` do projeto LaTeX (passo 6.2.3). **Vai como dado, não como
// formatação**: o `main.tex` não o lê, a lista de referências sai pronta do
// AURA (docs/latex-abntex.md §1.2). Serve para a reimportação (6.2.4) e para
// quem quiser levar as referências para outro programa.
//
// É o inverso de `converterEntrada()` (`references/import/bibtexToCsl.ts`):
// cada campo sai com o nome e a forma que o importador lê, e um `.bib`
// importado, exportado e importado de novo dá as mesmas referências. Campo do
// AURA que o importador não lê (acréscimos da edição, autor do livro no
// capítulo, curso e data de defesa da tese, número do evento, extensão em
// páginas) não sai: na reimportação vale a versão do AURA (§1.5).
//
// A chave de cada entrada é o `id` da referência, o mesmo `refId` do
// `\auracite`: é por ela que a reimportação liga citação e referência.

// Os caracteres especiais do BibTeX, com o escape que `decodificarLatex()`
// desfaz. UTF-8 fica como está: o importador o lê.
const ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

export function escaparBib(texto: string): string {
  return texto.replace(/[\\{}&%$#_~^]/g, (c) => ESCAPES[c]);
}

// Endereço sai cru: no biblatex, `url` é verbatim, e `\&` ficaria com a barra
// no Zotero ou no JabRef. O leitor do AURA aceita `%`, `&` e `#` dentro de
// chaves. Só chave vira `%7B`/`%7D`, a forma codificada que o navegador usa,
// para não desbalancear o valor.
function escaparUrl(url: string): string {
  return url.replace(/\{/g, "%7B").replace(/\}/g, "%7D");
}

// Título com dois-pontos e sem subtítulo vai entre chaves: o importador
// separa "Título: subtítulo" no primeiro dois-pontos em nível zero.
function protegerDoisPontos(texto: string): string {
  const escapado = escaparBib(texto);
  return texto.includes(":") ? `{${escapado}}` : escapado;
}

// "Sobrenome, Prenome". Sobrenome com espaço vai entre chaves, para o
// importador não tirar dele uma partícula ("de Souza"). Entidade inteira
// entre chaves é o que o importador lê como `literal`.
function nome(pessoa: CSLName): string {
  if (pessoa.literal) return `{${escaparBib(pessoa.literal)}}`;
  const family = escaparBib(pessoa.family ?? "");
  const sobrenome = /[\s,]/.test(family) ? `{${family}}` : family;
  return pessoa.given ? `${sobrenome}, ${escaparBib(pessoa.given)}` : sobrenome;
}

function nomes(pessoas: readonly CSLName[] | undefined): string | undefined {
  return pessoas && pessoas.length > 0 ? pessoas.map(nome).join(" and ") : undefined;
}

// ISO, que `dataIso()` lê; data sem a precisão de um número vai como veio.
function dataIso(data: CSLDate | undefined): string | undefined {
  if (!data) return undefined;
  const partes = data["date-parts"]?.[0];
  if (!partes) return data.raw ? escaparBib(data.raw) : undefined;
  const [ano, mes, dia] = partes;
  const doisDigitos = (n: number) => String(n).padStart(2, "0");
  return [String(ano), mes && doisDigitos(mes), mes && dia && doisDigitos(dia)]
    .filter(Boolean)
    .join("-");
}

// Só o ano vai em `year`, como num `.bib` comum; com mês ou dia, em `date`.
function camposDeData(data: CSLDate | undefined): [string, string | undefined][] {
  if (!data) return [];
  const partes = data["date-parts"]?.[0];
  if (partes && partes.length === 1) return [["year", String(partes[0])]];
  if (!partes && data.raw) return [["year", escaparBib(data.raw)]];
  return [["date", dataIso(data)]];
}

// "45-67" → "45--67", a forma do BibTeX; o importador volta ao hífen.
function paginas(page: string | undefined): string | undefined {
  return page?.replace(/-/g, "--");
}

function edicao(valor: Edicao | undefined): [string, string | undefined][] {
  if (!valor) return [];
  return [
    ["edition", String(valor.numero)],
    ["langid", valor.idioma],
  ];
}

const PAPEL_BIBLATEX: Record<TipoParticipacao, string> = {
  editor: "editor",
  organizador: "organizer",
  compilador: "compiler",
  coordenador: "coordinator",
};

// O importador deduz o grau pelo tipo da entrada: `@phdthesis` é doutorado,
// `@mastersthesis` é mestrado. Outro grau ("Especialização") não tem entrada
// própria e não volta pelo `.bib`.
function tipoDaTese(referencia: ReferenciaTese): string {
  if (referencia.grau === "Doutorado") return "phdthesis";
  if (referencia.grau === "Mestrado") return "mastersthesis";
  return "thesis";
}

type Campos = [string, string | undefined][];

function tipoECampos(referencia: Referencia): [string, Campos] {
  switch (referencia.type) {
    case "book":
      return [
        "book",
        [
          ...edicao(referencia.edicao),
          ["publisher", referencia.publisher],
          ["address", referencia["publisher-place"]],
          ["translator", nomes(referencia.translator)],
          ["volume", referencia.volume],
        ],
      ];
    case "article-journal":
      return [
        "article",
        [
          ["journal", referencia["container-title"]],
          ["address", referencia["publisher-place"]],
          ["volume", referencia.volume],
          ["number", referencia.issue],
          ["pages", paginas(referencia.page)],
        ],
      ];
    case "chapter": {
      const livro = referencia["container-subtitle"]
        ? `${escaparBib(referencia["container-title"])}: ${escaparBib(referencia["container-subtitle"])}`
        : protegerDoisPontos(referencia["container-title"]);
      return [
        "incollection",
        [
          ["booktitle", livro],
          ["editor", nomes(referencia.responsabilidade?.nomes)],
          [
            "editortype",
            referencia.responsabilidade && PAPEL_BIBLATEX[referencia.responsabilidade.tipo],
          ],
          ...edicao(referencia.edicao),
          ["publisher", referencia.publisher],
          ["address", referencia["publisher-place"]],
          ["pages", paginas(referencia.page)],
        ],
      ];
    }
    case "paper-conference":
      return [
        "inproceedings",
        [
          ["eventtitle", referencia["event-title"]],
          ["booktitle", referencia["container-title"] && escaparBib(referencia["container-title"])],
          ["venue", referencia["event-place"]],
          ["eventdate", dataIso(referencia["event-date"])],
          ["publisher", referencia.publisher],
          ["address", referencia["publisher-place"]],
          ["pages", paginas(referencia.page)],
        ],
      ];
    case "thesis":
      return [
        tipoDaTese(referencia),
        [
          ["type", referencia.tipoTrabalho],
          ["school", referencia.publisher],
          ["address", referencia["publisher-place"]],
          ["advisor", nomes(referencia.orientador)],
          [
            "pagetotal",
            referencia.extensao?.unidade === "folha"
              ? String(referencia.extensao.quantidade)
              : undefined,
          ],
        ],
      ];
    case "webpage":
      return ["online", [["organization", referencia["container-title"]]]];
  }
}

// Campos que já saem escapados (nomes, datas, páginas, livro) não passam de
// novo por `escaparBib()`.
const JA_ESCAPADOS = new Set([
  "author",
  "translator",
  "editor",
  "advisor",
  "date",
  "year",
  "eventdate",
  "urldate",
  "booktitle",
  "title",
  "subtitle",
]);

function entrada(referencia: Referencia): string {
  const [tipo, especificos] = tipoECampos(referencia);
  const campos: Campos = [
    ["author", nomes(referencia.author)],
    [
      "title",
      referencia.subtitle ? escaparBib(referencia.title) : protegerDoisPontos(referencia.title),
    ],
    ["subtitle", referencia.subtitle && escaparBib(referencia.subtitle)],
    ...camposDeData(referencia.issued),
    ...especificos,
    ["urldate", dataIso(referencia.accessed)],
  ];

  const linhas = campos
    .filter((campo): campo is [string, string] => Boolean(campo[1]))
    .map(([nomeCampo, valor]) => {
      const pronto = JA_ESCAPADOS.has(nomeCampo) ? valor : escaparBib(valor);
      return `  ${nomeCampo} = {${pronto}}`;
    });
  if (referencia.URL) linhas.push(`  url = {${escaparUrl(referencia.URL)}}`);

  return `@${tipo}{${referencia.id},\n${linhas.join(",\n")}\n}`;
}

export function gerarBib(referencias: readonly Referencia[]): string {
  const cabecalho = [
    "% Referências do trabalho, exportadas pelo AURA.",
    "% O main.tex não usa este arquivo: a lista de referências sai formatada",
    "% pelo AURA. A chave de cada entrada é a da citação (\\auracite).",
  ].join("\n");
  return [cabecalho, ...referencias.map(entrada)].join("\n\n") + "\n";
}
