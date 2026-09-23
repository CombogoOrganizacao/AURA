import {
  AlignmentType,
  HeadingLevel,
  type Document,
  type FileChild,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";

import { gerarListaDeAbreviaturas } from "../../document/elements/abreviaturas";
import {
  gerarListaDeFiguras,
  gerarListaDeTabelas,
} from "../../document/elements/listas";
import { textoItemSumario } from "../../document/elements/sumario";
import { trechosDaCitacaoLonga, trechosDoInline } from "../../document/elements/trechos";
import { numerarFiguras, numerarSecoes, numerarTabelas } from "../../document/numbering";
import {
  elementosDaParte,
  type ElementoDocumento,
  type ParteDocumento,
} from "../../document/order";
import type {
  Documento,
  NoCitacaoLonga,
  NoFormula,
  NoNumeravel,
  NoParagrafo,
  Secao,
} from "../../document/types";
import type { Referencia } from "../../references/types";
import { ABNT } from "./constants";
import { paragrafoFonte, paragrafoLegenda } from "./legenda";
import { runsDeTrechos } from "./trechos";
import { montarDocumento } from "./index";
import {
  blocoListaDeAbreviaturas,
  blocoListaDeFiguras,
  blocoListaDeTabelas,
} from "./listas";
import {
  blocosDeAnexos,
  blocosDeApendices,
  blocosDeReferencias,
} from "./posTextuais";
import {
  comQuebrasEntreBlocos,
  montarCapa,
  montarFolhaDeRosto,
  paragrafosAbstract,
  paragrafosAgradecimentos,
  paragrafosDedicatoria,
  paragrafosEpigrafe,
  paragrafosResumo,
} from "./preTextuais";
import { blocoSumario } from "./toc";

// Liga o exportador ao `Documento` canônico de verdade (passo 1.4.2) — não
// mais ao JSON de teste da PoC. Corpo desde 1.4.2, resumo/abstract desde
// 3.5.2 (`preTextuais.ts`). Capa ainda é placeholder em `sections.ts` (ver
// comentário lá e docs/porte-poc.md): depende de layout próprio que ainda
// não foi ligado.
//
// `NoConteudo` cobre `paragraph` (desde 1.3.3), `citacao_longa` (desde
// 3.4.1, estilo nomeado `CitacaoLonga` desde 3.4.2), `figura`/`tabela`
// (desde 3.6.3) e `formula` (desde 3.6.5) — ver src/core/document/types.ts e
// docx/styles.ts. Lista entra aqui na mesma hora em que ganha nó no editor
// (docs/schema-tiptap.md §7) — não antes.
//
// **Figura e tabela saem com legenda e fonte, não com o objeto.** A imagem
// de verdade em `word/media/` é o passo 6.1.2 (`imagem` é sempre `null` hoje,
// ver `editor/nodes/figure.ts`) e a grade OOXML da tabela é o 6.1.3 — os dois
// já estão no plano com arquivo próprio. O que este passo entrega é a
// **legenda numerada**, que é o que ele promete: campo `SEQ` em `legenda.ts`,
// porte da PoC. A moldura da figura é o mesmo placeholder honesto que a PoC
// congelada usa; a tabela sai com um aviso no lugar da grade, em vez de sumir
// em silêncio do documento exportado.
//
// **Negrito, itálico e citações desde o passo 4B.2.** O inline passa por
// `trechosDoInline()`/`trechosDaCitacaoLonga()` (`document/elements/
// trechos.ts`), que devolvem o texto com as marcas do aluno, as aspas da
// citação direta e a chamada autor-data, pela mesma função que a tela usa.
// Antes disso este arquivo juntava o texto e descartava toda marca.
//
// Devolve o `Document` (docx), não empacotado — mesmo motivo de
// `montarDocumento()` em `index.ts`: quem chama escolhe `Packer.toBuffer()`
// (Node) ou `Packer.toBlob()` (navegador, passo 1.4.4).

const NIVEL_PARA_HEADING = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
] as const;

