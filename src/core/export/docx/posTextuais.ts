import { AlignmentType, Paragraph, TextRun, type FileChild } from "docx";

import { gerarAnexos } from "../../document/elements/anexos";
import { gerarApendices } from "../../document/elements/apendices";
import {
  gerarListaReferencias,
  type EntradaListaReferencias,
} from "../../document/elements/referencias";
import { textoTituloPosTextual, type ItemPosTextual } from "../../document/elements/posTextual";
import { trechosDaCitacaoLonga, trechosDoInline } from "../../document/elements/trechos";
import type { Documento, ElementoPosTextual, NoConteudo } from "../../document/types";
import type { Referencia } from "../../references/types";
import { ABNT } from "./constants";
import { paragrafoTituloPosTextual } from "./preTextuais";
import { runsDeTrechos } from "./trechos";

// Pós-textuais no `.docx` — passo 3.7.2 (lugar e títulos) e 4.11 (a lista de
// referências): referências, apêndices e anexos. A
// letra e o título de apêndice/anexo vêm de `gerarApendices()`/`gerarAnexos()`
// (3.7.1), que é quem conhece a regra; aqui só vira OOXML. As duas sequências
// continuam independentes porque cada função recebe a sua lista e nada mais.
//
// **O título usa `TituloPosTextual`** — estilo separado desde 18/09/2026, e
// não por aparência: ele é idêntico ao `TituloPreTextual` (a NBR 14724:2024
// §5.2.3 trata os treze títulos sem indicativo numérico numa lista só, e
// APÊNDICE, ANEXO e REFERÊNCIAS estão nela junto de resumo e sumário). O que
// separa os dois é a NBR 6027, lida na mesma data: o §6.3 proíbe pré-textual
// no sumário, o §5.2 manda pós-textual entrar nele, e o campo `TOC` só
// distingue os dois grupos por nome de estilo. Até aqui os pós-textuais
// usavam o estilo dos pré-textuais e, por isso, **não apareciam no sumário** —
// é o achado 1 de docs/auditoria-abnt.md.
//
// **Cada apêndice/anexo em página própria** é convenção, não texto normativo
// conferido: a norma não diz onde cada um começa. Mesma ressalva da posição da
// legenda em `document/elements/legenda.ts`. Quem põe a quebra é
// `fromDocumento.ts`, que compõe os blocos — pelo mesmo motivo de
// `comQuebrasEntreBlocos()`: qual bloco é o primeiro depende do que a pessoa
// preencheu.

function paragrafoDeTexto(children: TextRun[]): Paragraph {
  return new Paragraph({ children, style: "Corpo" });
}

