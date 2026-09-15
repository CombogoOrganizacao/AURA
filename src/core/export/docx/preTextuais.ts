import { AlignmentType, PageBreak, Paragraph, TextRun } from "docx";

import type { Metadados } from "../../document/types";
import { ABNT } from "./constants";

// Resumo e abstract (NBR 6028) — passo 3.5.2. **Porte de `poc/docx/gerar.js`**
// (bloco "SEÇÃO 2 — Pré-textuais", `RESUMO`/`ABSTRACT`), congelada e
// conferida no Word: mesma estrutura de parágrafos, mesmo rótulo em negrito
// em run separado, mesma quebra de página entre um elemento e o outro. Não
// é código novo — o que mudou em relação à PoC é só a origem dos dados
// (`Metadados` de verdade, não as strings literais do script) e a omissão
// condicional, que a PoC não tinha porque lá todo campo estava sempre
// preenchido.
//
// Capa e folha de rosto (`src/core/document/elements/`, passo 3.5.1)
// continuam sem gerador de `.docx`: a PoC monta a folha de rosto no mesmo
// array, mas ligar isso aqui é outro passo. Sumário e listas: 3.6.1+.
//
// NBR 6028 pede parágrafo único, por isso sem recuo de primeira linha (ao
// contrário do corpo comum, em `fromDocumento.ts`). A norma é omissa sobre
// o espaçamento do resumo — `ABNT.resumoEspacoSimples` é a escolha
// explícita que a PoC já registrava (ver `constants.ts` e
// docs/auditoria-abnt.md); o ternário abaixo é o mesmo da PoC, e existe pra
// que virar a constante mude o resultado de verdade.
const espacoResumo = ABNT.resumoEspacoSimples ? ABNT.espacamento1 : ABNT.espacamento15;

// Mesmo estilo nomeado que `sections.ts` já usa pra "SUMÁRIO" — título fora
// do sumário (NBR 6027), sem nível de estrutura. Movido pra cá porque
// resumo/abstract também precisam dele; `sections.ts` importa daqui agora,
// em vez de declarar a própria cópia.
export function paragrafoTituloPreTextual(texto: string): Paragraph {
  return new Paragraph({ text: texto, style: "TituloPreTextual", keepNext: true });
}

function paragrafoJustificado(texto: string): Paragraph {
  return new Paragraph({
    children: [new TextRun(texto)],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: espacoResumo },
  });
}

// `palavrasChave`/`keywords` são array estruturado em `Metadados` — nunca
// uma string com ponto e vírgula já digitado à mão (mesma regra de
// "referências são objetos CSL-JSON", CLAUDE.md). A junção acontece só
// aqui, na hora de exportar. Dois runs, rótulo em negrito: igual à PoC.
function paragrafoTermos(rotulo: string, termos: string[]): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${rotulo}: `, bold: true }),
      new TextRun(`${termos.join("; ")}.`),
    ],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: espacoResumo },
  });
}

// Espaçador entre o corpo e a linha de termos — a PoC usa um parágrafo
// vazio com `after`, não `spacing` no parágrafo de cima.
function espacador(): Paragraph {
  return new Paragraph({ text: "", spacing: { after: 240 } });
}

function bloco(titulo: string, texto: string, rotuloTermos: string, termos: string[]): Paragraph[] {
  const paragrafos = [paragrafoTituloPreTextual(titulo), paragrafoJustificado(texto)];
  if (termos.length > 0) {
    paragrafos.push(espacador(), paragrafoTermos(rotuloTermos, termos));
  }
  return paragrafos;
}

// Omite o bloco inteiro quando não há texto — não fabrica um "RESUMO" vazio
// só pra ter aparência de conformidade (mesma lógica de
// `metadados.instituicao` em `elements/capa.ts`). Elemento obrigatório que
// falta é assunto de `validarDocumento()`, não do exportador.
export function paragrafosResumo(metadados: Metadados): Paragraph[] {
  if (!metadados.resumo) return [];
  return bloco("RESUMO", metadados.resumo, "Palavras-chave", metadados.palavrasChave);
}

// Abstract é opcional na v1 (docs/aura-decisoes-e-pendencias.md §1.3) — sai
// do `.docx` só quando o campo tem conteúdo. Critério de aceite deste passo.
export function paragrafosAbstract(metadados: Metadados): Paragraph[] {
  if (!metadados.abstract) return [];
  return bloco("ABSTRACT", metadados.abstract, "Keywords", metadados.keywords);
}

// Cada elemento pré-textual começa em página própria (NBR 14724, e é o que
// a PoC faz). A quebra vai ENTRE os blocos, nunca antes do primeiro: a
// seção OOXML já começa numa página nova, e uma quebra à frente dela
// deixaria uma página em branco. Por isso o `join` aqui em vez de cada
// bloco trazer a própria quebra — qual deles é o primeiro depende de quais
// campos a pessoa preencheu.
export function montarPreTextuais(metadados: Metadados): Paragraph[] {
  const blocos = [paragrafosResumo(metadados), paragrafosAbstract(metadados)].filter(
    (paragrafos) => paragrafos.length > 0
  );

  return blocos.flatMap((paragrafos, indice) =>
    indice === 0 ? paragrafos : [new Paragraph({ children: [new PageBreak()] }), ...paragrafos]
  );
}
