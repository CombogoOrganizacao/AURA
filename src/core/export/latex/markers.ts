import type { LinhaPreTextual } from "../../document/elements/linhaPreTextual";
import {
  gerarAgradecimentos,
  gerarDedicatoria,
  gerarEpigrafe,
} from "../../document/elements/opcionaisPreTextuais";
import type { Metadados } from "../../document/types";
import { escaparLatex } from "./escape";

// Marcadores de identidade do `.tex` (passo 6.2.2). São o que a reimportação
// (6.2.4) lê para devolver cada parte ao lugar certo; as regras estão em
// docs/latex-abntex.md §1.5. Comentário LaTeX: não muda nada no PDF.

// Versão do formato que a reimportação sabe ler. Sobe quando o que o AURA
// escreve muda de um jeito que um leitor antigo leria errado.
export const VERSAO_FORMATO_TEX = 1;

// Primeira linha do arquivo. Sem ela, a reimportação recusa o arquivo.
export function linhaDoDocumento(id: string): string {
  return `% AURA-DOCUMENTO: ${id} v${VERSAO_FORMATO_TEX}`;
}

// Antes do comando de título. A seção guarda a identidade por este `id`,
// não pela posição nem pelo título, que o aluno pode mudar no Overleaf.
export function marcadorDeSecao(id: string): string {
  return `% AURA-SECTION: ${id}`;
}

export function marcadorDeApendice(id: string): string {
  return `% AURA-APENDICE: ${id}`;
}

export function marcadorDeAnexo(id: string): string {
  return `% AURA-ANEXO: ${id}`;
}

// --- Bloco de metadados ------------------------------------------------------

// Um comando por campo de `Metadados` que o documento imprime. O corpo do
// `.tex` usa estes comandos, e não o texto: assim o que o aluno edita no
// bloco é o que aparece no PDF e o que volta na reimportação. O `curso` fica
// de fora porque nenhum pré-textual o imprime; banca e abreviaturas são listas
// de objetos e saem como texto (não voltam, `latex-abntex.md` §1.5).
export const MACRO = {
  titulo: "\\auratitulo",
  subtitulo: "\\aurasubtitulo",
  autores: "\\auraautores",
  instituicao: "\\aurainstituicao",
  orientador: "\\auraorientador",
  local: "\\auralocal",
  ano: "\\auraano",
  naturezaTrabalho: "\\auranatureza",
  resumo: "\\auraresumo",
  palavrasChave: "\\aurapalavraschave",
  abstract: "\\auraabstract",
  keywords: "\\aurakeywords",
  dedicatoria: "\\auradedicatoria",
  agradecimentos: "\\auraagradecimentos",
  epigrafe: "\\auraepigrafe",
} as const;

// Um autor por linha, separados por `\\`: a capa e as folhas imprimem um
// autor por linha, e a reimportação separa pelo mesmo `\\`.
export const SEPARADOR_AUTORES = " \\\\ ";

// Termos separados por ponto e vírgula, como saem impressos (6028:2021
// §4.1.7); o ponto final é do corpo, não do campo.
export const SEPARADOR_TERMOS = "; ";

// Parágrafos dos elementos opcionais separados por `\par`, na mesma divisão
// que o `.docx` faz (`opcionaisPreTextuais.ts`).
function paragrafosDe(linhas: readonly LinhaPreTextual[]): string {
  return linhas
    .filter((linha) => !linha.titulo)
    .map((linha) => escaparLatex(linha.texto))
    .join("\\par\n");
}

function valores(metadados: Metadados): Record<keyof typeof MACRO, string> {
  return {
    titulo: escaparLatex(metadados.titulo),
    subtitulo: escaparLatex(metadados.subtitulo ?? ""),
    autores: metadados.autores.map(escaparLatex).join(SEPARADOR_AUTORES),
    instituicao: escaparLatex(metadados.instituicao),
    orientador: escaparLatex(metadados.orientador),
    local: escaparLatex(metadados.local),
    ano: String(metadados.ano),
    naturezaTrabalho: escaparLatex(metadados.naturezaTrabalho),
    resumo: escaparLatex(metadados.resumo),
    palavrasChave: escaparLatex(metadados.palavrasChave.join(SEPARADOR_TERMOS)),
    abstract: escaparLatex(metadados.abstract),
    keywords: escaparLatex(metadados.keywords.join(SEPARADOR_TERMOS)),
    dedicatoria: paragrafosDe(gerarDedicatoria(metadados)),
    agradecimentos: paragrafosDe(gerarAgradecimentos(metadados)),
    epigrafe: paragrafosDe(gerarEpigrafe(metadados)),
  };
}

// `\newcommand` é longo no LaTeX2e: aceita `\par` e linha em branco dentro.
export function blocoDeMetadados(metadados: Metadados): string {
  const conteudo = valores(metadados);
  const comandos = (Object.keys(MACRO) as (keyof typeof MACRO)[]).map(
    (campo) => `\\newcommand{${MACRO[campo]}}{${conteudo[campo]}}`,
  );
  return [
    "% AURA-METADADOS: início",
    "% Dados do trabalho. Edite aqui: o texto do documento usa estes comandos,",
    "% e é este bloco que volta ao AURA na reimportação. O resto do preâmbulo",
    "% não volta.",
    ...comandos,
    "% AURA-METADADOS: fim",
  ].join("\n");
}
