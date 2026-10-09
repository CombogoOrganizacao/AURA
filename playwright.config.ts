import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Sem `workers` fixo (passo 6.6.5): o default do Playwright, metade dos
  // núcleos lógicos. Até o 6.6.4 a suíte rodava contra o `next dev`, que
  // compila cada rota sob demanda; vários workers pedindo rotas diferentes
  // faziam as compilações se atropelarem, e specs que passavam sozinhas
  // estouravam o timeout de 30 s. O remendo era `workers: 2`. Contra o build
  // de produção as rotas já chegam compiladas, e o paralelismo volta inteiro.
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
    // A suíte exercita o bundle de produção, o mesmo que vai para a Vercel.
    // Com `reuseExistingServer`, um `npm run dev` aberto na 3000 continua sendo
    // reaproveitado, e a iteração local não muda; aí a suíte roda contra o dev,
    // e vale o atropelo descrito acima (`npm run e2e -- --workers=2`).
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // O padrão é 60 s, e um build frio passa disso.
    timeout: 300_000,
  },
});
