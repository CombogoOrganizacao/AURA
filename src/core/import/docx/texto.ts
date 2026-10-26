import type { Marca, NoInline, NoParagrafo, NoTexto } from "../../document/types";
import { mapearHtmlColado, type NoHtmlColado } from "../../editor/paste";

// O texto do `.docx` na forma do editor (passos 8.7.1 e 8.7.2): parágrafos
// pela regra da colagem (`mapearHtmlColado()`), espaços como o editor os
// guarda, e as notas de rodapé no lugar da chamada.

export function textoDe(no: NoHtmlColado): string {
  return no.tipo === "texto" ? no.texto : no.filhos.map(textoDe).join("");
}

// --- Notas de rodapé ---------------------------------------------------------

// O mammoth põe a chamada da nota como `<sup><a href="#footnote-1">[1]</a>`
// e o texto numa lista (`<ol><li id="footnote-1">`) no fim do HTML. A
// chamada vira um marcador de texto, com o `id` da nota entre dois
// caracteres de uso privado do Unicode, que nenhum texto do Word traz desse
// jeito; depois da regra da colagem, o marcador vira o nó `nota_rodape`. Assim
// `mapearHtmlColado()` continua sem saber de nota nenhuma.
const ABRE_NOTA = "";
const FECHA_NOTA = "";
const MARCADOR_DE_NOTA = /([^]*)/g;

const ID_DE_NOTA = /^(footnote|endnote)-/;
const CHAMADA_DE_NOTA = /^#(footnote|endnote)-/;
const VOLTA_DA_NOTA = /^#(footnote|endnote)-ref-/;

export interface Notas {
  // Texto de cada nota, pelo `id` do mammoth.
  textos: Map<string, string>;
  // As que entraram no texto; as outras ficaram de fora (em título, resumo,
  // célula de tabela ou numa parte que não entra) e viram aviso.
  usadas: Set<string>;
}

function eChamadaDeNota(no: NoHtmlColado): string | null {
  if (no.tipo !== "elemento" || no.tag !== "sup") return null;
  for (const filho of no.filhos) {
    const href = filho.tipo === "elemento" && filho.tag === "a" ? filho.atributos?.href : undefined;
    if (href && CHAMADA_DE_NOTA.test(href)) return href.slice(1);
  }
  return null;
}

export function eListaDeNotas(no: NoHtmlColado): boolean {
  return (
    no.tipo === "elemento" &&
    no.tag === "ol" &&
    no.filhos.length > 0 &&
    no.filhos.every((item) => item.tipo === "elemento" && ID_DE_NOTA.test(item.atributos?.id ?? ""))
  );
}

// O texto da nota, sem a seta que volta para a chamada.
function textoDaNota(no: NoHtmlColado): string {
  if (no.tipo === "texto") return no.texto;
  if (no.tag === "a" && VOLTA_DA_NOTA.test(no.atributos?.href ?? "")) return "";
  return no.filhos.map(textoDaNota).join(" ");
}

function comMarcadores(no: NoHtmlColado): NoHtmlColado {
  if (no.tipo === "texto") return no;
  const id = eChamadaDeNota(no);
  if (id !== null) return { tipo: "texto", texto: `${ABRE_NOTA}${id}${FECHA_NOTA}` };
  return { ...no, filhos: no.filhos.map(comMarcadores) };
}

// Tira as listas de notas do fim e troca cada chamada pelo marcador.
export function separarNotas(raiz: readonly NoHtmlColado[]): {
  blocos: NoHtmlColado[];
  notas: Notas;
} {
  const textos = new Map<string, string>();
  for (const lista of raiz.filter(eListaDeNotas)) {
    if (lista.tipo !== "elemento") continue;
    for (const item of lista.filhos) {
      if (item.tipo === "elemento" && item.atributos?.id) {
        textos.set(item.atributos.id, normal(textoDaNota(item)));
      }
    }
  }
  return {
    blocos: raiz.filter((no) => !eListaDeNotas(no)).map(comMarcadores),
    notas: { textos, usadas: new Set() },
  };
}