// O indicativo numérico é DERIVADO, nunca digitado (§2 de
// docs/schema-tiptap.md): `Secao.titulo` guarda "Metodologia", e "2.1
// Metodologia" só existe na saída. Quem deriva é `numerarSecoes()` (3.2.1),
// a mesma função do painel de seções e do sumário — e quem monta a string é
// `textoItemSumario()` (3.6.1), pelo mesmo motivo.
//
// **A grafia daqui é a grafia do sumário.** O campo `TOC` (`toc.ts`, passo
// 3.6.2) não remonta título nenhum: o Word copia o texto destes parágrafos
// para dentro da entrada. Se o indicativo faltar aqui, falta lá — e a NBR
// 6027 pede que o sumário reproduza os títulos como aparecem no texto. Era
// o que `docs/porte-poc.md` registrava como pendente ("até lá, títulos de
// seção no exportador continuam sem indicativo numérico").
function paragrafoTitulo(secao: Secao, numero: string | null): Paragraph {
  return new Paragraph({
    text: textoItemSumario({ numero, titulo: secao.titulo }),
    heading: NIVEL_PARA_HEADING[secao.nivel - 1],
  });
}

// Placeholder honesto da figura, igual ao de `poc/docx/gerar.js` — a PoC
// também não embute imagem (6.1.2). `keepNext` prende a moldura à linha de
// fonte que vem logo abaixo.
function molduraFigura(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "[ espaço reservado para a imagem ]", italics: true })],
    alignment: AlignmentType.CENTER,
    spacing: { line: ABNT.espacamento1, before: 120, after: 120 },
    keepNext: true,
  });
}

// A grade de verdade (`<w:tbl>`, bordas no padrão IBGE, cabeçalho repetido)
// é o passo 6.1.3, que tem `docx/table.ts` próprio no plano. Até lá a tabela
// exporta legenda + aviso + fonte: quem abrir o `.docx` vê que falta algo,
// em vez de descobrir depois que a tabela evaporou.
function avisoTabelaPendente(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: "[ grade da tabela ainda não exportada — ver passo 6.1.3 ]",
        italics: true,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { line: ABNT.espacamento1, before: 120, after: 120 },
    keepNext: true,
  });
}

// Fórmula (passo 3.6.5) — sai como a própria fonte LaTeX, em texto simples e
// centralizada. **Não é um placeholder**: `texto` É o dado do nó
// (docs/schema-tiptap.md §4.8 e §6, "OMML em `formula` (texto simples até o
// passo 6.1.4)"), então o que a pessoa escreveu chega inteiro ao `.docx` em
// vez de virar uma moldura vazia. Converter para OMML — a equação desenhada
// de verdade, editável no Word — é o passo 6.1.4, e é reler este mesmo campo.
//
// **Corrigido em 18/09/2026, com a NBR 14724:2024 §5.7 na mão.** Este
// comentário creditava a centralização à norma. Ela não manda centralizar:
// "recomenda-se que as equações e fórmulas sejam DESTACADAS no texto e, se
// necessário, numeradas com algarismos arábicos entre parênteses, ALINHADOS À
// DIREITA". Destacar é a exigência (e centralizar é uma das formas de
// destacar); centralizar é convenção, como o recuo de parágrafo e o
// justificado — ver docs/auditoria-abnt.md.
//
// Sem número: aqui o texto confirma o que já se supunha — a norma numera
// equação só "se necessário", e a v1 não numera nenhuma (ver o cabeçalho de
// `src/core/editor/nodes/formula.ts`). Quando numerar, o número vai entre
// parênteses e alinhado à direita, não junto da fórmula.
function paragrafoFormula(no: NoFormula): Paragraph {
  return new Paragraph({
    children: [new TextRun(no.texto)],
    alignment: AlignmentType.CENTER,
    spacing: { line: ABNT.espacamento15, before: 120, after: 120 },
  });
}

