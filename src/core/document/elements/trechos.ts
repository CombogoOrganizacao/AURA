// O inline de um parágrafo como sai no documento final — passo 4B.2. Texto
// com negrito e itálico, mais o que a tela desenha como decoração e o arquivo
// precisa escrever como texto: as aspas da citação direta e a chamada.
//
// Até este passo o exportador juntava `text` dos nós e jogava fora toda marca.
// O itálico do aluno sumia do `.docx`, e a lista de referências (4.11) saía
// sem nenhuma chamada no corpo que a ligasse ao texto.
//
// **Independente de formato.** Devolve trechos, não `TextRun`: o `.docx`
// (`export/docx/trechos.ts`) os converte hoje, e o `.tex` (6.2.1) e a grade da
// tabela (6.1.3) vão consumir a mesma lista.
//
// **Mesma regra da tela.** Onde a citação começa e termina segue
// `mesmaCitacao()`, a varredura das órfãs (4.8), e o que a chamada diz sai de
// `chamadaDaCitacao()`, a mesma função que o plugin da tela
// (`components/editor/chamadas.ts`) usa. O arquivo não pode dizer uma coisa e
// a tela outra.

import { chamadaDaCitacao, mesmaCitacao } from "../../references/citacoes";
import type { OpcoesChamada } from "../../references/format/inText";
import type { Referencia } from "../../references/types";
import type { AtributosCitacao, NoCitacaoLonga, NoInline, NoTexto } from "../types";

export type PapelTrecho =
  // Texto do aluno, com as marcas dele.
  | "texto"
  // Aspas duplas da citação direta de até três linhas (NBR 10520:2023 §7.1).
  | "aspas"
  // A chamada autor-data, ou o aviso de referência excluída.
  | "chamada"
  // Nota de rodapé (passo 6.1.3c): `texto` é o conteúdo da nota, não algo que
  // saia no meio do parágrafo. Quem converte decide a forma: no `.docx`, a
  // referência de nota do Word, que desenha o expoente e numera sozinha.
  | "nota";

export interface Trecho {
  papel: PapelTrecho;
  texto: string;
  negrito: boolean;
  italico: boolean;
  // Só na chamada: a referência saiu do documento (4.8). O texto é o aviso
  // que a tela mostra, para o arquivo não esconder o que a tela denuncia.
  orfa?: boolean;
}

// Aspas e chamada não herdam o destaque do trecho citado. Nos exemplos da
// 10520:2023 a chamada sai em texto corrido, sem destaque (ao contrário do
// título na referência, 6023 §6.7), e as aspas delimitam a citação, não fazem
// parte dela.
function sinal(papel: "aspas" | "chamada", texto: string, orfa?: boolean): Trecho {
  return orfa === undefined
    ? { papel, texto, negrito: false, italico: false }
    : { papel, texto, negrito: false, italico: false, orfa };
}

function doAluno(no: NoTexto): Trecho {
  const marcas = no.marks ?? [];
  return {
    papel: "texto",
    texto: no.text,
    negrito: marcas.some((marca) => marca.type === "negrito"),
    italico: marcas.some((marca) => marca.type === "italico"),
  };
}

function atributosDe(no: NoTexto): AtributosCitacao | null {
  const marca = no.marks?.find((item) => item.type === "citacao");
  return marca?.type === "citacao" ? marca.attrs : null;
}

// Fecha uma citação inline: aspas de fechamento na direta e, com um espaço,
// a chamada — a mesma sequência que a tela desenha em `decorar()`.
function fecharCitacao(
  attrs: AtributosCitacao,
  references: readonly Referencia[],
  opcoes: OpcoesChamada | undefined,
): Trecho[] {
  const chamada = chamadaDaCitacao(attrs, references, opcoes);
  const fechamento = attrs.modo === "direta_curta" ? [sinal("aspas", "”")] : [];
  return [...fechamento, sinal("chamada", ` ${chamada.texto}`, chamada.orfa)];
}

// Inline de parágrafo, célula de tabela ou citação longa.
//
// A nota de rodapé no meio de uma citação não a parte em duas: se o texto
// depois dela continua a mesma citação, a faixa segue aberta (mesma leitura
// de `coletarDoInline()` em references/citacoes.ts). Se não continua, a
// citação fecha ANTES da nota, e o expoente sai depois da chamada:
// "(Silva, 2020)¹", não "(Silva, 2020" com a nota no meio.
export function trechosDoInline(
  content: readonly NoInline[] | undefined,
  references: readonly Referencia[],
  opcoes?: OpcoesChamada,
): Trecho[] {
  const trechos: Trecho[] = [];
  let aberta: AtributosCitacao | null = null;

  const nos = content ?? [];
  for (const [indice, no] of nos.entries()) {
    if (no.type === "nota_rodape") {
      if (aberta) {
        const seguinte = nos.slice(indice + 1).find((item) => item.type === "text");
        const continua = seguinte?.type === "text" ? atributosDe(seguinte) : null;
        if (!(continua && mesmaCitacao(aberta, continua))) {
          trechos.push(...fecharCitacao(aberta, references, opcoes));
          aberta = null;
        }
      }
      trechos.push({ papel: "nota", texto: no.texto, negrito: false, italico: false });
      continue;
    }

    const attrs = atributosDe(no);

    // Nó vizinho com a MESMA citação continua a faixa: uma palavra em itálico
    // no meio do excerto parte o texto em dois nós, e não em duas citações.
    if (aberta && !(attrs && mesmaCitacao(aberta, attrs))) {
      trechos.push(...fecharCitacao(aberta, references, opcoes));
      aberta = null;
    }
    if (attrs && !aberta) {
      if (attrs.modo === "direta_curta") trechos.push(sinal("aspas", "“"));
      aberta = attrs;
    }
    trechos.push(doAluno(no));
  }

  if (aberta) trechos.push(...fecharCitacao(aberta, references, opcoes));
  return trechos;
}

// Citação longa: a ligação é do bloco, e a chamada vai no fim do conteúdo
// (10520 §7.1.1, exemplo: "... de qualquer dimensão (Nichols, 1993, p. 181).").
// Sem aspas: a citação longa é "sem aspas" (§7.1.1). Sem `refId`, nada é
// acrescentado: a citação está incompleta, e quem aponta é a conferência.
export function trechosDaCitacaoLonga(
  no: NoCitacaoLonga,
  references: readonly Referencia[],
  opcoes?: OpcoesChamada,
): Trecho[] {
  const trechos = trechosDoInline(no.content, references, opcoes);
  if (!no.refId) return trechos;

  const chamada = chamadaDaCitacao(
    { refId: no.refId, pagina: no.pagina || null },
    references,
    opcoes,
  );
  return [...trechos, sinal("chamada", ` ${chamada.texto}`, chamada.orfa)];
}
