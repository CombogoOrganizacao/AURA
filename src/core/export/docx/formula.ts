import {
  AlignmentType,
  BuilderElement,
  createMathAccentCharacter,
  createMathBase,
  createMathNAryProperties,
  createMathSubScriptElement,
  createMathSuperScriptElement,
  Math as MathDocx,
  MathAngledBrackets,
  MathCurlyBrackets,
  MathFraction,
  MathFunction,
  MathIntegral,
  MathLimitLower,
  MathLimitUpper,
  MathRadical,
  MathRoundBrackets,
  MathRun,
  MathSquareBrackets,
  MathSubScript,
  MathSubSuperScript,
  MathSum,
  MathSuperScript,
  Paragraph,
  TextRun,
  type MathComponent,
  type XmlComponent,
} from "docx";

import type { NoFormula } from "../../document/types";
import { ABNT } from "./constants";
import { mathmlDoLatex, type NoMathml } from "./mathml";

// Fórmula no `.docx` como equação nativa do Word (OMML) — passo 6.1.4.
//
// **OMML, não imagem.** A equação nativa o aluno continua editando no Word,
// sai nítida em qualquer tamanho e é lida por leitor de tela; uma imagem não
// faz nada disso, e desenhá-la exigiria DOM (canvas), que `src/core/` não
// tem. O caminho é LaTeX → MathML (o KaTeX, o mesmo que desenha na tela,
// `mathml.ts`) → OMML, com as peças de equação da biblioteca `docx`. Nunca
// OOXML escrito em string (CLAUDE.md).
//
// **`BuilderElement` em três casos, e só neles:** n-ário com símbolo sem
// classe própria (∏, ∮, ⋃...), acento (x̄, β̂, u⃗) e delimitador com outro
// caractere que não parênteses, colchetes, chaves ou ângulos (|x|, ‖v‖, ⌊x⌋).
// É o construtor genérico da própria biblioteca, o mesmo com que ela monta
// `MathSum` por dentro; a serialização e o escape continuam sendo dela.
//
// **O que não converte fica registrado, não escondido.** `foraDoWord` lista
// o que a equação do Word não recebe (matriz, estilo de letra...), e a tela
// mostra essa lista na própria fórmula (`FormulaView.tsx`), antes da
// exportação. O resto da fórmula sai assim mesmo, o mais perto possível.
//
// Destaque e alinhamento: NBR 14724:2024 §5.7, "recomenda-se que as equações
// e fórmulas sejam destacadas no texto e, se necessário, numeradas com
// algarismos arábicos entre parênteses, alinhados à direita" (lido no PDF no
// passo 6.1.4). Parágrafo próprio e centralizado é o destaque; a v1 não
// numera (ver `src/core/editor/nodes/formula.ts`).

export interface OmmlDaFormula {
  // `null` quando o LaTeX não é válido: sai o código-fonte como texto.
  componentes: MathComponent[] | null;
  // Recursos da fórmula que a equação do Word não recebe, em pt-BR, sem
  // repetição, na ordem em que aparecem.
  foraDoWord: string[];
}

type Registro = Set<string>;

// As classes de equação do `docx` tipam os filhos como `MathComponent`, uma
// união fechada que não inclui `MathLimitLower`/`MathLimitUpper` nem
// `BuilderElement`, embora a própria biblioteca os aceite ali (são todos
// `XmlComponent`, e `MathLimitLower` existe justamente para ir dentro de
// uma equação). A conversão de tipo fica neste ponto só.
function componente(elemento: XmlComponent): MathComponent {
  return elemento as unknown as MathComponent;
}

const APLICACAO_INVISIVEL = new Set(["⁡", "⁢", "⁣", "⁤"]);

// Símbolos n-ários. O integral vai com os limites ao lado (`subSup`), como o
// Word e o LaTeX o desenham; somatório e produtório, acima e abaixo.
const NARIOS: Record<string, "undOvr" | "subSup"> = {
  "∑": "undOvr",
  "∏": "undOvr",
  "∐": "undOvr",
  "⋃": "undOvr",
  "⋂": "undOvr",
  "⋁": "undOvr",
  "⋀": "undOvr",
  "⨁": "undOvr",
  "⨂": "undOvr",
  "∫": "subSup",
  "∬": "subSup",
  "∭": "subSup",
  "∮": "subSup",
};

// Delimitadores de `\left ... \right`: o de abertura e o de fechamento.
const FECHA: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "⟨": "⟩",
  "|": "|",
  "∣": "∣",
  "‖": "‖",
  "∥": "∥",
  "⌊": "⌋",
  "⌈": "⌉",
  "": "",
};

