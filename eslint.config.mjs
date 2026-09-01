import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
