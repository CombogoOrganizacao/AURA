import type { Node as NoProseMirror } from "@tiptap/pm/model";

import { numerarPorOrdem, numerarSecoes } from "../document/numbering";
import type { NivelSecao, Secao } from "../document/types";

// Ponte entre o documento ProseMirror (nó `secao`, src/core/editor/nodes/
// section.ts) e `numerarSecoes()` (src/core/document/numbering.ts, que opera
// sobre `Secao[]` canônico) — usada pelo node view do passo 3.2.2
// (src/components/editor/nodes/SectionView.tsx) pra saber que número mostrar
// enquanto a pessoa ainda está digitando, antes de qualquer `onUpdate`
// converter o editor inteiro pro formato canônico.
//
// Não passa por `toDocumento()`/`editor.getJSON()`: numeração só depende de
// `id`/`nivel`/`ordem`, não do conteúdo (parágrafos) de cada seção — não há
// motivo pra materializar isso a cada tecla digitada, numa função chamada uma
// vez por seção visível. `doc.descendants()` visita em pré-ordem, a mesma
// convenção de achatamento que `toDocumento()` usa para subseção aninhada
// (src/core/document/serialize.ts).
export function numerarDocumentoProseMirror(doc: NoProseMirror): Map<string, string> {
  const secoesMinimas: Secao[] = [];
  let ordem = 0;

  doc.descendants((no) => {
    if (no.type.name !== "secao") {
      return;
    }
    const id = no.attrs.id as string | null;
    // Seção sem id não deveria existir no editor — `documento.ts` recusa a
    // transação que criaria uma —, mas não é papel desta função validar
    // isso; só ignora o que não tem como numerar.
    if (!id) {
      return;
    }
    secoesMinimas.push({
      id,
      ordem: ordem++,
      nivel: no.attrs.nivel as NivelSecao,
      titulo: "",
      content: [],
    });
  });

  return numerarSecoes(secoesMinimas);
}

// Mesma ponte, para figura e tabela (passo 3.6.3): o node view precisa saber
// que número mostrar enquanto a pessoa digita, antes de `onUpdate` converter
// o editor pro formato canônico. `doc.descendants()` visita em pré-ordem, que
// é a ordem de leitura do documento — a mesma que
// `numerarFiguras()`/`numerarTabelas()` obtêm percorrendo `Secao[]`.
//
// A contagem em si não é refeita aqui: as duas entradas (documento
// ProseMirror e `Secao[]` canônico) diferem, mas ambas terminam em
// `numerarPorOrdem()`. É o que impede a tela e o `.docx` de discordarem sobre
// qual é a Figura 3.
// Posições das notas de rodapé, na ordem de leitura (passo 6.1.3c). A nota N
// é a que está em `posicoes[N - 1]`: o número é derivado da ordem, como o da
// figura, e o `.docx` chega ao mesmo porque o Word conta as referências na
// mesma ordem.
//
// Guardado por documento: cada nota na tela pergunta o próprio número a cada
// transação, e sem o cache cada uma percorreria o documento inteiro. O
// `doc` do ProseMirror é imutável, então a mesma instância tem sempre as
// mesmas notas.
const cacheNotas = new WeakMap<NoProseMirror, number[]>();

export function posicoesDasNotas(doc: NoProseMirror): number[] {
  const guardadas = cacheNotas.get(doc);
  if (guardadas) return guardadas;

  const posicoes: number[] = [];
  doc.descendants((no, posicao) => {
    if (no.type.name === "nota_rodape") posicoes.push(posicao);
    // Só bloco de texto tem nota; figura, fórmula e tabela não precisam ser
    // abertos.
    return !no.isAtom && no.type.name !== "tabela";
  });

  cacheNotas.set(doc, posicoes);
  return posicoes;
}

export function numerarNumeraveisProseMirror(
  doc: NoProseMirror,
  tipo: "figura" | "tabela",
): Map<string, number> {
  const ids: string[] = [];

  doc.descendants((no) => {
    if (no.type.name !== tipo) {
      return;
    }
    const id = no.attrs.id as string | null;
    // Figura/tabela sem id não deveria existir (quem cria passa por
    // `novaFigura()`/`novaTabela()`), mas não é papel desta função validar
    // isso — só ignora o que não tem como numerar, igual a
    // `numerarDocumentoProseMirror()` faz com seção sem id.
    if (id) {
      ids.push(id);
    }
    // `false` interrompe a descida: uma tabela não contém outra (o schema de
    // `celula_tabela` é `text*`), e uma figura é atômica.
    return false;
  });

  return numerarPorOrdem(ids);
}
