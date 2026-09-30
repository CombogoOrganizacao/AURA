"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { Documento } from "@/core/document/types";
import {
  decodificarUtf8,
  idDoDocumento,
  lerTex,
  TAMANHO_MAXIMO_TEX,
} from "@/core/import/latex/lerTex";
import { montarReimportacao, type Relatorio } from "@/core/import/latex/reimport";
import {
  comReferenciasEscolhidas,
  LIMITES_ZIP,
  lerProjetoZip,
  montarReimportacaoDoProjeto,
  type ConflitoDeReferencia,
  type RelatorioDoProjeto,
} from "@/core/import/latex/reimportZip";
import type { ImagemArmazenada } from "@/core/persistence/types";
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
  origem: "tex" | "zip";
  destino: Destino;
  // O documento de destino como estava ao ler o arquivo (`null` se novo).
  atual: Documento | null;
  documento: Documento;
  relatorio: Relatorio | RelatorioDoProjeto;
  // Imagens de figura trocadas ou novas, do `.zip`, a gravar antes do
  // documento.
  imagens: ImagemArmazenada[];
  conflitos: ConflitoDeReferencia[];
  // Conflitos em que o aluno escolheu a versão do arquivo (§1.5: vale a do
  // AURA até ele escolher, entrada por entrada).
  usarDoArquivo: ReadonlySet<string>;
}

// Assinatura de todo `.zip` ("PK\x03\x04").
function eZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

