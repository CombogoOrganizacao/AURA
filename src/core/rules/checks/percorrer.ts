import type { AtributosCitacao, Documento, NoConteudo, NoTexto } from "../../document/types";
import { mesmaCitacao, type LocalCitacao } from "../../references/citacoes";
import type { LocalAchado } from "../compliance";

// Auxiliares das regras de verificação (passo 5.2.2). O que mais de uma regra
// precisa (percorrer o documento na ordem de leitura, montar o texto de um nó,
// achar citações com o lugar exato) mora aqui, para duas regras não
// discordarem sobre o que é "o texto".

export interface Bloco {
  onde: LocalCitacao;
  titulo: string;
  content: readonly NoConteudo[];
}

// Ordem de leitura: seções por `ordem` (não pela posição no array, mesma
// convenção de `numerarSecoes()`), depois apêndices e anexos na ordem da
// lista, como `listarCitacoes()` faz.
export function blocosEmOrdem(documento: Documento): Bloco[] {
  return [
    ...[...documento.sections]
      .sort((a, b) => a.ordem - b.ordem)
      .map((secao) => ({
        onde: { tipo: "secao", id: secao.id } as const,
        titulo: secao.titulo,
        content: secao.content,
      })),
    ...documento.apendices.map((elemento) => ({
      onde: { tipo: "apendice", id: elemento.id } as const,
      titulo: elemento.titulo,
      content: elemento.content,
    })),
    ...documento.anexos.map((elemento) => ({
      onde: { tipo: "anexo", id: elemento.id } as const,
      titulo: elemento.titulo,
      content: elemento.content,
    })),
  ];
}

export function textoInline(content: readonly NoTexto[] | undefined): string {
  return (content ?? []).map((texto) => texto.text).join("");
}

// O texto corrido de um nó, sem legenda nem fonte: é onde o aluno ESCREVE, e
// é onde uma figura é "citada no texto" (§5.8). Fórmula fica de fora, porque é
// LaTeX, não prosa (mesma escolha de `abreviaturas.ts`).
export function textoCorrido(no: NoConteudo): string {
  switch (no.type) {
    case "paragraph":
    case "citacao_longa":
      return textoInline(no.content);
    case "tabela":
      return no.linhas
        .flatMap((linha) => linha.celulas.map((celula) => textoInline(celula.content)))
        .join(" ");
    case "figura":
    case "formula":
      return "";
  }
}

export function localDoNo(
  onde: LocalCitacao,
  no: number,
  trecho?: { inicio: number; fim: number },
): LocalAchado {
  return trecho ? { tipo: "bloco", onde, no, trecho } : { tipo: "bloco", onde, no };
}

// --- Citações com o lugar exato ----------------------------------------------

export type CitacaoLocalizada =
  | { forma: "marca"; attrs: AtributosCitacao; texto: string; local: LocalAchado }
  | { forma: "longa"; refId: string | null; pagina: string; texto: string; local: LocalAchado };

// Todas as citações, na ordem de leitura, com o nó e o trecho. É o que
// permite ao painel (5.2.3) levar o cursor até a citação. Mesma regra de
// agrupamento de `listarCitacoes()`: nós vizinhos com a mesma citação são
// uma citação só (`mesmaCitacao()`).
//
// Diferente de `listarCitacoes()`, a citação longa SEM `refId` entra, com
// `refId: null`: é justamente o que uma das regras procura.
export function citacoesLocalizadas(documento: Documento): CitacaoLocalizada[] {
  const saida: CitacaoLocalizada[] = [];

  for (const bloco of blocosEmOrdem(documento)) {
    bloco.content.forEach((no, indice) => {
      if (no.type === "paragraph") {
        saida.push(...marcasDoInline(no.content, bloco.onde, indice, true));
      } else if (no.type === "citacao_longa") {
        saida.push({
          forma: "longa",
          refId: no.refId,
          pagina: no.pagina,
          texto: textoInline(no.content),
          local: localDoNo(bloco.onde, indice),
        });
      } else if (no.type === "tabela") {
        // Dentro da tabela o trecho não teria para onde apontar (a posição é
        // de uma célula, não do nó): o local é a tabela.
        for (const linha of no.linhas) {
          for (const celula of linha.celulas) {
            saida.push(...marcasDoInline(celula.content, bloco.onde, indice, false));
          }
        }
      }
    });
  }
  return saida;
}

function marcasDoInline(
  content: readonly NoTexto[] | undefined,
  onde: LocalCitacao,
  no: number,
  comTrecho: boolean,
): CitacaoLocalizada[] {
  const saida: CitacaoLocalizada[] = [];
  let aberta: {
    attrs: AtributosCitacao;
    texto: string;
    inicio: number;
    fim: number;
  } | null = null;
  let posicao = 0;

  const fechar = () => {
    if (!aberta) return;
    saida.push({
      forma: "marca",
      attrs: aberta.attrs,
      texto: aberta.texto,
      local: localDoNo(
        onde,
        no,
        comTrecho ? { inicio: aberta.inicio, fim: aberta.fim } : undefined,
      ),
    });
    aberta = null;
  };

  for (const texto of content ?? []) {
    const marca = texto.marks?.find((item) => item.type === "citacao");
    const attrs = marca?.type === "citacao" ? marca.attrs : null;
    const inicio = posicao;
    posicao += texto.text.length;

    if (aberta && attrs && mesmaCitacao(aberta.attrs, attrs)) {
      aberta.texto += texto.text;
      aberta.fim = posicao;
      continue;
    }
    fechar();
    if (attrs) aberta = { attrs, texto: texto.text, inicio, fim: posicao };
  }
  fechar();
  return saida;
}