// O KaTeX escreve o acento como caractere de espaçamento (ˉ, ^, ˜...); a
// equação do Word quer o caractere combinante.
const ACENTO_COMBINANTE: Record<string, string> = {
  "ˉ": "̄",
  "¯": "̄",
  "‾": "̅",
  "^": "̂",
  "ˆ": "̂",
  "~": "̃",
  "˜": "̃",
  "˙": "̇",
  "¨": "̈",
  "ˊ": "́",
  "´": "́",
  "ˋ": "̀",
  "`": "̀",
  "ˇ": "̌",
  "˘": "̆",
  "˚": "̊",
  "⃗": "⃗",
};

export function ommlDoLatex(latex: string): OmmlDaFormula {
  const raiz = mathmlDoLatex(latex);
  if (!raiz) return { componentes: null, foraDoWord: [] };
  const registro: Registro = new Set();
  const componentes = lista(raiz.filhos, registro);
  return { componentes, foraDoWord: [...registro] };
}

// Para a tela: o que desta fórmula não chega ao Word. Vazio também quando o
// LaTeX é inválido — aí o aviso que vale é o de erro, que a tela já mostra.
export function recursosForaDoWord(latex: string): string[] {
  return ommlDoLatex(latex).foraDoWord;
}

export function paragrafoFormula(no: NoFormula): Paragraph {
  const { componentes } = ommlDoLatex(no.texto);
  return new Paragraph({
    children: componentes
      ? [new MathDocx({ children: componentes })]
      : [new TextRun(no.texto)],
    alignment: AlignmentType.CENTER,
    spacing: { line: ABNT.espacamento15, before: 120, after: 120 },
  });
}

// --- Conversão ---------------------------------------------------------------

function ehMo(no: NoMathml | undefined, texto?: string): boolean {
  return no?.tag === "mo" && (texto === undefined || no.texto === texto);
}

function ehFence(no: NoMathml | undefined): no is NoMathml {
  return ehMo(no) && no!.atributos.fence === "true";
}

// O operador n-ário no começo de um elemento com limites (`∑_{i=1}^{n}`
// vira `munderover` com `∑` como base) ou sozinho (`\sum x`).
function operadorNario(no: NoMathml): string | null {
  const base = ["munderover", "msubsup", "munder", "mover", "msub", "msup"].includes(no.tag)
    ? no.filhos[0]
    : no;
  if (base?.tag === "mo" && base.texto in NARIOS) return base.texto;
  return null;
}

// `sin x`, `log_2 x`, `lim_{x→0} f`: o KaTeX marca o nome da função com o
// caractere invisível de aplicação de função (U+2061), logo depois dele — ou
// no fim da base, no caso do `lim` com limite embaixo.
function terminaEmAplicacao(no: NoMathml): boolean {
  const ultimo = no.filhos.at(-1);
  if (ehMo(ultimo, "⁡")) return true;
  const base = no.filhos[0];
  return (
    ["munder", "mover", "munderover", "msub", "msup", "msubsup"].includes(no.tag) &&
    base !== undefined &&
    terminaEmAplicacao(base)
  );
}

// Uma sequência de irmãos. É aqui, e não em `converter()`, que se resolve o
// que depende do vizinho: o par de delimitadores de `\left ... \right`, o
// argumento de uma função e o termo de um somatório.
function lista(nos: readonly NoMathml[], registro: Registro): MathComponent[] {
  const saida: MathComponent[] = [];

  for (let i = 0; i < nos.length; i++) {
    const no = nos[i];

    if (no.tag === "annotation" || no.tag === "annotation-xml") continue;
    if (no.tag === "mo" && APLICACAO_INVISIVEL.has(no.texto)) continue;

    if (ehFence(no) && no.texto in FECHA) {
      const fim = fechamento(nos, i);
      if (fim !== -1) {
        saida.push(delimitado(no.texto, nos[fim].texto, lista(nos.slice(i + 1, fim), registro)));
        i = fim;
        continue;
      }
    }

    const nario = operadorNario(no);
    if (nario) {
      // O termo do somatório é o irmão seguinte. O que vem depois dele fica
      // fora do n-ário, logo ao lado — no Word se vê igual.
      const termo = nos[i + 1] && !ehMo(nos[i + 1]) ? nos[i + 1] : undefined;
      saida.push(elementoNario(nario, no, termo ? converter(termo, registro) : [], registro));
      if (termo) i += 1;
      continue;
    }

    const seguinte = nos[i + 1];
    // Nome de função sem nada depois: é o `lim` dentro do próprio limite
    // (`munder`), e a função já é montada um nível acima, com o argumento.
    if (ehMo(seguinte, "⁡") && nos[i + 2] === undefined) {
      saida.push(...converter(no, registro));
      i += 1;
      continue;
    }
    if (ehMo(seguinte, "⁡") ||(no.tag !== "mrow" && terminaEmAplicacao(no))) {
      const pulo = ehMo(seguinte, "⁡") ? 1 : 0;
      const argumento = nos[i + 1 + pulo];
      saida.push(
        new MathFunction({
          name: converter(no, registro),
          children: argumento ? converter(argumento, registro) : [],
        }),
      );
      i += pulo + (argumento ? 1 : 0);
      continue;
    }

    saida.push(...converter(no, registro));
  }

  return saida;
}

