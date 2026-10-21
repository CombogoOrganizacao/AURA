import type { ReactNode } from "react";

import type { Trecho } from "@/core/document/elements/trechos";
import type { BlocoPrevia, CelulaPrevia, Previa } from "@/core/preview/previa";
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
        <Celula key={j}>
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
    case "referencia":
      return (
        <p className="pv-referencia">
          <TrechosDaReferencia trechos={bloco.trechos} />
        </p>
      );
  }
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
      {previa.elementos.map((elemento, i) => (
        // Cada elemento depois do corpo abre folha nova (como no `.docx`).
        <section
          key={i}
          className={elemento.parte === "posTextual" ? "pv-elemento-novo" : undefined}
        >
          {elemento.blocos.map((bloco, j) => (
            <Bloco key={j} bloco={bloco} imagens={imagens} />
          ))}
        </section>
      ))}
    </div>
  );
}
