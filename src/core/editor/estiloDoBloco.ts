import type { EditorState } from "@tiptap/pm/state";

import { NORMAS } from "../standards/standards";

// O que a caixa de estilo e o indicador de tamanho da barra mostram para a
// seleção atual.
//
// **O tamanho é consequência do estilo, não escolha.** A NBR 14724 fixa 12 no
// texto e "tamanho menor e uniforme" na citação longa, nas notas e nas
// legendas. Deixar o tamanho livre seria deixar o trabalho sair da norma sem
// aviso, então a barra só o mostra; para mudar, muda-se o elemento (corpo ↔
// citação longa). Os números vêm de `NORMAS.abnt`, a mesma tabela auditada que
// o exportador segue.
//
// - `corpo` e `citacao_longa`: os dois estilos que a caixa sabe trocar;
// - `celula`: texto de célula de tabela (12, como o corpo — ver o estilo
//   `CelulaTabela` em `export/docx/styles.ts`), que não troca de estilo;
// - `misto`: a seleção pega blocos de estilos diferentes;
// - `outro`: figura, fórmula ou tabela selecionada inteira.

export type EstiloBloco = "corpo" | "citacao_longa" | "celula" | "misto" | "outro";

export interface EstiloDaSelecao {
  estilo: EstiloBloco;
  /** Em pontos; `null` quando não há um tamanho único a mostrar. */
  tamanhoPt: number | null;
}

const ABNT = NORMAS.abnt;

function estiloDoNo(nome: string): EstiloBloco {
  if (nome === "paragraph") return "corpo";
  if (nome === "citacao_longa") return "citacao_longa";
  if (nome === "celula_tabela") return "celula";
  return "outro";
}

function tamanhoDe(estilo: EstiloBloco): number | null {
  if (estilo === "corpo" || estilo === "celula") return ABNT.fonte.tamanho;
  if (estilo === "citacao_longa") {
    return ABNT.citacaoLonga?.tamanhoFonte ?? ABNT.fonte.tamanhoCitacao ?? null;
  }
  return null;
}

export function estiloDaSelecao(state: EditorState): EstiloDaSelecao {
  const { $from, $to } = state.selection;
  // Seleção de nó (figura, tabela, fórmula): o "pai" do cursor seria a seção.
  if (!$from.parent.isTextblock) return { estilo: "outro", tamanhoPt: null };

  const estilos = new Set<EstiloBloco>();
  state.doc.nodesBetween($from.pos, $to.pos, (no) => {
    if (no.isTextblock) estilos.add(estiloDoNo(no.type.name));
  });
  if (estilos.size === 0) estilos.add(estiloDoNo($from.parent.type.name));

  if (estilos.size > 1) {
    // Corpo e célula têm o mesmo tamanho: a seleção é mista no estilo, mas
    // ainda dá um tamanho único.
    const tamanhos = new Set([...estilos].map(tamanhoDe));
    return { estilo: "misto", tamanhoPt: tamanhos.size === 1 ? [...tamanhos][0] : null };
  }
  const [estilo] = estilos;
  return { estilo, tamanhoPt: tamanhoDe(estilo) };
}
