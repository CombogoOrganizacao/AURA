"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { baixar, nomeArquivo } from "@/components/editor/baixarArquivo";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { Documento } from "@/core/document/types";
import { cabeNoOverleaf, camposOverleaf, ENDERECO_OVERLEAF } from "@/core/export/latex/overleaf";
import { dadosFaltando, type CampoExigido } from "@/core/rules/checks/dadosDeIdentificacao";
import { blobDoZip, docxDoDocumento, texDoDocumento, zipLatexDoDocumento } from "@/lib/exportar";
import { usePersistencia } from "@/lib/persistence-provider";

interface ModalExportarProps {
  // O documento como está na tela, e não o salvo.
  documento: Documento;
  // Grava já, sem esperar o autosave: o que sai do AURA fica também salvo.
  salvarAgora: () => Promise<void>;
  onFechar: () => void;
  // Leva ao campo que falta, nos dados do trabalho (6.2.12).
  onPreencherDados?: (campo: CampoExigido) => void;
}

type Projeto =
  | { status: "preparando" }
  | { status: "pronto"; zip: Uint8Array; campos: Record<string, string>; cabe: boolean }
  | { status: "erro" };

type Formato = "docx" | "tex" | "zip";

// Janela de exportação (passo 6.3.2): os três formatos num lugar só.
//
// - **`.docx` é o principal** (§1.7): é o que a banca e a secretaria pedem, e
//   o que o Word transforma em PDF. **Não há PDF aqui** (fora da v1, §2.2): a
//   nota diz como gerá-lo no Word.
// - **Projeto LaTeX (`.zip`)**: `main.tex`, capítulos, `referencias.bib` e
//   figuras. "Abrir no Overleaf" (6.3.1) aparece ao lado só quando o projeto
//   cabe no que o Overleaf recebe por POST (`cabeNoOverleaf()`, limite medido);
//   o pacote é montado ao abrir a janela, para o envio sair no próprio clique
//   (aberto depois de uma espera, o Overleaf numa aba nova seria barrado como
//   pop-up). **Nenhuma URL do trabalho é gerada**: o `.zip` vai dentro do
//   POST, do navegador direto para o Overleaf (CSP: `form-action` só para
//   `https://www.overleaf.com`).
// - **Só o `.tex`**: um arquivo. As figuras ficam só referenciadas, e a janela
//   avisa (docs/latex-abntex.md §1.4).
//
// **Dado de capa faltando avisa no topo, sem impedir** (6.2.12): vale para os
// três formatos, e "Preencher dados" leva ao campo.
//
// A janela continua aberta depois de um download, para quem quer mais de um
// formato; só o "Abrir no Overleaf", que leva a outra aba, a fecha. Sem
// rodapé: o X basta para fechar.
export function ModalExportar({
  documento,
  salvarAgora,
  onFechar,
  onPreencherDados,
}: ModalExportarProps) {
  const persistencia = usePersistencia();
  const [projeto, setProjeto] = useState<Projeto>({ status: "preparando" });
  const [gerando, setGerando] = useState<Formato | null>(null);
  const [erro, setErro] = useState<Formato | null>(null);
  const faltando = dadosFaltando(documento.metadados);
  const figuras = figurasComImagem(documento);

  // Grava e monta o projeto LaTeX uma vez, ao abrir.
  useEffect(() => {
    if (!persistencia) return;
    let cancelado = false;
    salvarAgora()
      .catch((falha: unknown) => console.error("Falha ao salvar antes de exportar:", falha))
      .then(() => zipLatexDoDocumento(persistencia, documento))
      .then((zip) => {
        if (cancelado) return;
        const campos = camposOverleaf(zip);
        setProjeto({ status: "pronto", zip, campos, cabe: cabeNoOverleaf(campos) });
      })
      .catch((falha: unknown) => {
        console.error("Falha ao montar o projeto LaTeX:", falha);
        if (!cancelado) setProjeto({ status: "erro" });
      });
    return () => {
      cancelado = true;
    };
    // A janela exporta o documento de quando foi aberta: ela é modal, e nada
    // o muda enquanto está aberta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistencia]);

  async function gerar(formato: Formato, acao: () => Promise<void>) {
    setGerando(formato);
    setErro(null);
    try {
      await acao();
    } catch (falha) {
      console.error(`Falha ao exportar ${formato}:`, falha);
      setErro(formato);
    } finally {
      setGerando(null);
    }
  }

  const nome = nomeArquivo(documento);

  function baixarDocx() {
    if (!persistencia) return;
    void gerar("docx", async () => {
      baixar(await docxDoDocumento(persistencia, documento), `${nome}.docx`);
    });
  }

  function baixarTex() {
    if (!persistencia) return;
    void gerar("tex", async () => {
      const tex = await texDoDocumento(persistencia, documento);
      baixar(new Blob([tex], { type: "application/x-tex" }), `${nome}.tex`);
    });
  }

  function baixarZip(zip: Uint8Array) {
    baixar(blobDoZip(zip), `${nome}.zip`);
  }

  function abrirNoOverleaf(campos: Record<string, string>) {
    // Formulário de verdade, e não `fetch`: o Overleaf abre o projeto na aba
    // nova, com a sessão da pessoa lá. `noopener noreferrer`: a aba do
    // Overleaf não recebe acesso a esta nem o endereço dela.
    const formulario = document.createElement("form");
    formulario.method = "post";
    formulario.action = ENDERECO_OVERLEAF;
    formulario.target = "_blank";
    formulario.rel = "noopener noreferrer";
    formulario.hidden = true;
    for (const [campo, valor] of Object.entries(campos)) {
      const entrada = document.createElement("input");
      entrada.type = "hidden";
      entrada.name = campo;
      entrada.value = valor;
      formulario.append(entrada);
    }
    document.body.append(formulario);
    formulario.submit();
    formulario.remove();
    onFechar();
  }

  const pronto = projeto.status === "pronto" ? projeto : null;

  return (
    <Dialog
      open
      width={600}
      title="Exportar"
      subtitle="Uma cópia do trabalho, no formato que você escolher"
      onClose={onFechar}
    >
      <div className="flex flex-col gap-4 text-sm text-body">
        {faltando.length > 0 && (
          <Alert tone="warning" title="Faltam dados da capa">
            <p>A capa e a folha de rosto vão sair sem:</p>
            <ul className="list-disc pl-5">
              {faltando.map((item) => (
                <li key={item.campo}>{item.nome}</li>
              ))}
            </ul>
            {onPreencherDados && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  onFechar();
                  onPreencherDados(faltando[0].campo);
                }}
              >
                Preencher dados
              </Button>
            )}
          </Alert>
        )}

        <Formato
          titulo="Word (.docx)"
          destaque="Formato principal"
          acoes={
            <Button loading={gerando === "docx"} disabled={!persistencia} onClick={baixarDocx}>
              Baixar .docx
            </Button>
          }
        >
          <p>
            Abre no Word, no LibreOffice e no Google Docs, com os estilos, o sumário e a numeração
            de páginas da norma. Ao abrir, o Word pergunta se atualiza os campos: confirme, para o
            sumário e as listas saírem com as páginas.
          </p>
          <p className="text-xs text-muted">
            Para entregar em PDF, abra o .docx no Word e use Arquivo → Salvar como → PDF. O AURA não
            gera PDF.
          </p>
          {erro === "docx" && <Falha formato=".docx" />}
        </Formato>

        <Formato
          titulo="Projeto LaTeX (.zip)"
          acoes={
            <>
              {pronto?.cabe && (
                <Button variant="outline" onClick={() => abrirNoOverleaf(pronto.campos)}>
                  Abrir no Overleaf
                </Button>
              )}
              <Button
                variant="outline"
                loading={projeto.status === "preparando"}
                disabled={!pronto}
                onClick={() => pronto && baixarZip(pronto.zip)}
              >
                Baixar .zip
              </Button>
            </>
          }
        >
          <p>
            O main.tex, um arquivo por capítulo, as referências em referencias.bib e as figuras. No
            Overleaf, envie-o em New Project → Upload Project.
          </p>
          {pronto && (
            <p className="text-xs text-muted">Tamanho do projeto: {tamanho(pronto.zip.length)}.</p>
          )}
          {pronto?.cabe && (
            <p className="text-xs text-muted">
              “Abrir no Overleaf” envia o projeto do seu navegador direto para o Overleaf, que o
              cria na sua conta. O AURA não guarda cópia nem gera link do trabalho.
            </p>
          )}
          {pronto && !pronto.cabe && (
            <p className="text-xs text-muted">
              Grande demais para abrir direto no Overleaf, que só recebe assim projetos de até cerca
              de 1,4 MB: baixe o .zip e envie-o pelo Upload Project.
            </p>
          )}
          {projeto.status === "erro" && <Falha formato="projeto LaTeX" />}
        </Formato>

        <Formato
          titulo="Só o .tex"
          acoes={
            <Button
              variant="outline"
              loading={gerando === "tex"}
              disabled={!persistencia}
              onClick={baixarTex}
            >
              Baixar .tex
            </Button>
          }
        >
          <p>Um arquivo só, para quem já tem um projeto LaTeX montado.</p>
          {figuras > 0 && (
            <p className="text-xs text-muted">
              {figuras === 1
                ? "A figura do trabalho fica só indicada no arquivo, sem a imagem"
                : `As ${figuras} figuras do trabalho ficam só indicadas no arquivo, sem as imagens`}
              : elas vêm no .zip, e sem elas o .tex não compila.
            </p>
          )}
          {erro === "tex" && <Falha formato=".tex" />}
        </Formato>

        <p className="text-xs text-muted">
          O que você editar fora do AURA não volta sozinho. Para trazer as mudanças de um projeto
          LaTeX, use “Importar LaTeX” (no Overleaf, Menu → Download → Source).
        </p>
      </div>
    </Dialog>
  );
}

