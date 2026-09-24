"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import {
  lerCabecalhoImagem,
  TAMANHO_MAXIMO_IMAGEM,
  type FormatoImagem,
} from "@/core/document/imagem";
import type { AdaptadorPersistencia } from "@/core/persistence/types";

// Imagens das figuras (passo 6.1.2). O node view da figura (`FiguraView`)
// não sabe de persistência nem de documento: recebe daqui só enviar um
// arquivo e carregar uma imagem já guardada. O documento guarda o `id`; os
// bytes ficam na persistência (`salvarImagem`, core/persistence/types.ts).
//
// A tela mostra a imagem por data URL, e não por `blob:`: a CSP do projeto
// (next.config.ts) aceita `data:` em `img-src`, e não havia motivo para
// abrir mais uma origem.

export interface ImagensDoDocumento {
  // Confere e guarda o arquivo; devolve o id para gravar na figura.
  enviar(arquivo: File): Promise<string>;
  // A imagem como data URL, ou `null` se ela não existe mais.
  carregar(id: string): Promise<string | null>;
}

const Contexto = createContext<ImagensDoDocumento | null>(null);

const MIME: Record<FormatoImagem, string> = { png: "image/png", jpg: "image/jpeg" };

// Base64 em blocos: `String.fromCharCode(...bytes)` de uma foto inteira
// estouraria a pilha de argumentos.
function dataUrl(formato: FormatoImagem, bytes: Uint8Array): string {
  let binario = "";
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) {
    binario += String.fromCharCode(...bytes.subarray(i, i + bloco));
  }
  return `data:${MIME[formato]};base64,${btoa(binario)}`;
}

export function ProvedorImagens({
  documentoId,
  persistencia,
  children,
}: {
  documentoId: string;
  persistencia: AdaptadorPersistencia;
  children: ReactNode;
}) {
  const valor = useMemo<ImagensDoDocumento>(() => {
    // A mesma imagem aparece em mais de um render (e volta ao desfazer uma
    // troca): converter uma vez basta.
    const cache = new Map<string, Promise<string | null>>();

    return {
      async enviar(arquivo) {
        if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
          throw new Error("A imagem passa de 5 MB. Reduza o tamanho e tente de novo.");
        }
        const bytes = new Uint8Array(await arquivo.arrayBuffer());
        const dados = lerCabecalhoImagem(bytes);
        if (!dados) {
          throw new Error("Use uma imagem PNG ou JPEG.");
        }
        const id = crypto.randomUUID();
        await persistencia.salvarImagem({ id, documentoId, ...dados, bytes });
        cache.set(id, Promise.resolve(dataUrl(dados.formato, bytes)));
        return id;
      },

      carregar(id) {
        let pendente = cache.get(id);
        if (!pendente) {
          pendente = persistencia
            .carregarImagem(documentoId, id)
            .then((imagem) => (imagem ? dataUrl(imagem.formato, imagem.bytes) : null))
            .catch((erro: unknown) => {
              // Uma falha de leitura não fica guardada: a próxima tentativa lê de novo.
              cache.delete(id);
              throw erro;
            });
          cache.set(id, pendente);
        }
        return pendente;
      },
    };
  }, [documentoId, persistencia]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useImagensDoDocumento(): ImagensDoDocumento | null {
  return useContext(Contexto);
}