// --- Espaços e parágrafos ----------------------------------------------------

// Espaços seguidos viram um, as pontas saem, e o marcador de nota some: é o
// texto de um título, de um termo ou do resumo, onde nota não entra.
export function normal(texto: string): string {
  return texto.replace(MARCADOR_DE_NOTA, "").replace(/\s+/g, " ").trim();
}

function mesmasMarcas(a: NoTexto, b: NoTexto): boolean {
  const tipos = (no: NoTexto) =>
    (no.marks ?? [])
      .map((marca) => marca.type)
      .sort()
      .join();
  return tipos(a) === tipos(b);
}

// O espaço do Word como o editor o guarda: espaços seguidos viram um (o
// tabulador do recuo também), as pontas saem, e trechos vizinhos com as
// mesmas marcas se juntam.
export function limparInline(nos: readonly NoTexto[]): NoTexto[] {
  const saida: NoTexto[] = [];
  for (const no of nos) {
    let texto = no.text.replace(/\s+/g, " ");
    const anterior = saida.at(-1);
    if (anterior?.text.endsWith(" ")) texto = texto.replace(/^ /, "");
    if (!texto) continue;
    if (anterior && mesmasMarcas(anterior, no)) anterior.text += texto;
    else
      saida.push(
        no.marks ? { type: "text", text: texto, marks: no.marks } : { type: "text", text: texto },
      );
  }
  if (saida[0]) saida[0].text = saida[0].text.trimStart();
  const ultimo = saida.at(-1);
  if (ultimo) ultimo.text = ultimo.text.trimEnd();
  return saida.filter((no) => no.text.length > 0);
}

// O trecho com marcadores vira texto e notas. A nota entra colada à palavra
// de antes, como a chamada no Word.
function comNotas(nos: readonly NoTexto[], notas: Notas): NoInline[] {
  const saida: NoInline[] = [];
  for (const no of nos) {
    let inicio = 0;
    for (const achado of no.text.matchAll(MARCADOR_DE_NOTA)) {
      const antes = no.text.slice(inicio, achado.index).replace(/ $/, "");
      if (antes) saida.push({ ...no, text: antes });
      const texto = notas.textos.get(achado[1]);
      if (texto !== undefined) {
        saida.push({ type: "nota_rodape", texto });
        notas.usadas.add(achado[1]);
      }
      inicio = achado.index + achado[0].length;
    }
    const resto = no.text.slice(inicio);
    if (resto) saida.push(inicio === 0 ? no : { ...no, text: resto });
  }
  return saida;
}

// Só o texto, sem nota: a célula de tabela não tem nota de rodapé no AURA.
export function semNotas(nos: readonly NoTexto[]): NoTexto[] {
  return limparInline(nos.map((no) => ({ ...no, text: no.text.replace(MARCADOR_DE_NOTA, "") })));
}

// Os trechos de texto, com as marcas, de um bloco do HTML, por parágrafo, pela
// regra da colagem. Um `<br>` do Word (quebra de linha manual) separa
// parágrafos, como na colagem.
export function trechosPorParagrafo(no: NoHtmlColado): NoTexto[][] {
  return mapearHtmlColado([no])
    .map((paragrafo) =>
      limparInline(
        (paragrafo.content ?? []).map((texto) => ({
          type: "text" as const,
          text: texto.text ?? "",
          ...(texto.marks ? { marks: texto.marks as Marca[] } : {}),
        })),
      ),
    )
    .filter((trechos) => trechos.length > 0);
}

export function paragrafosDe(no: NoHtmlColado, notas: Notas): NoParagrafo[] {
  return trechosPorParagrafo(no).flatMap((trechos): NoParagrafo[] => {
    const content = comNotas(trechos, notas);
    return content.length > 0 ? [{ type: "paragraph", content }] : [];
  });
}

export function textoDoParagrafo(paragrafo: NoParagrafo): string {
  return (paragrafo.content ?? []).map((no) => (no.type === "text" ? no.text : "")).join("");
}