// Legenda ACIMA do objeto e "Fonte:" abaixo, tanto em figura quanto em
// tabela — literal na NBR 14724:2024 §5.8 ("deve ser PRECEDIDO por sua palavra
// designativa... IMEDIATAMENTE APÓS a ilustração, deve ser indicada a fonte
// consultada"). Era convenção não conferida até 18/09/2026; ver o cabeçalho de
// `src/core/document/elements/legenda.ts`.
//
// `numero` vem de `numerarFiguras()`/`numerarTabelas()` (3.6.3) — a mesma
// dupla que a tela usa. Ele não é escrito como texto: entra como resultado em
// cache do campo `SEQ` (ver `docx/legenda.ts`), que é o que faz a lista de
// figuras/tabelas sair com o número na primeira atualização de campos do
// Word.
function paragrafosNumeravel(no: NoNumeravel, numero: number): Paragraph[] {
  return [
    paragrafoLegenda(no, numero),
    no.type === "figura" ? molduraFigura() : avisoTabelaPendente(),
    ...paragrafoFonte(no),
  ];
}

// Recebe só os blocos que carregam inline direto. Figura e tabela ficam de
// fora pelo tipo, não por um `if` aqui dentro: elas não têm `content`, e
// tratá-las neste mesmo caminho seria exportá-las como parágrafo vazio.
function paragrafoCorpo(
  no: NoParagrafo | NoCitacaoLonga,
  references: readonly Referencia[],
): Paragraph {
  if (no.type === "citacao_longa") {
    // Estilo nomeado carrega recuo/fonte/espaçamento sozinho (styles.ts) —
    // nada repetido aqui, ao contrário do parágrafo comum abaixo, que ainda
    // não tem estilo nomeado próprio (isso é "Corpo" em 6.1.1).
    return new Paragraph({
      children: runsDeTrechos(trechosDaCitacaoLonga(no, references)),
      style: "CitacaoLonga",
    });
  }

  return new Paragraph({
    children: runsDeTrechos(trechosDoInline(no.content, references)),
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: ABNT.espacamento15 },
    indent: { firstLine: ABNT.recuoParagrafo },
  });
}

// Um gerador por elemento da ordem canônica (src/core/document/order.ts).
// **A ordem do `.docx` sai da constante, não daqui**: este `Record` diz COMO
// montar cada elemento, nunca QUANDO — quem percorre é `blocosDaParte()`,
// seguindo `ORDEM_CANONICA`. Trocar duas linhas de lugar aqui não muda o
// arquivo gerado; trocar em `order.ts` muda.
//
// Cada gerador devolve blocos (`FileChild[][]`), não um array achatado: é
// quem compõe a parte que decide a quebra de página entre um bloco e o
// seguinte. Bloco vazio significa "este elemento não sai" — a decisão fica
// com o gerador do elemento (resumo sem texto, dedicatória desligada,
// nenhum apêndice cadastrado), nunca duplicada aqui.
// O corpo: títulos numerados e o conteúdo de cada seção, na ordem de
// `Secao.ordem`. Era o miolo de `fromDocumento()` até este passo; virou função
// própria para entrar no `Record` abaixo como mais um elemento da ordem
// canônica, em vez de ser o caso especial que todos os outros contornam.
function paragrafosDoCorpo(documento: Documento): Paragraph[] {
  const secoesEmOrdem = [...documento.sections].sort((a, b) => a.ordem - b.ordem);
  const numeracao = numerarSecoes(documento.sections);

  // Contagem contínua no documento inteiro, derivada da ordem de leitura —
  // as MESMAS funções que o editor usa na tela (3.6.3), para o número da
  // legenda no `.docx` não poder divergir do que a pessoa viu ao escrever.
  const figuras = numerarFiguras(documento.sections);
  const tabelas = numerarTabelas(documento.sections);

  const corpo: Paragraph[] = [];
  for (const secao of secoesEmOrdem) {
    // `?? null` pelo mesmo motivo de `gerarSumario()`: o `Map` é indexado
    // por `id`, e uma seção ausente dele sai sem indicativo em vez de com
    // `undefined` no meio do título.
    corpo.push(paragrafoTitulo(secao, numeracao.get(secao.id) ?? null));
    for (const no of secao.content) {
      if (no.type === "figura" || no.type === "tabela") {
        // `?? 0` nunca acontece com um documento consistente: os dois `Map`
        // são construídos percorrendo estas mesmas seções. Um nó ausente
        // deles significaria id repetido — e o número sai errado, não
        // `undefined` no meio da legenda.
        const numero = (no.type === "figura" ? figuras : tabelas).get(no.id) ?? 0;
        corpo.push(...paragrafosNumeravel(no, numero));
      } else if (no.type === "formula") {
        corpo.push(paragrafoFormula(no));
      } else {
        corpo.push(paragrafoCorpo(no, documento.references));
      }
    }
  }

  return corpo;
}

