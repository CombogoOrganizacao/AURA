import { AlignmentType, Paragraph, TextRun, type FileChild } from "docx";

import { gerarAnexos } from "../../document/elements/anexos";
import { gerarApendices } from "../../document/elements/apendices";
import {
  TITULO_REFERENCIAS,
  textoTituloPosTextual,
  type ItemPosTextual,
} from "../../document/elements/posTextual";
import type { Documento, ElementoPosTextual, NoConteudo } from "../../document/types";
import { ABNT } from "./constants";
import { paragrafoTituloPosTextual } from "./preTextuais";

// Pós-textuais no `.docx` — passo 3.7.2: referências, apêndices e anexos. A
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

function paragrafoDeTexto(texto: string): Paragraph {
  return new Paragraph({
    children: [new TextRun(texto)],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: ABNT.espacamento15 },
    indent: { firstLine: ABNT.recuoParagrafo },
  });
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
function paragrafoDeConteudo(no: NoConteudo): Paragraph {
  if (no.type === "paragraph" || no.type === "citacao_longa") {
    return paragrafoDeTexto((no.content ?? []).map((noTexto) => noTexto.text).join(""));
  }

  if (no.type === "formula") return paragrafoDeTexto(no.texto);

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

function blocoDeElemento(item: ItemPosTextual, elemento: ElementoPosTextual): FileChild[] {
  return [
    paragrafoTituloPosTextual(textoTituloPosTextual(item)),
    ...elemento.content.map(paragrafoDeConteudo),
  ];
}

function blocos(
  elementos: readonly ElementoPosTextual[],
  gerar: (lista: readonly ElementoPosTextual[]) => ItemPosTextual[],
): FileChild[][] {
  return gerar(elementos).map((item, indice) => blocoDeElemento(item, elementos[indice]));
}

export function blocosDeApendices(documento: Documento): FileChild[][] {
  return blocos(documento.apendices, gerarApendices);
}

export function blocosDeAnexos(documento: Documento): FileChild[][] {
  return blocos(documento.anexos, gerarAnexos);
}

// Referências (NBR 6023) — o LUGAR na ordem canônica é deste passo, o
// CONTEÚDO é da Fase 4. Não existe formatador ABNT (4.3) nem UI que escreva em
// `Documento.references` (sempre `[]`, ver `types.ts`).
//
// Documento sem referência nenhuma não ganha seção de referências: é a mesma
// regra de `paragrafosResumo()` — o exportador não fabrica um "REFERÊNCIAS"
// vazio só para ter aparência de conformidade.
//
// Havendo referência antes do 4.11, sai o título e um aviso no lugar da lista,
// nunca a referência jogada crua nem o silêncio: é o mesmo desfecho que a
// grade da tabela e a moldura da figura já têm em `fromDocumento.ts`. Guardar
// uma referência e não imprimi-la seria a pior das três saídas.
export function blocosDeReferencias(documento: Documento): FileChild[][] {
  if (documento.references.length === 0) return [];

  return [
    [
      paragrafoTituloPosTextual(TITULO_REFERENCIAS),
      new Paragraph({
        children: [
          new TextRun({
            text: `[ ${documento.references.length} referência(s) cadastrada(s) — formatação ABNT ainda não exportada, ver passo 4.11 ]`,
            italics: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { line: ABNT.espacamento1 },
      }),
    ],
  ];
}
