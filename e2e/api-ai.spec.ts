import { expect, test } from "@playwright/test";

// Stub de /api/ai (passo 6.5.3) contra o servidor de verdade: o que o Vitest
// de src/core/ai/ não alcança — o 405 do Next, os cabeçalhos de segurança,
// o preflight e a rota respondendo igual com e sem chave.

const VALIDA = {
  versao: 1,
  operacao: "revisar",
  trecho: { texto: "Os dados mostra que o método foi eficaz." },
};

test("requisição válida recebe 501 ia_desativada, em JSON e sem cache", async ({ request }) => {
  const resposta = await request.post("/api/ai", { data: VALIDA });

  expect(resposta.status()).toBe(501);
  expect(resposta.headers()["content-type"]).toContain("application/json");
  expect(resposta.headers()["cache-control"]).toBe("no-store");
  expect(resposta.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await resposta.json()).toEqual({
    erro: {
      codigo: "ia_desativada",
      mensagem: "A revisão com IA ainda não está disponível no AURA.",
    },
  });
});

test("com sessão e chave do usuário, a resposta é a mesma: nenhuma chave é lida", async ({
  request,
}) => {
  const resposta = await request.post("/api/ai", {
    data: VALIDA,
    headers: { Authorization: "Bearer token-falso", "X-Gemini-Key": "AIza-chave-falsa" },
  });

  expect(resposta.status()).toBe(501);
  const texto = await resposta.text();
  expect(texto).not.toMatch(/AIza|token-falso/);
  expect(JSON.parse(texto).erro.codigo).toBe("ia_desativada");
});

test("requisição fora de forma é 400 com o campo", async ({ request }) => {
  const resposta = await request.post("/api/ai", { data: { ...VALIDA, operacao: "parafrasear" } });

  expect(resposta.status()).toBe(400);
  expect((await resposta.json()).erro).toMatchObject({
    codigo: "requisicao_invalida",
    campo: "operacao",
  });
});

test("corpo que não é JSON é 415", async ({ request }) => {
  const resposta = await request.post("/api/ai", {
    data: "versao=1",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  expect(resposta.status()).toBe(415);
  expect((await resposta.json()).erro.codigo).toBe("tipo_invalido");
});

test("outro método é 405", async ({ request }) => {
  expect((await request.get("/api/ai")).status()).toBe(405);
});

test("o preflight não libera outra origem", async ({ request }) => {
  const resposta = await request.fetch("/api/ai", {
    method: "OPTIONS",
    headers: {
      Origin: "https://exemplo.invalid",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });

  expect(resposta.headers()["access-control-allow-origin"]).toBeUndefined();
});
