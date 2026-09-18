import { AlignmentType, PageBreak, Paragraph, TextRun, type FileChild } from "docx";

import { gerarCapa } from "../../document/elements/capa";
import { gerarFolhaDeRosto } from "../../document/elements/folhaDeRosto";
import type {
  LinhaPreTextual,
  PapelLinhaPreTextual,
} from "../../document/elements/linhaPreTextual";
import {
  gerarAgradecimentos,
  gerarDedicatoria,
  gerarEpigrafe,
} from "../../document/elements/opcionaisPreTextuais";
import type { Metadados } from "../../document/types";
import { ABNT } from "./constants";

// Resumo e abstract (NBR 6028) — passo 3.5.2. **Porte de `poc/docx/gerar.js`**
// (bloco "SEÇÃO 2 — Pré-textuais", `RESUMO`/`ABSTRACT`), congelada e
// conferida no Word: mesma estrutura de parágrafos, mesmo rótulo em negrito
// em run separado, mesma quebra de página entre um elemento e o outro. Não
// é código novo — o que mudou em relação à PoC é só a origem dos dados
// (`Metadados` de verdade, não as strings literais do script) e a omissão
// condicional, que a PoC não tinha porque lá todo campo estava sempre
// preenchido.
//
// Capa e folha de rosto (`src/core/document/elements/`, passo 3.5.1)
// continuam sem gerador de `.docx`: a PoC monta a folha de rosto no mesmo
// array, mas ligar isso aqui é outro passo. O sumário saiu daqui: é campo
// `TOC`, em `toc.ts` (3.6.2). Listas de figuras/tabelas: 3.6.4.
//
// NBR 6028 pede parágrafo único, por isso sem recuo de primeira linha (ao
// contrário do corpo comum, em `fromDocumento.ts`). A norma é omissa sobre
// o espaçamento do resumo — `ABNT.resumoEspacoSimples` é a escolha
// explícita que a PoC já registrava (ver `constants.ts` e
// docs/auditoria-abnt.md); o ternário abaixo é o mesmo da PoC, e existe pra
// que virar a constante mude o resultado de verdade.
const espacoResumo = ABNT.resumoEspacoSimples ? ABNT.espacamento1 : ABNT.espacamento15;

// Estilo nomeado de título de elemento pré-textual — título fora do sumário
// (NBR 6027), sem nível de estrutura: por não ser Heading, o campo `TOC` não
// o recolhe (ver `toc.ts`). Um lugar só, usado por resumo/abstract aqui,
// pelos opcionais abaixo e pelo título "SUMÁRIO" em `toc.ts`.
export function paragrafoTituloPreTextual(texto: string): Paragraph {
  return new Paragraph({ text: texto, style: "TituloPreTextual", keepNext: true });
}

// Mesmo título centralizado (NBR 14724:2024 §5.2.3), estilo separado — e a
// separação existe por causa da NBR 6027, não da aparência: pré-textual não
// entra no sumário (§6.3), pós-textual entra (§5.2), e o campo `TOC` só sabe
// distinguir os dois por nome de estilo. Ver `styles.ts` e `toc.ts`.
export function paragrafoTituloPosTextual(texto: string): Paragraph {
  return new Paragraph({ text: texto, style: "TituloPosTextual", keepNext: true });
}

function paragrafoJustificado(texto: string): Paragraph {
  return new Paragraph({
    children: [new TextRun(texto)],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: espacoResumo },
  });
}

