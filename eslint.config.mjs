import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Desliga regras de estilo do ESLint que brigariam com o Prettier.
  // Precisa vir depois das outras configs para sobrescrevê-las.
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Site estático legado — congelado, não é padrão a seguir (ver CLAUDE.md).
    "legacy/**",
    // PoC do exportador .docx — congelada a partir do commit que a introduziu.
    "poc/**",
  ]),
]);

export default eslintConfig;
