"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { Documento } from "@/core/document/types";
import { decodificarUtf8, lerTex, TAMANHO_MAXIMO_TEX } from "@/core/import/latex/lerTex";
import { montarReimportacao, type Reimportacao } from "@/core/import/latex/reimport";
import { substituirDocumento } from "@/core/persistence/versions";
import { usePersistencia } from "@/lib/persistence-provider";

import { ModalReimportacao, NOME_DA_VERSAO_ANTERIOR, type Destino } from "./ModalReimportacao";

interface BotaoReimportarProps {
  // O documento como está na tela: é ele que vira a versão guardada.
  documento: Documento;
  // Troca o documento aberto, guardando o de agora como versão
  // (`EstadoHistorico.substituir`).
  substituir: (novo: Documento, nomeDoAnterior: string) => Promise<void>;
  // Grava já o que está na tela, antes de abrir outro trabalho.
  salvarAgora: () => Promise<void>;
}

interface Previa {
  arquivo: string;
  destino: Destino;
  // O documento de destino como estava ao ler o arquivo (`null` se novo).
  atual: Documento | null;
  reimportacao: Reimportacao;
}

// "Reimportar .tex" (passo 6.2.4): o caminho de volta do Overleaf. Lê o
// arquivo no navegador (nada vai a servidor), monta o relatório, e só grava
// depois do "Reimportar", com o trabalho de agora guardado antes como versão
// (docs/latex-abntex.md §1.5, princípio 2).
export function BotaoReimportar({ documento, substituir, salvarAgora }: BotaoReimportarProps) {
  const persistencia = usePersistencia();
  const router = useRouter();
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [falhaAoLer, setFalhaAoLer] = useState<string | null>(null);
  const [falhaAoGravar, setFalhaAoGravar] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);

  async function aoEscolherArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    // Zera o campo: escolher o mesmo arquivo de novo, depois de corrigi-lo,
    // precisa disparar `change`.
    evento.target.value = "";
    if (!arquivo || !persistencia) return;

    setFalhaAoLer(null);
    setFalhaAoGravar(null);
    // Em bytes, antes de ler: UTF-8 tem no máximo 4 bytes por caractere.
    if (arquivo.size > TAMANHO_MAXIMO_TEX * 4) {
      setFalhaAoLer(`O arquivo ${arquivo.name} é grande demais para ser um .tex de TCC.`);
      return;
    }

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await arquivo.arrayBuffer());
    } catch {
      setFalhaAoLer(`Não foi possível ler o arquivo ${arquivo.name}.`);
      return;
    }
    const texto = decodificarUtf8(bytes);
    if (!texto.ok) {
      setFalhaAoLer(texto.erro.mensagem);
      return;
    }

    const ler = (referencias: Documento["references"]) =>
      lerTex(texto.texto, {
        arquivo: arquivo.name,
        chavesDeReferencia: new Set(referencias.map((referencia) => referencia.id)),
      });

    let lido = ler(documento.references);
    if (!lido.ok) {
      setFalhaAoLer(lido.erro.mensagem);
      return;
    }

    let atual: Documento | null = documento;
    let destino: Destino = { tipo: "este" };
    if (lido.tex.documentoId !== documento.id) {
      try {
        atual = await persistencia.carregarDocumento(lido.tex.documentoId);
      } catch {
        setFalhaAoLer("Não foi possível abrir os trabalhos salvos neste navegador.");
        return;
      }
      destino = atual ? { tipo: "outro", titulo: atual.metadados.titulo } : { tipo: "novo" };
      // O `\cite` do aluno se resolve contra as referências do trabalho de
      // destino, não do aberto.
      lido = ler(atual?.references ?? []);
      if (!lido.ok) {
        setFalhaAoLer(lido.erro.mensagem);
        return;
      }
    }

    setPrevia({
      arquivo: arquivo.name,
      destino,
      atual,
      reimportacao: montarReimportacao(atual, lido.tex),
    });
  }

  async function confirmar() {
    if (!previa || !persistencia) return;
    const { destino, atual, reimportacao } = previa;
    setGravando(true);
    setFalhaAoGravar(null);
    try {
      if (destino.tipo === "este") {
        await substituir(reimportacao.documento, NOME_DA_VERSAO_ANTERIOR);
        setPrevia(null);
        return;
      }
      if (atual) {
        await substituirDocumento(
          persistencia,
          atual,
          reimportacao.documento,
          NOME_DA_VERSAO_ANTERIOR,
        );
      } else {
        await persistencia.salvarDocumento(reimportacao.documento);
      }
      // O trabalho aberto fica gravado antes de a tela sair dele.
      await salvarAgora().catch((erro: unknown) => {
        console.error("Falha ao salvar antes de abrir o trabalho reimportado:", erro);
      });
      setPrevia(null);
      router.push(`/documento/${encodeURIComponent(reimportacao.documento.id)}`);
    } catch (erro) {
      console.error("Falha ao gravar a reimportação:", erro);
      setFalhaAoGravar(
        "O trabalho não foi alterado. Tente de novo; se o erro continuar, exporte o trabalho antes.",
      );
    } finally {
      setGravando(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!persistencia}
        onClick={() => entradaArquivo.current?.click()}
      >
        Reimportar .tex
      </Button>
      <input
        ref={entradaArquivo}
        type="file"
        accept=".tex,text/x-tex,application/x-tex"
        className="sr-only"
        tabIndex={-1}
        aria-label="Arquivo .tex exportado pelo AURA"
        onChange={aoEscolherArquivo}
      />

      {falhaAoLer && (
        <div className="fixed top-16 right-4 z-40 w-[min(420px,calc(100vw-2rem))]">
          <Alert tone="danger" title="Reimportação recusada" onDismiss={() => setFalhaAoLer(null)}>
            {falhaAoLer}
          </Alert>
        </div>
      )}

      {previa && (
        <ModalReimportacao
          arquivo={previa.arquivo}
          destino={previa.destino}
          relatorio={previa.reimportacao.relatorio}
          gravando={gravando}
          falha={falhaAoGravar}
          onConfirmar={confirmar}
          onFechar={() => setPrevia(null)}
        />
      )}
    </>
  );
}
