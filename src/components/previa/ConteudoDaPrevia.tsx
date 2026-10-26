import type { ReactNode } from "react";

import type { Trecho } from "@/core/document/elements/trechos";
import type { LinhaPreTextual } from "@/core/document/elements/linhaPreTextual";
import type { BlocoPrevia, CelulaPrevia, ElementoPrevia, Previa } from "@/core/preview/previa";
import type { TrechoReferencia } from "@/core/references/format/abnt";

// O trabalho como HTML, para o Paged.js quebrar em páginas (passo 8.6.1).
// **Montado em React a partir do modelo (`core/preview/previa.ts`)**: nada de
// `innerHTML`, nem texto do aluno virando marcação. A fórmula é a única peça
// que o React não escreve: ela sai como um `<span data-latex>` vazio, e quem
// monta a prévia o preenche com `katex.render()` (nós de DOM de verdade, como
// o `FormulaView` do editor) antes de entregar a árvore ao Paged.js.

function Trechos({ trechos }: { trechos: readonly Trecho[] }): ReactNode {
  return trechos.map((trecho, i) => {
    if (trecho.papel === "nota") {
      // `float: footnote` (CSS do Paged.js): o texto vai para o pé da folha, e
      // o expoente fica no lugar. O número é do contador do Paged.js.
      return (
        <span key={i} className="pv-nota">
          {trecho.texto}
        </span>
      );
    }
    if (trecho.papel === "formula") {
      return <span key={i} className="pv-formula-inline" data-latex={trecho.texto} />;
    }
    let no: ReactNode = trecho.texto;
    if (trecho.italico) no = <em>{no}</em>;
    if (trecho.negrito) no = <strong>{no}</strong>;
    if (trecho.papel === "aspas" || trecho.papel === "chamada") {
      no = <span className={trecho.papel === "aspas" ? "pv-aspas" : "pv-chamada"}>{no}</span>;
    }
    return <span key={i}>{no}</span>;
  });
}

function TrechosDaReferencia({ trechos }: { trechos: readonly TrechoReferencia[] }): ReactNode {
  return trechos.map((trecho, i) =>
    trecho.papel === "titulo" ? <strong key={i}>{trecho.texto}</strong> : trecho.texto,
  );
}

function Celulas({ linhas, tag }: { linhas: CelulaPrevia[][]; tag: "th" | "td" }) {
  const Celula = tag;
  return linhas.map((linha, i) => (
    <tr key={i}>
      {linha.map((celula, j) => (
        <Celula key={j} colSpan={celula.colspan} rowSpan={celula.rowspan}>
          <Trechos trechos={celula.trechos} />
        </Celula>
      ))}
    </tr>
  ));
}

function Bloco({ bloco, imagens }: { bloco: BlocoPrevia; imagens: ReadonlyMap<string, string> }) {
  switch (bloco.tipo) {
    case "titulo": {
      const Titulo = bloco.nivel === 1 ? "h1" : bloco.nivel === 2 ? "h2" : "h3";
      return (
        <Titulo
          id={`pv-${bloco.id}`}
          className={`pv-titulo pv-titulo-${bloco.nivel}${bloco.abrePagina ? " pv-titulo-abre" : ""}`}
        >
          {bloco.texto}
        </Titulo>
      );
    }
    case "tituloSemIndicativo":
      return (
        <h1 id={`pv-${bloco.id}`} className="pv-titulo-centro">
          {bloco.texto}
        </h1>
      );
    case "paragrafo":
      return (
        <p className="pv-paragrafo">
          <Trechos trechos={bloco.trechos} />
        </p>
      );
    case "citacaoLonga":
      return (
        <blockquote className="pv-citacao">
          <Trechos trechos={bloco.trechos} />
        </blockquote>
      );
    case "formula":
      return <div className="pv-formula" data-latex={bloco.texto} data-bloco="1" />;
    case "figura": {
      const url = bloco.imagem ? imagens.get(bloco.imagem) : undefined;
      return (
        <figure id={`pv-${bloco.id}`} className="pv-figura">
          <p className="pv-legenda">{bloco.legenda}</p>
          {url ? (
            // `alt` vazio: a legenda acima já diz o que a figura é.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="pv-imagem" src={url} alt="" />
          ) : (
            <p className="pv-moldura">[ espaço reservado para a imagem ]</p>
          )}
          {bloco.fonte && <p className="pv-fonte">{bloco.fonte}</p>}
        </figure>
      );
    }
    case "tabela":
      return (
        <div id={`pv-${bloco.id}`} className="pv-tabela-bloco">
          <p className="pv-legenda">{bloco.legenda}</p>
          <table className="pv-tabela">
            <colgroup>
              {bloco.proporcoes.map((proporcao, i) => (
                <col key={i} style={{ width: `${proporcao * 100}%` }} />
              ))}
            </colgroup>
            {bloco.cabecalho.length > 0 && (
              <thead>
                <Celulas linhas={bloco.cabecalho} tag="th" />
              </thead>
            )}
            <tbody>
              <Celulas linhas={bloco.corpo} tag="td" />
            </tbody>
          </table>
          {bloco.fonte && <p className="pv-fonte">{bloco.fonte}</p>}
        </div>
      );
    case "tituloPreTextual":
      return <h1 className="pv-titulo-centro">{bloco.texto}</h1>;
    case "linha":
      return <LinhaDaFolha linha={bloco.linha} espacoAntes={bloco.espacoAntes} />;
    case "noPe":
      return (
        <div className="pv-pe">
          {bloco.linhas.map((linha, i) => (
            <p key={i} className="pv-pe-linha">
              {linha.texto}
            </p>
          ))}
        </div>
      );
    case "resumo":
      return <p className="pv-resumo">{bloco.texto}</p>;
    case "termos":
      return (
        <p className="pv-resumo pv-termos">
          <strong>{bloco.rotulo}: </strong>
          {bloco.termos.join("; ")}.
        </p>
      );
    case "entradaIndice":
      // O número da página vem do Paged.js: `target-counter` no CSS, a partir
      // do `href` (`estilos.ts`).
      return (
        <p className={`pv-indice pv-indice-${bloco.nivel}`}>
          <a href={`#pv-${bloco.alvo}`}>{bloco.texto}</a>
        </p>
      );
    case "abreviatura":
      return (
        <p className="pv-sigla">
          <span className="pv-sigla-curta">{bloco.sigla}</span>
          <span>{bloco.significado}</span>
        </p>
      );
    case "referencia":
      return (
        <p className="pv-referencia">
          <TrechosDaReferencia trechos={bloco.trechos} />
        </p>
      );
  }
}

