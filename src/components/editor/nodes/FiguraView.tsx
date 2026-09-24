"use client";

import { useEffect, useRef, useState } from "react";

import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";

import { Button } from "@/components/ui/Button";
import { ROTULO_FIGURA } from "@/core/document/elements/legenda";

import { useImagensDoDocumento } from "../ImagensDoDocumento";
import { CampoFonte, CampoLegenda } from "./CamposLegenda";
import { useNumeroNumeravel } from "./useNumeroNumeravel";

// Node view do nó `figura` (passo 3.6.3) — ver docs/schema-tiptap.md §4.6.
// Mostra "Figura 3" sem gravar o número em lugar nenhum: vem de
// `numerarNumeraveisProseMirror()` (src/core/editor/numbering.ts),
// recalculada a cada transação. Inserir uma figura antes desta renumera as
// duas sozinho, sem nada para sincronizar.
//
// Fica em `src/components/` e não em `src/core/` de propósito: o nó em si
// (`src/core/editor/nodes/figure.ts`) continua livre de React — quem liga
// este node view a ele é `Editor.tsx`, mesma divisão de `SectionView.tsx`.
//
// **Legenda acima, fonte abaixo.** É a convenção corrente, não uma regra
// conferida na fonte primária — ver o cabeçalho de
// `src/core/document/elements/legenda.ts`, que registra o que a auditoria do
// passo 3.1.1 cobriu e o que ficou pendente.
//
// **A imagem (passo 6.1.2).** O atributo `imagem` guarda só o id; os bytes
// ficam na persistência, e quem envia e carrega é `ImagensDoDocumento`.
// Trocar ou remover a imagem só muda o atributo: a imagem antiga continua
// guardada, porque uma versão do histórico pode apontar para ela, e o
// Ctrl+Z traz a anterior de volta.
export function FiguraView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  const id = node.attrs.id as string | null;
  const imagemId = node.attrs.imagem as string | null;
  const legenda = node.attrs.legenda as string;
  const numero = useNumeroNumeravel(editor, "figura", id);
  const imagens = useImagensDoDocumento();

  // A imagem carregada, com o id de onde veio: trocar de imagem invalida a
  // anterior sem precisar limpar estado.
  const [carregada, setCarregada] = useState<{ id: string; url: string | null } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!imagemId || !imagens) return;
    let ativo = true;
    imagens.carregar(imagemId).then(
      (url) => ativo && setCarregada({ id: imagemId, url }),
      () => ativo && setCarregada({ id: imagemId, url: null }),
    );
    return () => {
      ativo = false;
    };
  }, [imagemId, imagens]);

  const url = carregada?.id === imagemId ? carregada.url : undefined;
  const descricao = legenda.trim() || `${ROTULO_FIGURA} ${numero ?? ""}`.trim();

  async function escolher(arquivo: File | undefined) {
    if (!arquivo || !imagens) return;
    setEnviando(true);
    setErro(null);
    try {
      updateAttributes({ imagem: await imagens.enviar(arquivo) });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível guardar a imagem.");
    } finally {
      setEnviando(false);
      // Permite escolher o mesmo arquivo de novo depois de um erro.
      if (campoArquivo.current) campoArquivo.current.value = "";
    }
  }

  return (
    <NodeViewWrapper as="figure" data-id={id}>
      <CampoLegenda
        rotulo={ROTULO_FIGURA}
        numero={numero}
        valor={legenda}
        onChange={(novaLegenda) => updateAttributes({ legenda: novaLegenda })}
      />
      <div className="doc-figura-moldura" contentEditable={false}>
        {imagemId && url ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL local, sem otimização a fazer
          <img className="doc-figura-imagem" src={url} alt={descricao} />
        ) : imagemId && url === null ? (
          <span>a imagem desta figura não foi encontrada</span>
        ) : imagemId ? (
          <span>carregando a imagem…</span>
        ) : (
          <span>espaço reservado para a imagem</span>
        )}

        {imagens && (
          <div className="doc-figura-acoes">
            <input
              ref={campoArquivo}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              aria-label={`Arquivo de imagem da ${descricao}`}
              onChange={(evento) => void escolher(evento.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="outline"
              loading={enviando}
              onClick={() => campoArquivo.current?.click()}
            >
              {imagemId ? "Trocar imagem" : "Inserir imagem"}
            </Button>
            {imagemId && (
              <Button size="sm" variant="ghost" onClick={() => updateAttributes({ imagem: null })}>
                Remover imagem
              </Button>
            )}
          </div>
        )}
        {erro && (
          <p role="alert" className="doc-figura-erro">
            {erro}
          </p>
        )}
      </div>
      <CampoFonte
        rotulo={ROTULO_FIGURA}
        numero={numero}
        valor={node.attrs.fonte as string}
        onChange={(fonte) => updateAttributes({ fonte })}
      />
    </NodeViewWrapper>
  );
}
