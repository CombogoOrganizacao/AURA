import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // `next dev` reescreve CLAUDE.md a cada execução, injetando um bloco
  // "nextjs-agent-rules". CLAUDE.md é o arquivo de instruções do projeto —
  // o framework não deve tocá-lo.
  agentRules: false,
};

export default nextConfig;
