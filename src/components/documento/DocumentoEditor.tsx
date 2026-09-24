"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AppTopBar } from "@/components/app/AppTopBar";
import { BotaoExportar } from "@/components/editor/BotaoExportar";
import { Editor, type IrParaLocal, type MoverSecao } from "@/components/editor/Editor";
import { LayoutEdicao, mostrarColunaEsquerda } from "@/components/editor/LayoutEdicao";
import { PainelInspetor } from "@/components/editor/PainelInspetor";
import { PainelSecoes } from "@/components/editor/PainelSecoes";
import { PainelReferencias } from "@/components/referencias/PainelReferencias";
import { Button } from "@/components/ui/Button";
import { EstadoCarregando, EstadoErro } from "@/components/ui/Estados";
import { novoDocumento } from "@/core/document/factory";
import type { Documento, Metadados, Secao } from "@/core/document/types";
import type { AdaptadorPersistencia } from "@/core/persistence/types";
import type { Achado } from "@/core/rules/compliance";
import { resolveRules } from "@/core/rules/resolve";
import type { Referencia } from "@/core/references/types";
import { usePersistencia } from "@/lib/persistence-provider";
import { useAutosave, type StatusAutosave } from "@/lib/useAutosave";
import { useConferencia } from "@/lib/useConferencia";

import { Abstract } from "./Abstract";
import { PainelAbreviaturas } from "./PainelAbreviaturas";
import { PainelBanca } from "./PainelBanca";
import { FormMetadados } from "./FormMetadados";
import { PainelElementos } from "./PainelElementos";
import { Resumo } from "./Resumo";

interface DocumentoEditorProps {
  documentoId: string;
}

// Regras da conferência (passo 5.2.3). Na v1 não há preset, edital nem
// override (docs/to-do.md, 5.1.1): as regras são a ABNT auditada, e resolver
// uma vez basta.
const REGRAS = resolveRules("abnt", null, null).regras;

// Qual `<details data-painel>` da coluna esquerda edita cada campo de
// metadado. É o que leva o clique num achado de metadado ao campo certo.
const PAINEL_DO_CAMPO: Partial<Record<keyof Metadados, string>> = {
  titulo: "dados",
  subtitulo: "dados",
  autores: "dados",
  instituicao: "dados",
  curso: "dados",
  orientador: "dados",
  local: "dados",
  ano: "dados",
  naturezaTrabalho: "dados",
  bancaExaminadora: "aprovacao",
  resumo: "resumo",
  palavrasChave: "resumo",
  abstract: "abstract",
  keywords: "abstract",
  dedicatoria: "elementos",
  agradecimentos: "elementos",
  epigrafe: "elementos",
  abreviaturas: "abreviaturas",
};

// Abre o painel da coluna esquerda (reabrindo a coluna, se recolhida), rola
// até ele e põe o foco no campo marcado com `data-campo`, ou no primeiro
// campo do painel quando o campo não tem marca própria (lista de
// palavras-chave, banca). DOM direto, como `irParaSecao()` em
// `PainelSecoes.tsx`: os painéis são `<details>` nativos, sem estado React.
function abrirPainel(painel: string, campo?: string) {
  mostrarColunaEsquerda();
  const detalhes = document.querySelector<HTMLDetailsElement>(
    `details[data-painel="${CSS.escape(painel)}"]`,
  );
  if (!detalhes) return;
  detalhes.open = true;
  // O quadro seguinte: a coluna pode ter acabado de reabrir.
  requestAnimationFrame(() => {
    const alvo =
      (campo && detalhes.querySelector<HTMLElement>(`[data-campo="${CSS.escape(campo)}"]`)) ||
      detalhes.querySelector<HTMLElement>("input, textarea, button:not([disabled])");
    detalhes.scrollIntoView({ behavior: "smooth", block: "start" });
    alvo?.focus({ preventScroll: true });
  });
}

const TEXTO_STATUS: Record<StatusAutosave, string> = {
  pendente: "Alterações não salvas…",
  salvando: "Salvando…",
  salvo: "Salvo",
  erro: "Erro ao salvar",
};