// O índice do delimitador que fecha o aberto em `inicio`, contando os pares
// aninhados. -1 se não houver (aí o delimitador sai como caractere solto).
function fechamento(nos: readonly NoMathml[], inicio: number): number {
  const pilha = [FECHA[nos[inicio].texto]];
  for (let j = inicio + 1; j < nos.length; j++) {
    const no = nos[j];
    if (!ehFence(no)) continue;
    if (no.texto === pilha[pilha.length - 1]) {
      pilha.pop();
      if (pilha.length === 0) return j;
    } else if (no.texto in FECHA) {
      pilha.push(FECHA[no.texto]);
    }
  }
  return -1;
}

function delimitado(abre: string, fecha: string, filhos: MathComponent[]): MathComponent {
  if (abre === "(" && fecha === ")") return new MathRoundBrackets({ children: filhos });
  if (abre === "[" && fecha === "]") return new MathSquareBrackets({ children: filhos });
  if (abre === "{" && fecha === "}") return new MathCurlyBrackets({ children: filhos });
  if (abre === "⟨" && fecha === "⟩") return new MathAngledBrackets({ children: filhos });
  return componente(
    new BuilderElement({
      name: "m:d",
      children: [
        new BuilderElement({
          name: "m:dPr",
          children: [
            new BuilderElement<{ val: string }>({
              name: "m:begChr",
              attributes: { val: { key: "m:val", value: abre } },
            }),
            new BuilderElement<{ val: string }>({
              name: "m:endChr",
              attributes: { val: { key: "m:val", value: fecha } },
            }),
          ],
        }),
        createMathBase({ children: filhos }),
      ],
    }),
  );
}

function limitesDe(no: NoMathml): { inferior?: NoMathml; superior?: NoMathml } {
  const [, a, b] = no.filhos;
  switch (no.tag) {
    case "munderover":
    case "msubsup":
      return { inferior: a, superior: b };
    case "munder":
    case "msub":
      return { inferior: a };
    case "mover":
    case "msup":
      return { superior: a };
    default:
      return {};
  }
}

function elementoNario(
  simbolo: string,
  no: NoMathml,
  termo: MathComponent[],
  registro: Registro,
): MathComponent {
  const { inferior, superior } = limitesDe(no);
  const subScript = inferior ? converter(inferior, registro) : undefined;
  const superScript = superior ? converter(superior, registro) : undefined;

  if (simbolo === "∑") return new MathSum({ children: termo, subScript, superScript });
  if (simbolo === "∫") return new MathIntegral({ children: termo, subScript, superScript });

  return componente(
    new BuilderElement({
      name: "m:nary",
      children: [
        createMathNAryProperties({
          accent: simbolo,
          hasSubScript: !!subScript,
          hasSuperScript: !!superScript,
          limitLocationVal: NARIOS[simbolo],
        }),
        ...(subScript ? [createMathSubScriptElement({ children: subScript })] : []),
        ...(superScript ? [createMathSuperScriptElement({ children: superScript })] : []),
        createMathBase({ children: termo }),
      ],
    }),
  );
}

function acento(base: MathComponent[], combinante: string): MathComponent {
  return componente(
    new BuilderElement({
      name: "m:acc",
      children: [
        new BuilderElement({
          name: "m:accPr",
          children: [createMathAccentCharacter({ accent: combinante })],
        }),
        createMathBase({ children: base }),
      ],
    }),
  );
}

