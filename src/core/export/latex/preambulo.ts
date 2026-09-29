import { TITULO_LISTA_ABREVIATURAS } from "../../document/elements/abreviaturas";
import { tituloComSubtitulo } from "../../document/elements/capa";
import { TITULO_LISTA_FIGURAS, TITULO_LISTA_TABELAS } from "../../document/elements/listas";
import { TITULO_SUMARIO } from "../../document/elements/sumario";
import type { Metadados } from "../../document/types";
import { escaparLatex } from "./escape";
import { blocoDeMetadados } from "./markers";

// Preâmbulo do `.tex` (passo 6.2.1). Cada bloco corresponde a uma linha de
// docs/latex-abntex.md §4: a classe `abntex2` dá a estrutura, e o que ela faz
// diferente da NBR 14724:2024 (ou do que o `.docx` já decidiu onde a norma
// deixa escolha) é sobrescrito aqui. Mudar um valor daqui sem mudar o `.docx`
// faz o mesmo trabalho sair com duas aparências.
//
// Compilador: pdfLaTeX (§1.4), por isso `inputenc` e `fontenc`, que a classe
// não carrega sozinha (manual da abntex2, §4.1).

const OPCOES_DA_CLASSE = [
  "12pt",
  // Só anverso (doc de decisões §1.3): sem margem espelhada, sem página em
  // branco antes de capítulo. Cada seção primária começa em página nova
  // (14724 §5.2.2), que é o que `openany` faz.
  "oneside",
  "openany",
  "a4paper",
  // Caixa alta nos títulos de capítulo e dos pré e pós-textuais, como o
  // `heading1` e o `TituloPreTextual` do `.docx` (manual §4.2.5).
  "chapter=TITLE",
  // Inglês para a hifenização do abstract; `brazil` por último, porque a
  // última opção é o idioma padrão (manual §4.8.1).
  "english",
  "brazil",
];

const PACOTES = String.raw`\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
% Fonte tipo Times, como a Times New Roman do .docx. A norma não fixa família
% (14724 §5.1): é convenção, não conformidade. newtxmath traz os símbolos da
% AMS; por isso amssymb não entra (os dois definem os mesmos comandos).
\usepackage{amsmath}
\usepackage{newtxtext,newtxmath}
% Recuo também no primeiro parágrafo de cada seção, como o .docx.
\usepackage{indentfirst}
\usepackage{graphicx}
% Tabela IBGE com cabeçalho repetido na página seguinte: longtable, não
% \IBGEtab, que não funciona com ela (manual §6.5).
\usepackage{longtable,booktabs,array}
% [H]: figura no lugar em que o aluno a pôs, não onde o LaTeX preferir
% (14724 §5.8, "o mais próximo possível do trecho").
\usepackage{float}`;

const SOBRESCRITAS = String.raw`% A classe já carrega o hyperref; carregar de novo quebra a compilação.
% Link sem cor: texto em preto (14724 §5.1).
\hypersetup{hidelinks}

% Títulos em 12 pt, com a gradação do .docx: nível 1 caixa alta e negrito,
% nível 2 negrito, nível 3 itálico (14724 §5.1 e §5.4).
\renewcommand{\ABNTEXchapterfont}{\rmfamily\bfseries}
\renewcommand{\ABNTEXchapterfontsize}{\normalsize}
\renewcommand{\ABNTEXsectionfont}{\rmfamily\bfseries}
\renewcommand{\ABNTEXsectionfontsize}{\normalsize}
\renewcommand{\ABNTEXsubsectionfont}{\rmfamily\mdseries\itshape}
\renewcommand{\ABNTEXsubsectionfontsize}{\normalsize}
\renewcommand{\ABNTEXsubsubsectionfont}{\rmfamily\mdseries}
\renewcommand{\ABNTEXsubsubsectionfontsize}{\normalsize}

% Sumário com o mesmo destaque do texto (14724 §5.4; 6027 §6.2).
\renewcommand{\cftchapterfont}{\rmfamily\bfseries}
\renewcommand{\cftchapterpagefont}{\rmfamily\bfseries}
\renewcommand{\cftsectionfont}{\rmfamily\bfseries}
\renewcommand{\cftsectionpagefont}{\rmfamily\bfseries}
\renewcommand{\cftsubsectionfont}{\rmfamily\itshape}
\renewcommand{\cftsubsectionpagefont}{\rmfamily\itshape}

% Espaço entre título e texto: 18 pt, a mesma medida do .docx
% (ABNT.espacoTitulo, 14724 §5.2.2). A classe descumpre de propósito
% (manual §6.1.3). Nada acima do título de capítulo: topo da mancha.
\setlength{\beforechapskip}{0pt}
\setlength{\afterchapskip}{18pt}
\setbeforesecskip{18pt}
\setaftersecskip{18pt}
\setbeforesubsecskip{18pt}
\setaftersubsecskip{18pt}

% Parágrafo como o .docx: recuo de 1,25 cm (convenção) e nada entre eles.
\setlength{\parindent}{1.25cm}
\setlength{\parskip}{0pt}

% "Figura 1 — Título": travessão, como o .docx (14724 §5.8). Legenda em
% tamanho menor (§5.1), como o estilo Legenda. O espaço simples (§5.2) não
% cabe aqui (comando de espaçamento dentro da fonte da legenda quebra a
% compilação): a figura inteira sai em espaço simples (document.ts).
\renewcommand{\ABNTEXcaptiondelim}{~--- }
\captiondelim{\ABNTEXcaptiondelim}
\captionnamefont{\ABNTEXfontereduzida}
\captiontitlefont{\ABNTEXfontereduzida}

% Listas de figuras e de tabelas: "Figura 1 — Título", com o travessão da
% legenda (a classe usa meia-risca centralizada).
\renewcommand*{\cftfigureaftersnum}{~---}
\renewcommand*{\cfttableaftersnum}{~---}

% Sumário com a entrelinha uniforme do .docx: a classe põe espaço a mais antes
% de cada capítulo e antes da parte pós-textual (visto no Overleaf em
% 28/09/2026: 18 pt entre capítulos contra 6 entre seções, 29 antes de
% REFERÊNCIAS).
\setlength{\cftbeforechapterskip}{0pt}
\setlength{\cftbeforepartskip}{0pt}

% Sumário e listas sem pontilhado, como o .docx: a NBR 6027 não o pede, e o
% exemplo dela não tem.
\renewcommand*{\cftchapterdotsep}{\cftnodots}
\renewcommand*{\cftsectiondotsep}{\cftnodots}
\renewcommand*{\cftsubsectiondotsep}{\cftnodots}
\renewcommand*{\cftfiguredotsep}{\cftnodots}
\renewcommand*{\cfttabledotsep}{\cftnodots}

% Cabeçalho só com o número da página, no alto à direita, sem o título da
% seção e sem traço (14724 §5.3). A classe põe os dois.
\makeoddhead{abntheadings}{}{}{\ABNTEXfontereduzida\thepage}
\makeevenhead{abntheadings}{}{}{\ABNTEXfontereduzida\thepage}
\makeheadrule{abntheadings}{0pt}{0pt}

% Filete da nota de rodapé com 5 cm a partir da margem (14724 §5.2.1).
\renewcommand{\footnoterule}{\kern-3pt\hrule width 5cm\kern 2.6pt}

% Atalhos que o KaTeX da tela aceita e o LaTeX não tem.
\providecommand{\R}{\mathbb{R}}
\providecommand{\N}{\mathbb{N}}
\providecommand{\Z}{\mathbb{Z}}
\providecommand{\Q}{\mathbb{Q}}`;