function Formato({
  titulo,
  destaque,
  acoes,
  children,
}: {
  titulo: string;
  destaque?: string;
  acoes: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={titulo}
      className={[
        "flex flex-col gap-2 rounded-md border p-4",
        destaque ? "border-bordo-200 bg-brand-soft" : "border-[var(--border-subtle)]",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-sans text-sm font-semibold text-title">
          {titulo}
          {destaque && (
            <span className="rounded-xs bg-bordo-700 px-1.5 py-0.5 text-2xs font-medium text-on-bordo">
              {destaque}
            </span>
          )}
        </h3>
        <div className="flex flex-wrap gap-2">{acoes}</div>
      </div>
      {children}
    </section>
  );
}

function Falha({ formato }: { formato: string }) {
  return (
    <Alert tone="danger" title={`Não foi possível gerar o ${formato}`}>
      Tente de novo. Se o erro continuar, feche a janela e exporte outro formato.
    </Alert>
  );
}

// Figuras do corpo com imagem: são as que o `.tex` avulso referencia sem
// levar o arquivo. Figura sem imagem sai como moldura de aviso nos dois.
function figurasComImagem(documento: Documento): number {
  return documento.sections
    .flatMap((secao) => secao.content)
    .filter((no) => no.type === "figura" && no.imagem !== null).length;
}

function tamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
