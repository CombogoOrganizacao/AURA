import { Mark, mergeAttributes } from "@tiptap/core";
import type { Node as NoPM } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

import type { AtributosSugestao, EstadoSugestao, TipoSugestao } from "../../document/types";

// Marca `sugestao` — docs/schema-tiptap.md §5.3, passo 6.5.1. Preparação
// para a IA, sem IA: nada na interface da v1 cria, aceita ou rejeita uma
// sugestão. Existe agora para o documento salvo não mudar de forma quando a
// IA entrar (§1.10 de docs/aura-decisoes-e-pendencias.md).
//
// **Decidir não é aplicar.** `aceitarSugestao()` e `rejeitarSugestao()` mudam
// só o `estado`, e o texto marcado continua onde está. O que vale na versão
// final sai de `naVersaoFinal()`. Ver o comentário de `AtributosSugestao` em
// src/core/document/types.ts.
//
// **Não nasce de conteúdo colado.** Todo HTML colado passa por
// `mapearHtmlColado()` (src/core/editor/paste.ts), que só produz parágrafo,
// negrito e itálico. O `parseHTML` abaixo serve para o ProseMirror
// reconhecer a marca que ele mesmo desenhou, e passa pelo mesmo validador da
// serialização, como em `citation.ts`.

export const TIPOS_SUGESTAO: readonly TipoSugestao[] = ["insercao", "remocao"];
export const ESTADOS_SUGESTAO: readonly EstadoSugestao[] = ["pendente", "aceita", "rejeitada"];

export const Sugestao = Mark.create({
  name: "sugestao",

  // Digitar logo depois de uma sugestão NÃO estende a marca: o que o aluno
  // escreve é dele, e não pode entrar no documento como texto sugerido.
  inclusive: false,

  // O padrão do ProseMirror já faz uma marca excluir outra do mesmo tipo: um
  // trecho pertence a uma sugestão só. Por isso `sugerirRemocao()` recusa um
  // trecho que já tem sugestão, em vez de deixar a nova apagar a antiga.

  addAttributes() {
    return {
      id: { default: null },
      tipo: { default: null },
      estado: { default: "pendente" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-sugestao]",
        getAttrs: (elemento) =>
          lerAtributosSugestao({
            id: elemento.getAttribute("data-sugestao-id"),
            tipo: elemento.getAttribute("data-tipo"),
            estado: elemento.getAttribute("data-estado"),
          }) ?? false,
      },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const { id, tipo, estado } = mark.attrs as AtributosSugestao;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-sugestao": "",
        "data-sugestao-id": id,
        "data-tipo": tipo,
        "data-estado": estado,
      }),
      0,
    ];
  },
});

export default Sugestao;

// --- Validação ---------------------------------------------------------------
// Mesma política de `lerAtributosCitacao()`: atributo fora de forma torna a
// marca inválida inteira. Um `estado` consertado para um padrão poderia
// transformar em "aceita" uma sugestão que o aluno nunca aceitou.

export function lerAtributosSugestao(valor: unknown): AtributosSugestao | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  const { id, tipo, estado } = valor as Record<string, unknown>;

  if (typeof id !== "string" || id === "") return null;
  if (typeof tipo !== "string" || !(TIPOS_SUGESTAO as readonly string[]).includes(tipo)) {
    return null;
  }
  if (typeof estado !== "string" || !(ESTADOS_SUGESTAO as readonly string[]).includes(estado)) {
    return null;
  }

  return { id, tipo: tipo as TipoSugestao, estado: estado as EstadoSugestao };
}

// O texto marcado entra na versão final? A inserção, só depois de aceita; a
// remoção some só depois de aceita. Pendente ou rejeitada, vale o texto do
// aluno: nada sugerido entra no trabalho sem a decisão dele (§1.1).
export function naVersaoFinal({ tipo, estado }: AtributosSugestao): boolean {
  return tipo === "insercao" ? estado === "aceita" : estado !== "aceita";
}

// --- Comandos ----------------------------------------------------------------
// Mesma convenção de `tabela.ts`/`reorder.ts`: recebem `tr` mutável, devolvem
// `true` se mudaram algo, e são testáveis só com `EditorState`, sem DOM.
//
// O `id` vem de quem cria a sugestão, como o `id` da seção vem de
// `novaSecao()`. Uma substituição chama as duas funções com o mesmo `id`.

