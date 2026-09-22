import { formatarReferencia } from "@/core/references/format/abnt";
import { ROTULO_TIPO, type Referencia } from "@/core/references/types";

// A referência como ela vai sair impressa — é o que torna concreto que os
// campos separados viram uma entrada na norma, sem a pessoa precisar exportar
// para conferir. Usada no painel (4.5) e na prévia da importação (4.7): as
// duas telas mostram a mesma entrada, do mesmo jeito.
//
// **O negrito é escolha desta tela, não do core.** A §6.7 admite negrito,
// itálico ou sublinhado, desde que uniforme em todas as referências; o core
// marca o trecho com `papel: "titulo"` e quem desenha escolhe. A exportação
// (4.11) precisa escolher o MESMO recurso, ou o documento fica com dois.
export function PreviaReferencia({ referencia }: { referencia: Referencia }) {
  // Referência recém-criada ainda não tem o que formatar: sem título, o
  // formatador devolveria só a imprenta ausente ("[S. l.: s. n.]."), que
  // parece defeito em vez de campo por preencher.
  if (referencia.title.trim() === "") {
    return <span className="text-muted">{ROTULO_TIPO[referencia.type]} sem título</span>;
  }

  return (
    <>
      {formatarReferencia(referencia).map((trecho, indice) =>
        trecho.papel === "titulo" ? (
          <strong key={indice} className="font-semibold">
            {trecho.texto}
          </strong>
        ) : (
          <span key={indice}>{trecho.texto}</span>
        ),
      )}
    </>
  );
}

// Nome curto para rótulo de botão e para aviso. O texto formatado inteiro
// viraria um `aria-label` de duas linhas.
export function nomeDaReferencia(referencia: Referencia): string {
  const titulo = referencia.title.trim();
  return titulo === "" ? `${ROTULO_TIPO[referencia.type]} sem título` : titulo;
}
