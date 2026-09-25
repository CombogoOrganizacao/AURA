import { ROTULO_FIGURA, ROTULO_TABELA } from "../../document/elements/legenda";
import { numerarFiguras, numerarTabelas } from "../../document/numbering";
import type { Documento, NoNumeravel } from "../../document/types";
import type { Achado, Verificacao } from "../compliance";
import { localDoNo, textoCorrido } from "./percorrer";

// Ilustrações e tabelas — NBR 14724:2024 §5.8 e §5.9, lidos no PDF em
// 23/09/2026.
//
// Só o corpo (seções): é onde figura e tabela são numeradas
// (`numerarFiguras()`), e dentro de apêndice o exportador ainda não as
// exporta (`export/docx/posTextuais.ts`).

const ITEM = { figura: "NBR 14724:2024 §5.8", tabela: "NBR 14724:2024 §5.9" } as const;
const ROTULO = { figura: ROTULO_FIGURA, tabela: ROTULO_TABELA } as const;

interface Numeravel {
  no: NoNumeravel;
  numero: number;
  local: ReturnType<typeof localDoNo>;
}

function numeraveis(documento: Documento): Numeravel[] {
  const figuras = numerarFiguras(documento.sections);
  const tabelas = numerarTabelas(documento.sections);
  const saida: Numeravel[] = [];
  for (const secao of [...documento.sections].sort((a, b) => a.ordem - b.ordem)) {
    secao.content.forEach((no, indice) => {
      if (no.type !== "figura" && no.type !== "tabela") return;
      const numero = (no.type === "figura" ? figuras : tabelas).get(no.id) ?? 0;
      saida.push({ no, numero, local: localDoNo({ tipo: "secao", id: secao.id }, indice) });
    });
  }
  return saida;
}

// Os números citados no texto para um rótulo: "Figura 3", "figura 3",
// "Figuras 2 e 3", "Figuras 1, 2 e 4", "Figuras 2 a 5". A caixa não importa: a
// norma não a fixa, e "conforme a figura 3" no meio da frase cita a figura 3.
function numerosCitados(texto: string, rotulo: string): Set<number> {
  const citados = new Set<number>();
  const padrao = new RegExp(
    `(?<![\\p{L}])${rotulo}s?\\s+(\\d+(?:\\s*(?:,|e|a|-|–)\\s*\\d+)*)(?![\\p{L}\\p{N}])`,
    "giu",
  );
  for (const [, lista] of texto.matchAll(padrao)) {
    const partes = lista.split(/\s*(,|e|a|-|–)\s*/u);
    let anterior: number | null = null;
    let intervalo = false;
    for (const parte of partes) {
      if (parte === "a" || parte === "-" || parte === "–") {
        intervalo = true;
      } else if (parte === "," || parte === "e") {
        intervalo = false;
      } else {
        const numero = Number(parte);
        if (intervalo && anterior !== null) {
          for (let n = anterior; n <= numero; n++) citados.add(n);
        } else {
          citados.add(numero);
        }
        anterior = numero;
        intervalo = false;
      }
    }
  }
  return citados;
}

// §5.8: "A ilustração DEVE ser citada no texto e inserida o mais próximo
// possível do trecho a que se refere." §5.9, para tabelas: "Devem ser citadas
// no texto, inseridas o mais próximo possível do trecho a que se referem". A
// norma não diz que a citação vem antes: basta aparecer no texto.
export const ilustracaoCitada: Verificacao = {
  regra: "ilustracao-citada",
  verificar: ({ documento }) => {
    const texto = [...documento.sections]
      .sort((a, b) => a.ordem - b.ordem)
      .flatMap((secao) => secao.content.map(textoCorrido))
      .join("\n");
    const citadas = {
      figura: numerosCitados(texto, ROTULO_FIGURA),
      tabela: numerosCitados(texto, ROTULO_TABELA),
    };

    return numeraveis(documento)
      .filter(({ no, numero }) => !citadas[no.type].has(numero))
      .map(({ no, numero, local }) => ({
        gravidade: "erro" as const,
        item: ITEM[no.type],
        mensagem: `${ROTULO[no.type]} ${numero} não é citada no texto. A norma pede que ${no.type === "figura" ? "a ilustração" : "a tabela"} seja citada e fique perto do trecho a que se refere.`,
        local,
      }));
  },
};

// §5.8: "Imediatamente após a ilustração, DEVE ser indicada a fonte
// consultada [...]. A ilustração produzida pelo autor, para o trabalho
// apresentado, deve conter na fonte esta informação: elaborado pelo próprio
// autor ou elaboração própria ou o próprio autor, entre outros." §5.9 diz o
// mesmo das tabelas. A fonte é obrigatória mesmo na produção própria.
export const ilustracaoComFonte: Verificacao = {
  regra: "ilustracao-com-fonte",
  verificar: ({ documento }) =>
    numeraveis(documento)
      .filter(({ no }) => !no.fonte.trim())
      .map(({ no, numero, local }) => ({
        gravidade: "erro" as const,
        item: ITEM[no.type],
        mensagem: `${ROTULO[no.type]} ${numero} está sem fonte. A fonte é obrigatória, mesmo quando a produção é sua: nesse caso, indique que foi elaborada pelo próprio autor.`,
        local,
      })),
};

// Título da legenda, obrigação nas duas — erro. Figura: §5.8, "precedido por
// sua palavra designativa [...], seguida de seu número de ordem [...], de
// travessão e do respectivo título". Tabela: o §5.9 remete às normas de
// apresentação tabular do IBGE (3. ed., 1993), e o §4.2 delas diz "Toda
// tabela deve ter título, inscrito no topo". Era aviso sem item até o passo
// 6.1.3, quando o documento do IBGE foi lido na fonte primária.
const ITEM_TITULO_TABELA = "IBGE, Normas de apresentação tabular (1993) §4.2";

export const ilustracaoComTitulo: Verificacao = {
  regra: "ilustracao-com-titulo",
  verificar: ({ documento }) =>
    numeraveis(documento)
      .filter(({ no }) => !no.legenda.trim())
      .map(({ no, numero, local }): Omit<Achado, "regra"> =>
        no.type === "figura"
          ? {
              gravidade: "erro",
              item: ITEM.figura,
              mensagem: `${ROTULO_FIGURA} ${numero} está sem título na legenda. A norma pede palavra designativa, número, travessão e título.`,
              local,
            }
          : {
              gravidade: "erro",
              item: ITEM_TITULO_TABELA,
              mensagem: `${ROTULO_TABELA} ${numero} está sem título. Toda tabela deve ter título, acima dela, dizendo o que os dados são, onde e quando.`,
              local,
            },
      ),
};
