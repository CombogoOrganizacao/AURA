import type { Node as NoProseMirror } from "@tiptap/pm/model";
import { TextSelection, type Selection, type Transaction } from "@tiptap/pm/state";

// Garantir uma linha para digitar — o conserto do "não consigo escrever
// depois da tabela".
//
// O problema é de ESTRUTURA, não de clique: uma seção que termina em tabela,
// figura ou fórmula não tem nenhuma posição de texto depois do último bloco,
// então não existe para onde mandar o cursor. Clicar no vazio da folha abaixo
// do conteúdo também não fazia nada, porque ali não há nó nenhum sob o
// ponteiro. As funções abaixo criam a linha que falta — e só quando falta.
//
// **Só criam parágrafo por ação explícita de quem escreve** (clicar no vazio
// da folha, inserir um bloco pela barra). Nada aqui roda sozinho a cada
// transação: um parágrafo vazio que aparece por conta própria no fim de toda
// seção viraria linha em branco no `.docx` que ninguém pediu — e o formato
// canônico (src/core/document/types.ts) passaria a guardar um nó que existe
// só por causa da tela.
//
// Recebem `tr` mutável e devolvem a posição do cursor, mesma convenção de
// `reorder.ts`: quem chama já tem um `tr` de `editor.state` e despacha o
// resultado direto. Testável só com `EditorState`, sem `EditorView` nem DOM.

// A seção mais profunda no fim do documento, com a posição logo depois do
// último filho dela — que é onde uma linha nova entra.
//
// Uma subseção é um nó `secao` dentro de outro
// (docs/aura-decisoes-e-pendencias.md §1.5), então o fim do corpo não é o fim
// do último filho do `doc`: é preciso descer enquanto o último filho ainda
// for uma seção.
//
// A conta anda pelo FIM do conteúdo, não pelo início do nó, porque o `doc`
// não tem borda de abertura no espaço de posições (a primeira posição dentro
// dele é 0, não 1) e qualquer nó filho tem — somar `+1` uma vez a menos ou a
// mais é o erro clássico aqui.
function ultimaSecao(doc: NoProseMirror): { node: NoProseMirror; fimDoConteudo: number } {
  let node = doc;
  let fimDoConteudo = doc.content.size;

  while (node.lastChild?.type.name === "secao") {
    const inicioDoFilho = fimDoConteudo - node.lastChild.nodeSize;
    node = node.lastChild;
    // Dentro do filho, o conteúdo acaba logo antes da borda de fechamento.
    fimDoConteudo = inicioDoFilho + node.nodeSize - 1;
  }

  return { node, fimDoConteudo };
}

function paragrafoVazio(doc: NoProseMirror): NoProseMirror {
  const paragrafo = doc.type.schema.nodes.paragraph.createAndFill();
  if (!paragrafo) {
    throw new Error("Schema sem nó `paragraph` — não há como criar uma linha para digitar");
  }
  return paragrafo;
}

// Põe o cursor na última linha do corpo, criando-a se o documento terminar
// num bloco que não recebe cursor. É o que responde ao clique no vazio da
// folha, abaixo do texto — o gesto que a pessoa já faz em qualquer editor.
//
// Quando a última linha já é um parágrafo (ou uma citação longa), não cria
// nada: só leva o cursor para o fim dela, que é o comportamento esperado de
// clicar embaixo de um texto.
export function cursorNaUltimaLinha(tr: Transaction): number {
  const { node, fimDoConteudo } = ultimaSecao(tr.doc);

  if (node.lastChild?.isTextblock) {
    // Dentro do último parágrafo, antes da borda de fechamento DELE.
    const dentro = fimDoConteudo - 1;
    tr.setSelection(TextSelection.create(tr.doc, dentro));
    return dentro;
  }

  tr.insert(fimDoConteudo, paragrafoVazio(tr.doc));
  tr.setSelection(TextSelection.create(tr.doc, fimDoConteudo + 1));
  return fimDoConteudo + 1;
}

// Garante uma linha logo depois do bloco que termina em `fim`, e põe o cursor
// nela. Usada ao inserir figura, tabela ou fórmula pela barra: quem acabou de
// inserir um bloco quase sempre quer continuar escrevendo embaixo dele, e sem
// isto a inserção no fim da seção deixava o cursor sem destino.
//
// Reaproveita o parágrafo que já estiver ali em vez de empilhar um vazio a
// cada inserção.
export function cursorDepoisDoBloco(tr: Transaction, fim: number): number {
  const seguinte = tr.doc.resolve(fim).nodeAfter;

  if (!seguinte?.isTextblock) {
    tr.insert(fim, paragrafoVazio(tr.doc));
  }

  tr.setSelection(TextSelection.create(tr.doc, fim + 1));
  return fim + 1;
}

// Onde termina o bloco em que a seleção está — o filho direto da seção que a
// contém. Serve para achar o "depois deste bloco" sem depender de onde
// exatamente o TipTap largou o cursor: inserir uma figura deixa o nó inteiro
// selecionado (é atômico), inserir uma tabela leva o cursor para dentro de
// uma célula, e inserir num parágrafo o deixa no texto. Os três casos
// respondem a mesma pergunta por caminhos diferentes.
//
// Devolve `null` se a seleção não estiver dentro de nenhuma seção — não
// acontece com o schema atual (`doc` é `secao+`), mas é o que impede uma
// posição inventada de virar `insert` em lugar errado.
export function fimDoBlocoAtual(selecao: Selection): number | null {
  const $pos = selecao.$to;

  for (let profundidade = $pos.depth; profundidade >= 1; profundidade--) {
    if ($pos.node(profundidade).type.name !== "secao") continue;

    // A seleção já está DIRETO na seção (nó inteiro selecionado, ou cursor de
    // intervalo entre dois blocos): a própria posição é o fim do bloco.
    return profundidade === $pos.depth ? $pos.pos : $pos.after(profundidade + 1);
  }

  return null;
}