// **Não reaproveita o renderizador do corpo de propósito.** Lá figura e tabela
// saem com legenda numerada, e o número vem de `numerarFiguras()`, que percorre
// `documento.sections` — apêndice não está nelas. Passar por aquele caminho
// daria "Figura 0" em silêncio, e numerar ilustração de apêndice é regra que a
// auditoria do 3.1.1 não cobriu.
//
// Hoje isto é inalcançável: não existe UI que crie apêndice (registrado no
// 3.7.1), então `content` é sempre vazio. O aviso existe para o dia em que
// existir — perder uma figura em silêncio é o desfecho que este projeto já
// recusou na grade da tabela (`fromDocumento.ts`).
//
// Negrito, itálico e citações pelos mesmos trechos do corpo (passo 4B.2).
function paragrafoDeConteudo(no: NoConteudo, references: readonly Referencia[]): Paragraph {
  if (no.type === "paragraph") {
    return paragrafoDeTexto(runsDeTrechos(trechosDoInline(no.content, references)));
  }
  if (no.type === "citacao_longa") {
    return new Paragraph({
      children: runsDeTrechos(trechosDaCitacaoLonga(no, references)),
      style: "CitacaoLonga",
    });
  }

  if (no.type === "formula") return paragrafoDeTexto([new TextRun(no.texto)]);

  return new Paragraph({
    children: [
      new TextRun({
        text: `[ ${no.type} dentro de apêndice/anexo ainda não exportada — numeração não definida ]`,
        italics: true,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { line: ABNT.espacamento1 },
  });
}

function blocoDeElemento(
  item: ItemPosTextual,
  elemento: ElementoPosTextual,
  references: readonly Referencia[],
): FileChild[] {
  return [
    paragrafoTituloPosTextual(textoTituloPosTextual(item)),
    ...elemento.content.map((no) => paragrafoDeConteudo(no, references)),
  ];
}

function blocos(
  elementos: readonly ElementoPosTextual[],
  gerar: (lista: readonly ElementoPosTextual[]) => ItemPosTextual[],
  references: readonly Referencia[],
): FileChild[][] {
  return gerar(elementos).map((item, indice) =>
    blocoDeElemento(item, elementos[indice], references),
  );
}

export function blocosDeApendices(documento: Documento): FileChild[][] {
  return blocos(documento.apendices, gerarApendices, documento.references);
}

export function blocosDeAnexos(documento: Documento): FileChild[][] {
  return blocos(documento.anexos, gerarAnexos, documento.references);
}

// Referências — passo 4.11. O conteúdo e a ordem vêm de
// `gerarListaReferencias()` (`document/elements/referencias.ts`); aqui é só a
// disposição na página, conferida no texto integral das normas:
// - NBR 6023:2025 §6.3: "elaboradas em espaço simples, alinhadas à margem
//   esquerda do texto e separadas entre si por uma linha em branco de espaço
//   simples";
// - NBR 14724:2024 §5.2: as referências são exceção ao 1,5 e "devem ser
//   separadas entre si por um espaço simples em branco";
// - §5.1: fonte 12 — as referências não estão entre os elementos de "tamanho
//   menor", então saem no corpo do texto (o estilo padrão).
//
// **A linha em branco é um parágrafo vazio, e não espaçamento depois.** É o
// que a norma descreve ("uma linha em branco de espaço simples"), e é a única
// forma de ela medir exatamente uma linha da mesma fonte: `spacing.after` em
// pontos fixos erraria a altura da linha simples da Times, que o Word calcula
// pela métrica da fonte.
//
// **O destaque é negrito**, o mesmo recurso que o painel (4.5) usa na tela.
// A §6.7 deixa escolher negrito, itálico ou sublinhado, mas exige o MESMO em
// todas as referências — e o aluno não pode ver um na tela e receber outro no
// arquivo.
//
// Sem referência nenhuma, nada sai: o exportador não fabrica um "REFERÊNCIAS"
// vazio (ver `gerarListaReferencias()`).
//
// Alinhamento, espaço simples e recuo zero vêm do estilo `Referencia`
// (styles.ts, passo 6.1.1), e não de cada parágrafo.

function paragrafoReferencia(trechos: EntradaListaReferencias["trechos"]): Paragraph {
  return new Paragraph({
    children: trechos.map(
      (trecho) =>
        new TextRun({ text: trecho.texto, ...(trecho.papel === "titulo" ? { bold: true } : {}) }),
    ),
    style: "Referencia",
  });
}

// No mesmo estilo da referência: é a "linha em branco de espaço simples" da
// norma, e mede uma linha da mesma fonte.
function linhaEmBranco(): Paragraph {
  return new Paragraph({ children: [], style: "Referencia" });
}

export function blocosDeReferencias(documento: Documento): FileChild[][] {
  const lista = gerarListaReferencias(documento.references);
  if (!lista) return [];

  const corpo = lista.entradas.flatMap((entrada, indice) =>
    indice === 0
      ? [paragrafoReferencia(entrada.trechos)]
      : [linhaEmBranco(), paragrafoReferencia(entrada.trechos)],
  );
  return [[paragrafoTituloPosTextual(lista.titulo), ...corpo]];
}