// Comandos do AURA. Imprimem o que o aluno vê; os argumentos a mais existem
// para a reimportação (docs/latex-abntex.md §1.5) e não aparecem no PDF.
const COMANDOS_AURA = String.raw`% Espaço simples sem espaço vertical a mais. O \SingleSpacing do memoir
% insere espaço onde é chamado: visto no Overleaf em 28/09/2026, 35 pt entre
% o título do capítulo e a legenda da figura e 34 entre o título da seção e a
% citação longa, contra ~21 e ~23 com este comando.
\newcommand{\auraespacosimples}{\linespread{1}\selectfont}
% \auracite[atributos]{refId}{trecho}{chamada}: citação ligada à
% referência. Imprime o trecho e a chamada; os atributos são para o AURA.
\newcommand{\auracite}[4][]{#3#4}
% Chamada de citação derivada: o AURA a recalcula na reimportação.
\newcommand{\aurachamada}[1]{#1}
% Citação direta com mais de três linhas (10520:2023 §7.1.1), sobre o
% ambiente citacao da classe: recuo de 4 cm, letra menor, sem aspas.
\newenvironment{auracitacaolonga}[2][]{\begin{citacao}\auraespacosimples}{\end{citacao}}
% "Fonte: ..." abaixo da figura ou da tabela: tamanho menor e espaço simples
% (14724 §5.1 e §5.2), centralizada como o estilo Legenda do .docx, com
% 12 pt abaixo, como ele. Os 6 pt entre imagem e fonte são da imagem
% (document.ts), como no .docx: a tabela não os tem.
\newcommand{\aurafonte}[1]{\par{\ABNTEXfontereduzida\auraespacosimples\centering #1\par}\vspace{12pt}}

% Espaços em volta de figura e tabela iguais aos do .docx, que não põe nada
% antes da legenda e 6 pt entre legenda e imagem. O LaTeX punha ~12 pt em
% volta de toda figura e 10 pt acima de toda legenda (visto no Overleaf em
% 28/09/2026: 49 pt entre o título do capítulo e a legenda da figura).
\setlength{\intextsep}{0pt}
\setlength{\abovecaptionskip}{0pt}
\setlength{\belowcaptionskip}{6pt}
\setlength{\LTpre}{0pt}
\setlength{\LTpost}{0pt}`;

function nomes(): string {
  return String.raw`\addto\captionsbrazil{%
  \renewcommand{\contentsname}{${escaparLatex(TITULO_SUMARIO)}}%
  \renewcommand{\listfigurename}{${escaparLatex(TITULO_LISTA_FIGURAS)}}%
  \renewcommand{\listtablename}{${escaparLatex(TITULO_LISTA_TABELAS)}}%
  \renewcommand{\listadesiglasname}{${escaparLatex(TITULO_LISTA_ABREVIATURAS)}}%
}`;
}

// Dados do trabalho para os metadados do PDF (título e autor na aba do
// leitor). A capa e a folha de rosto não usam estes comandos, e sim os do
// bloco `AURA-METADADOS` (`markers.ts`); estes não voltam na reimportação.
function dados(metadados: Metadados): string {
  return [
    `\\titulo{${escaparLatex(tituloComSubtitulo(metadados))}}`,
    `\\autor{${escaparLatex(metadados.autores.join("; "))}}`,
    `\\local{${escaparLatex(metadados.local)}}`,
    `\\data{${metadados.ano}}`,
  ].join("\n");
}

export function preambulo(metadados: Metadados): string {
  return [
    `\\documentclass[${OPCOES_DA_CLASSE.join(",")}]{abntex2}`,
    PACOTES,
    SOBRESCRITAS,
    nomes(),
    COMANDOS_AURA,
    blocoDeMetadados(metadados),
    dados(metadados),
  ].join("\n\n");
}
