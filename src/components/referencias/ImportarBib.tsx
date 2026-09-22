"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { importarBibtex, type ResultadoImportacao } from "@/core/references/import/bibtexToCsl";
import { ROTULO_TIPO, type Referencia } from "@/core/references/types";

import { nomeDaReferencia, PreviaReferencia } from "./PreviaReferencia";

interface ImportarBibProps {
  onImportar: (referencias: Referencia[]) => void;
}

// Teto do arquivo lido. Um `.bib` de TCC tem dezenas de KB; 2 MB cobre a
// biblioteca inteira de um orientador exportada do Zotero. O limite existe
// porque o arquivo vem de fora e é lido inteiro na memória da aba — sem ele,
// um arquivo errado de centenas de MB trava o editor com o trabalho aberto.
const TAMANHO_MAXIMO = 2 * 1024 * 1024;

interface Previa {
  arquivo: string;
  resultado: ResultadoImportacao;
  // `id` das importadas que a pessoa DESMARCOU. Guardar as descartadas, e não
  // as escolhidas, é o que faz "tudo marcado" ser o estado inicial sem copiar
  // a lista inteira para o estado.
  desmarcadas: ReadonlySet<string>;
}

// Importação de `.bib` com prévia antes de confirmar (passo 4.7). Nada entra
// no documento até o "Importar": o arquivo é de outra ferramenta, e o
// mapeamento do 4.6 supõe coisas (nome do evento, papel do organizador) que
// a pessoa precisa ver antes de virarem referência do trabalho dela.
//
// **Tudo o que o arquivo trouxe aparece**, em três grupos, na mesma ordem do
// `ResultadoImportacao`: as que entram (marcadas, com os avisos embaixo), as
// que o AURA não conseguiu converter (com o motivo) e os trechos com erro de
// sintaxe (com a linha). Uma entrada que some sem explicação faria a pessoa
// desconfiar das outras.
//
// O arquivo é lido no navegador e não vai a servidor nenhum — o `.bib` pode
// ter anotações pessoais em `note` e `abstract`.
export function ImportarBib({ onImportar }: ImportarBibProps) {
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  async function aoEscolherArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    // Zera o campo: sem isso, escolher o MESMO arquivo de novo (depois de
    // corrigi-lo no Overleaf) não dispara `change`.
    evento.target.value = "";
    if (!arquivo) return;

    setFalha(null);
    if (arquivo.size > TAMANHO_MAXIMO) {
      setFalha(`O arquivo ${arquivo.name} tem mais de 2 MB — não parece um .bib de referências.`);
      return;
    }

    let texto: string;
    try {
      texto = await arquivo.text();
    } catch {
      setFalha(`Não foi possível ler o arquivo ${arquivo.name}.`);
      return;
    }

    const resultado = importarBibtex(texto, () => crypto.randomUUID());
    const total =
      resultado.importadas.length + resultado.descartadas.length + resultado.erros.length;
    if (total === 0) {
      setFalha(`Nenhuma referência encontrada em ${arquivo.name}.`);
      return;
    }
    setPrevia({ arquivo: arquivo.name, resultado, desmarcadas: new Set() });
  }

  function alternar(id: string, marcada: boolean) {
    setPrevia((atual) => {
      if (!atual) return atual;
      const desmarcadas = new Set(atual.desmarcadas);
      if (marcada) desmarcadas.delete(id);
      else desmarcadas.add(id);
      return { ...atual, desmarcadas };
    });
  }

  function marcarTodas(marcar: boolean) {
    setPrevia(
      (atual) =>
        atual && {
          ...atual,
          desmarcadas: marcar
            ? new Set()
            : new Set(atual.resultado.importadas.map((item) => item.referencia.id)),
        },
    );
  }

  const escolhidas =
    previa?.resultado.importadas
      .filter((item) => !previa.desmarcadas.has(item.referencia.id))
      .map((item) => item.referencia) ?? [];

  function confirmar() {
    if (escolhidas.length > 0) onImportar(escolhidas);
    setPrevia(null);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => entradaArquivo.current?.click()}>
        Importar .bib
      </Button>
      <input
        ref={entradaArquivo}
        type="file"
        accept=".bib,text/x-bibtex,application/x-bibtex"
        className="sr-only"
        tabIndex={-1}
        aria-label="Arquivo .bib"
        onChange={aoEscolherArquivo}
      />

      {falha && (
        <Alert tone="danger" className="w-full" onDismiss={() => setFalha(null)}>
          {falha}
        </Alert>
      )}

      {previa && (
        <Dialog
          open
          width={720}
          title="Importar referências"
          subtitle={resumo(previa)}
          onClose={() => setPrevia(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPrevia(null)}>
                Cancelar
              </Button>
              <Button disabled={escolhidas.length === 0} onClick={confirmar}>
                {rotuloConfirmar(escolhidas.length)}
              </Button>
            </>
          }
        >
          <ConteudoPrevia previa={previa} onAlternar={alternar} onMarcarTodas={marcarTodas} />
        </Dialog>
      )}
    </>
  );
}

