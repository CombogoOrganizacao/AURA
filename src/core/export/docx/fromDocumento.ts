import { AlignmentType, HeadingLevel, type Document, Paragraph, TextRun } from "docx";

import { textoItemSumario } from "../../document/elements/sumario";
import { numerarSecoes } from "../../document/numbering";
import type {
  Documento,
  NoCitacaoLonga,
  NoNumeravel,
  NoParagrafo,
  Secao,
} from "../../document/types";
import { ABNT } from "./constants";
import { paragrafoFonte, paragrafoLegenda } from "./legenda";
import { montarDocumento } from "./index";
import { blocosDeListas } from "./listas";
import { comQuebrasEntreBlocos, montarPreTextuais } from "./preTextuais";

// Liga o exportador ao `Documento` canônico de verdade (passo 1.4.2) — não
// mais ao JSON de teste da PoC. Corpo desde 1.4.2, resumo/abstract desde
// 3.5.2 (`preTextuais.ts`). Capa ainda é placeholder em `sections.ts` (ver
// comentário lá e docs/porte-poc.md): depende de layout próprio que ainda
// não foi ligado.
//
// `NoConteudo` cobre `paragraph` (desde 1.3.3), `citacao_longa` (desde
// 3.4.1, estilo nomeado `CitacaoLonga` desde 3.4.2) e `figura`/`tabela`
// (desde 3.6.3) — ver src/core/document/types.ts e docx/styles.ts. Lista e
// fórmula entram aqui na mesma hora em que ganham nó no editor
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
// **Sem a "chamada" de autoria ao final** (ex.: "(SOBRENOME, ano, p. 42)")
// que `poc/docx/gerar.js` já sabe montar: lá ela vem de `no.chamada` +
// `no.refId` resolvido contra uma lista de referências de verdade — aqui
// `refId` é sempre `null` na prática (`Documento.references` não tem UI que
// escreva nele, ver `longQuote.ts`), então não há do que montar a chamada
// ainda. Fica para quando a Fase 4 ligar `refId` a uma referência real.
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

// Legenda ACIMA do objeto, tanto em figura quanto em tabela — é a convenção
// corrente, mas **não** foi conferida na fonte primária: ver o cabeçalho de
// `src/core/document/elements/legenda.ts`, que registra o que a auditoria do
// 3.1.1 cobriu e o que ficou pendente.
function paragrafosNumeravel(no: NoNumeravel): Paragraph[] {
  return [
    paragrafoLegenda(no),
    no.type === "figura" ? molduraFigura() : avisoTabelaPendente(),
    ...paragrafoFonte(no),
  ];
}

// Recebe só os blocos que carregam inline direto. Figura e tabela ficam de
// fora pelo tipo, não por um `if` aqui dentro: elas não têm `content`, e
// tratá-las neste mesmo caminho seria exportá-las como parágrafo vazio.
function paragrafoCorpo(no: NoParagrafo | NoCitacaoLonga): Paragraph {
  const texto = (no.content ?? []).map((noTexto) => noTexto.text).join("");

  if (no.type === "citacao_longa") {
    // Estilo nomeado carrega recuo/fonte/espaçamento sozinho (styles.ts) —
    // nada repetido aqui, ao contrário do parágrafo comum abaixo, que ainda
    // não tem estilo nomeado próprio (isso é "Corpo" em 6.1.1).
    return new Paragraph({ children: [new TextRun(texto)], style: "CitacaoLonga" });
  }

  return new Paragraph({
    children: [new TextRun(texto)],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: ABNT.espacamento15 },
    indent: { firstLine: ABNT.recuoParagrafo },
  });
}

export function fromDocumento(documento: Documento): Document {
  const secoesEmOrdem = [...documento.sections].sort((a, b) => a.ordem - b.ordem);
  const numeracao = numerarSecoes(documento.sections);

  const corpo: Paragraph[] = [];
  for (const secao of secoesEmOrdem) {
    // `?? null` pelo mesmo motivo de `gerarSumario()`: o `Map` é indexado
    // por `id`, e uma seção ausente dele sai sem indicativo em vez de com
    // `undefined` no meio do título.
    corpo.push(paragrafoTitulo(secao, numeracao.get(secao.id) ?? null));
    for (const no of secao.content) {
      if (no.type === "figura" || no.type === "tabela") {
        corpo.push(...paragrafosNumeravel(no));
      } else {
        corpo.push(paragrafoCorpo(no));
      }
    }
  }

  // Ordem canônica dos pré-textuais (docs/to-do.md 3.7.2): opcionais,
  // resumo e abstract (`montarPreTextuais`), depois as listas de figuras,
  // tabelas e abreviaturas (3.6.4) — o sumário fecha a seção, em
  // `sections.ts`. `comQuebrasEntreBlocos` trata o que já veio de
  // `montarPreTextuais()` como um bloco só, então a quebra de página cai
  // entre ele e a primeira lista, e entre uma lista e a seguinte.
  const preTextuais = comQuebrasEntreBlocos([
    montarPreTextuais(documento.metadados),
    ...blocosDeListas(documento),
  ]);

  return montarDocumento({ corpo, preTextuais });
}
