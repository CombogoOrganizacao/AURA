import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/core/**/*.test.ts"],
    environment: "node",

    // Cobertura de `src/core/` (passo 6.6.2): `npm run test:coverage`, e no
    // CI a cada push, com o relatório HTML como artefato.
    //
    // Os pisos por área são os quatro que o passo nomeia: regras, formatador
    // de referências, numeração e OOXML. Cada um fica alguns pontos abaixo
    // do medido em 09/10/2026, para segurar regressão sem quebrar o CI por
    // uma linha a mais. Subir o piso quando a cobertura subir; baixar exige
    // dizer por quê.
    //
    // `editor/nodes` e `editor/marks` ficam sem piso de propósito: o que
    // falta neles é `parseHTML`/`renderHTML`, que precisam de DOM e rodam no
    // Playwright, não aqui.
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: [
        "src/core/**/*.test.ts",
        "src/core/**/__tests__/**",
        "src/core/**/__fixtures__/**",
      ],
      reporter: ["text-summary", "html", "json-summary"],
      thresholds: {
        "src/core/rules/**": { lines: 95, statements: 95, functions: 95, branches: 88 },
        "src/core/references/format/**": {
          lines: 98,
          statements: 95,
          functions: 98,
          branches: 85,
        },
        "src/core/**/numbering*.ts": { lines: 98, statements: 98, functions: 98, branches: 90 },
        "src/core/export/docx/**": { lines: 95, statements: 93, functions: 98, branches: 80 },
      },
    },
  },
});
