import type { NoNumeravel } from "../types";

// Legenda de ilustração e de tabela — passo 3.6.3. Um lugar só para montar a
// string, pelo mesmo motivo de `textoItemSumario()` (3.6.1): o editor mostra
// "Figura 3 — Fluxo do processo" na tela, o `.docx` escreve a mesma coisa
// (com o número vindo de um campo `SEQ`), e a lista de ilustrações (3.6.4)
// vai repetir a terceira vez. Três montagens da mesma string divergem na
// primeira vez que alguém mexer numa delas.
//
// **O número não entra aqui como campo de dado.** Quem o calcula é
// `numerarFiguras()`/`numerarTabelas()` (src/core/document/numbering.ts), a
// partir da ordem de aparição — ver docs/schema-tiptap.md §2.
//
// **As regras de ilustração/tabela da NBR 14724 não passaram pela auditoria
// do passo 3.1.1.** O que ela cobriu e vale aqui: legenda em fonte menor e
// espaçamento simples (achado do 3.1.1, item 5.1/5.2 da 14724:2011 — e a
// própria auditoria registra que a 4ª edição, de 2024, **muda a regra de
// fonte de ilustração/tabela** e não foi lida). O que NÃO foi conferido na
// fonte primária: legenda acima do objeto, "Fonte:" obrigatória abaixo, e o
// travessão entre número e título. São as regras incontroversas repetidas
// por toda fonte secundária, e por isso **nenhum item desta norma é citado
// por número de seção aqui** — mesmo tratamento dado à NBR 6027 em
// `sumario.ts`. Auditar antes de a Fase 5 transformar qualquer coisa daqui
// em regra de conformidade (CLAUDE.md, "Auditar os valores da ABNT contra as
// NBRs").

export const ROTULO_FIGURA = "Figura";
export const ROTULO_TABELA = "Tabela";

export function rotuloDe(no: NoNumeravel): string {
  return no.type === "figura" ? ROTULO_FIGURA : ROTULO_TABELA;
}

// Separador entre o indicativo e o título da legenda. Exportado porque o
// node view o desenha entre dois elementos (o número derivado é texto fixo,
// o título é um `<input>`) e o `.docx` o escreve entre dois runs — nenhum
// dos dois consegue usar `textoLegenda()` inteiro, e os três precisam
// concordar. Idêntico ao de `poc/docx/gerar.js` (`legendaComSeq`), congelada
// e conferida no Word.
export const SEPARADOR_LEGENDA = " — ";

// "Figura 3 — Fluxo do processo". O travessão só aparece quando há título:
// legenda ainda em branco sai como "Figura 3", não "Figura 3 — ", que é o
// que a pessoa veria enquanto digita.
export function textoLegenda(rotulo: string, numero: number, legenda: string): string {
  const indicativo = `${rotulo} ${numero}`;
  return legenda ? `${indicativo}${SEPARADOR_LEGENDA}${legenda}` : indicativo;
}

// "Fonte: ..." — obrigatória abaixo do objeto. Devolve `""` quando o campo
// está vazio, e quem chama omite o parágrafo: o exportador não fabrica uma
// "Fonte:" pendurada sem fonte nenhuma só pra ter aparência de conformidade
// (mesma lógica de `paragrafosResumo()` em export/docx/preTextuais.ts).
// Elemento obrigatório que falta é assunto de `validarDocumento()`.
export function textoFonte(fonte: string): string {
  return fonte ? `Fonte: ${fonte}` : "";
}