// Uma linha da capa, da folha de rosto ou de aprovação, ou do que a norma
// manda alinhar. O papel diz a ênfase e o alinhamento diz o recuo
// (`estilos.ts`).
function LinhaDaFolha({ linha, espacoAntes }: { linha: LinhaPreTextual; espacoAntes: number }) {
  return (
    <p
      className={[
        "pv-linha",
        `pv-linha-${linha.alinhamento}`,
        linha.papel ? `pv-papel-${linha.papel}` : "",
      ].join(" ")}
      style={espacoAntes > 0 ? { marginTop: `${espacoAntes}pt` } : undefined}
    >
      {linha.texto}
    </p>
  );
}

// As três partes do trabalho (`core/document/order.ts`): a capa fica fora da
// contagem de páginas, os pré-textuais contam a partir da folha de rosto sem
// mostrar o número, e o texto e o que vem depois dele contam e mostram. O
// texto e os pós-textuais dividem a mesma contagem, contínua (NBR 14724:2024
// §5.3), e por isso o mesmo grupo.
type GrupoDaPrevia = "capa" | "pre" | "texto";

function grupoDe(elemento: ElementoPrevia): GrupoDaPrevia {
  if (elemento.parte === "capa") return "capa";
  return elemento.parte === "preTextual" ? "pre" : "texto";
}

function agrupar(previa: Previa): { grupo: GrupoDaPrevia; elementos: ElementoPrevia[] }[] {
  const grupos: { grupo: GrupoDaPrevia; elementos: ElementoPrevia[] }[] = [];
  for (const elemento of previa.elementos) {
    const grupo = grupoDe(elemento);
    const ultimo = grupos.at(-1);
    if (ultimo?.grupo === grupo) ultimo.elementos.push(elemento);
    else grupos.push({ grupo, elementos: [elemento] });
  }
  return grupos;
}

export function ConteudoDaPrevia({
  previa,
  imagens,
}: {
  previa: Previa;
  // Id da imagem → URL (`data:`), já carregada.
  imagens: ReadonlyMap<string, string>;
}) {
  return (
    <div className="pv">
      {agrupar(previa).map(({ grupo, elementos }) => (
        // Cada grupo é uma página nomeada (`estilos.ts`): é ela que decide se
        // o número aparece e de onde a contagem parte.
        <div key={grupo} className={`pv-parte pv-parte-${grupo}`}>
          {elementos.map((elemento, i) => (
            // Cada elemento depois do primeiro do grupo abre folha nova (como
            // no `.docx`).
            <section key={i} className={i > 0 ? "pv-elemento-novo" : undefined}>
              {elemento.blocos.map((bloco, j) => (
                <Bloco key={j} bloco={bloco} imagens={imagens} />
              ))}
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