function ConteudoPrevia({
  previa,
  onAlternar,
  onMarcarTodas,
}: {
  previa: Previa;
  onAlternar: (id: string, marcada: boolean) => void;
  onMarcarTodas: (marcar: boolean) => void;
}) {
  const { importadas, descartadas, erros } = previa.resultado;
  const todasMarcadas = previa.desmarcadas.size === 0;

  return (
    // A lista rola dentro do diálogo: com 40 entradas, o rodapé com o
    // "Importar" sairia da tela.
    <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
      {importadas.length > 0 && (
        <section aria-label="Referências encontradas" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-title">Encontradas ({importadas.length})</h3>
            <Button variant="quiet" size="sm" onClick={() => onMarcarTodas(!todasMarcadas)}>
              {todasMarcadas ? "Desmarcar todas" : "Marcar todas"}
            </Button>
          </div>
          <ul className="flex flex-col gap-3">
            {importadas.map(({ chave, referencia, avisos }) => (
              <li
                key={referencia.id}
                className="flex flex-col gap-1.5 border-t border-[var(--border-subtle)] pt-3 first:border-t-0 first:pt-0"
              >
                <Checkbox
                  checked={!previa.desmarcadas.has(referencia.id)}
                  onChange={(evento) => onAlternar(referencia.id, evento.target.checked)}
                  aria-label={`Importar ${nomeDaReferencia(referencia)}`}
                  label={
                    <span className="text-xs font-normal leading-relaxed text-body">
                      <PreviaReferencia referencia={referencia} />
                    </span>
                  }
                  description={
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge>{ROTULO_TIPO[referencia.type]}</Badge>
                      <code className="font-mono text-2xs text-muted">{chave}</code>
                    </span>
                  }
                />
                {avisos.length > 0 && (
                  <ul className="ml-7 flex flex-col gap-1">
                    {avisos.map((aviso, indice) => (
                      <li key={indice} className="text-2xs leading-snug text-warning">
                        {aviso}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {descartadas.length > 0 && (
        <section aria-label="Entradas que não serão importadas" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-title">
            Não serão importadas ({descartadas.length})
          </h3>
          <ul className="flex flex-col gap-1.5">
            {descartadas.map((item) => (
              <li key={`${item.chave}-${item.linha}`} className="text-2xs leading-snug text-muted">
                <code className="font-mono">{item.chave}</code> (linha {item.linha}): {item.motivo}
              </li>
            ))}
          </ul>
          <p className="text-2xs text-muted">
            Se precisar de alguma delas, cadastre com “Nova referência”.
          </p>
        </section>
      )}

      {erros.length > 0 && (
        <section aria-label="Trechos com erro no arquivo" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-title">
            Trechos que não puderam ser lidos ({erros.length})
          </h3>
          <ul className="flex flex-col gap-1.5">
            {erros.map((erro) => (
              <li
                key={`${erro.linha}-${erro.mensagem}`}
                className="text-2xs leading-snug text-danger"
              >
                {erro.chave ? (
                  <>
                    <code className="font-mono">{erro.chave}</code> (linha {erro.linha})
                  </>
                ) : (
                  <>Entrada da linha {erro.linha}</>
                )}
                : {erro.mensagem}.
                {/*
                  A linha em que a leitura parou quase nunca é a do defeito —
                  uma chave sem fechar só é percebida quando a próxima entrada
                  já começou. Vai junto porque ajuda a achar o trecho, mas
                  depois do que importa.
                */}
                {erro.linhaDaParada !== erro.linha && (
                  <span className="text-muted">
                    {" "}
                    A leitura parou na linha {erro.linhaDaParada}.
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-2xs text-muted">
            O resto do arquivo foi lido normalmente. Corrija esses trechos no .bib e importe de
            novo, se quiser.
          </p>
        </section>
      )}
    </div>
  );
}

function resumo({ arquivo, resultado }: Previa): string {
  const n = resultado.importadas.length;
  const encontradas = n === 1 ? "1 referência encontrada" : `${n} referências encontradas`;
  return `${arquivo} — ${encontradas}. Desmarque as que não quiser trazer.`;
}

function rotuloConfirmar(n: number): string {
  if (n === 0) return "Nenhuma selecionada";
  return n === 1 ? "Importar 1 referência" : `Importar ${n} referências`;
}
