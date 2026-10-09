import { expect, test } from "@playwright/test";

// Passo 6.5.4 — a aba IA é o espaço reservado do seletor de chave e do
// contador de tokens, inativo. O critério é negativo: não sugerir o que não
// existe. Por isso o teste confere também o que NÃO pode estar ali.

test("a aba IA reserva o espaço, está inativa e não oferece nada que não exista", async ({
  page,
}) => {
  const chamadasIA: string[] = [];
  page.on("request", (requisicao) => {
    if (new URL(requisicao.url()).pathname.startsWith("/api/ai")) chamadasIA.push(requisicao.url());
  });

  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.getByRole("tab", { name: "IA" }).click();

  const espaco = page.getByRole("region", { name: "Revisão com IA" });
  await expect(espaco).toBeVisible();
  await expect(espaco.getByText("Indisponível")).toBeVisible();

  // Seletor de chave: os dois caminhos (§1.9), desabilitados e sem nenhum
  // marcado, porque não há chave em uso.
  const chaves = espaco.getByRole("group", { name: "Chave de API" });
  for (const nome of ["Chave do AURA", "Sua chave do Gemini"]) {
    const opcao = chaves.getByRole("radio", { name: nome });
    await expect(opcao).toBeDisabled();
    await expect(opcao).not.toBeChecked();
  }

  // Contador: traço, não zero. Nenhuma chamada aconteceu para ser contada.
  await expect(espaco.getByText("Tokens nesta sessão")).toBeVisible();
  const contador = espaco.getByRole("definition");
  await expect(contador).toContainText("—");
  await expect(contador).not.toContainText(/\d/);

  // Nada para digitar nem clicar: sem campo de pergunta, sem botão de
  // conectar, sem exemplos do que a IA "faria".
  await expect(espaco.getByRole("textbox")).toHaveCount(0);
  await expect(espaco.getByRole("button")).toHaveCount(0);
  await expect(espaco).not.toContainText(/Resuma|Reescreva|Sugira|Pergunte|assistente/i);

  expect(chamadasIA).toEqual([]);
});
