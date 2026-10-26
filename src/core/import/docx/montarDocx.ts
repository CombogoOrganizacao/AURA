import { lerCabecalhoImagem, TAMANHO_MAXIMO_IMAGEM, type DadosImagem } from "../../document/imagem";
import type { Documento } from "../../document/types";
import type { ImagemArmazenada } from "../../persistence/types";
import type { TexLido } from "../latex/lerTex";
import { montarReimportacao, type Relatorio, type ResolverImagem } from "../latex/reimport";

// O `.docx` lido, aplicado ao trabalho de destino (passo 8.7.2): o mesmo
// `montarReimportacao()` do LaTeX, mais as imagens. Cada figura chega com a
// chave que `src/lib/lerDocx.ts` deu à imagem (`FiguraLida.caminho`); aqui a
// imagem é conferida (PNG ou JPEG, pelos bytes, até 5 MB, como no editor) e
// ganha um `id` na loja de imagens. **Não grava nada**: quem confirma grava
// as imagens antes do documento, como no `.zip` (`BotaoReimportar.tsx`).

export interface ImportacaoDocx {
  documento: Documento;
  relatorio: Relatorio;
  // Imagens a gravar antes do documento, já com o `documentoId` dele.
  imagens: ImagemArmazenada[];
}

export function montarImportacaoDocx({
  atual,
  lido,
  imagens,
  gerarId = () => crypto.randomUUID(),
}: {
  atual: Documento | null;
  lido: TexLido;
  // Os bytes de cada imagem do arquivo, pela chave.
  imagens: ReadonlyMap<string, Uint8Array>;
  gerarId?: () => string;
}): ImportacaoDocx {
  const aceitas: { id: string; bytes: Uint8Array; dados: DadosImagem }[] = [];
  const resolverImagem: ResolverImagem = (chave) => {
    const bytes = imagens.get(chave);
    if (!bytes) return { motivo: "a imagem não pôde ser lida do arquivo." };
    if (bytes.length > TAMANHO_MAXIMO_IMAGEM) {
      return { motivo: "a imagem passa de 5 MB. Reduza a imagem e inclua na figura." };
    }
    const dados = lerCabecalhoImagem(bytes);
    if (!dados) {
      return {
        motivo:
          "o AURA aceita PNG e JPEG, e a imagem está em outro formato (no Word, é comum vir em EMF, WMF ou GIF). Salve a imagem como PNG e inclua na figura.",
      };
    }
    const id = gerarId();
    aceitas.push({ id, bytes, dados });
    return { imagem: id };
  };

  const { documento, relatorio } = montarReimportacao(atual, lido, { gerarId, resolverImagem });
  return {
    documento,
    relatorio,
    imagens: aceitas.map(({ id, bytes, dados }) => ({
      id,
      documentoId: documento.id,
      ...dados,
      bytes,
    })),
  };
}
