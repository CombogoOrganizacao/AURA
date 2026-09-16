import { AlignmentType, HeadingLevel, type Document, Paragraph, TextRun } from "docx";

import { textoItemSumario } from "../../document/elements/sumario";
import { numerarSecoes } from "../../document/numbering";
import type { Documento, NoConteudo, Secao } from "../../document/types";
import { ABNT } from "./constants";
import { montarDocumento } from "./index";
import { montarPreTextuais } from "./preTextuais";

// Liga o exportador ao `Documento` canônico de verdade (passo 1.4.2) — não
// mais ao JSON de teste da PoC. Corpo desde 1.4.2, resumo/abstract desde
// 3.5.2 (`preTextuais.ts`). Capa ainda é placeholder em `sections.ts` (ver
// comentário lá e docs/porte-poc.md): depende de layout próprio que ainda
// não foi ligado.
//
// `NoConteudo` cobre `paragraph` (desde 1.3.3) e `citacao_longa` (desde
// 3.4.1, estilo nomeado `CitacaoLonga` desde 3.4.2 — ver
// src/core/document/types.ts e docx/styles.ts). Lista, figura, tabela e
// fórmula entram aqui na mesma hora em que ganham nó no editor
// (docs/schema-tiptap.md §7) — não antes.
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

function paragrafoCorpo(no: NoConteudo): Paragraph {
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
      corpo.push(paragrafoCorpo(no));
    }
  }

  return montarDocumento({ corpo, preTextuais: montarPreTextuais(documento.metadados) });
}
