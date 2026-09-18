import { AlignmentType, type IStylesOptions } from "docx";

import { ABNT } from "./constants";

// Estilos nomeados do `.docx` — porte 1:1 de `poc/docx/gerar.js` (ver
// docs/porte-poc.md para o que ficou de fora deste porte). Fatorado de
// `index.ts` no passo 3.2.5: este arquivo é o destino de todo estilo
// nomeado do exportador, daqui em diante — `CitacaoLonga` chega em 3.4.2,
// o restante (Título 1-3 completo, Corpo, Referência, Legenda) em 6.1.1.
// Nunca de volta pra `index.ts`, que fica só com a montagem do `Document`.
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
function estiloTitulo(extra: Record<string, boolean>) {
  return {
    run: { font: ABNT.fonte, size: ABNT.tamanhoCorpo, color: "000000", ...extra },
    paragraph: { spacing: { before: 360, after: 240, line: ABNT.espacamento15 } },
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
      paragraph: { spacing: { before: 480, after: 240, line: ABNT.espacamento15 } },
    },
    heading2: estiloTitulo({ bold: true }),
    heading3: estiloTitulo({ italics: true }),
    heading4: estiloTitulo({}),
    heading5: estiloTitulo({ italics: true, smallCaps: true }),
    footnoteText: {
      run: { font: ABNT.fonte, size: ABNT.tamanhoMenor },
      paragraph: { spacing: { line: ABNT.espacamento1 } },
    },
  },
  paragraphStyles: [
    // Título de elemento sem indicativo numérico — NBR 14724:2024 §5.2.3,
    // que trata NUMA LISTA SÓ os treze: errata, agradecimentos, as quatro
    // listas, os dois resumos, sumário, referências, glossário, apêndice(s),
    // anexo(s) e índice(s). "Devem ser centralizados", e nada mais. Usar um
    // estilo só para pré e pós-textual não é atalho: é o agrupamento da norma.
    // (O nome ficou preso ao lugar onde apareceu primeiro; renomear quebraria
    // a paridade com `poc/docx/saida.docx` — registrado para o 6.1.1.)
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