// `palavrasChave`/`keywords` são array estruturado em `Metadados` — nunca
// uma string com ponto e vírgula já digitado à mão (mesma regra de
// "referências são objetos CSL-JSON", CLAUDE.md). A junção acontece só
// aqui, na hora de exportar. Dois runs, rótulo em negrito: igual à PoC.
function paragrafoTermos(rotulo: string, termos: string[]): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${rotulo}: `, bold: true }),
      new TextRun(`${termos.join("; ")}.`),
    ],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: espacoResumo },
  });
}

// Espaçador entre o corpo e a linha de termos — a PoC usa um parágrafo
// vazio com `after`, não `spacing` no parágrafo de cima.
function espacador(): Paragraph {
  return new Paragraph({ text: "", spacing: { after: 240 } });
}

function bloco(titulo: string, texto: string, rotuloTermos: string, termos: string[]): Paragraph[] {
  const paragrafos = [paragrafoTituloPreTextual(titulo), paragrafoJustificado(texto)];
  if (termos.length > 0) {
    paragrafos.push(espacador(), paragrafoTermos(rotuloTermos, termos));
  }
  return paragrafos;
}

// Omite o bloco inteiro quando não há texto — não fabrica um "RESUMO" vazio
// só pra ter aparência de conformidade (mesma lógica de
// `metadados.instituicao` em `elements/capa.ts`). Elemento obrigatório que
// falta é assunto de `validarDocumento()`, não do exportador.
export function paragrafosResumo(metadados: Metadados): Paragraph[] {
  if (!metadados.resumo) return [];
  return bloco("RESUMO", metadados.resumo, "Palavras-chave", metadados.palavrasChave);
}

// Abstract é opcional na v1 (docs/aura-decisoes-e-pendencias.md §1.3) — sai
// do `.docx` só quando o campo tem conteúdo. Critério de aceite deste passo.
export function paragrafosAbstract(metadados: Metadados): Paragraph[] {
  if (!metadados.abstract) return [];
  return bloco("ABSTRACT", metadados.abstract, "Keywords", metadados.keywords);
}

// Ponte entre a camada `core/document/elements/` (que diz ordem e
// alinhamento, sem saber o que é um twip) e o OOXML — passo 3.5.3. Dedicatória,
// agradecimentos e epígrafe chegam assim; capa e folha de rosto, que já
// falam a mesma língua desde o 3.5.1, podem passar por aqui quando alguém
// as ligar (3.7.2).
//
// "Recuada a partir do meio da mancha gráfica para a margem direita" (a nota
// de natureza do trabalho na NBR 14724 §5.2, e por convenção a dedicatória e
// a epígrafe) vira recuo à esquerda de metade da largura útil: é o mesmo
// `CM(8)` que a PoC congelada usa na folha de rosto, derivado aqui de
// `ABNT.larguraUtil` em vez de repetido como número solto.
const RECUO_METADE = Math.round(ABNT.larguraUtil / 2);

// Tipografia por papel da linha — a metade que `elements/` deixa de propósito
// para quem exporta (ver `linhaPreTextual.ts`). **Porte de `poc/docx/gerar.js`**
// (`linhaCentral(..., { bold: true })` e os `toUpperCase()` da capa e da folha
// de rosto), congelada e conferida no Word.
//
// **Nada disso é norma.** A NBR 14724 enumera os elementos da capa e da folha
// de rosto e diz que são centralizados; não manda caixa alta nem negrito em
// lugar nenhum. É a convenção que toda banca espera, e está aqui como
// convenção — mesma disciplina de `docs/auditoria-abnt.md`, que separa
// "conforme" de "convenção sem base normativa literal".
const ENFASE: Partial<Record<PapelLinhaPreTextual, { bold?: boolean; caixaAlta?: boolean }>> = {
  instituicao: { bold: true },
  autor: { caixaAlta: true },
  tituloDoTrabalho: { bold: true, caixaAlta: true },
};

function paragrafoDeLinha(linha: LinhaPreTextual): Paragraph {
  if (linha.titulo) return paragrafoTituloPreTextual(linha.texto);

  if (linha.alinhamento === "recuada-a-direita") {
    return new Paragraph({
      children: [
        // A nota de natureza sai em corpo menor, como na PoC. Convenção, não
        // norma: o §5.2 manda recuar, não diminuir. Vale só para ela — o
        // nome do orientador segue centralizado e em corpo normal, que é o
        // que o passo 3.5.1 decidiu (e onde a PoC diverge: lá ele é recuado
        // junto com a natureza).
        new TextRun(
          linha.papel === "natureza"
            ? { text: linha.texto, size: ABNT.tamanhoMenor }
            : { text: linha.texto },
        ),
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: linha.papel === "natureza" ? ABNT.espacamento1 : ABNT.espacamento15 },
      indent: { left: RECUO_METADE },
    });
  }

  const enfase = linha.papel ? ENFASE[linha.papel] : undefined;

  return new Paragraph({
    children: [
      new TextRun({
        text: enfase?.caixaAlta ? linha.texto.toLocaleUpperCase("pt-BR") : linha.texto,
        bold: enfase?.bold,
      }),
    ],
    alignment: linha.alinhamento === "centro" ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { line: ABNT.espacamento15 },
  });
}

// Espaço vertical ANTES da primeira linha de cada papel — é o que distribui a
// capa na folha em vez de amontoar tudo no topo. Porte dos parágrafos vazios
// com `after` de `poc/docx/gerar.js`: a PoC não usa `spacing` na linha de
// cima, usa uma linha vazia entre os grupos, e é assim que o arquivo foi
// conferido no Word.
//
// Distribuição vertical de capa e folha de rosto é convenção; a norma só
// enumera e centraliza.
function comEspacosPorPapel(
  linhas: readonly LinhaPreTextual[],
  espacos: Partial<Record<PapelLinhaPreTextual, number>>,
): Paragraph[] {
  const vistos = new Set<PapelLinhaPreTextual>();
  const paragrafos: Paragraph[] = [];

  for (const linha of linhas) {
    const espaco = linha.papel && !vistos.has(linha.papel) ? espacos[linha.papel] : undefined;
    if (linha.papel) vistos.add(linha.papel);
    if (espaco) paragrafos.push(new Paragraph({ text: "", spacing: { after: espaco } }));
    paragrafos.push(paragrafoDeLinha(linha));
  }

  return paragrafos;
}

// Capa (NBR 14724 §5.1) — passo 3.7.2. A ordem vem de `gerarCapa()` (3.5.1),
// que é quem leu a norma; aqui só a tipografia e a distribuição na folha.
//
// **Sem o curso**, que `poc/docx/gerar.js` põe logo abaixo da instituição: o
// §5.1 não o lista, e `gerarCapa()` segue a enumeração da norma. É divergência
// consciente da PoC, não esquecimento.
export function montarCapa(metadados: Metadados): Paragraph[] {
  return comEspacosPorPapel(gerarCapa(metadados), {
    autor: 3000,
    tituloDoTrabalho: 3000,
    local: 4000,
  });
}

// Folha de rosto (NBR 14724 §5.2) — passo 3.7.2. **Primeiro elemento da seção
// dos pré-textuais**, e não da capa: é nela que a contagem de páginas começa
// (a capa fica fora da contagem), ainda que o número só passe a ser exibido no
// textual. Ver `sections.ts`.
export function montarFolhaDeRosto(metadados: Metadados): Paragraph[] {
  return comEspacosPorPapel(gerarFolhaDeRosto(metadados), {
    tituloDoTrabalho: 2400,
    natureza: 1200,
    orientador: 600,
    local: 2400,
  });
}

// Cada elemento pré-textual começa em página própria (NBR 14724, e é o que
// a PoC faz). A quebra vai ENTRE os blocos, nunca antes do primeiro: a
// seção OOXML já começa numa página nova, e uma quebra à frente dela
// deixaria uma página em branco. Por isso a junção aqui em vez de cada bloco
// trazer a própria quebra — qual deles é o primeiro depende de quais campos
// a pessoa preencheu.
//
// Exportada no passo 3.6.4 para `fromDocumento.ts` emendar as listas
// (figuras, tabelas, abreviaturas — `docx/listas.ts`) depois do abstract
// seguindo a mesma regra de quebra, em vez de reimplementá-la. Fala em
// `FileChild`, não em `Paragraph`: a lista de figuras é um campo
// `TableOfContents`, que não é parágrafo.
export function comQuebrasEntreBlocos(blocos: readonly FileChild[][]): FileChild[] {
  return blocos
    .filter((bloco) => bloco.length > 0)
    .flatMap((bloco, indice) =>
      indice === 0 ? bloco : [new Paragraph({ children: [new PageBreak()] }), ...bloco],
    );
}

// Dedicatória, agradecimentos e epígrafe (3.5.3), um por função. Separados, e
// não um `montarPreTextuais()` que os junta com resumo e abstract, porque
// quem conhece a ORDEM é `src/core/document/order.ts` (3.7.2) — aqui cada
// elemento só sabe virar OOXML. Cada um devolve `[]` quando está desligado ou
// vazio, e a decisão continua sendo de `gerarDedicatoria()` e companhia.
export function paragrafosDedicatoria(metadados: Metadados): Paragraph[] {
  return gerarDedicatoria(metadados).map(paragrafoDeLinha);
}

export function paragrafosAgradecimentos(metadados: Metadados): Paragraph[] {
  return gerarAgradecimentos(metadados).map(paragrafoDeLinha);
}

export function paragrafosEpigrafe(metadados: Metadados): Paragraph[] {
  return gerarEpigrafe(metadados).map(paragrafoDeLinha);
}