// Texto de um elemento e de tudo dentro dele — para o acento sobre texto
// (`\text{média}`, que o KaTeX parte em "m", "e" + acento, "dia").
function textoDe(no: NoMathml): string {
  return no.texto + no.filhos.map(textoDe).join("");
}

function converter(no: NoMathml, registro: Registro): MathComponent[] {
  const [a, b] = no.filhos;

  switch (no.tag) {
    case "math":
    case "mrow":
    case "mstyle":
    case "mpadded":
    case "mtd":
      return lista(no.filhos, registro);
    case "semantics":
      // O primeiro filho é a fórmula; o resto é a anotação com o LaTeX.
      return a ? converter(a, registro) : [];

    case "mi":
    case "mn":
    case "mo":
    case "mtext":
    case "ms": {
      const variante = no.atributos.mathvariant;
      if (variante && variante !== "normal" && variante !== "italic") {
        registro.add("estilo de letra (\\mathbf, \\mathcal, \\mathbb…)");
      }
      return no.texto ? [new MathRun(no.texto)] : [];
    }
    case "mspace":
    case "mphantom":
      return [];

    case "mfrac":
      if (no.atributos.linethickness === "0px" || no.atributos.linethickness === "0") {
        registro.add("coeficiente binomial (\\binom), sai como fração");
      }
      return [
        new MathFraction({
          numerator: a ? converter(a, registro) : [],
          denominator: b ? converter(b, registro) : [],
        }),
      ];
    case "msqrt":
      return [new MathRadical({ children: lista(no.filhos, registro) })];
    case "mroot":
      return [
        new MathRadical({
          children: a ? converter(a, registro) : [],
          degree: b ? converter(b, registro) : [],
        }),
      ];

    case "msup":
      return [
        new MathSuperScript({
          children: a ? converter(a, registro) : [],
          superScript: b ? converter(b, registro) : [],
        }),
      ];
    case "msub":
      return [
        new MathSubScript({
          children: a ? converter(a, registro) : [],
          subScript: b ? converter(b, registro) : [],
        }),
      ];
    case "msubsup":
      return [
        new MathSubSuperScript({
          children: a ? converter(a, registro) : [],
          subScript: b ? converter(b, registro) : [],
          superScript: no.filhos[2] ? converter(no.filhos[2], registro) : [],
        }),
      ];

    case "mover": {
      const sinal = b?.tag === "mo" ? ACENTO_COMBINANTE[b.texto] : undefined;
      if (no.atributos.accent === "true" && sinal) {
        // Acento sobre texto comum vira a letra acentuada, que é o que ele é.
        if (a && (a.tag === "mtext" || a.tag === "mi") && a.texto.length === 1) {
          const letra = (textoDe(a) + sinal).normalize("NFC");
          if (letra.length === 1) return [new MathRun(letra)];
        }
        return [acento(a ? converter(a, registro) : [], sinal)];
      }
      return [
        componente(
          new MathLimitUpper({
            children: a ? converter(a, registro) : [],
            limit: b ? converter(b, registro) : [],
          }),
        ),
      ];
    }
    case "munder":
      return [
        componente(
          new MathLimitLower({
            children: a ? converter(a, registro) : [],
            limit: b ? converter(b, registro) : [],
          }),
        ),
      ];
    case "munderover":
      return [
        componente(
          new MathLimitLower({
            children: [
              componente(
                new MathLimitUpper({
                  children: a ? converter(a, registro) : [],
                  limit: no.filhos[2] ? converter(no.filhos[2], registro) : [],
                }),
              ),
            ],
            limit: b ? converter(b, registro) : [],
          }),
        ),
      ];

    case "mtable":
      // Matriz, sistema de equações, `aligned`: a equação do Word tem
      // matriz (`m:m`), mas a biblioteca não, e montá-la por fora seria o
      // OOXML à mão que o projeto recusa. Sai linha por linha, separada por
      // ponto e vírgula, e a tela avisa.
      registro.add("matriz ou equações alinhadas (\\begin{…})");
      return no.filhos.flatMap((linha, indice) => [
        ...(indice > 0 ? [new MathRun("; ")] : []),
        ...linha.filhos.flatMap((celula, coluna) => [
          ...(coluna > 0 ? [new MathRun("  ")] : []),
          ...converter(celula, registro),
        ]),
      ]);
    case "menclose":
      registro.add("moldura ou risco (\\boxed, \\cancel)");
      return lista(no.filhos, registro);

    default:
      registro.add(`elemento de fórmula “${no.tag}”`);
      return lista(no.filhos, registro);
  }
}
