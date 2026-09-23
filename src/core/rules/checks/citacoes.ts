import type { Achado, Verificacao } from "../compliance";
import { citacoesLocalizadas } from "./percorrer";

// Citações — NBR 10520:2023, lida no PDF (reconferida em 23/09/2026). Cada
// achado aponta o nó e o trecho da citação, para o painel levar o cursor até
// ela (5.2.3).

function resumirTrecho(texto: string): string {
  const limpo = texto.trim().replace(/\s+/gu, " ");
  return limpo.length > 60 ? `${limpo.slice(0, 57)}...` : limpo;
}

// §5.1: "A citação DEVE permitir sua correlação na lista de referências ou em
// notas." Uma citação cujo `refId` saiu de `Documento.references` não tem com
// quem se correlacionar. O texto do aluno fica intacto (passo 4.8); a tela e o
// `.docx` mostram "(referência excluída)" no lugar da chamada.
export const citacaoOrfa: Verificacao = {
  regra: "citacao-orfa",
  verificar: ({ documento }) => {
    const existentes = new Set(documento.references.map((referencia) => referencia.id));
    return citacoesLocalizadas(documento)
      .filter((citacao) => {
        const refId = citacao.forma === "marca" ? citacao.attrs.refId : citacao.refId;
        return refId !== null && !existentes.has(refId);
      })
      .map((citacao) => ({
        gravidade: "erro" as const,
        item: "NBR 10520:2023 §5.1",
        mensagem: `A citação "${resumirTrecho(citacao.texto)}" aponta para uma referência que foi excluída. Ligue-a a uma referência da lista.`,
        local: citacao.local,
      }));
  },
};

// §7.1: "A indicação da fonte DEVE ser conforme o sistema de chamada adotado."
// A citação longa (§7.1.1) sem referência ligada sai sem chamada nenhuma: é
// transcrição sem fonte.
export const citacaoLongaSemReferencia: Verificacao = {
  regra: "citacao-longa-sem-referencia",
  verificar: ({ documento }) =>
    citacoesLocalizadas(documento)
      .filter((citacao) => citacao.forma === "longa" && citacao.refId === null)
      .map((citacao) => ({
        gravidade: "erro" as const,
        item: "NBR 10520:2023 §7.1",
        mensagem: `A citação longa "${resumirTrecho(citacao.texto)}" não está ligada a nenhuma referência, e sai sem indicação da fonte.`,
        local: citacao.local,
      })),
};

// §6.1.3 e §6.1.4: "Em citações diretas, acrescenta-se o número da página ou
// localização, SE HOUVER, após a data." O Exemplo 2 do §6.1.3 cita sem página
// uma fonte não paginada. Por isso AVISO: a fonte pode não ter página. A
// longa também é direta (§7.1.1).
export const citacaoDiretaSemPagina: Verificacao = {
  regra: "citacao-direta-sem-pagina",
  verificar: ({ documento }) =>
    citacoesLocalizadas(documento).flatMap((citacao): Omit<Achado, "regra">[] => {
      const semPagina =
        citacao.forma === "marca"
          ? citacao.attrs.modo === "direta_curta" && !citacao.attrs.pagina?.trim()
          : citacao.refId !== null && !citacao.pagina.trim();
      if (!semPagina) return [];
      return [
        {
          gravidade: "aviso",
          item: "NBR 10520:2023 §6.1.3",
          mensagem: `A citação direta "${resumirTrecho(citacao.texto)}" está sem página. Se a fonte for paginada, informe a página ou a localização.`,
          local: citacao.local,
        },
      ];
    }),
};

// Referência cadastrada e nunca citada. **Convenção, não norma**: a 10520
// §5.1 exige o caminho citação → lista, e nenhum item da 10520:2023 nem da
// 6023:2025 (seção 6, lida no PDF em 23/09/2026) exige o inverso. Por isso
// aviso, com `item: null`: o painel o mostra como conferência de consistência,
// nunca como exigência da NBR. Apud conta como citação da fonte consultada,
// que é o `refId` (10520 §7.3).
export const referenciaNaoCitada: Verificacao = {
  regra: "referencia-nao-citada",
  verificar: ({ documento }) => {
    const citadas = new Set(
      citacoesLocalizadas(documento).map((citacao) =>
        citacao.forma === "marca" ? citacao.attrs.refId : citacao.refId,
      ),
    );
    return documento.references
      .filter((referencia) => !citadas.has(referencia.id))
      .map((referencia) => ({
        gravidade: "aviso" as const,
        item: null,
        mensagem: `"${referencia.title ?? referencia.id}" está na lista de referências mas não é citada no texto. A norma não proíbe; confira se deveria estar.`,
        local: { tipo: "referencia" as const, refId: referencia.id },
      }));
  },
};
