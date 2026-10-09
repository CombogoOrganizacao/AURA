import { mensagemDoErro, type CodigoErro, type Operacao, VERSAO_CONTRATO } from "./contrato";

// O stream da resposta de sucesso — contrato §3 (docs/contrato-api-ai.md).
// Pronto desde o stub (passo 6.5.3), embora a rota ainda não o use: com a IA
// desativada, toda requisição válida termina em `501` antes de haver o que
// transmitir. Quando a IA entrar, a rota passa a devolver
// `new Response(streamDeEventos(...))` com `CABECALHOS_STREAM`, e o formato
// já está provado em `eventos.test.ts`.
//
// Só APIs-padrão (`ReadableStream`, `TextEncoder`), que existem no Node e no
// navegador. Nada de DOM, por isso cabe em `src/core/`.

export interface SugestaoIA {
  id: string;
  inicio: number;
  fim: number;
  original: string;
  substituto: string;
  motivo: string;
}

export type EventoIA =
  | {
      event: "inicio";
      data: { versao: typeof VERSAO_CONTRATO; operacao: Operacao; requisicao: string };
    }
  | { event: "sugestao"; data: SugestaoIA }
  | {
      event: "uso";
      data: {
        chave: "aura" | "usuario";
        tokens: { entrada: number; saida: number; total: number };
      };
    }
  | { event: "fim"; data: { sugestoes: number; descartadas: number } }
  | { event: "erro"; data: { codigo: CodigoErro; mensagem: string } };

export const CABECALHOS_STREAM: Readonly<Record<string, string>> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store",
};

// Um evento SSE: `event:`, `data:` com o JSON numa linha só, e a linha em
// branco que o encerra. `JSON.stringify` escapa `\n` e `\r`, então o `data`
// nunca se parte em duas linhas.
export function formatarEvento({ event, data }: EventoIA): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function terminal(evento: EventoIA): boolean {
  return evento.event === "fim" || evento.event === "erro";
}

// Transforma os eventos produzidos pela chamada à IA no corpo da resposta,
// mantendo a garantia de término do contrato (§3.2): o último evento é
// sempre `fim` ou `erro`, nunca os dois.
//
// - Se o produtor falha, sai `erro` com `erro_interno`, e não o motivo
//   técnico, que poderia carregar dado da requisição.
// - Se o produtor acaba sem `fim` nem `erro`, também sai `erro`: terminar em
//   silêncio faria o cliente achar que a rede caiu.
// - Nada depois do evento terminal é enviado.
// - Cancelar o stream (o cliente abortou o `fetch`) encerra o produtor, para
//   a chamada ao Gemini parar de gastar tokens (contrato §3.1).
export function streamDeEventos(eventos: AsyncIterable<EventoIA>): ReadableStream<Uint8Array> {
  const iterador = eventos[Symbol.asyncIterator]();
  const codificador = new TextEncoder();
  const erroInterno: EventoIA = {
    event: "erro",
    data: { codigo: "erro_interno", mensagem: mensagemDoErro("erro_interno") },
  };

  return new ReadableStream<Uint8Array>({
    async pull(controle) {
      let proximo: IteratorResult<EventoIA>;
      try {
        proximo = await iterador.next();
      } catch {
        controle.enqueue(codificador.encode(formatarEvento(erroInterno)));
        controle.close();
        return;
      }

      if (proximo.done) {
        controle.enqueue(codificador.encode(formatarEvento(erroInterno)));
        controle.close();
        return;
      }

      controle.enqueue(codificador.encode(formatarEvento(proximo.value)));
      if (terminal(proximo.value)) {
        controle.close();
        await iterador.return?.();
      }
    },

    async cancel() {
      await iterador.return?.();
    },
  });
}
