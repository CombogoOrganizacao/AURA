// Citações do documento e quais delas estão órfãs — passo 4.8.
//
// **Órfã é derivado, nunca gravado.** Uma citação aponta para a referência por
// `refId`; quando a referência sai de `Documento.references`, a citação passa
// a ser órfã sem que nada no texto mude. É a mesma escolha da numeração de
// seção (`numbering.ts`): o que decorre de outro dado é calculado, não
// guardado, e por isso não tem como ficar desatualizado. Consequências:
// - excluir uma referência NÃO apaga nem altera o texto do aluno (critério do
//   passo) — o texto marcado continua ali, com a marca e o `refId`;
// - o "Desfazer" do painel (4.5) reata a ligação sozinho, porque ela nunca
//   foi desfeita;
// - quem mostra a citação órfã é a conferência da Fase 5 (5.2.2), que chama
//   `citacoesOrfas()` — não há estado "órfã" para sincronizar.

import type {
  AtributosCitacao,
  Documento,
  ElementoPosTextual,
  NoConteudo,
  NoTexto,
  Secao,
} from "../document/types";

export type LocalCitacao =
  { tipo: "secao"; id: string } | { tipo: "apendice"; id: string } | { tipo: "anexo"; id: string };

export type OcorrenciaCitacao =
  | {
      // Trecho inline com a marca `citacao`.
      origem: "marca";
      refId: string;
      attrs: AtributosCitacao;
      local: LocalCitacao;
      // O texto do aluno sob a marca — para a conferência mostrar QUAL
      // passagem perdeu a referência.
      texto: string;
    }
  | {
      // Bloco `citacao_longa`, cuja ligação está no próprio nó (§4.3).
      origem: "citacao_longa";
      refId: string;
      pagina: string;
      local: LocalCitacao;
      texto: string;
    };

// Todas as citações ligadas a uma referência, na ordem do documento: seções
// por `ordem`, depois apêndices e anexos. Citação longa sem `refId` (ainda
// não ligada a nada) não é ocorrência — não é órfã, é incompleta, e isso é
// outra regra da Fase 5.
export function listarCitacoes(documento: Documento): OcorrenciaCitacao[] {
  const ocorrencias: OcorrenciaCitacao[] = [];
  const secoes = [...documento.sections].sort((a, b) => a.ordem - b.ordem);

  const blocos: Array<[LocalCitacao, Secao | ElementoPosTextual]> = [
    ...secoes.map((secao): [LocalCitacao, Secao] => [{ tipo: "secao", id: secao.id }, secao]),
    ...documento.apendices.map((elemento): [LocalCitacao, ElementoPosTextual] => [
      { tipo: "apendice", id: elemento.id },
      elemento,
    ]),
    ...documento.anexos.map((elemento): [LocalCitacao, ElementoPosTextual] => [
      { tipo: "anexo", id: elemento.id },
      elemento,
    ]),
  ];

  for (const [local, bloco] of blocos) {
    for (const no of bloco.content) coletarDoNo(no, local, ocorrencias);
  }
  return ocorrencias;
}

// As citações cujo `refId` não está mais entre as referências do documento.
export function citacoesOrfas(documento: Documento): OcorrenciaCitacao[] {
  const existentes = new Set(documento.references.map((referencia) => referencia.id));
  return listarCitacoes(documento).filter((ocorrencia) => !existentes.has(ocorrencia.refId));
}

function coletarDoNo(no: NoConteudo, local: LocalCitacao, saida: OcorrenciaCitacao[]) {
  switch (no.type) {
    case "paragraph":
      coletarDoInline(no.content, local, saida);
      return;
    case "citacao_longa":
      if (no.refId) {
        saida.push({
          origem: "citacao_longa",
          refId: no.refId,
          pagina: no.pagina,
          local,
          texto: textoDe(no.content),
        });
      }
      // O schema recusa a marca `citacao` dentro da citação longa (a ligação
      // é do bloco), mas um documento antigo ou importado poderia trazê-la:
      // varrer mesmo assim é mais barato que deixar uma ligação escondida.
      coletarDoInline(no.content, local, saida);
      return;
    case "tabela":
      for (const linha of no.linhas) {
        for (const celula of linha.celulas) coletarDoInline(celula.content, local, saida);
      }
      return;
    case "figura":
    case "formula":
      // Legenda, fonte e LaTeX são texto simples, sem marca.
      return;
  }
}

// Nós de texto vizinhos com a MESMA citação são uma citação só: o aluno pode
// ter posto uma palavra do excerto em itálico, e o ProseMirror parte o texto
// em dois nós com a marca repetida. Contar duas seria dizer que há duas
// chamadas onde a tela mostra uma.
function coletarDoInline(
  content: NoTexto[] | undefined,
  local: LocalCitacao,
  saida: OcorrenciaCitacao[],
) {
  let aberta: Extract<OcorrenciaCitacao, { origem: "marca" }> | null = null;

  for (const texto of content ?? []) {
    const marca = texto.marks?.find((item) => item.type === "citacao");
    const attrs = marca?.type === "citacao" ? marca.attrs : undefined;

    if (!attrs) {
      aberta = null;
      continue;
    }
    if (aberta && mesmaCitacao(aberta.attrs, attrs)) {
      aberta.texto += texto.text;
      continue;
    }
    aberta = { origem: "marca", refId: attrs.refId, attrs, local, texto: texto.text };
    saida.push(aberta);
  }
}

function mesmaCitacao(a: AtributosCitacao, b: AtributosCitacao): boolean {
  return (
    a.refId === b.refId &&
    a.modo === b.modo &&
    a.pagina === b.pagina &&
    JSON.stringify(a.apud) === JSON.stringify(b.apud)
  );
}

function textoDe(content: NoTexto[] | undefined): string {
  return (content ?? []).map((texto) => texto.text).join("");
}