// Dono único do `Documento` na tela de edição (passo 1.3.7). Inserido ao
// perceber, testando o exportador (1.4.4), que `FormMetadados` e `Editor`
// não podiam continuar cada um carregando e salvando sua própria cópia do
// `Documento`: o autosave de um sobrescrevia inteiro o `Documento` com
// dados desatualizados do outro (o último a salvar apagava a mudança mais
// recente, em silêncio). Aqui só há um `useAutosave`, sobre o `Documento`
// inteiro; `FormMetadados` e `Editor` são controlados — só editam sua
// fatia (`metadados` / `sections`) e devolvem a mudança pra cá.
//
// A partir do passo 2B.10, esta é a única tela que monta `AppTopBar` no
// modo `editor` — o que exige montá-lo também nos ramos de carregamento e
// erro, aqui embaixo, sem `docTitle`/`statusAutosave`/`acoes` (não há
// documento carregado ainda pra preenchê-los).
export function DocumentoEditor({ documentoId }: DocumentoEditorProps) {
  const persistencia = usePersistencia();
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!persistencia) return;
    let cancelado = false;

    persistencia
      .carregarDocumento(documentoId)
      .then((encontrado) => {
        if (cancelado) return;
        // Documento inexistente = primeira vez que este id é usado; nasce
        // vazio, com o id que foi pedido (não o que novoDocumento() geraria).
        setDocumento(encontrado ?? { ...novoDocumento(), id: documentoId });
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        console.error("Falha ao carregar documento:", erro);
        setErroAoCarregar(true);
      });

    return () => {
      cancelado = true;
    };
  }, [persistencia, documentoId, tentativa]);

  // Reseta pro estado de carregamento aqui, não no efeito acima — mesmo
  // motivo de `app/page.tsx`: setState síncrono dentro de efeito é o que o
  // lint de hooks recusa.
  function tentarDeNovo() {
    setDocumento(null);
    setErroAoCarregar(false);
    setTentativa((n) => n + 1);
  }

  if (erroAoCarregar) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <AppTopBar mode="editor" />
        <EstadoErro
          titulo="Não foi possível carregar este documento."
          action={
            <Button variant="outline" onClick={tentarDeNovo}>
              Tentar de novo
            </Button>
          }
        />
      </div>
    );
  }

  if (!documento || !persistencia) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <AppTopBar mode="editor" />
        <EstadoCarregando texto="Carregando documento…" />
      </div>
    );
  }

  // `Carregado` só monta quando `documento` já existe — é o que faz o "não
  // salva na primeira renderização" do useAutosave coincidir com "não
  // salva o que acabou de ser carregado, sem edição nenhuma" (mesmo
  // truque de FormMetadados no passo 1.3.6).
  return (
    <Carregado documentoId={documentoId} documentoInicial={documento} persistencia={persistencia} />
  );
}

