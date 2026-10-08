"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
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

import {
  ModalReimportacao,
  NOME_DA_VERSAO_ANTERIOR,
  type Alternativa as AlternativaDoModal,
  type Destino,
} from "./ModalReimportacao";

interface BotaoReimportarProps {
  // O documento como está na tela: é ele que vira a versão guardada.
  documento: Documento;
  // Troca o documento aberto, guardando o de agora como versão
  // (`EstadoHistorico.substituir`).
  substituir: (novo: Documento, nomeDoAnterior: string) => Promise<void>;
  // Grava já o que está na tela, antes de abrir outro trabalho.
  salvarAgora: () => Promise<void>;
}

// O que o arquivo faria com um destino: o documento resultante, o relatório,
// as imagens a gravar e os conflitos de referência.
interface Montado {
  documento: Documento;
  relatorio: Relatorio | RelatorioDoProjeto;
  imagens: ImagemArmazenada[];
  conflitos: ConflitoDeReferencia[];
}

interface Alternativa extends Montado, AlternativaDoModal {
  // O documento de destino como estava ao ler o arquivo (`null` se novo).
  atual: Documento | null;
}

interface Previa {
  arquivo: string;
  origem: "tex" | "zip";
  // Arquivo de fora do AURA (§1.6): duas alternativas, trabalho novo ou
  // substituir o aberto, e o aluno escolhe.
  externo: boolean;
  alternativas: Alternativa[];
  // `null` enquanto o aluno não escolheu.
  escolhida: number | null;
  // Conflitos em que o aluno escolheu a versão do arquivo (§1.5: vale a do
  // AURA até ele escolher, entrada por entrada).
  usarDoArquivo: ReadonlySet<string>;
}

type Montar = (
  atual: Documento | null,
) => Promise<{ ok: true; valor: Montado } | { ok: false; mensagem: string }>;

// Assinatura de todo `.zip` ("PK\x03\x04").
function eZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

