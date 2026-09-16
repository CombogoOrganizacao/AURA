import { numerarSecoes } from "../numbering";
import type { NivelSecao, Secao } from "../types";

// Sumário (NBR 6027) — passo 3.6.1. Derivado da árvore de seções a cada
// chamada, como capa e folha de rosto são derivadas de `Metadados` (3.5.1):
// não existe sumário gravado em lugar nenhum, então não existe sumário
// desatualizado. Inserir, remover, reordenar ou mudar o nível de uma seção
// aparece aqui sozinho, sem nada para sincronizar à mão.
//
// **Recebe `Secao[]`, não `Documento`, e isso é a regra virando assinatura.**
// A NBR 6027 deixa os elementos pré-textuais fora do sumário — resumo,
// dedicatória, agradecimentos e epígrafe não entram. Como esses elementos são
// campos de `Metadados` e `Metadados` não chega aqui, eles não têm por onde
// entrar nem por engano. A garantia é o tipo, não um teste que alguém pode
// apagar depois (é o mesmo raciocínio de docs/schema-tiptap.md §1: mantê-los
// fora do documento editável é o que os mantém fora do sumário "sem regra
// especial").
//
// **Sem número de página**, que a NBR 6027 pede e este módulo não tem como
// saber: paginação não existe em `src/core/` — a folha A4 da tela não quebra
// em página 2 (é o que `AvisoPaginacao.tsx` avisa), e onde cada título cai
// depende da renderização real. No `.docx` quem preenche é o campo `TOC` do
// Word (passo 3.6.2); na tela, o sumário serve para navegar, não para imitar
// a página impressa.
//
// Confirma a ressalva de custo de docs/aura-decisoes-e-pendencias.md §127: o
// sumário automático do TipTap é extensão Pro (paga) e não foi preciso — este
// arquivo não importa nada do TipTap nem do navegador, só a árvore de seções
// que o formato canônico já tem.
//
// **NBR 6027 não passou pela auditoria do passo 3.1.1**, que cobriu 14724,
// 6023, 10520 e 6024. As regras usadas aqui (pré-textual fora do sumário;
// mesma ordem e grafia do corpo; sumário como último pré-textual) são as
// incontroversas, repetidas por toda fonte secundária — mas nenhuma foi
// conferida na fonte primária, e por isso nenhum item desta norma é citado
// por número de seção. Auditar a 6027 antes de a Fase 5 transformar qualquer
// coisa daqui em regra de conformidade (CLAUDE.md, "Auditar os valores da
// ABNT contra as NBRs").

export interface ItemSumario {
  // Mesmo `id` da `Secao` de origem: é por ele que a tela liga a entrada ao
  // título no corpo (rolar até, destacar) sem depender da posição na lista.
  id: string;
  // Indicativo numérico derivado ("1", "2.1", "3.1.2"), ou `null` para
  // entrada sem numeração progressiva. Nenhuma seção produz `null` hoje —
  // o campo existe porque referências, apêndices e anexos entram no sumário
  // pela norma **sem** indicativo, e isso é o passo 3.7.2. Já estar no tipo
  // é o que faz acrescentá-los depois não mexer no `ItemSumario`.
  numero: string | null;
  titulo: string;
  nivel: NivelSecao;
}

// O título do próprio sumário, num lugar só: a tela e o exportador (3.6.2)
// precisam da mesma string, e duas cópias divergem na primeira vez que
// alguém mexer numa delas.
export const TITULO_SUMARIO = "SUMÁRIO";

// Indicativo separado do título por um espaço — NBR 6024. Um espaço, não
// ponto nem travessão: o ponto do "3.1.2" separa os níveis entre si, não o
// número do texto. Existe aqui, e não em quem exibe, para o corpo do `.docx`
// e a entrada do sumário saírem com a MESMA grafia — a 6027 pede que o
// sumário reproduza os títulos como aparecem no texto, e a única forma de
// garantir isso é os dois chamarem a mesma função.
//
// `Pick` em vez de `ItemSumario` inteiro (passo 3.6.2): quem monta o título
// da seção no `.docx` (`export/docx/fromDocumento.ts`) tem `numero` e
// `titulo` em mãos, e não uma entrada de sumário — obrigá-lo a fabricar um
// `ItemSumario` só para chamar esta função seria inventar um objeto para
// satisfazer uma assinatura. `ItemSumario` continua satisfazendo o tipo.
export function textoItemSumario(item: Pick<ItemSumario, "numero" | "titulo">): string {
  return item.numero ? `${item.numero} ${item.titulo}` : item.titulo;
}

// Ordenado por `ordem`, não pela posição no array — mesma convenção de
// `numerarSecoes()` e de `fromDocumento()`. O array é só armazenamento; a
// ordem do documento é o campo `ordem`.
export function gerarSumario(sections: Secao[]): ItemSumario[] {
  const numeracao = numerarSecoes(sections);

  return [...sections]
    .sort((a, b) => a.ordem - b.ordem)
    .map((secao) => ({
      id: secao.id,
      // `numerarSecoes()` é a MESMA função que o painel de seções
      // (`PainelSecoes.tsx`) e o corpo usam — não há uma segunda contagem
      // aqui que possa divergir da primeira. `?? null` porque o `Map` é
      // indexado por `id`: uma seção ausente dele significaria árvore
      // inconsistente, e a entrada sai sem indicativo em vez de com
      // `undefined` no meio do texto.
      numero: numeracao.get(secao.id) ?? null,
      titulo: secao.titulo,
      nivel: secao.nivel,
    }));
}
