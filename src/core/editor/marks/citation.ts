import { Mark, mergeAttributes } from "@tiptap/core";

import type { AtributosCitacao, FonteOriginal, ModoCitacao } from "../../document/types";
import type { CSLDate } from "../../references/types";

// Marca `citacao` — docs/schema-tiptap.md §5.2, passo 4.8. Arquivo em inglês
// (`citation.ts`, como o passo pede), nome do domínio no `name`, a mesma
// convenção de `longQuote.ts` → `citacao_longa`.
//
// **O trecho marcado é o texto do aluno; a chamada não está em lugar nenhum
// do dado.** A marca guarda só a ligação (`refId`) e o que a chamada precisa
// saber sobre ESTA citação (modo, página, fonte original do apud). O
// "(Silva, 2019, p. 45)" é sintetizado na hora de exibir e de exportar (4.9),
// a partir destes atributos e dos dados da referência. Ver o comentário de
// `AtributosCitacao` em src/core/document/types.ts.
//
// **Não nasce de conteúdo colado.** Todo HTML colado passa por
// `mapearHtmlColado()` (src/core/editor/paste.ts), que só produz parágrafo,
// negrito e itálico — a regra de CLAUDE.md "nenhum HTML bruto no schema"
// continua valendo sem exceção. O `parseHTML` abaixo existe para o
// ProseMirror reconhecer a marca que ele mesmo desenhou, e ainda assim passa
// pelo mesmo validador da serialização.

export const MODOS_CITACAO: readonly ModoCitacao[] = ["direta_curta", "indireta"];

export const Citacao = Mark.create({
  name: "citacao",

  // Digitar logo depois de uma citação NÃO estende a marca: a frase seguinte
  // do aluno não é parte do excerto citado. Mesmo motivo de um link.
  inclusive: false,

  // O padrão do ProseMirror já faz uma marca excluir outra do mesmo tipo:
  // um trecho aponta para UMA referência. Citar duas obras sobre a mesma
  // passagem é uma chamada com duas entradas (10520 §6.1.8), assunto do 4.9.

  addAttributes() {
    return {
      refId: { default: null },
      modo: { default: "indireta" },
      pagina: { default: null },
      apud: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-citacao]",
        getAttrs: (elemento) => {
          let apud: unknown = null;
          const cru = elemento.getAttribute("data-apud");
          if (cru) {
            try {
              apud = JSON.parse(cru);
            } catch {
              return false;
            }
          }
          const atributos = lerAtributosCitacao({
            refId: elemento.getAttribute("data-ref-id"),
            modo: elemento.getAttribute("data-modo"),
            pagina: elemento.getAttribute("data-pagina"),
            apud,
          });
          return atributos ?? false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const { refId, modo, pagina, apud } = mark.attrs as AtributosCitacao;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-citacao": "",
        "data-ref-id": refId,
        "data-modo": modo,
        ...(pagina !== null ? { "data-pagina": pagina } : {}),
        ...(apud !== null ? { "data-apud": JSON.stringify(apud) } : {}),
      }),
      0,
    ];
  },
});

export default Citacao;

// --- Validação ---------------------------------------------------------------
// Uma função só, usada pela serialização (editor → canônico) e pelo
// `parseHTML`. Atributo que não tem a forma certa torna a marca inválida
// inteira, em vez de ser corrigido para um padrão: uma citação com `refId`
// inventado apontaria para a referência errada com cara de certa.

export function lerAtributosCitacao(valor: unknown): AtributosCitacao | null {
  if (!ehObjeto(valor)) return null;
  const { refId, modo, pagina, apud } = valor;

  if (typeof refId !== "string" || refId === "") return null;
  if (typeof modo !== "string" || !(MODOS_CITACAO as readonly string[]).includes(modo)) {
    return null;
  }
  if (pagina !== null && pagina !== undefined && typeof pagina !== "string") return null;

  let fonteOriginal: FonteOriginal | null = null;
  if (apud !== null && apud !== undefined) {
    fonteOriginal = lerFonteOriginal(apud);
    if (!fonteOriginal) return null;
  }

  return {
    refId,
    modo: modo as ModoCitacao,
    pagina: typeof pagina === "string" ? pagina : null,
    apud: fonteOriginal,
  };
}

function lerFonteOriginal(valor: unknown): FonteOriginal | null {
  if (!ehObjeto(valor)) return null;
  const { author, issued, pagina } = valor;

  if (!Array.isArray(author) || author.length === 0 || !author.every(ehNome)) return null;
  const data = issued === undefined ? undefined : lerData(issued);
  if (data === null) return null;
  if (pagina !== null && pagina !== undefined && typeof pagina !== "string") return null;

  return {
    author: author.map(({ family, given, literal }) => ({
      ...(typeof family === "string" ? { family } : {}),
      ...(typeof given === "string" ? { given } : {}),
      ...(typeof literal === "string" ? { literal } : {}),
    })),
    ...(data ? { issued: data } : {}),
    pagina: typeof pagina === "string" ? pagina : null,
  };
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function ehNome(valor: unknown): valor is Record<string, unknown> {
  if (!ehObjeto(valor)) return false;
  const campos = [valor.family, valor.given, valor.literal];
  return (
    campos.every((campo) => campo === undefined || typeof campo === "string") &&
    campos.some((campo) => typeof campo === "string" && campo !== "")
  );
}

function lerData(valor: unknown): CSLDate | null {
  if (!ehObjeto(valor)) return null;
  const { "date-parts": partes, raw } = valor;
  if (raw !== undefined && typeof raw !== "string") return null;
  if (partes === undefined) return typeof raw === "string" ? { raw } : null;

  const valido =
    Array.isArray(partes) &&
    partes.length > 0 &&
    partes.every(
      (parte) =>
        Array.isArray(parte) &&
        parte.length >= 1 &&
        parte.length <= 3 &&
        parte.every((numero) => Number.isInteger(numero)),
    );
  if (!valido) return null;
  return {
    "date-parts": (partes as number[][]).map((parte) => [...parte] as [number, number?, number?]),
    ...(typeof raw === "string" ? { raw } : {}),
  };
}
