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
// **Auditado contra a fonte primária em 18/09/2026** (NBR 14724:2024 §5.8,
// lido na íntegra). As três regras que este arquivo carregava como "não
// conferido" têm item de norma agora, na mesma frase:
//
//   "Qualquer tipo de ilustração deve ser PRECEDIDO por sua palavra
//   designativa..., seguida de seu número de ordem de ocorrência no texto, em
//   algarismos arábicos, DE TRAVESSÃO e do respectivo título. IMEDIATAMENTE
//   APÓS A ILUSTRAÇÃO, deve ser indicada a fonte consultada."
//
// — ou seja: legenda acima do objeto, travessão entre número e título, e
// "Fonte:" abaixo. A palavra designativa é livre ("desenho, esquema,
// fluxograma, fotografia, gráfico, mapa, organograma, planta, quadro, retrato,
// FIGURA, imagem, entre outros"); a v1 usa "Figura" para toda ilustração, o
// que é uma das opções da lista, não a única.
//
// Tamanho e espaçamento vêm de outros dois itens: §5.1 pede "tamanho menor e
// uniforme" para fontes e legendas de ilustrações e tabelas, e §5.2 as lista
// entre as exceções ao 1,5. **Nenhum dos dois dá o número** — o corpo 10 do
// estilo `Legenda` continua sendo convenção (docs/auditoria-abnt.md).
//
// Tabela segue outra norma para a GRADE: o §5.9 remete às normas de
// apresentação tabular do IBGE (3. ed., 1993), lidas na fonte primária no
// passo 6.1.3 e aplicadas em `export/docx/table.ts` — não aqui: a legenda da
// tabela é a mesma do
// §4.2.1.10 ("precedido da palavra Tabela, seguida de seu número de ordem de
// ocorrência no texto e travessão").

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
