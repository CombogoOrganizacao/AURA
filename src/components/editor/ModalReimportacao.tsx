"use client";

import { nomeDaReferencia, PreviaReferencia } from "@/components/referencias/PreviaReferencia";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Radio } from "@/components/ui/Radio";
import type { Aviso } from "@/core/import/latex/fonte";
import type {
  CampoReimportado,
  Comparacao,
  Mudanca,
  Relatorio,
} from "@/core/import/latex/reimport";
import type { RelatorioDoProjeto } from "@/core/import/latex/reimportZip";

// Para onde o arquivo vai (docs/latex-abntex.md §1.5 e §1.6): o trabalho
// aberto, outro trabalho desta máquina, ou um novo.
export type Destino =
  { tipo: "este"; titulo: string } | { tipo: "outro"; titulo: string } | { tipo: "novo" };

// Um destino possível e o relatório do que o arquivo faria com ele.
export interface Alternativa {
  destino: Destino;
  // Do `.zip`, o relatório traz também referências, imagens e ignorados.
  relatorio: Relatorio | RelatorioDoProjeto;
}

interface ModalReimportacaoProps {
  arquivo: string;
  origem: "tex" | "zip";
  // Arquivo de fora do AURA (§1.6): o aluno escolhe o destino.
  externo: boolean;
  alternativas: readonly Alternativa[];
  // `null` enquanto o aluno não escolheu.
  escolhida: number | null;
  onEscolher: (indice: number) => void;
  // Conflitos de referência em que o aluno escolheu a versão do arquivo.
  usarDoArquivo: ReadonlySet<string>;
  onAlternarReferencia: (id: string, usar: boolean) => void;
  gravando: boolean;
  falha: string | null;
  onConfirmar: () => void;
  onFechar: () => void;
}

export const NOME_DA_VERSAO_ANTERIOR = "Antes da reimportação";

const ROTULO_CAMPO: Record<CampoReimportado, string> = {
  titulo: "Título",
  subtitulo: "Subtítulo",
  autores: "Autoria",
  instituicao: "Instituição",
  orientador: "Orientador(a)",
  local: "Local",
  ano: "Ano",
  naturezaTrabalho: "Natureza do trabalho",
  resumo: "Resumo",
  palavrasChave: "Palavras-chave",
  abstract: "Abstract",
  keywords: "Keywords",
  dedicatoria: "Dedicatória",
  agradecimentos: "Agradecimentos",
  epigrafe: "Epígrafe",
};

const ROTULO_MUDANCA: Record<Mudanca, string> = {
  titulo: "título",
  nivel: "nível",
  texto: "texto",
  posicao: "posição",
};

function eDoProjeto(relatorio: Relatorio | RelatorioDoProjeto): relatorio is RelatorioDoProjeto {
  return "referencias" in relatorio;
}

function rotuloDoConfirmar(destino: Destino, externo: boolean): string {
  if (destino.tipo === "novo") return "Criar trabalho";
  return externo ? "Substituir" : "Reimportar";
}