function Carregado({
  documentoId,
  documentoInicial,
  persistencia,
}: {
  documentoId: string;
  documentoInicial: Documento;
  persistencia: AdaptadorPersistencia;
}) {
  const [documento, setDocumento] = useState(documentoInicial);
  const status = useAutosave(documento, (atual) => persistencia.salvarDocumento(atual));

  function atualizarMetadados(atualizador: (atual: Metadados) => Metadados) {
    setDocumento((atual) => ({ ...atual, metadados: atualizador(atual.metadados) }));
  }

  function atualizarSecoes(secoes: Secao[]) {
    setDocumento((atual) => ({ ...atual, sections: secoes }));
  }

  function atualizarReferencias(atualizador: (atual: Referencia[]) => Referencia[]) {
    setDocumento((atual) => ({ ...atual, references: atualizador(atual.references) }));
  }

  // `PainelSecoes` (irmão de `Editor`, sem acesso à instância do TipTap)
  // reordena através desta ref — passo 3.2.4. `useCallback` com deps vazias
  // dá pro `onReorderReady` de `Editor.tsx` uma identidade estável, então o
  // efeito que a chama roda só quando o editor troca de instância de
  // verdade, não a cada re-render deste componente (autosave, digitação...).
  const moverSecaoRef = useRef<MoverSecao | null>(null);
  const registrarComandoDeReordenar = useCallback((mover: MoverSecao) => {
    moverSecaoRef.current = mover;
  }, []);
  const reordenarSecoes: MoverSecao = useCallback((idOrigem, idDestino, inserirDepois) => {
    moverSecaoRef.current?.(idOrigem, idDestino, inserirDepois);
  }, []);

  // Conferência (passo 5.2.3), recalculada na pausa da digitação (5.2.4).
  // A chave "Verificar enquanto escrevo" vale só nesta sessão do editor.
  const [verificarEnquantoEscrevo, setVerificarEnquantoEscrevo] = useState(true);
  const conferencia = useConferencia(documento, REGRAS, { ativa: verificarEnquantoEscrevo });

  // Mesmo padrão do reordenar: o `Editor` entrega o comando, a ref guarda a
  // versão mais recente.
  const irParaLocalRef = useRef<IrParaLocal | null>(null);
  const registrarIrPara = useCallback((irPara: IrParaLocal) => {
    irParaLocalRef.current = irPara;
  }, []);

  const irParaAchado = useCallback((achado: Achado) => {
    const { local } = achado;
    if (local.tipo === "bloco") {
      irParaLocalRef.current?.(local);
    } else if (local.tipo === "metadado") {
      const painel = PAINEL_DO_CAMPO[local.campo];
      if (painel) abrirPainel(painel, local.campo);
    } else if (local.tipo === "referencia") {
      abrirPainel("referencias");
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppTopBar
        mode="editor"
        docTitle={documento.metadados.titulo}
        statusAutosave={TEXTO_STATUS[status]}
        acoes={<BotaoExportar documentoId={documentoId} />}
      />
      <LayoutEdicao
        sidebar={
          <div className="flex min-h-0 flex-1 flex-col">
            {/*
              `<details>` nativo — recolhível sem estado React nem
              primitivo de acordeão novo (não pedido neste passo). Começa
              fechado: a seção é o que a coluna prioriza; metadados são
              consulta ocasional, não o que se olha a cada abertura.
            */}
            <details
              data-painel="dados"
              className="shrink-0 border-b border-[var(--border-subtle)]"
            >
              <summary className="cursor-pointer px-4 py-3 font-sans text-xs font-semibold tracking-wide text-body select-none">
                Dados do trabalho
              </summary>
              <div className="px-4 pb-4">
                <FormMetadados metadados={documento.metadados} onChange={atualizarMetadados} />
              </div>
            </details>
            <details
              data-painel="aprovacao"
              className="shrink-0 border-b border-[var(--border-subtle)]"
            >
              <summary className="cursor-pointer px-4 py-3 font-sans text-xs font-semibold tracking-wide text-body select-none">
                Folha de aprovação
              </summary>
              <div className="px-4 pb-4">
                <PainelBanca metadados={documento.metadados} onChange={atualizarMetadados} />
              </div>
            </details>
            <details
              data-painel="resumo"
              className="shrink-0 border-b border-[var(--border-subtle)]"
            >
              <summary className="cursor-pointer px-4 py-3 font-sans text-xs font-semibold tracking-wide text-body select-none">
                Resumo e palavras-chave
              </summary>
              <div className="px-4 pb-4">
                <Resumo metadados={documento.metadados} onChange={atualizarMetadados} />
              </div>
            </details>
            <details
              data-painel="abstract"
              className="shrink-0 border-b border-[var(--border-subtle)]"
            >
              <summary className="cursor-pointer px-4 py-3 font-sans text-xs font-semibold tracking-wide text-body select-none">
                Abstract e keywords
              </summary>
              <div className="px-4 pb-4">
                <Abstract metadados={documento.metadados} onChange={atualizarMetadados} />
              </div>
            </details>
            <details
              data-painel="elementos"
              className="shrink-0 border-b border-[var(--border-subtle)]"
            >
              <summary className="cursor-pointer px-4 py-3 font-sans text-xs font-semibold tracking-wide text-body select-none">
                Elementos opcionais
              </summary>
              <div className="px-4 pb-4">
                <PainelElementos metadados={documento.metadados} onChange={atualizarMetadados} />
              </div>
            </details>
            <details
              data-painel="abreviaturas"
              className="shrink-0 border-b border-[var(--border-subtle)]"
            >
              <summary className="cursor-pointer px-4 py-3 font-sans text-xs font-semibold tracking-wide text-body select-none">
                Abreviaturas e siglas
              </summary>
              <div className="px-4 pb-4">
                {/*
                  Recebe `sections` além de `metadados` (passo 3.6.4): o
                  painel avisa quando uma sigla cadastrada ainda não aparece
                  no texto, e para isso precisa olhar o corpo. É leitura, não
                  edição — quem escreve em `sections` continua sendo só o
                  editor.
                */}
                <PainelAbreviaturas
                  metadados={documento.metadados}
                  sections={documento.sections}
                  onChange={atualizarMetadados}
                />
              </div>
            </details>
            {/*
              Referências **só no desktop** (critério do passo 4.5), com o
              mesmo `hidden md:block` da tabela e da fórmula na `Toolbar`
              (3.6.3/3.6.5). Cadastrar uma referência é preencher de seis a
              doze campos separados — autoria, título, imprenta, paginação —, e
              num teclado virtual isso deixa de ser tarefa e vira provação. O
              que o breakpoint tira é o CADASTRO: as referências já cadastradas
              continuam saindo no `.docx` exportado de qualquer largura.

              O 6.4.5 troca este `hidden` por "desabilitado com explicação",
              junto com os outros três — sumir sem aviso é pior que impedir
              com motivo, e a troca vale a pena fazer de uma vez só.
            */}
            <details
              data-painel="referencias"
              className="hidden shrink-0 border-b border-[var(--border-subtle)] md:block"
            >
              <summary className="cursor-pointer px-4 py-3 font-sans text-xs font-semibold tracking-wide text-body select-none">
                Referências
              </summary>
              <div className="px-4 pb-4">
                <PainelReferencias
                  references={documento.references}
                  onChange={atualizarReferencias}
                />
              </div>
            </details>
            <PainelSecoes sections={documento.sections} onReorder={reordenarSecoes} />
          </div>
        }
        inspetor={
          <PainelInspetor
            documentoId={documentoId}
            conferencia={conferencia}
            verificarEnquantoEscrevo={verificarEnquantoEscrevo}
            onVerificarEnquantoEscrevoChange={(ligar) => {
              setVerificarEnquantoEscrevo(ligar);
              // Religar confere na hora, sem esperar a próxima pausa.
              if (ligar) conferencia.conferirAgora();
            }}
            onIrPara={irParaAchado}
          />
        }
      >
        <Editor
          sections={documento.sections}
          references={documento.references}
          onSectionsChange={atualizarSecoes}
          onReorderReady={registrarComandoDeReordenar}
          onIrParaReady={registrarIrPara}
        />
      </LayoutEdicao>
    </div>
  );
}
