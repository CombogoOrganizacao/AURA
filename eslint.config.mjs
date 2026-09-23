import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Nenhum componente fala com o adaptador de persistência direto — sempre
  // por `usePersistencia()` (src/lib/persistence-provider.tsx). É o que
  // torna "trocar de adaptador é mudar uma linha" verdade de fato, não só
  // uma convenção lembrada (passo 1.2.4 do to-do).
  {
    files: ["src/components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/core/persistence/indexeddb"],
              message:
                "Componentes não falam com o IndexedDB direto — use usePersistencia() de @/lib/persistence-provider.",
            },
          ],
        },
      ],
    },
  },
  // `src/core/` é lógica pura (CLAUDE.md, "Camadas"): sem DOM e sem
  // armazenamento do navegador. O legado gravava presets e documentos em
  // `localStorage` direto; aqui tudo passa pela interface de persistência
  // (passo 5.1.3). O IndexedDB do adaptador local é a exceção por desenho, e
  // não está nesta lista.
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...["localStorage", "sessionStorage", "window", "document"].map((name) => ({
          name,
          message:
            "src/core/ é lógica pura: sem DOM nem armazenamento do navegador. Persistência passa por AdaptadorPersistencia.",
        })),
      ],
    },
  },
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
