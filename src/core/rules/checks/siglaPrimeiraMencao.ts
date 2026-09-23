import { padraoSigla } from "../../document/elements/abreviaturas";
import type { Documento } from "../../document/types";
import type { LocalAchado, Verificacao } from "../compliance";
import { localDoNo, textoInline } from "./percorrer";

// Sigla na primeira menção — NBR 14724:2024 §5.6, lido no PDF em 23/09/2026:
// "A sigla, quando mencionada pela primeira vez no texto, DEVE ser indicada
// entre parênteses, precedida pelo nome completo." EXEMPLO: "Associação
// Brasileira de Normas Técnicas (ABNT)".
//
// Confere o que o aluno cadastrou em "Abreviaturas e siglas": o AURA não
// adivinha o que é sigla, nem escreve o nome completo (CLAUDE.md, "Identidade
// e limite de produto"). A busca usa `padraoSigla()`, a mesma noção de
// "palavra inteira" que decide quem entra na lista de abreviaturas, e o mesmo
// escopo: o corpo (seções), com títulos, legendas e células. Sigla cadastrada
// que não aparece no texto não é achado daqui: o painel de abreviaturas já
// avisa que ela fica fora da lista.

interface Trecho {
  texto: string;
  local: (inicio: number, fim: number) => LocalAchado;
}

// Os textos do corpo na ordem de leitura. Só parágrafo e citação longa
// levam o trecho em caracteres: nos outros, a posição não tem para onde
// apontar dentro do nó.
function trechosDoCorpo(documento: Documento): Trecho[] {
  const trechos: Trecho[] = [];
  for (const secao of [...documento.sections].sort((a, b) => a.ordem - b.ordem)) {
    const onde = { tipo: "secao" as const, id: secao.id };
    trechos.push({ texto: secao.titulo, local: () => ({ tipo: "bloco", onde }) });

    secao.content.forEach((no, indice) => {
      if (no.type === "paragraph" || no.type === "citacao_longa") {
        trechos.push({
          texto: textoInline(no.content),
          local: (inicio, fim) => localDoNo(onde, indice, { inicio, fim }),
        });
      } else if (no.type === "figura" || no.type === "tabela") {
        const local = () => localDoNo(onde, indice);
        trechos.push({ texto: no.legenda, local }, { texto: no.fonte, local });
        if (no.type === "tabela") {
          for (const linha of no.linhas) {
            for (const celula of linha.celulas) {
              trechos.push({ texto: textoInline(celula.content), local });
            }
          }
        }
      }
    });
  }
  return trechos;
}

function normalizar(texto: string): string {
  return texto.replace(/\s+/gu, " ").trim().toLocaleLowerCase("pt-BR");
}

// "Nome completo (SIGLA)": o texto logo antes da sigla termina com o
// significado cadastrado e um parêntese, e logo depois vem o parêntese de
// fechamento. Caixa e espaços do nome completo não contam: "associação
// brasileira..." no meio da frase é o mesmo nome.
function naFormaDaNorma(texto: string, inicio: number, fim: number, significado: string): boolean {
  const antes = normalizar(texto.slice(0, inicio));
  const depois = texto.slice(fim).trimStart();
  return antes.endsWith(`${normalizar(significado)} (`) && depois.startsWith(")");
}

export const siglaPrimeiraMencao: Verificacao = {
  regra: "sigla-primeira-mencao",
  verificar: ({ documento }) => {
    const trechos = trechosDoCorpo(documento);

    return (documento.metadados.abreviaturas ?? [])
      .filter((abreviatura) => abreviatura.sigla.trim() && abreviatura.significado.trim())
      .flatMap((abreviatura) => {
        for (const trecho of trechos) {
          const achado = padraoSigla(abreviatura.sigla).exec(trecho.texto);
          if (!achado) continue;

          const inicio = achado.index;
          const fim = inicio + achado[0].length;
          if (naFormaDaNorma(trecho.texto, inicio, fim, abreviatura.significado)) return [];
          return [
            {
              gravidade: "erro" as const,
              item: "NBR 14724:2024 §5.6",
              mensagem: `Na primeira vez em que aparece, a sigla ${abreviatura.sigla.trim()} deve vir entre parênteses, depois do nome completo: "${abreviatura.significado.trim()} (${abreviatura.sigla.trim()})".`,
              local: trecho.local(inicio, fim),
            },
          ];
        }
        return [];
      });
  },
};