type GeradorDeBlocos = (documento: Documento) => FileChild[][];

function blocoUnico(paragrafos: FileChild[]): FileChild[][] {
  return paragrafos.length > 0 ? [paragrafos] : [];
}

const GERADORES: Record<ElementoDocumento, GeradorDeBlocos> = {
  capa: (documento) => blocoUnico(montarCapa(documento.metadados)),
  folhaDeRosto: (documento) => blocoUnico(montarFolhaDeRosto(documento.metadados)),
  dedicatoria: (documento) => blocoUnico(paragrafosDedicatoria(documento.metadados)),
  agradecimentos: (documento) => blocoUnico(paragrafosAgradecimentos(documento.metadados)),
  epigrafe: (documento) => blocoUnico(paragrafosEpigrafe(documento.metadados)),
  resumo: (documento) => blocoUnico(paragrafosResumo(documento.metadados)),
  abstract: (documento) => blocoUnico(paragrafosAbstract(documento.metadados)),
  listaDeFiguras: (documento) =>
    blocoUnico(blocoListaDeFiguras(gerarListaDeFiguras(documento.sections).length > 0)),
  listaDeTabelas: (documento) =>
    blocoUnico(blocoListaDeTabelas(gerarListaDeTabelas(documento.sections).length > 0)),
  listaDeAbreviaturas: (documento) =>
    blocoUnico(
      blocoListaDeAbreviaturas(
        gerarListaDeAbreviaturas(documento.metadados, documento.sections),
      ),
    ),
  sumario: () => blocoUnico(blocoSumario()),
  corpo: (documento) => blocoUnico(paragrafosDoCorpo(documento)),
  referencias: blocosDeReferencias,
  apendices: blocosDeApendices,
  anexos: blocosDeAnexos,
};

function blocosDaParte(documento: Documento, parte: ParteDocumento): FileChild[][] {
  return elementosDaParte(parte).flatMap((elemento) => GERADORES[elemento](documento));
}

export function fromDocumento(documento: Documento): Document {
  // Capa: um elemento só, numa seção OOXML só — sem quebra a compor.
  const capa = blocosDaParte(documento, "capa").flat();

  // Pré-textuais: cada elemento em página própria (NBR 14724), com a quebra
  // ENTRE os blocos e nunca antes do primeiro — a seção OOXML já começa numa
  // página nova.
  const preTextuais = comQuebrasEntreBlocos(blocosDaParte(documento, "preTextual"));

  // Textual e pós-textual dividem a mesma seção OOXML (mesma paginação,
  // contínua e exibida), mas o pós-textual começa em página nova: a quebra vem
  // ANTES de cada bloco, inclusive do primeiro, porque ele segue o corpo
  // dentro da mesma seção em vez de abrir uma.
  const posTextuais = blocosDaParte(documento, "posTextual").flatMap((bloco) => [
    new Paragraph({ children: [new PageBreak()] }),
    ...bloco,
  ]);

  const corpo = [...blocosDaParte(documento, "textual").flat(), ...posTextuais];

  return montarDocumento({ capa, corpo, preTextuais });
}
