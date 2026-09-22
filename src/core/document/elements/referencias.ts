import { formatarReferencia, type TrechoReferencia } from "../../references/format/abnt";
import { ordenarReferencias } from "../../references/sort";
import type { Referencia } from "../../references/types";
import { TITULO_REFERENCIAS } from "./posTextual";

// O elemento "Referências" — passo 4.11. Conferido no texto integral das
// normas, em 22/09/2026:
// - NBR 14724:2024 §4.2.3.1: "Elemento obrigatório. Devem ser elaboradas
//   conforme a ABNT NBR 6023"; é o primeiro dos pós-textuais (a ordem vem de
//   `../order.ts`);
// - §5.2.3: o título "referências" é dos títulos sem indicativo numérico,
//   centralizado — quem o desenha é o estilo `TituloPosTextual`;
// - NBR 6023:2025 §6.7: "ordenadas em uma única lista", com o recurso
//   tipográfico do título uniforme em todas;
// - §9.1: ordem alfabética — `ordenarReferencias()` (4.4);
// - §6.3 e 14724 §5.2: espaço simples, alinhadas à margem esquerda, uma linha
//   em branco entre elas. Isso é disposição na página, e fica com o
//   exportador (`export/docx/posTextuais.ts`).
//
// Este módulo monta o CONTEÚDO — que entradas, em que ordem, com que trechos —
// e não sabe nada de OOXML, pelo mesmo motivo de `gerarApendices()` e
// `gerarSumario()`: a tela e o `.docx` precisam da mesma lista.
//
// Recebe `Referencia[]`, não `Documento`: é tudo o que a lista precisa saber.

export interface EntradaListaReferencias {
  // O `id` da referência, para a tela ligar a linha ao cadastro sem depender
  // da posição — a posição muda a cada sobrenome corrigido.
  id: string;
  // A referência formatada pela 6023 (4.3), com o papel de cada trecho: quem
  // desenha escolhe o recurso do destaque (§6.7), o core só diz qual é o
  // título.
  trechos: TrechoReferencia[];
}

export interface ListaReferencias {
  titulo: typeof TITULO_REFERENCIAS;
  entradas: EntradaListaReferencias[];
}

// Sem referência nenhuma, não há lista: o exportador não fabrica um
// "REFERÊNCIAS" vazio. A falta de um elemento obrigatório (§4.2.3.1) é
// assunto da conferência (Fase 5), que a aponta — um título sem nada embaixo
// teria cara de conformidade e não seria.
export function gerarListaReferencias(references: readonly Referencia[]): ListaReferencias | null {
  if (references.length === 0) return null;
  return {
    titulo: TITULO_REFERENCIAS,
    entradas: ordenarReferencias(references).map((referencia) => ({
      id: referencia.id,
      trechos: formatarReferencia(referencia),
    })),
  };
}