// Relatório da importação (passos 6.2.4 e 6.2.5) antes de qualquer gravação:
// nada muda no trabalho até a confirmação (§1.5, princípio 2). Tudo o que o
// arquivo trouxe de diferente aparece, e os avisos dizem a linha, para o
// aluno achar no arquivo.
export function ModalReimportacao({
  arquivo,
  origem,
  externo,
  alternativas,
  escolhida,
  onEscolher,
  usarDoArquivo,
  onAlternarReferencia,
  gravando,
  falha,
  onConfirmar,
  onFechar,
}: ModalReimportacaoProps) {
  const alternativa = escolhida === null ? null : alternativas[escolhida];
  const destino = alternativa?.destino ?? null;
  const relatorio = alternativa?.relatorio ?? null;
  const nadaAGravar = Boolean(relatorio?.semMudancas && destino?.tipo === "este");

  return (
    <Dialog
      open
      width={720}
      title={externo ? "Importar do LaTeX" : "Reimportar do LaTeX"}
      // O nome do arquivo numa linha só, a partir da esquerda, rolando para
      // o lado quando não cabe; o nome inteiro também aparece no hover.
      subtitle={
        <span title={arquivo} className="block overflow-x-auto whitespace-nowrap pb-1">
          {arquivo}
        </span>
      }
      onClose={gravando ? undefined : onFechar}
      footer={
        nadaAGravar ? (
          <Button onClick={onFechar}>Fechar</Button>
        ) : (
          <>
            <Button variant="ghost" disabled={gravando} onClick={onFechar}>
              Cancelar
            </Button>
            <Button loading={gravando} disabled={!destino} onClick={onConfirmar}>
              {destino ? rotuloDoConfirmar(destino, externo) : "Importar"}
            </Button>
          </>
        )
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
        {falha && (
          <Alert tone="danger" title="Não foi possível gravar">
            {falha}
          </Alert>
        )}
        {externo && (
          <EscolhaDeDestino
            alternativas={alternativas}
            escolhida={escolhida}
            onEscolher={onEscolher}
            origem={origem}
          />
        )}
        {destino && !externo && <AvisoDeDestino destino={destino} origem={origem} />}
        {relatorio?.semMudancas && (
          <Alert tone="success" title="Nada mudou">
            O arquivo diz o mesmo que o trabalho no AURA.
          </Alert>
        )}

        {relatorio && destino && (
          <>
            <GrupoDeComparacao
              titulo="Seções"
              comparacao={relatorio.secoes}
              novo={destino.tipo === "novo"}
            />
            <GrupoDeComparacao
              titulo="Apêndices"
              comparacao={relatorio.apendices}
              novo={destino.tipo === "novo"}
            />
            <GrupoDeComparacao
              titulo="Anexos"
              comparacao={relatorio.anexos}
              novo={destino.tipo === "novo"}
            />

            {relatorio.metadados.length > 0 && (
              <section aria-label="Dados do trabalho alterados" className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-title">
                  Dados do trabalho ({relatorio.metadados.length})
                </h3>
                <ul className="flex flex-col gap-2">
                  {relatorio.metadados.map(({ campo, antes, depois }) => (
                    <li key={campo} className="flex flex-col gap-0.5 text-xs text-body">
                      <span className="font-semibold">{ROTULO_CAMPO[campo]}</span>
                      <span className="line-clamp-2 text-muted line-through">
                        {antes || "(vazio)"}
                      </span>
                      <span className="line-clamp-3">{depois || "(vazio)"}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {eDoProjeto(relatorio) && (
              <DoProjeto
                relatorio={relatorio}
                novo={destino.tipo === "novo"}
                usarDoArquivo={usarDoArquivo}
                onAlternarReferencia={onAlternarReferencia}
              />
            )}

            {relatorio.avisos.length > 0 && <ListaDeAvisos avisos={relatorio.avisos} />}

            {!nadaAGravar && destino.tipo !== "novo" && (
              <p className="text-xs text-muted">
                Antes de gravar, o trabalho como está agora fica guardado no histórico como “
                {NOME_DA_VERSAO_ANTERIOR}”, e pode ser restaurado.
              </p>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

// Arquivo de fora (§1.6): trabalho novo, ou o conteúdo do aberto substituído.
// Nenhuma das duas vem marcada: o aluno escolhe a cada vez.
function EscolhaDeDestino({
  alternativas,
  escolhida,
  onEscolher,
  origem,
}: {
  alternativas: readonly Alternativa[];
  escolhida: number | null;
  onEscolher: (indice: number) => void;
  origem: "tex" | "zip";
}) {
  return (
    <section aria-label="Destino" className="flex flex-col gap-3">
      <Alert tone="info" title="Este arquivo não foi exportado pelo AURA">
        Ele é lido como um trabalho novo: capítulos, seções e texto entram como estão, e o que não
        tem equivalente no AURA vem com aviso.{" "}
        {origem === "tex"
          ? "Figuras e referências só vêm no .zip do projeto."
          : "As referências vêm dos arquivos .bib do pacote."}
      </Alert>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1 text-xs font-semibold text-title">
          O que fazer com este arquivo?
        </legend>
        {alternativas.map(({ destino }, indice) => (
          <Radio
            key={destino.tipo}
            name="destino-da-importacao"
            checked={escolhida === indice}
            onChange={() => onEscolher(indice)}
            label={
              destino.tipo === "novo"
                ? "Criar um trabalho novo"
                : `Substituir o conteúdo de “${destino.titulo || "Documento sem título"}”`
            }
            description={
              destino.tipo === "novo"
                ? "O trabalho aberto não muda."
                : "O conteúdo de agora sai do trabalho e fica guardado no histórico, e pode ser restaurado."
            }
          />
        ))}
      </fieldset>
    </section>
  );
}

function AvisoDeDestino({ destino, origem }: { destino: Destino; origem: "tex" | "zip" }) {
  if (destino.tipo === "outro") {
    return (
      <Alert tone="info" title={`Este arquivo é do trabalho “${destino.titulo || "sem título"}”`}>
        A reimportação vai para ele, e ele é aberto em seguida. O trabalho aberto agora não muda.
      </Alert>
    );
  }
  if (destino.tipo === "novo") {
    return (
      <Alert tone="info" title="Trabalho novo">
        Este arquivo é de um trabalho que não está neste navegador, e a reimportação cria um
        trabalho novo com ele.{" "}
        {origem === "zip"
          ? "As referências vêm do referencias.bib do pacote."
          : "As referências não vêm no .tex avulso: reimporte o .zip do projeto para trazê-las, ou as citações ficam sem referência até você cadastrá-las."}
      </Alert>
    );
  }
  return null;
}

// O que só o `.zip` traz: referências do `.bib`, imagens e arquivos que o
// AURA não lê.
function DoProjeto({
  relatorio,
  novo,
  usarDoArquivo,
  onAlternarReferencia,
}: {
  relatorio: RelatorioDoProjeto;
  novo: boolean;
  usarDoArquivo: ReadonlySet<string>;
  onAlternarReferencia: (id: string, usar: boolean) => void;
}) {
  const { referencias, imagens, ignorados } = relatorio;
  const totalImagens = imagens.atualizadas.length + imagens.novas;

  return (
    <>
      {(referencias.novas.length > 0 || referencias.conflitos.length > 0) && (
        <section aria-label="Referências" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-title">Referências</h3>
          {referencias.novas.length > 0 && (
            <Lista
              rotulo={
                novo
                  ? `Do arquivo (${referencias.novas.length})`
                  : `Novas (${referencias.novas.length})`
              }
            >
              {referencias.novas.map((referencia) => (
                <li key={referencia.id}>{nomeDaReferencia(referencia)}</li>
              ))}
            </Lista>
          )}
          {referencias.conflitos.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-2xs font-semibold tracking-wide text-muted uppercase">
                Diferentes no arquivo ({referencias.conflitos.length})
              </span>
              <p className="text-xs text-muted">
                Fica a versão do AURA, a menos que você marque a do arquivo.
              </p>
              <ul className="flex flex-col gap-3">
                {referencias.conflitos.map((conflito) => (
                  <li
                    key={conflito.id}
                    className="flex flex-col gap-1.5 border-t border-[var(--border-subtle)] pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="text-xs leading-relaxed text-body">
                      <span className="font-semibold">No AURA: </span>
                      <PreviaReferencia referencia={conflito.noAura} />
                    </div>
                    <div className="text-xs leading-relaxed text-body">
                      <span className="font-semibold">No arquivo: </span>
                      <PreviaReferencia referencia={conflito.noArquivo} />
                    </div>
                    <Checkbox
                      checked={usarDoArquivo.has(conflito.id)}
                      onChange={(evento) =>
                        onAlternarReferencia(conflito.id, evento.target.checked)
                      }
                      aria-label={`Usar a versão do arquivo de ${nomeDaReferencia(conflito.noAura)}`}
                      label={<span className="text-xs">Usar a versão do arquivo</span>}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {totalImagens > 0 && (
        <section aria-label="Imagens" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-title">Imagens ({totalImagens})</h3>
          {imagens.atualizadas.length > 0 && (
            <Lista rotulo={`Trocadas (${imagens.atualizadas.length})`}>
              {imagens.atualizadas.map((imagem) => (
                <li key={imagem.imagem}>{imagem.legenda || "Figura sem legenda"}</li>
              ))}
            </Lista>
          )}
          {imagens.novas > 0 && (
            <p className="text-xs text-body">
              {imagens.novas === 1
                ? "1 imagem vem do pacote."
                : `${imagens.novas} imagens vêm do pacote.`}
            </p>
          )}
          {imagens.atualizadas.length > 0 && (
            <p className="text-xs text-muted">A imagem de antes continua na versão guardada.</p>
          )}
        </section>
      )}

      {ignorados.length > 0 && (
        <section aria-label="Arquivos ignorados" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-title">
            Arquivos que o AURA não lê ({ignorados.length})
          </h3>
          <ul className="flex flex-col gap-0.5 overflow-x-auto whitespace-nowrap pb-1 font-mono text-2xs text-muted">
            {ignorados.map((caminho) => (
              <li key={caminho}>{caminho}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function GrupoDeComparacao({
  titulo,
  comparacao,
  novo,
}: {
  titulo: string;
  comparacao: Comparacao;
  novo: boolean;
}) {
  const { novas, removidas, alteradas } = comparacao;
  if (novas.length + removidas.length + alteradas.length === 0) return null;

  return (
    <section aria-label={titulo} className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-title">{titulo}</h3>
      {novas.length > 0 && (
        <Lista rotulo={novo ? `Do arquivo (${novas.length})` : `Novos (${novas.length})`}>
          {novas.map((item) => (
            <li key={item.id}>{item.titulo || "(sem título)"}</li>
          ))}
        </Lista>
      )}
      {alteradas.length > 0 && (
        <Lista rotulo={`Alterados (${alteradas.length})`}>
          {alteradas.map((item) => (
            <li key={item.id}>
              {item.titulo || "(sem título)"}{" "}
              <span className="text-muted">
                — {item.mudancas.map((mudanca) => ROTULO_MUDANCA[mudanca]).join(", ")}
                {item.tituloAntes !== undefined && ` (antes: “${item.tituloAntes}”)`}
              </span>
            </li>
          ))}
        </Lista>
      )}
      {removidas.length > 0 && (
        <Alert tone="warning" title={`Removidos no arquivo (${removidas.length})`}>
          <ul className="list-disc pl-4">
            {removidas.map((item) => (
              <li key={item.id}>{item.titulo || "(sem título)"}</li>
            ))}
          </ul>
          <p className="mt-1">Saem do trabalho. O texto deles fica na versão guardada.</p>
        </Alert>
      )}
    </section>
  );
}

function Lista({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-semibold tracking-wide text-muted uppercase">{rotulo}</span>
      <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-body">{children}</ul>
    </div>
  );
}

function ListaDeAvisos({ avisos }: { avisos: readonly Aviso[] }) {
  return (
    <section aria-label="Avisos da reimportação" className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-title">Avisos ({avisos.length})</h3>
      <ul className="flex flex-col gap-1.5">
        {avisos.map((aviso, indice) => (
          <li key={indice} className="text-xs text-body">
            <span className="font-mono text-2xs text-muted">
              {aviso.linha > 0 ? `${aviso.arquivo}, linha ${aviso.linha}` : aviso.arquivo}
            </span>{" "}
            {aviso.mensagem}
          </li>
        ))}
      </ul>
    </section>
  );
}
