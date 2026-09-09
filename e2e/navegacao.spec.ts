import { expect, test } from "@playwright/test";

// Fase 2B deu à AURA uma casca de verdade — landing, autenticação estática,
// meus documentos, editor de três colunas, central de editais — todas
// ligadas por navegação real do Next.js (não protótipo estático). Este
// teste percorre o caminho principal entre elas; cada tela já tem cobertura
// própria mais funda em outro lugar (fatia-vertical.spec.ts cobre
// criar/digitar/persistir/exportar; este aqui cobre só o "dá pra chegar
// lá clicando", que nenhum outro teste confere de ponta a ponta).
test("percorre landing → documentos → editor → editais", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AURA/);
  await expect(page.locator("h1")).toContainText("Seu trabalho nas normas");

  // O CTA principal da landing pula direto pra /documentos — decisão
  // registrada em 2B.6: sem Firebase Auth na v1, um portão de cadastro
  // que não cadastra nada é fricção sem função.
  await page.getByRole("link", { name: "Comece agora!" }).first().click();
  await page.waitForURL(/\/documentos$/);
  await expect(page.locator("h1")).toContainText("Meus documentos");

  // Abas da barra superior no modo `app` — "Central de editais" é o
  // segundo elo desta cadeia, sem passar pelo editor.
  await page.getByRole("link", { name: "Central de editais" }).click();
  await page.waitForURL(/\/editais$/);
  await expect(page.locator("h1")).toContainText("Central de editais");

  // De volta a documentos, "Novo documento" leva ao editor de três
  // colunas — `AppTopBar` troca pro modo `editor`, com o botão de voltar.
  await page.getByRole("link", { name: "Meus documentos" }).click();
  await page.waitForURL(/\/documentos$/);
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await expect(page.getByRole("link", { name: "Voltar aos documentos" })).toBeVisible();

  // O botão de voltar do editor fecha o círculo.
  await page.getByRole("link", { name: "Voltar aos documentos" }).click();
  await page.waitForURL(/\/documentos$/);
});

test("entrar e cadastrar são alcançáveis e não fingem sucesso", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Entrar" }).first().click();
  await page.waitForURL(/\/entrar$/);

  const entrarUrl = page.url();
  await page.getByRole("button", { name: /Entrar/ }).click({ force: true });
  await expect(page).toHaveURL(entrarUrl);

  await page.getByRole("link", { name: "Criar conta gratuita" }).click();
  await page.waitForURL(/\/cadastrar$/);
});