// "Reimportar LaTeX" (passos 6.2.4 e 6.2.5): o caminho de volta do Overleaf,
// e a entrada do TCC que o aluno começou em LaTeX, pelo `.tex` avulso ou
// pelo `.zip` do projeto. Lê o arquivo no navegador (nada vai a servidor),
// monta o relatório, e só grava depois da confirmação, com o trabalho de
// agora guardado antes como versão (docs/latex-abntex.md §1.5 e §1.6).
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

  // Os destinos possíveis, pelo `id` da primeira linha do `.tex` (§1.5 e
  // §1.6): do AURA, o trabalho aberto, outro desta máquina, ou um novo; de
  // fora, as duas escolhas.
  async function destinosDe(
    id: string | null,
  ): Promise<{ destino: Destino; atual: Documento | null }[] | null> {
    const aberto = { tipo: "este", titulo: documento.metadados.titulo } as const;
    if (id === null) {
      return [
        { destino: { tipo: "novo" }, atual: null },
        { destino: aberto, atual: documento },
      ];
    }
    if (id === documento.id) return [{ destino: aberto, atual: documento }];
    try {
      const atual = await persistencia!.carregarDocumento(id);
      return [
        {
          destino: atual ? { tipo: "outro", titulo: atual.metadados.titulo } : { tipo: "novo" },
          atual,
        },
      ];
    } catch {
      setFalhaAoLer("Não foi possível abrir os trabalhos salvos neste navegador.");
      return null;
    }
  }

  async function preparar(nome: string, origem: "tex" | "zip", id: string | null, montar: Montar) {
    const destinos = await destinosDe(id);
    if (!destinos) return;
    const alternativas: Alternativa[] = [];
    for (const { destino, atual } of destinos) {
      const montado = await montar(atual);
      if (!montado.ok) {
        setFalhaAoLer(montado.mensagem);
        return;
      }
      alternativas.push({ destino, atual, ...montado.valor });
    }
    setPrevia({
      arquivo: nome,
      origem,
      externo: id === null,
      alternativas,
      escolhida: alternativas.length === 1 ? 0 : null,
      usarDoArquivo: new Set(),
    });
  }

  async function lerTexAvulso(nome: string, bytes: Uint8Array) {
    const texto = decodificarUtf8(bytes);
    if (!texto.ok) {
      setFalhaAoLer(texto.erro.mensagem);
      return;
    }
    await preparar(nome, "tex", idDoDocumento(texto.texto), async (atual) => {
      // O `\cite` do aluno se resolve contra as referências do destino.
      const lido = lerTex(texto.texto, {
        arquivo: nome,
        chavesDeReferencia: new Set((atual?.references ?? []).map((item) => item.id)),
      });
      if (!lido.ok) return { ok: false, mensagem: lido.erro.mensagem };
      const { documento: novo, relatorio } = montarReimportacao(atual, lido.tex);
      return { ok: true, valor: { documento: novo, relatorio, imagens: [], conflitos: [] } };
    });
  }

  async function lerZip(nome: string, bytes: Uint8Array) {
    const projeto = await lerProjetoZip(bytes);
    if (!projeto.ok) {
      setFalhaAoLer(projeto.erro.mensagem);
      return;
    }
    await preparar(nome, "zip", idDoDocumento(projeto.valor.main), async (atual) => {
      // As imagens salvas das figuras que vieram no `.zip`, para comparar os
      // bytes: igual, nada muda.
      const imagensSalvas = new Map<string, ImagemArmazenada>();
      if (atual) {
        for (const id of projeto.valor.figuras.keys()) {
          const imagem = await persistencia!.carregarImagem(atual.id, id).catch(() => null);
          if (imagem) imagensSalvas.set(id, imagem);
        }
      }
      const resultado = montarReimportacaoDoProjeto({
        atual,
        projeto: projeto.valor,
        imagensSalvas,
      });
      if (!resultado.ok) return { ok: false, mensagem: resultado.erro.mensagem };
      return {
        ok: true,
        valor: {
          documento: resultado.valor.documento,
          relatorio: resultado.valor.relatorio,
          imagens: resultado.valor.imagens,
          conflitos: resultado.valor.relatorio.referencias.conflitos,
        },
      };
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
    if (!previa || !persistencia || previa.escolhida === null) return;
    const {
      destino,
      atual,
      imagens,
      documento: montado,
      conflitos,
    } = previa.alternativas[previa.escolhida];
    const final = comReferenciasEscolhidas(montado, conflitos, previa.usarDoArquivo);
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
      {/* No celular só o ícone (6.4.4), para a barra caber; o nome do botão
          continua "Importar LaTeX". */}
      <Button
        variant="outline"
        disabled={!persistencia}
        onClick={() => entradaArquivo.current?.click()}
        aria-label="Importar LaTeX"
        icon={
          <span className="flex md:hidden">
            <Icon name="file-up" size={16} />
          </span>
        }
      >
        <span className="sr-only md:not-sr-only">Importar LaTeX</span>
      </Button>
      <input
        ref={entradaArquivo}
        type="file"
        accept=".tex,.zip,text/x-tex,application/x-tex,application/zip"
        className="sr-only"
        tabIndex={-1}
        aria-label="Arquivo .tex ou .zip"
        onChange={aoEscolherArquivo}
      />

      {falhaAoLer && (
        <div className="fixed top-16 right-4 z-40 w-[min(420px,calc(100vw-2rem))]">
          <Alert tone="danger" title="Importação recusada" onDismiss={() => setFalhaAoLer(null)}>
            {falhaAoLer}
          </Alert>
        </div>
      )}

      {previa && (
        <ModalReimportacao
          arquivo={previa.arquivo}
          origem={previa.origem}
          externo={previa.externo}
          alternativas={previa.alternativas}
          escolhida={previa.escolhida}
          onEscolher={(indice) =>
            setPrevia((atual) => atual && { ...atual, escolhida: indice, usarDoArquivo: new Set() })
          }
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
