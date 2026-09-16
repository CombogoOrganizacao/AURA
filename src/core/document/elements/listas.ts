import { numerarFiguras, numerarTabelas } from "../numbering";
import type { NoNumeravel, Secao } from "../types";
import { ROTULO_FIGURA, ROTULO_TABELA, textoLegenda } from "./legenda";

// Lista de ilustrações e lista de tabelas (NBR 14724) — passo 3.6.4.
// Derivadas da árvore de seções a cada chamada, exatamente como o sumário
// (3.6.1) e pelo mesmo motivo: não existe lista gravada em lugar nenhum,
// então não existe lista desatualizada. Inserir, remover ou reordenar uma
// figura aparece aqui sozinho — é o critério de aceite deste passo
// ("acompanham inserção e remoção"), e não é um ramo de código: o resultado
// inteiro é recalculado da ordem de aparição.
//
// **Recebe `Secao[]`, não `Documento`** — mesma assinatura-como-regra de
// `gerarSumario()`: figura e tabela são nós do corpo, e nada que venha de
// `Metadados` tem por onde entrar numa lista de ilustrações.
//
// O texto de cada entrada sai de `textoLegenda()`, a MESMA função que monta
// a legenda no corpo (3.6.3). A norma pede que a lista reproduza a legenda
// como ela aparece no texto, e a única forma de garantir isso é os dois
// chamarem a mesma função.
//
// **Sem número de página**, pelo mesmo motivo do sumário: paginação não
// existe em `src/core/`. No `.docx` quem preenche é um campo `TOC` de
// legendas (`export/docx/listas.ts`), que recolhe os campos `SEQ` do 3.6.3.
//
// **A NBR 14724 não foi auditada quanto a ilustrações/tabelas** — ver o
// cabeçalho de `legenda.ts`, que registra o que o passo 3.1.1 cobriu e o que
// ficou pendente. Daqui, o que é incontroverso: as listas são pré-textuais
// opcionais, vêm depois do resumo/abstract e antes do sumário, e relacionam
// cada item na ordem em que aparece no texto. Nenhum item da norma é citado
// por número de seção.

export interface ItemLista {
  // Mesmo `id` do nó de origem, para a tela poder rolar até a figura.
  id: string;
  numero: number;
  // Já montado ("Figura 3 — Fluxo do processo"): quem exibe não remonta a
  // string, do mesmo jeito que `textoItemSumario()` resolve para o sumário.
  texto: string;
}

export const TITULO_LISTA_FIGURAS = "LISTA DE FIGURAS";
export const TITULO_LISTA_TABELAS = "LISTA DE TABELAS";

// Figura sem legenda digitada entra na lista assim mesmo, como "Figura 3":
// ela existe no documento, e omiti-la faria a lista discordar do corpo.
// Legenda obrigatória que falta é assunto de `validarDocumento()` (Fase 5),
// não de quem gera a lista — mesma divisão de `paragrafosResumo()`.
function gerar(sections: Secao[], tipo: NoNumeravel["type"], rotulo: string): ItemLista[] {
  const numeracao = tipo === "figura" ? numerarFiguras(sections) : numerarTabelas(sections);

  return [...sections]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((secao) => secao.content)
    .filter((no): no is NoNumeravel => no.type === tipo)
    .map((no) => {
      const numero = numeracao.get(no.id);
      return {
        id: no.id,
        // `?? 0` nunca acontece na prática: `numerarFiguras()` percorre
        // exatamente os mesmos nós que o filtro acima. Existe para a lista
        // não sair com `undefined` no meio do texto caso um dia as duas
        // travessias divirjam.
        numero: numero ?? 0,
        texto: textoLegenda(rotulo, numero ?? 0, no.legenda),
      };
    });
}

export function gerarListaDeFiguras(sections: Secao[]): ItemLista[] {
  return gerar(sections, "figura", ROTULO_FIGURA);
}

export function gerarListaDeTabelas(sections: Secao[]): ItemLista[] {
  return gerar(sections, "tabela", ROTULO_TABELA);
}
