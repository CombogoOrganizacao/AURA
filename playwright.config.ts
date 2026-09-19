import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // `next dev` compila cada rota sob demanda. O default do Playwright é metade
  // dos núcleos lógicos, e vários workers pedindo rotas diferentes ao mesmo
  // tempo fazem as compilações se atropelarem: specs que passam sozinhas
  // estouram o timeout de 30 s, em conjunto diferente a cada corrida. Não é
  // instabilidade dos testes — foi reproduzido na árvore limpa, no passo 4.2.
  //
  // O teto é empírico: 2 passou três corridas seguidas; o default, nenhuma. O
  // flag vence o config (`npm run e2e -- --workers=4`) para sondar de novo
  // quando a suíte crescer. A correção de verdade é servir a suíte a partir do
  // build de produção, em vez do servidor de desenvolvimento.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
