import { describe, expect, it } from "vitest";

import { formatarEvento, streamDeEventos, type EventoIA } from "./eventos";

// O stream da resposta de sucesso (contrato §3), pronto desde o stub
// (passo 6.5.3).

const INICIO: EventoIA = {
  event: "inicio",
  data: { versao: 1, operacao: "revisar", requisicao: "r1" },
};
const SUGESTAO: EventoIA = {
  event: "sugestao",
  data: {
    id: "r1-1",
    inicio: 9,
    fim: 15,
    original: "mostra",
    substituto: "mostram",
    motivo: 'Concordância: o sujeito "os dados" está no plural.',
  },
};
const USO: EventoIA = {
  event: "uso",
  data: { chave: "aura", tokens: { entrada: 312, saida: 58, total: 370 } },
};
const FIM: EventoIA = { event: "fim", data: { sugestoes: 1, descartadas: 0 } };

async function* deLista(eventos: EventoIA[]) {
  yield* eventos;
}

async function lerTudo(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

// O que o cliente faz (contrato §3.1): separar na linha em branco e ler
// `event:` e `data:`.
function separar(texto: string): { event: string; data: unknown }[] {
  return texto
    .split("\n\n")
    .filter((bloco) => bloco !== "")
    .map((bloco) => {
      const [linhaEvento, linhaDados, ...resto] = bloco.split("\n");
      expect(resto).toEqual([]);
      return {
        event: linhaEvento.replace(/^event: /, ""),
        data: JSON.parse(linhaDados.replace(/^data: /, "")),
      };
    });
}

describe("formato SSE (contrato §3)", () => {
  it("event, data numa linha só, e a linha em branco", () => {
    expect(formatarEvento(FIM)).toBe('event: fim\ndata: {"sugestoes":1,"descartadas":0}\n\n');
  });

  it("quebra de linha no texto não parte o data em duas linhas", () => {
    const evento: EventoIA = {
      event: "sugestao",
      data: { ...(SUGESTAO.data as object), original: "a\nb", substituto: "a\r\nb" } as never,
    };
    const [bloco] = formatarEvento(evento).split("\n\n");
    expect(bloco.split("\n")).toHaveLength(2);
  });
});

describe("streamDeEventos — garantia de término (contrato §3.2)", () => {
  it("transmite os eventos na ordem e termina no fim", async () => {
    const texto = await lerTudo(streamDeEventos(deLista([INICIO, SUGESTAO, USO, FIM])));
    expect(separar(texto)).toEqual([INICIO, SUGESTAO, USO, FIM]);
  });

  it("nada sai depois do evento terminal", async () => {
    const texto = await lerTudo(streamDeEventos(deLista([INICIO, FIM, SUGESTAO])));
    expect(separar(texto).map((evento) => evento.event)).toEqual(["inicio", "fim"]);
  });

  it("produtor que acaba sem fim nem erro termina em erro, não em silêncio", async () => {
    const eventos = separar(await lerTudo(streamDeEventos(deLista([INICIO, SUGESTAO]))));
    expect(eventos.at(-1)).toMatchObject({ event: "erro", data: { codigo: "erro_interno" } });
  });

  it("produtor que falha vira erro_interno, sem o motivo técnico", async () => {
    async function* falha() {
      yield INICIO;
      yield SUGESTAO;
      throw new Error("chave AIza-segredo recusada");
    }
    const texto = await lerTudo(streamDeEventos(falha()));
    const eventos = separar(texto);

    expect(eventos.map((evento) => evento.event)).toEqual(["inicio", "sugestao", "erro"]);
    expect(eventos[2].data).toMatchObject({ codigo: "erro_interno" });
    expect(texto).not.toMatch(/AIza|segredo/);
  });

  it("cancelar o stream encerra o produtor (o cliente abortou o fetch)", async () => {
    let encerrado = false;
    async function* infinito() {
      try {
        while (true) yield SUGESTAO;
      } finally {
        encerrado = true;
      }
    }
    const leitor = streamDeEventos(infinito()).getReader();
    await leitor.read();
    await leitor.cancel();

    expect(encerrado).toBe(true);
  });
});
