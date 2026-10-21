// O Paged.js não traz tipos. Só o que a prévia usa (passo 8.6.1).
declare module "pagedjs" {
  export interface Fluxo {
    total: number;
    pages: unknown[];
  }

  export class Previewer {
    constructor(opcoes?: Record<string, unknown>);
    preview(
      conteudo: Node,
      folhasDeEstilo: Record<string, string>[],
      destino: Element,
    ): Promise<Fluxo>;
    // Desfaz o que `preview()` pôs no documento (estilos do `@page`).
    polisher: { destroy(): void };
    chunker: { destroy(): void };
  }
}
