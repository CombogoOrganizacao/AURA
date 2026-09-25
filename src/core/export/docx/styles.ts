import { AlignmentType, type IStylesOptions } from "docx";

import { ABNT } from "./constants";

// Estilos nomeados do `.docx` — porte 1:1 de `poc/docx/gerar.js` (ver
// docs/porte-poc.md para o que ficou de fora deste porte). Fatorado de
// `index.ts` no passo 3.2.5: este arquivo é o destino de todo estilo
// nomeado do exportador. A lista fechou no passo 6.1.1: Título 1–3, Corpo,
// Citação Longa, Referência, Legenda, os dois títulos sem indicativo e as
// três entradas de sumário; `CelulaTabela` entrou no 6.1.3, com a grade da
// tabela. Nunca de volta pra `index.ts`, que fica só com a
// montagem do `Document`.
//
// **Por que estilo nomeado, e não formatação em cada parágrafo.** O aluno
// abre o `.docx` no Word e continua escrevendo. Com estilos, o parágrafo novo
// que ele digita herda a formatação da norma pelo painel de Estilos, e o
// sumário automático reconhece os títulos. Formatação solta em cada
// parágrafo não passa adiante.
//
// A NBR 14724:2024 §5.4 exige gradação visível entre níveis de título e
// consistência entre sumário e texto ("destacam-se gradativamente, no sumário
// e, de forma idêntica, no texto... utilizando-se os recursos de negrito,
// itálico ou sublinhado e outros"), e remete à NBR 6024 — nenhuma das duas
// impõe esta combinação específica (caixa alta+negrito / negrito / itálico):
// é escolha de estilo do AURA
// (docs/auditoria-abnt.md, achado do passo 3.1.1, mesmos valores que
// `NORMAS.abnt.titulos` em `src/core/standards/standards.ts`). O Vitest
// de 3.2.5 (`styles.test.ts`) confere que os três níveis se distinguem no
// `<w:style>` gerado — não que esta seja "a" combinação exigida pela norma.
//
// `keepNext` em todo título: um título sozinho no pé da página, com o texto
// dele na página seguinte, é o defeito que o Word evita nos títulos dele de
// fábrica. Não é regra da norma; é o comportamento que o aluno espera ao
// continuar no Word.
function estiloTitulo(extra: Record<string, boolean>) {
  return {
    run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, color: "000000", ...extra },
    paragraph: { keepNext: true, spacing: { before: 360, after: 240, line: ABNT.espacamento15 } },
  };
}

// Entrada de sumário, um estilo por nível (passo 6.1.1). Sem eles, o Word
// cria os seus ao atualizar o campo `TOC`, e os de fábrica **recuam cada
// nível**, o que contraria a NBR 6027:2012 §5.1: "os indicativos das seções
// que compõem o sumário [...] devem ser alinhados à esquerda". Por isso o
// recuo é zero nos três.
//
// - §6.2 ("recomenda-se"): a subordinação "destacada com a mesma apresentação
//   tipográfica utilizada nas seções do documento". Cada nível repete o
//   destaque do título correspondente (`extra`).
// - §5.4: a paginação "à margem direita". Tabulação direita na largura útil
//   da folha, **sem pontilhado**: a norma não o pede, e o exemplo dela não
//   tem.
// - Entrelinha 1,5: o sumário não está entre as exceções de espaço simples da
//   NBR 14724:2024 §5.2.
//
// **Limitação registrada:** a §5.2 recomenda alinhar os títulos "pela margem
// do título do indicativo mais extenso". O campo `TOC` copia o texto do
// título como está, e no texto o indicativo é separado do título por um
// espaço (NBR 14724:2024 §5.2.2). Com um espaço não há margem comum a
// alinhar; seria preciso uma tabulação no título do corpo, contra a 14724.
//
// `name: "toc N"` é o nome interno que o Word usa para reconhecer o estilo
// como o de sumário dele (no Word em português aparece como "Sumário N").
function estiloSumario(nivel: 1 | 2 | 3, extra: Record<string, boolean>) {
  return {
    id: `TOC${nivel}`,
    name: `toc ${nivel}`,
    basedOn: "Normal",
    next: "Normal",
    run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, color: "000000", ...extra },
    paragraph: {
      spacing: { before: 0, after: 0, line: ABNT.espacamento15 },
      indent: { left: 0, firstLine: 0 },
      rightTabStop: ABNT.larguraUtil,
    },
  };
}