// Insere `texto` em `pos` como sugestão de inserção, pendente. Herda as
// marcas que a digitação naquele ponto herdaria (o itálico de um trecho em
// itálico, por exemplo).
export function sugerirInsercao(tr: Transaction, pos: number, texto: string, id: string): boolean {
  if (texto === "" || id === "") return false;

  const tipoMarca = tr.doc.type.schema.marks.sugestao;
  const $pos = tr.doc.resolve(pos);
  // A citação longa é transcrição literal (10520 §7.1.1) e não aceita a
  // marca (`marks: "negrito italico"`, src/core/editor/nodes/longQuote.ts).
  if (!$pos.parent.inlineContent || !$pos.parent.type.allowsMarkType(tipoMarca)) return false;

  const herdadas = $pos.marks().filter((marca) => marca.type !== tipoMarca);
  // Dentro de outra sugestão, a nova a substituiria em parte do trecho.
  if ($pos.marks().length !== herdadas.length) return false;

  const marca = tipoMarca.create({ id, tipo: "insercao", estado: "pendente" });
  tr.insert(pos, tr.doc.type.schema.text(texto, marca.addToSet(herdadas)));
  return true;
}

// Marca o trecho `de`–`ate` como sugestão de remoção, pendente. O texto não
// sai do documento: sai da versão final, se a remoção for aceita.
export function sugerirRemocao(tr: Transaction, de: number, ate: number, id: string): boolean {
  if (de >= ate || id === "") return false;

  const tipoMarca = tr.doc.type.schema.marks.sugestao;
  if (tr.doc.rangeHasMark(de, ate, tipoMarca)) return false;

  // Todo o trecho precisa poder levar a marca: uma remoção que pulasse em
  // silêncio a parte dentro de uma citação longa não removeria o que diz.
  let cabe = true;
  let temTexto = false;
  tr.doc.nodesBetween(de, ate, (no, _pos, pai) => {
    if (!no.isText) return true;
    temTexto = true;
    if (!pai?.type.allowsMarkType(tipoMarca)) cabe = false;
    return false;
  });
  if (!cabe || !temTexto) return false;

  tr.addMark(de, ate, tipoMarca.create({ id, tipo: "remocao", estado: "pendente" }));
  return true;
}

export function aceitarSugestao(tr: Transaction, id: string): boolean {
  return decidir(tr, id, "aceita");
}

export function rejeitarSugestao(tr: Transaction, id: string): boolean {
  return decidir(tr, id, "rejeitada");
}

export interface FaixaSugestao {
  de: number;
  ate: number;
  attrs: AtributosSugestao;
}

// Os trechos de texto com a sugestão `id` (uma substituição tem pelo menos
// dois: o removido e o inserido), em posições do ProseMirror.
export function faixasDaSugestao(doc: NoPM, id: string): FaixaSugestao[] {
  const faixas: FaixaSugestao[] = [];
  doc.descendants((no, pos) => {
    if (!no.isText) return true;
    const marca = no.marks.find((item) => item.type.name === "sugestao" && item.attrs.id === id);
    if (marca) faixas.push({ de: pos, ate: pos + no.nodeSize, attrs: marca.attrs as AtributosSugestao });
    return false;
  });
  return faixas;
}

// Muda o estado de todas as faixas da sugestão de uma vez, inserção e remoção
// juntas: aceitar metade de uma substituição deixaria o texto antigo e o novo
// lado a lado na versão final. A decisão pode ser revista enquanto a marca
// existir (rejeitada → aceita, e vice-versa).
function decidir(tr: Transaction, id: string, estado: EstadoSugestao): boolean {
  const faixas = faixasDaSugestao(tr.doc, id).filter((faixa) => faixa.attrs.estado !== estado);
  if (faixas.length === 0) return false;

  const tipoMarca = tr.doc.type.schema.marks.sugestao;
  for (const { de, ate, attrs } of faixas) {
    // `addMark` troca a marca do mesmo tipo: não fica a velha ao lado da nova.
    tr.addMark(de, ate, tipoMarca.create({ ...attrs, estado }));
  }
  return true;
}
