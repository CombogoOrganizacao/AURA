import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// CSP estática (sem nonce): o app é gerado estaticamente (SSG) nesta fase, e
// nonce por requisição exigiria tirar toda página de force-dynamic — troca de
// arquitetura maior que um passo de headers. 'unsafe-inline' em script-src é
// necessário porque o próprio Next injeta um <script> inline com o payload do
// RSC para hidratar a página; testado sem isso, a hidratação quebra (React
// #412). A defesa contra script injetado no conteúdo do usuário é a
// sanitização do editor, não a CSP — ver invariante em CLAUDE.md. SRI (abaixo)
// ainda cobre a integridade dos bundles carregados por src.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  /* config options here */
  // `next dev` reescreve CLAUDE.md a cada execução, injetando um bloco
  // "nextjs-agent-rules". CLAUDE.md é o arquivo de instruções do projeto —
  // o framework não deve tocá-lo.
  agentRules: false,

  experimental: {
    sri: {
      algorithm: "sha256",
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: cspHeader },
        ],
      },
    ];
  },
};

export default nextConfig;
