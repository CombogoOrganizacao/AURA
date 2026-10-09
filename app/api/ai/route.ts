import { atenderComIADesativada } from "@/core/ai/contrato";

// Rota única da IA — docs/contrato-api-ai.md. Stub do passo 6.5.3: a IA está
// fora da v1, e toda requisição válida recebe `501 ia_desativada`.
//
// **Nenhuma chave é lida.** Do pedido saem só o `Content-Type` e o corpo;
// `Authorization` e `X-Gemini-Key` não são tocados, e não existe variável de
// ambiente com chave. A lógica fica em src/core/ai/contrato.ts, testada no
// Vitest, e a assinatura de `atenderComIADesativada()` não tem por onde
// receber uma credencial.
//
// Só `POST`: o Next responde `405` aos outros métodos, e o `OPTIONS`
// automático dele não envia `Access-Control-*`, então outra origem não passa
// do preflight (contrato §5.1).
//
// O stream da resposta de sucesso já existe (src/core/ai/eventos.ts) e entra
// aqui junto com a IA.

export async function POST(request: Request): Promise<Response> {
  const { status, corpo } = atenderComIADesativada({
    contentType: request.headers.get("content-type"),
    corpo: await request.text(),
  });

  return Response.json(corpo, { status, headers: { "Cache-Control": "no-store" } });
}
