import { convertMillimetersToTwip } from "docx";

// Constantes ABNT (NBR 14724, seção 5) — porte 1:1 de `poc/docx/gerar.js`
// (ver docs/aura-poc-exportador-docx.md e docs/porte-poc.md para o que ficou
// de fora deste porte). Valores conferidos na PoC; não reajustar um número
// aqui sem reconferir no Word (ver CLAUDE.md, "Verificação").
//
// OOXML mede posição e espaçamento em twips (1/20 de ponto = 1/1440 de
// polegada) e tamanho de fonte em meio-pontos (`size: 24` = 12pt) — por isso
// a conversão de cm pra twips abaixo, e por isso `tamanhoCorpo`/`tamanhoMenor`
// já saem em meio-pontos, não em pontos.
const cm = (centimetros: number) => convertMillimetersToTwip(centimetros * 10);

export const ABNT = {
  margem: { top: cm(3), left: cm(3), bottom: cm(2), right: cm(2) },
  // Número da página a 2 cm da borda (distância do cabeçalho até o topo).
  distanciaCabecalho: cm(2),
  fonte: "Times New Roman",
  tamanhoCorpo: 24, // meio-pontos -> 12pt
  tamanhoMenor: 20, // meio-pontos -> 10pt
  espacamento15: 360, // 240 = simples; 360 = 1,5 linhas
  espacamento1: 240,
  recuoParagrafo: cm(1.25),
  recuoCitacao: cm(4),
  paginaA4: { width: cm(21), height: cm(29.7) },
  larguraUtil: cm(16), // 21 - 3 (margem esquerda) - 2 (margem direita)
  // Altura máxima da imagem de uma figura (passo 6.1.2). **Convenção do AURA,
  // não da norma**: a mancha útil da A4 tem 24,7 cm (29,7 - 3 - 2), e 18 cm
  // deixam lugar, na mesma página, para a legenda acima e a fonte abaixo.
  alturaMaximaFigura: cm(18),
  // A NBR 14724:2024 §5.2 manda espaço simples em citação longa, notas,
  // referências, legendas e natureza do trabalho — e **não** lista o resumo.
  // A NBR 6028:2021 §3.2 fecha a questão do outro lado: "a apresentação
  // gráfica deve seguir o padrão do documento no qual está inserido", ou seja,
  // o 1,5 do corpo. Era escolha explícita por omissão das normas até
  // 18/09/2026; agora tem base nas duas. O `false` continua certo — a
  // constante fica porque virá preset de instituição que peça o contrário.
  resumoEspacoSimples: false,
} as const;