export const ESTILOS_DOCUMENTO: IStylesOptions = {
  default: {
    document: {
      run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo },
      paragraph: { spacing: { line: ABNT.espacamento15 } },
    },
    // heading4/heading5 não são produzidos por `fromDocumento()` — `NivelSecao`
    // (src/core/document/types.ts) para em 3. Ficam declarados só pra manter
    // paridade de `<w:style>` com `poc/docx/gerar.js` (conferido em
    // `index.test.ts`), que monta até cinco níveis de subseção.
    heading1: {
      run: {
        font: ABNT.fonte,
        size: ABNT.tamanhoCorpo,
        bold: true,
        allCaps: true,
        color: "000000",
      },
      paragraph: {
        keepNext: true,
        spacing: { before: 480, after: 240, line: ABNT.espacamento15 },
      },
    },
    heading2: estiloTitulo({ bold: true }),
    heading3: estiloTitulo({ italics: true }),
    heading4: estiloTitulo({}),
    heading5: estiloTitulo({ italics: true, smallCaps: true }),
    // Nota de rodapé — NBR 14724:2024 §5.2.1 (lida no PDF no passo 6.1.3c) e
    // NBR 10520:2023 §8: espaço simples (também §5.2), fonte menor e uniforme
    // (§5.1: 10 pt, a mesma da citação longa), "sem espaço entre elas" e a
    // segunda linha "abaixo da primeira letra da primeira palavra". O recuo
    // deslocado faz a última parte: o expoente fica na margem, e a tabulação
    // que `notas.ts` põe depois dele leva o texto até `recuoNota`, onde as
    // linhas seguintes também começam.
    //
    // O `docx` substitui o `paragraph` de fábrica inteiro por este, e o de
    // fábrica é que zerava o `after`: por isso `before`/`after` explícitos.
    //
    // O filete de 5 cm da §5.2.1 é o separador de notas do próprio Word, que
    // o `docx` grava e não deixa medir. Fica para a conferência no Word.
    footnoteText: {
      run: { font: ABNT.fonte, size: ABNT.tamanhoMenor },
      paragraph: {
        spacing: { before: 0, after: 0, line: ABNT.espacamento1 },
        indent: { left: ABNT.recuoNota, hanging: ABNT.recuoNota },
      },
    },
  },
  paragraphStyles: [
    // Texto corrido — passo 6.1.1. NBR 14724:2024 §5.2: entrelinha 1,5; §5.1:
    // fonte 12; recuo de primeira linha e justificado, os mesmos valores que
    // o parágrafo já recebia solto antes deste estilo existir
    // (`ABNT.recuoParagrafo`, ver constants.ts para a origem de cada um).
    {
      id: "Corpo",
      name: "Corpo",
      basedOn: "Normal",
      next: "Corpo",
      quickFormat: true,
      run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo },
      paragraph: {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: ABNT.espacamento15 },
        indent: { firstLine: ABNT.recuoParagrafo },
      },
    },
    // Referência da lista — passo 6.1.1. NBR 6023:2025 §6.3: "elaboradas em
    // espaço simples, alinhadas à margem esquerda do texto"; a linha em branco
    // entre uma e outra é um parágrafo vazio no mesmo estilo (ver
    // `posTextuais.ts`, que explica por quê). Fonte 12: as referências não
    // estão entre os elementos de tamanho menor (NBR 14724:2024 §5.1).
    {
      id: "Referencia",
      name: "Referencia",
      basedOn: "Normal",
      next: "Referencia",
      quickFormat: true,
      run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo },
      paragraph: {
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: ABNT.espacamento1 },
        indent: { left: 0, firstLine: 0 },
      },
    },
    // Conteúdo de célula de tabela — passo 6.1.3. Fonte 12 e entrelinha 1,5
    // porque a tabela não está entre as exceções da NBR 14724:2024 §5.1 e
    // §5.2 (que alcançam só título, legenda e fonte da tabela — ver
    // `table.ts`). À esquerda e sem recuo: o recuo de primeira linha e o
    // justificado do `Corpo` são de parágrafo corrido, e numa coluna estreita
    // o justificado abre buracos entre as palavras.
    {
      id: "CelulaTabela",
      name: "Celula de Tabela",
      basedOn: "Normal",
      next: "CelulaTabela",
      quickFormat: true,
      run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo },
      paragraph: {
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: ABNT.espacamento15 },
        indent: { left: 0, firstLine: 0 },
      },
    },
    estiloSumario(1, { bold: true, allCaps: true }),
    estiloSumario(2, { bold: true }),
    estiloSumario(3, { italics: true }),
    // Título de elemento sem indicativo numérico — NBR 14724:2024 §5.2.3,
    // que trata NUMA LISTA SÓ os treze: errata, agradecimentos, as quatro
    // listas, os dois resumos, sumário, referências, glossário, apêndice(s),
    // anexo(s) e índice(s). "Devem ser centralizados", e nada mais. O
    // `TituloPosTextual`, logo abaixo, tem a mesma aparência: o que separa os
    // dois é só o sumário (ver lá).
    {
      id: "TituloPreTextual",
      name: "Titulo Pre-Textual",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, bold: true, color: "000000" },
      paragraph: {
        alignment: AlignmentType.CENTER,
        spacing: { after: 360, line: ABNT.espacamento15 },
      },
    },
    // **Mesma formatação do `TituloPreTextual`, estilo separado.** A NBR
    // 14724:2024 §5.2.3 põe os treze títulos sem indicativo numérico numa lista
    // só, e eles saem idênticos no papel — o que separa os dois estilos não é
    // aparência, é a NBR 6027: o §6.3 proíbe pré-textual no sumário e o §5.2
    // manda pós-textual entrar nele. Um campo `TOC` só sabe distinguir os dois
    // grupos se eles tiverem nomes de estilo diferentes (`toc.ts` mapeia este
    // por `\t`, ver lá).
    //
    // `basedOn: "TituloPreTextual"` em vez de repetir as propriedades: mudar o
    // título centralizado da norma num lugar muda nos dois, que é o que o
    // §5.2.3 quer dizer ao tratá-los num grupo só.
    {
      id: "TituloPosTextual",
      name: "Titulo Pos-Textual",
      basedOn: "TituloPreTextual",
      next: "Normal",
      quickFormat: true,
    },
    // NBR 10520 — citação direta com mais de três linhas (passo 3.4.2, nó
    // `citacao_longa` desde 3.4.1). Nomeado, ao contrário do que
    // `poc/docx/gerar.js` fazia (formatação solta no `Paragraph`, sem
    // `paragraphStyles` próprio) — é o que faz o Word listar "Citacao Longa"
    // no painel de Estilos (critério do 6.1.1, que estende esta lista com
    // Corpo/Referencia/Legenda mais adiante). `recuoCitacao` (4 cm) só à
    // esquerda, mesma decisão da PoC e do CSS do editor (globals.css,
    // `--doc-indent-citacao`, passo 3.4.1) — nunca as duas margens.
    // NBR 14724 — legenda e fonte de ilustração/tabela (passo 3.6.3, estilo
    // nomeado ao corrigir a lista de tabelas). **O estilo existe para que o
    // tamanho menor venha do PARÁGRAFO, não de cada run.** O número da
    // legenda é um campo (`SEQ`) com resultado em cache, e o run desse cache
    // é montado pela biblioteca `docx`, sem como receber `size` — com o
    // tamanho preso em cada run, o número sairia em 12 pt no meio de uma
    // legenda de 10 pt. É também como o Word trata legenda desde sempre
    // (estilo "Legenda"/"Caption"), e adianta uma linha do 6.1.1.
    {
      id: "Legenda",
      name: "Legenda",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: ABNT.fonte, size: ABNT.tamanhoMenor, color: "000000" },
      paragraph: {
        alignment: AlignmentType.CENTER,
        spacing: { line: ABNT.espacamento1 },
      },
    },
    {
      id: "CitacaoLonga",
      name: "Citacao Longa",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: ABNT.fonte, size: ABNT.tamanhoMenor, color: "000000" },
      paragraph: {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 240, after: 240, line: ABNT.espacamento1 },
        indent: { left: ABNT.recuoCitacao },
      },
    },
  ],
};
