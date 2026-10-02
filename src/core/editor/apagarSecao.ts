import { closeHistory } from "@tiptap/pm/history";
import type { Node as NoProseMirror } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";

// Apaga uma seção pela interface — pela barra (a seção do cursor) e pelo
// menu de botão direito do painel de seções. Antes disto, uma seção criada
// por engano não tinha como sair do documento.
//
// **Só a seção, não as subseções.** As seções são uma lista plana com `nivel`
// (ver `novaSecao.ts`): apagar "2" tira o título e o texto de "2", e "2.1"
// continua no documento — passa a ser numerada sob a seção de nível 1
// anterior. É o que acontece ao apagar um título no Word; levar as subseções
// junto apagaria texto que a pessoa não pediu para apagar.
//
// O documento exige ao menos uma seção (`secao+`): a última nunca é apagada.

export interface SecaoNoDocumento {
  id: string;
  titulo: string;
  /** Tem título ou algum conteúdo — apagar perde algo que a pessoa escreveu. */
  temConteudo: boolean;
}

export function podeApagarSecao(doc: NoProseMirror): boolean {
  return doc.childCount > 1;
}

// A seção de topo que contém o cursor.
export function secaoDoCursor(state: EditorState): SecaoNoDocumento | null {
  const { doc, selection } = state;
  if (doc.childCount === 0) return null;
  const no = doc.child(Math.min(selection.$from.index(0), doc.childCount - 1));
  return descrever(no);
}

export function secaoPorId(doc: NoProseMirror, id: string): SecaoNoDocumento | null {
  let achada: SecaoNoDocumento | null = null;
  doc.forEach((no) => {
    if (no.attrs.id === id) achada = descrever(no);
  });
  return achada;
}

// Devolve `false` sem mexer em nada se a seção não existe ou é a única.
export function apagarSecao(tr: Transaction, id: string): boolean {
  const doc = tr.doc;
  if (!podeApagarSecao(doc)) return false;

  let inicio = -1;
  let tamanho = 0;
  doc.forEach((no, offset) => {
    if (no.attrs.id === id) {
      inicio = offset;
      tamanho = no.nodeSize;
    }
  });
  if (inicio < 0) return false;

  // Passo próprio no desfazer: sem isto, o histórico junta a remoção à
  // digitação de menos de 0,5 s antes, e um Ctrl+Z levava as duas.
  closeHistory(tr);
  tr.delete(inicio, inicio + tamanho);
  // Cursor no começo da seção que ocupou o lugar — ou no fim da anterior,
  // quando a apagada era a última.
  const alvo = Math.min(inicio, tr.doc.content.size);
  tr.setSelection(Selection.near(tr.doc.resolve(alvo), alvo < tr.doc.content.size ? 1 : -1));
  return true;
}

function descrever(no: NoProseMirror): SecaoNoDocumento {
  const titulo = (no.attrs.titulo as string | undefined) ?? "";
  // Um parágrafo vazio é o conteúdo de uma seção recém-criada: não conta.
  const soParagrafoVazio =
    no.childCount === 0 ||
    (no.childCount === 1 && no.firstChild!.type.name === "paragraph" && no.firstChild!.content.size === 0);
  return {
    id: no.attrs.id as string,
    titulo,
    temConteudo: titulo.trim() !== "" || !soParagrafoVazio,
  };
}