// "Reimportar LaTeX" (passo 6.2.4): o caminho de volta do Overleaf, pelo
// `.tex` avulso ou pelo `.zip` do projeto. Lê o arquivo no navegador (nada
// vai a servidor), monta o relatório, e só grava depois do "Reimportar", com
// o trabalho de agora guardado antes como versão (docs/latex-abntex.md §1.5,
// princípio 2).
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
    // Antes de ler: nem o `.zip` inteiro (imagens incluídas) nem o `.tex`
    // (UTF-8, até 4 bytes por caractere) chegam perto disto.
    if (arquivo.size > Math.max(LIMITES_ZIP.bytesDescompactados, TAMANHO_MAXIMO_TEX * 4)) {
      setFalhaAoLer(`O arquivo ${arquivo.name} é grande demais para ser o projeto de um TCC.`);
      return;
    }

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await arquivo.arrayBuffer());
    } catch {
      setFalhaAoLer(`Não foi possível ler o arquivo ${arquivo.name}.`);
      return;
    }

    if (eZip(bytes)) await lerZip(arquivo.name, bytes);
    else await lerTexAvulso(arquivo.name, bytes);
  }

  // O trabalho de destino, pelo `id` da primeira linha do `.tex` (§1.5): o
  // aberto, outro desta máquina, ou nenhum (trabalho novo). Sem `id`, fica o
  // aberto, e a leitura recusa o arquivo com a mensagem certa.
  async function destinoDe(
    id: string | null,
  ): Promise<{ atual: Documento | null; destino: Destino } | null> {
    if (!id || id === documento.id) return { atual: documento, destino: { tipo: "este" } };
    try {
      const atual = await persistencia!.carregarDocumento(id);
      return {
        atual,
        destino: atual ? { tipo: "outro", titulo: atual.metadados.titulo } : { tipo: "novo" },
      };
    } catch {
      setFalhaAoLer("Não foi possível abrir os trabalhos salvos neste navegador.");
      return null;
    }
  }

  async function lerTexAvulso(nome: string, bytes: Uint8Array) {
    const texto = decodificarUtf8(bytes);
    if (!texto.ok) {
      setFalhaAoLer(texto.erro.mensagem);
      return;
    }
    const alvo = await destinoDe(idDoDocumento(texto.texto));
    if (!alvo) return;
    // O `\cite` do aluno se resolve contra as referências do destino.
    const lido = lerTex(texto.texto, {
      arquivo: nome,
      chavesDeReferencia: new Set((alvo.atual?.references ?? []).map((item) => item.id)),
    });
    if (!lido.ok) {
      setFalhaAoLer(lido.erro.mensagem);
      return;
    }
    const { documento: novo, relatorio } = montarReimportacao(alvo.atual, lido.tex);
    setPrevia({
      arquivo: nome,
      origem: "tex",
      ...alvo,
      documento: novo,
      relatorio,
      imagens: [],
      conflitos: [],
      usarDoArquivo: new Set(),
    });
  }

  async function lerZip(nome: string, bytes: Uint8Array) {
    const projeto = await lerProjetoZip(bytes);
    if (!projeto.ok) {
      setFalhaAoLer(projeto.erro.mensagem);
      return;
    }
    const alvo = await destinoDe(idDoDocumento(projeto.valor.main));
    if (!alvo) return;

    // As imagens salvas das figuras que vieram no `.zip`, para comparar os
    // bytes: igual, nada muda.
    const imagensSalvas = new Map<string, ImagemArmazenada>();
    if (alvo.atual) {
      for (const id of projeto.valor.figuras.keys()) {
        const imagem = await persistencia!.carregarImagem(alvo.atual.id, id).catch(() => null);
        if (imagem) imagensSalvas.set(id, imagem);
      }
    }

    const resultado = montarReimportacaoDoProjeto({
      atual: alvo.atual,
      projeto: projeto.valor,
      imagensSalvas,
    });
    if (!resultado.ok) {
      setFalhaAoLer(resultado.erro.mensagem);
      return;
    }
    setPrevia({
      arquivo: nome,
      origem: "zip",
      ...alvo,
      documento: resultado.valor.documento,
      relatorio: resultado.valor.relatorio,
      imagens: resultado.valor.imagens,
      conflitos: resultado.valor.relatorio.referencias.conflitos,
      usarDoArquivo: new Set(),
    });
  }

  function alternarReferencia(id: string, usar: boolean) {
    setPrevia((atual) => {
      if (!atual) return atual;
      const usarDoArquivo = new Set(atual.usarDoArquivo);
      if (usar) usarDoArquivo.add(id);
      else usarDoArquivo.delete(id);
      return { ...atual, usarDoArquivo };
    });
  }

  async function confirmar() {
    if (!previa || !persistencia) return;
    const { destino, atual, imagens } = previa;
    const final = comReferenciasEscolhidas(
      previa.documento,
      previa.conflitos,
      previa.usarDoArquivo,
    );
    setGravando(true);
    setFalhaAoGravar(null);
    try {
      // As imagens antes do documento: ele nunca aponta para uma imagem que
      // ainda não existe.
      for (const imagem of imagens) await persistencia.salvarImagem(imagem);

      if (destino.tipo === "este") {
        await substituir(final, NOME_DA_VERSAO_ANTERIOR);
        setPrevia(null);
        return;
      }
      if (atual) {
        await substituirDocumento(persistencia, atual, final, NOME_DA_VERSAO_ANTERIOR);
      } else {
        await persistencia.salvarDocumento(final);
      }
      // O trabalho aberto fica gravado antes de a tela sair dele.
      await salvarAgora().catch((erro: unknown) => {
        console.error("Falha ao salvar antes de abrir o trabalho reimportado:", erro);
      });
      setPrevia(null);
      router.push(`/documento/${encodeURIComponent(final.id)}`);
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
        Reimportar LaTeX
      </Button>
      <input
        ref={entradaArquivo}
        type="file"
        accept=".tex,.zip,text/x-tex,application/x-tex,application/zip"
        className="sr-only"
        tabIndex={-1}
        aria-label="Arquivo .tex ou .zip exportado pelo AURA"
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
          origem={previa.origem}
          destino={previa.destino}
          relatorio={previa.relatorio}
          usarDoArquivo={previa.usarDoArquivo}
          onAlternarReferencia={alternarReferencia}
          gravando={gravando}
          falha={falhaAoGravar}
          onConfirmar={confirmar}
          onFechar={() => setPrevia(null)}
        />
      )}
    </>
  );
}
