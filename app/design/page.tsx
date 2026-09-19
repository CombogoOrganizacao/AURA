// Página de amostra dos tokens visuais (passo 2.1) e dos componentes base
// (passos 2.2 a 2.4). Não é tela da v1 — é a referência viva do que está em
// app/globals.css, src/components/ui/ e docs/design.md. Deve continuar
// batendo com os três sempre que um token ou componente mudar.
//
// Desde o passo 4.2 ela hospeda também um componente de FUNCIONALIDADE, e não
// só primitivo de `ui/`: o formulário de referência, que é controlado e ainda
// não tem dono — quem vai segurá-lo é o painel de gerenciamento do passo 4.5.
// O Vitest deste projeto só roda sobre `src/core/`, então a metade visual de
// um passo como esse precisa de uma página para o Playwright dirigir. Sai
// daqui quando o 4.5 lhe der lugar próprio.

import { AppTopBar } from "@/components/app/AppTopBar";
import { Brand } from "@/components/app/Brand";
import { LayoutEdicao } from "@/components/editor/LayoutEdicao";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "@/components/ui/Estados";
import { Alert } from "@/components/ui/Alert";
import { Icon, NOMES_ICONES } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { PaperSheet } from "@/components/ui/PaperSheet";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RevisionMark } from "@/components/ui/RevisionMark";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";

import { DialogDemo } from "./DialogDemo";
import { FormReferenciaDemo } from "./FormReferenciaDemo";
import { AlertDismissDemo, CheckboxDemo, RadioDemo, SwitchDemo, TextareaDemo } from "./FormsDemo";
import { TagDemo } from "./TagDemo";
import { ToastDemo } from "./ToastDemo";

const ITENS_AMOSTRA_LONGA = Array.from({ length: 24 }, (_, i) => i + 1);

// Classes escritas por extenso — não geradas de `bg-${nome}-${step}` — porque
// o scanner do Tailwind só retém no build a variável de tema por trás de uma
// classe que aparece como string literal no código-fonte. Uma cor só
// referenciada via `var(--color-...)` construído em runtime (como estava
// aqui antes) fica de fora do CSS final e a amostra sai com buracos — foi
// exatamente o que essa página pegou ao comparar `npm run build` com o dev.
const escalaBordo = [
  { passo: 50, bg: "bg-bordo-50", texto: "text-bordo-900" },
  { passo: 100, bg: "bg-bordo-100", texto: "text-bordo-900" },
  { passo: 200, bg: "bg-bordo-200", texto: "text-bordo-900" },
  { passo: 300, bg: "bg-bordo-300", texto: "text-bordo-900" },
  { passo: 400, bg: "bg-bordo-400", texto: "text-creme-50" },
  { passo: 500, bg: "bg-bordo-500", texto: "text-creme-50" },
  { passo: 600, bg: "bg-bordo-600", texto: "text-creme-50" },
  { passo: 700, bg: "bg-bordo-700", texto: "text-creme-50" },
  { passo: 800, bg: "bg-bordo-800", texto: "text-creme-50" },
  { passo: 900, bg: "bg-bordo-900", texto: "text-creme-50" },
] as const;

const escalaCreme = [
  { passo: 50, bg: "bg-creme-50", texto: "text-bordo-900" },
  { passo: 100, bg: "bg-creme-100", texto: "text-bordo-900" },
  { passo: 200, bg: "bg-creme-200", texto: "text-bordo-900" },
  { passo: 300, bg: "bg-creme-300", texto: "text-bordo-900" },
  { passo: 400, bg: "bg-creme-400", texto: "text-bordo-900" },
  { passo: 500, bg: "bg-creme-500", texto: "text-bordo-900" },
  { passo: 600, bg: "bg-creme-600", texto: "text-creme-50" },
  { passo: 700, bg: "bg-creme-700", texto: "text-creme-50" },
] as const;

const escalaInk = [
  { passo: 50, bg: "bg-ink-50", texto: "text-bordo-900" },
  { passo: 100, bg: "bg-ink-100", texto: "text-bordo-900" },
  { passo: 200, bg: "bg-ink-200", texto: "text-bordo-900" },
  { passo: 300, bg: "bg-ink-300", texto: "text-bordo-900" },
  { passo: 400, bg: "bg-ink-400", texto: "text-bordo-900" },
  { passo: 500, bg: "bg-ink-500", texto: "text-creme-50" },
  { passo: 600, bg: "bg-ink-600", texto: "text-creme-50" },
  { passo: 700, bg: "bg-ink-700", texto: "text-creme-50" },
  { passo: 800, bg: "bg-ink-800", texto: "text-creme-50" },
  { passo: 900, bg: "bg-ink-900", texto: "text-creme-50" },
  { passo: 950, bg: "bg-ink-950", texto: "text-creme-50" },
] as const;

const semanticas = [
  { nome: "success", bg: "bg-success", soft: "bg-success-soft" },
  { nome: "warning", bg: "bg-warning", soft: "bg-warning-soft" },
  { nome: "danger", bg: "bg-danger", soft: "bg-danger-soft" },
  { nome: "info", bg: "bg-info", soft: "bg-info-soft" },
] as const;

const revisoes = [
  { nome: "insert", classe: "bg-revision-insert" },
  { nome: "delete", classe: "bg-revision-delete" },
  { nome: "comment", classe: "bg-revision-comment" },
  { nome: "citation", classe: "bg-revision-citation" },
  { nome: "highlight", classe: "bg-revision-highlight" },
] as const;

const escalaInterfacePx = [
  { nome: "2xs", classe: "text-2xs", valor: "11px" },
  { nome: "xs", classe: "text-xs", valor: "12px" },
  { nome: "sm", classe: "text-sm", valor: "13px" },
  { nome: "base", classe: "text-base", valor: "14px" },
  { nome: "md", classe: "text-md", valor: "16px" },
  { nome: "lg", classe: "text-lg", valor: "18px" },
  { nome: "xl", classe: "text-xl", valor: "22px" },
  { nome: "2xl", classe: "text-2xl", valor: "27px" },
  { nome: "3xl", classe: "text-3xl", valor: "34px" },
  { nome: "4xl", classe: "text-4xl", valor: "44px" },
  { nome: "5xl", classe: "text-5xl", valor: "56px" },
] as const;

const escalaDocumentoPt = [
  { nome: "--doc-caption", valor: "10pt" },
  { nome: "--doc-body", valor: "12pt (mínimo NBR 14724)" },
  { nome: "--doc-body-lg", valor: "13pt" },
  { nome: "--doc-h3", valor: "12pt" },
  { nome: "--doc-h2", valor: "14pt" },
  { nome: "--doc-h1", valor: "16pt" },
  { nome: "--doc-title", valor: "20pt" },
] as const;

const espacamento = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const;

const raios = [
  { nome: "xs", classe: "rounded-xs", uso: "—" },
  { nome: "sm", classe: "rounded-sm", uso: "controles: botão, campo, tag, aba" },
  { nome: "md", classe: "rounded-md", uso: "avisos" },
  { nome: "lg", classe: "rounded-lg", uso: "cartões" },
  { nome: "xl", classe: "rounded-xl", uso: "painéis grandes" },
  { nome: "2xl", classe: "rounded-2xl", uso: "—" },
  { nome: "squircle", classe: "rounded-squircle", uso: "só o ícone da marca" },
  { nome: "full", classe: "rounded-full", uso: "cápsula: badge, progresso" },
] as const;

const sombras = [
  { nome: "xs", classe: "shadow-xs" },
  { nome: "sm", classe: "shadow-sm" },
  { nome: "md", classe: "shadow-md" },
  { nome: "lg", classe: "shadow-lg" },
  { nome: "sheet", classe: "shadow-sheet" },
  { nome: "brand", classe: "shadow-brand" },
] as const;

function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-2xs text-subtle">{children}</span>;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-ink-200 pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

interface PassoEscala {
  passo: number;
  bg: string;
  texto: string;
}

function Escala({ nome, passos }: { nome: string; passos: readonly PassoEscala[] }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-muted">{nome}</h3>
      <div className="flex flex-wrap gap-2">
        {passos.map((item) => (
          <div key={item.passo} className="flex flex-col items-center gap-1">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-sm border border-ink-200 font-mono text-2xs ${item.bg} ${item.texto}`}
            >
              {item.passo}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DesignPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-1 flex-col gap-10 p-10">
      <div>
        <h1 className="font-serif text-3xl font-bold">Design tokens — AURA</h1>
        <p className="mt-1 text-sm text-muted">
          Referência viva de app/globals.css. Ver docs/design.md para o raciocínio completo.
        </p>
      </div>

      <Secao titulo="Cor — paleta de marca">
        <p className="max-w-prose text-sm text-muted">
          Bordô <code className="font-mono text-xs">#70001b</code> (bordo-700) é a cor de
          autoridade: rail, botão primário, títulos. Creme{" "}
          <code className="font-mono text-xs">#fed488</code> (creme-300) é o par de destaque. As
          duas nunca competem na mesma superfície com o mesmo peso.
        </p>
        <div className="flex flex-col gap-6">
          <Escala nome="bordo" passos={escalaBordo} />
          <Escala nome="creme" passos={escalaCreme} />
          <Escala nome="ink" passos={escalaInk} />
        </div>
      </Secao>

      <Secao titulo="Cor — aliases semânticos">
        <p className="max-w-prose text-sm text-muted">
          Preferir estes à paleta bruta ao escrever componente — é o que sobrevive se a paleta
          mudar.
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { nome: "title", classe: "bg-title" },
            { nome: "body", classe: "bg-body" },
            { nome: "muted", classe: "bg-muted" },
            { nome: "subtle", classe: "bg-subtle" },
            { nome: "disabled", classe: "bg-disabled" },
            { nome: "link", classe: "bg-link" },
            { nome: "brand", classe: "bg-brand" },
            { nome: "brand-soft", classe: "bg-brand-soft" },
            { nome: "accent", classe: "bg-accent" },
            { nome: "accent-soft", classe: "bg-accent-soft" },
            { nome: "page", classe: "bg-page" },
            { nome: "card", classe: "bg-card" },
            { nome: "sunken", classe: "bg-sunken" },
          ].map((item) => (
            <div key={item.nome} className="flex flex-col items-center gap-1">
              <div className={`h-14 w-20 rounded-sm border border-ink-200 ${item.classe}`} />
              <span className="font-mono text-2xs text-subtle">{item.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Cor — semânticas e marcas de revisão">
        <div className="flex flex-wrap gap-6">
          {semanticas.map((item) => (
            <div key={item.nome} className="flex flex-col items-center gap-1">
              <div className="flex gap-1">
                <div className={`h-14 w-14 rounded-sm ${item.bg}`} />
                <div className={`h-14 w-14 rounded-sm border border-ink-200 ${item.soft}`} />
              </div>
              <span className="font-mono text-2xs text-subtle">{item.nome}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">
          Marcas de revisão — exclusivas do texto do documento, não aparecem fora dele:
        </p>
        <div className="flex flex-wrap gap-6">
          {revisoes.map((item) => (
            <div key={item.nome} className="flex flex-col items-center gap-1">
              <div className={`h-14 w-14 rounded-sm border border-ink-200 ${item.classe}`} />
              <span className="font-mono text-2xs text-subtle">{item.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tipografia — famílias">
        <div className="flex flex-col gap-3">
          <p className="font-serif text-2xl">Newsreader — títulos e texto do documento</p>
          <p className="font-sans text-base">Work Sans — interface, rótulos e botões</p>
          <p className="font-mono text-base">IBM Plex Mono — números, DOIs, chaves de citação</p>
          <p className="font-brand text-2xl font-bold text-brand">
            AURA — Roboto 700, só o logotipo
          </p>
        </div>
      </Secao>

      <Secao titulo="Tipografia — escala de interface (px, base 14)">
        <div className="flex flex-col gap-2">
          {escalaInterfacePx.map((item) => (
            <div key={item.nome} className="flex items-baseline gap-4">
              <span className="w-16 shrink-0 font-mono text-xs text-subtle">{item.valor}</span>
              <span className={item.classe}>Formatação, revisão e organização — {item.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tipografia — escala de documento (pt, dentro da folha A4)">
        <p className="max-w-prose text-sm text-muted">
          Escala paralela, nunca intercambiável com a de interface. Fonte da folha é Times New Roman
          ou Arial (a norma decide, não a marca) — a amostra abaixo usa o corpo do documento
          (Newsreader) só para mostrar a proporção.
        </p>
        <div className="flex flex-col gap-2">
          {escalaDocumentoPt.map((item) => (
            <div key={item.nome} className="flex items-baseline gap-4">
              <span className="w-40 shrink-0 font-mono text-xs text-subtle">{item.nome}</span>
              <span className="font-serif" style={{ fontSize: `var(${item.nome})` }}>
                {item.valor}
              </span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Espaçamento (base 4px)">
        <p className="text-sm text-muted">
          É a escala numérica padrão do Tailwind — <code className="font-mono text-xs">p-4</code> já
          é <code className="font-mono text-xs">--space-4</code> (16px).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {espacamento.map((n) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div className="bg-brand" style={{ width: `${n * 4}px`, height: "12px" }} />
              <span className="font-mono text-2xs text-subtle">{n * 4}px</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Raios">
        <div className="flex flex-wrap gap-6">
          {raios.map((item) => (
            <div key={item.nome} className="flex flex-col items-center gap-1">
              <div className={`h-16 w-16 border-2 border-bordo-700 ${item.classe}`} />
              <span className="font-mono text-2xs text-subtle">{item.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Elevação">
        <div className="flex flex-wrap gap-8 pb-4">
          {sombras.map((item) => (
            <div key={item.nome} className="flex flex-col items-center gap-2">
              <div className={`h-16 w-16 rounded-lg bg-card ${item.classe}`} />
              <span className="font-mono text-2xs text-subtle">{item.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Componentes — Button">
        <p className="max-w-prose text-sm text-muted">
          Hover escurece, nunca clareia. Foco visível usa o mesmo anel dos campos (
          <code className="font-mono text-xs">shadow-focus-ring</code>) — testar com Tab, não só com
          o mouse.
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Salvar</Button>
            <Button variant="secondary">Aplicar correção</Button>
            <Button variant="outline">Nova referência</Button>
            <Button variant="ghost">Ignorar</Button>
            <Button variant="quiet">Cancelar</Button>
            <Button variant="danger">Excluir</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Tamanho sm</Button>
            <Button size="md">Tamanho md</Button>
            <Button size="lg">Tamanho lg</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button loading>Exportando…</Button>
            <Button variant="primary" disabled>
              Salvar
            </Button>
            <Button variant="outline" disabled>
              Nova referência
            </Button>
          </div>
        </div>
      </Secao>

      <Secao titulo="Componentes — Input (campo)">
        <div className="flex max-w-sm flex-col gap-4">
          <Input
            label="Título do trabalho"
            placeholder="Ex.: Impactos da IA na revisão por pares"
          />
          <Input
            label="Palavras-chave"
            placeholder="Ex.: ensino remoto, evasão"
            hint="Separe por vírgula."
          />
          <Input label="Ano" defaultValue="20XX" error="Informe um ano com 4 dígitos." required />
          <Input label="Instituição" defaultValue="Desabilitado" disabled />
          <Input
            label="Buscar norma"
            placeholder="Ex.: NBR 6023"
            icon={<Icon name="info" size={16} />}
            suffix="ABNT"
          />
        </div>
      </Secao>

      <Secao titulo="Componentes — Select (seleção)">
        <div className="flex max-w-sm flex-col gap-4">
          <Select label="Norma" options={["ABNT NBR 14724", "APA 7", "Vancouver"]} />
          <Select
            label="Natureza do trabalho"
            options={["TCC", "Dissertação", "Artigo"]}
            error="Selecione uma opção."
            required
          />
          <Select label="Idioma" options={["Português (Brasil)"]} disabled />
        </div>
      </Secao>

      <Secao titulo="Componentes — Dialog (modal)">
        <DialogDemo />
      </Secao>

      <Secao titulo="Componentes — Toast">
        <ToastDemo />
      </Secao>

      <Secao titulo="Componentes — Tabs (aba)">
        <div className="flex flex-col gap-6">
          <Tabs
            variant="underline"
            items={[
              { id: "normas", label: "Normas", count: 14 },
              { id: "texto", label: "Texto", count: 3 },
              { id: "referencias", label: "Referências" },
            ]}
          />
          <Tabs
            variant="segmented"
            items={[
              { id: "editor", label: "Editor" },
              { id: "historico", label: "Histórico" },
              { id: "bloqueada", label: "Em breve", disabled: true },
            ]}
          />
        </div>
      </Secao>

      <Secao titulo="Componentes — Tooltip">
        <div className="flex items-center gap-3 pb-6">
          <Tooltip content="Aplicar a todas as ocorrências">
            <Button variant="quiet" size="sm">
              Passe o mouse ou dê Tab
            </Button>
          </Tooltip>
          <Rotulo>role=&quot;tooltip&quot; associado por aria-describedby</Rotulo>
        </div>
      </Secao>

      <Secao titulo="Componentes — Estados (carregamento, vazio, erro)">
        <p className="max-w-prose text-sm text-muted">
          Substituem um painel ou tela inteira — não convivem com o conteúdo, ao contrário de um
          aviso inline. Em uso real em <code className="font-mono text-xs">app/page.tsx</code>,{" "}
          <code className="font-mono text-xs">DocumentoEditor.tsx</code> e{" "}
          <code className="font-mono text-xs">Editor.tsx</code>.
        </p>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-ink-200 bg-ink-200 sm:grid-cols-3">
          <div className="bg-card">
            <EstadoCarregando />
          </div>
          <div className="bg-card">
            <EstadoVazio
              titulo="Nenhum documento ainda."
              action={<Button size="sm">Criar novo documento</Button>}
            />
          </div>
          <div className="bg-card">
            <EstadoErro
              titulo="Não foi possível carregar."
              action={
                <Button size="sm" variant="outline">
                  Tentar de novo
                </Button>
              }
            />
          </div>
        </div>
      </Secao>

      <Secao titulo="Marca — lockup">
        <p className="max-w-prose text-sm text-muted">
          O único ativo de marca é <code className="font-mono text-xs">/logo-aura.png</code>. Já
          traz o fundo bordô e o raio grande: não recolorir, não recortar, não usar sobre bordô
          cheio nem sobre fotografia, e nunca sozinho como ícone de rail, botão ou lista. O tom{" "}
          <code className="font-mono text-xs">creme</code> existe só para fundo bordô.
        </p>
        <div className="flex flex-wrap items-center gap-8">
          <Brand />
          <Brand size={44} />
          <div className="flex items-center rounded-lg bg-bordo-700 px-6 py-4">
            <Brand tone="creme" />
          </div>
        </div>
      </Secao>

      <Secao titulo="Ícones — vocabulário completo">
        <p className="max-w-prose text-sm text-muted">
          Todo ícone do sistema passa por <code className="font-mono text-xs">Icon.tsx</code>, que é
          o único arquivo autorizado a produzir SVG. O mapa é fechado: só entram os glifos que
          alguma tela usa de verdade. Monocromáticos, traço 2px, herdando a cor do contexto —{" "}
          <span className="font-mono text-xs">{NOMES_ICONES.length}</span> no total.
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
          {NOMES_ICONES.map((nome) => (
            <div
              key={nome}
              className="flex items-center gap-2 rounded-sm border border-ink-200 bg-card px-2.5 py-2 text-muted"
            >
              <Icon name={nome} size={18} />
              <span className="truncate font-mono text-2xs text-subtle">{nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Componentes — Card (cartão)">
        <p className="max-w-prose text-sm text-muted">
          A superfície em que painel, item de lista e bloco de conteúdo se apoiam. Raio 10px, borda
          1px cinza-quente, sombra sutil. <strong>Nunca</strong> borda colorida só à esquerda — é
          uma das duas proibições explícitas do sistema. Aviso com cor de estado é papel do{" "}
          <code className="font-mono text-xs">Alert</code>.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Card
            title="Normas em uso"
            subtitle="NBR 14724 · estrutura do trabalho"
            actions={
              <Button size="sm" variant="ghost">
                Ver
              </Button>
            }
            footer="Atualizado com a norma vigente."
          >
            <p className="text-sm text-muted">
              Tom <code className="font-mono text-xs">default</code>, com cabeçalho, ações e rodapé.
            </p>
          </Card>
          <Card tone="brand">
            <p className="text-sm text-body">
              Tom <code className="font-mono text-xs">brand</code> — bordô 50.
            </p>
          </Card>
          <Card tone="accent">
            <p className="text-sm text-body">
              Tom <code className="font-mono text-xs">accent</code> — creme 100.
            </p>
          </Card>
          <Card tone="sunken" interactive>
            <p className="text-sm text-body">
              Tom <code className="font-mono text-xs">sunken</code> com{" "}
              <code className="font-mono text-xs">interactive</code>: passe o mouse e a sombra sobe.
            </p>
          </Card>
        </div>
      </Secao>

      <Secao titulo="Componentes — Badge (etiqueta de estado)">
        <p className="max-w-prose text-sm text-muted">
          Só leitura, uma ou duas palavras em sentence case. Não é clicável — chip selecionável ou
          removível é <code className="font-mono text-xs">Tag</code>.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Rascunho</Badge>
          <Badge tone="brand">Gratuito, sempre</Badge>
          <Badge tone="accent">Em revisão</Badge>
          <Badge tone="success" dot>
            Conforme
          </Badge>
          <Badge tone="warning" dot>
            3 pendências
          </Badge>
          <Badge tone="danger" dot>
            Fora da norma
          </Badge>
          <Badge tone="info">Desativado</Badge>
        </div>
        <Rotulo>Fundo cheio</Rotulo>
        <div className="flex flex-wrap items-center gap-2">
          <Badge solid>Rascunho</Badge>
          <Badge tone="brand" solid>
            Gratuito, sempre
          </Badge>
          <Badge tone="accent" solid>
            Em revisão
          </Badge>
          <Badge tone="success" solid dot>
            Conforme
          </Badge>
          <Badge tone="warning" solid>
            3 pendências
          </Badge>
          <Badge tone="danger" solid>
            Fora da norma
          </Badge>
          <Badge tone="info" solid>
            Desativado
          </Badge>
        </div>
      </Secao>

      <Secao titulo="Componentes — Tag (chip)">
        <p className="max-w-prose text-sm text-muted">
          Filtros de revisão, palavras-chave, coautores. Mais quadrado que o Badge — raio 4px,
          altura 26px, porque é um controle. Selecionado é bordô sólido.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <TagDemo />
        </div>
      </Secao>

      <Secao titulo="Componentes — IconButton (botão de ícone)">
        <p className="max-w-prose text-sm text-muted">
          Quadrado, só ícone, para barra de ferramentas e cabeçalho de painel.{" "}
          <code className="font-mono text-xs">label</code> é obrigatório: vira o{" "}
          <code className="font-mono text-xs">aria-label</code> e o título de hover.
        </p>
        <Rotulo>Variantes (md)</Rotulo>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton name="bold" label="Negrito" />
          <IconButton name="italic" label="Itálico" variant="outline" />
          <IconButton name="plus" label="Nova seção" variant="solid" />
          <IconButton name="wand-sparkles" label="Aplicar formatação ABNT" active />
          <IconButton name="table" label="Tabela" disabled />
        </div>
        <Rotulo>Tamanhos</Rotulo>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton name="undo-2" label="Desfazer" size="sm" />
          <IconButton name="undo-2" label="Desfazer" size="md" />
          <IconButton name="undo-2" label="Desfazer" size="lg" />
        </div>
      </Secao>

      <Secao titulo="Componentes — Textarea (campo multilinha)">
        <p className="max-w-prose text-sm text-muted">
          Resumo, comentário, parágrafo colado. Usa a serifada do documento (
          <code className="font-mono text-xs">font-serif</code>) — o texto digitado é texto
          acadêmico, não rótulo de interface.
        </p>
        <TextareaDemo />
      </Secao>

      <Secao titulo="Componentes — Checkbox">
        <p className="max-w-prose text-sm text-muted">
          Marca creme sobre bordô, 18px. Sem <code className="font-mono text-xs">onChange</code>, o
          campo alterna sozinho — controlado só quando alguém escuta a mudança.
        </p>
        <CheckboxDemo />
      </Secao>

      <Secao titulo="Componentes — Radio">
        <p className="max-w-prose text-sm text-muted">
          Escolha única num grupo (mesmo <code className="font-mono text-xs">name</code>). Sempre
          controlado — ao contrário do Checkbox, um grupo sem handler não teria como trocar de
          opção.
        </p>
        <RadioDemo />
      </Secao>

      <Secao titulo="Componentes — Switch">
        <p className="max-w-prose text-sm text-muted">
          Liga/desliga imediato. O pino vira creme quando ligado — o único lugar do sistema em que o
          creme marca &ldquo;ativado&rdquo; fora de botão secundário.
        </p>
        <SwitchDemo />
      </Secao>

      <Secao titulo="Componentes — Alert (aviso fixo)">
        <p className="max-w-prose text-sm text-muted">
          Fixo no fluxo da página — pendência de norma, resultado de exportação. Ícone fixo por tom,
          fundo suave + borda inteira da mesma família. Para confirmação passageira o componente é{" "}
          <code className="font-mono text-xs">Toast</code>.
        </p>
        <div className="flex flex-col gap-3">
          <Alert
            tone="warning"
            title="3 referências sem chamada no texto"
            action={
              <Button size="sm" variant="outline">
                Revisar referências
              </Button>
            }
          >
            A NBR 6023 exige que toda referência listada seja citada ao menos uma vez.
          </Alert>
          <Alert tone="success" title="Conforme">
            Todas as pendências desta seção foram resolvidas.
          </Alert>
          <Alert tone="danger" title="Falha ao exportar .docx">
            Tente novamente em alguns segundos.
          </Alert>
          <Alert tone="brand" title="NBR 14724">
            Estrutura do trabalho acadêmico — capa, elementos pré-textuais, corpo e pós-textuais.
          </Alert>
          <AlertDismissDemo />
        </div>
      </Secao>

      <Secao titulo="Componentes — ProgressBar">
        <p className="max-w-prose text-sm text-muted">
          Progresso determinado — índice de conformidade, análise em curso. Números sempre em
          monoespaçada.
        </p>
        <div className="flex max-w-sm flex-col gap-4">
          <ProgressBar label="Conformidade ABNT" valueLabel="86%" value={86} tone="success" />
          <ProgressBar label="Referências revisadas" valueLabel="12/14" value={12} max={14} />
          <ProgressBar label="Envio" valueLabel="42%" value={42} tone="accent" size="sm" />
        </div>
      </Secao>

      <Secao titulo="Componentes — PaperSheet (folha A4) e RevisionMark">
        <p className="max-w-prose text-sm text-muted">
          A folha em que todo editor, prévia e mock de exportação vive. Proporção 210×297 real,
          margens da NBR 14724 (30/30/20/20 mm) e texto na escala de documento (pt) — nunca px
          dentro da folha. <code className="font-mono text-xs">showMargins</code> desenha a guia
          tracejada da área escrita.
        </p>
        <div className="flex flex-wrap items-start gap-6">
          <PaperSheet width="330px" pageNumber={21} showMargins font="times">
            <h1
              className="m-0 mb-3 text-[12px] font-bold uppercase"
              style={{ color: "var(--doc-ink)" }}
            >
              3 Metodologia
            </h1>
            <p
              className="m-0 text-[10.5px] leading-[1.5]"
              style={{ textIndent: "1.25cm", color: "var(--doc-ink)" }}
            >
              A pesquisa <RevisionMark kind="delete">foi feita</RevisionMark>{" "}
              <RevisionMark kind="insert">realizou-se</RevisionMark> em três etapas sucessivas{" "}
              <RevisionMark kind="citation" note="NBR 10520: falta a página">
                (SILVA, 2021)
              </RevisionMark>
              . O corpus reuniu{" "}
              <RevisionMark kind="comment" note="Especificar o critério de seleção">
                documentos diversos
              </RevisionMark>{" "}
              coletados entre 2019 e 2023.{" "}
              <RevisionMark kind="norm" note="NBR 14724: numeração progressiva">
                Referencial teórico
              </RevisionMark>{" "}
              apoia-se em três eixos complementares.
            </p>
          </PaperSheet>
          <PaperSheet width="330px" pageNumber={22} font="arial">
            <p
              className="m-0 text-[10.5px] leading-[1.5]"
              style={{ textIndent: "1.25cm", color: "var(--doc-ink)" }}
            >
              A mesma folha com <code className="font-mono text-2xs">font=&quot;arial&quot;</code> —
              as duas fontes que a NBR 14724 admite, escolhidas pelo usuário na barra do editor.
            </p>
          </PaperSheet>
        </div>
      </Secao>

      <Secao titulo="Componentes — AppTopBar (barra superior)">
        <p className="max-w-prose text-sm text-muted">
          Uma barra, três modos. A marca aparece nos três; cada modo troca o que vem depois dela —
          navegação pública, abas internas ou a barra de trabalho do editor. Teste o menu do usuário
          (<code className="font-mono text-xs">UserChip</code>) com o teclado:{" "}
          <kbd className="font-mono text-2xs">Tab</kbd>,{" "}
          <kbd className="font-mono text-2xs">Enter</kbd> e{" "}
          <kbd className="font-mono text-2xs">Esc</kbd> fecham e reabrem.
        </p>
        <div className="flex flex-col gap-4">
          <div>
            <Rotulo>mode=&quot;guest&quot;</Rotulo>
            <div className="mt-1.5 overflow-hidden rounded-lg border border-ink-200">
              <AppTopBar mode="guest" />
            </div>
          </div>
          <div>
            <Rotulo>mode=&quot;app&quot;</Rotulo>
            <div className="mt-1.5 overflow-hidden rounded-lg border border-ink-200">
              <AppTopBar mode="app" />
            </div>
          </div>
          <div>
            <Rotulo>mode=&quot;editor&quot;</Rotulo>
            <div className="mt-1.5 overflow-hidden rounded-lg border border-ink-200">
              <AppTopBar
                mode="editor"
                docTitle="Impactos da IA na revisão por pares"
                statusAutosave="Salvo"
                acoes={
                  <Button size="sm" variant="outline" icon={<Icon name="file-down" size={15} />}>
                    Exportar .docx
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </Secao>

      <Secao titulo="Componentes — Layout de edição">
        <p className="max-w-prose text-sm text-muted">
          Casca de três colunas — arraste a borda entre painéis (ou foque nela e use as setas do
          teclado) e recarregue a página: a largura escolhida persiste. O botão no topo colapsa cada
          painel lateral. Só o centro rola; role a lista de amostra em cada coluna e note que as
          outras duas não se movem. Sem conteúdo de verdade ainda — seções, IA, histórico e
          conformidade são da Fase 3+; aqui só existe a casca (
          <code className="font-mono text-xs">LayoutEdicao.tsx</code>).
        </p>
        <div className="flex h-[420px] overflow-hidden rounded-lg border border-ink-200">
          <LayoutEdicao
            sidebar={
              <>
                <div className="shrink-0 border-b border-[var(--border-subtle)] px-4 py-3 font-sans text-xs font-semibold tracking-wide text-body">
                  Seções (amostra)
                </div>
                <div className="flex-1 overflow-auto px-2 py-2">
                  {ITENS_AMOSTRA_LONGA.map((n) => (
                    <div
                      key={n}
                      className="rounded-sm px-2 py-1.5 font-sans text-sm text-body hover:bg-bordo-50"
                    >
                      {n}. Seção de amostra
                    </div>
                  ))}
                </div>
              </>
            }
            inspetor={
              <>
                <div className="shrink-0 border-b border-[var(--border-subtle)] px-4 py-3 font-sans text-xs font-semibold tracking-wide text-body">
                  Inspetor (amostra)
                </div>
                <div className="flex-1 overflow-auto px-4 py-2">
                  {ITENS_AMOSTRA_LONGA.map((n) => (
                    <p key={n} className="py-1.5 font-sans text-xs text-muted">
                      Item de amostra {n}
                    </p>
                  ))}
                </div>
              </>
            }
          >
            <div className="flex flex-col gap-3 p-6">
              {ITENS_AMOSTRA_LONGA.map((n) => (
                <p key={n} className="font-serif text-sm text-body">
                  Parágrafo de amostra {n} — só pra o centro ter altura suficiente pra rolar por
                  conta própria, independente dos painéis laterais.
                </p>
              ))}
            </div>
          </LayoutEdicao>
        </div>
      </Secao>

      <Secao titulo="Formulário de referência (passo 4.2)">
        <p className="max-w-2xl font-sans text-xs text-muted">
          Os campos e a ordem saem de <code>src/core/references/campos.ts</code>, que segue os
          modelos da NBR 6023:2025 — este componente só desenha o que a tabela manda. Troque o tipo:
          os campos trocam e o que os dois tipos têm em comum fica.
        </p>
        <FormReferenciaDemo />
      </Secao>
    </div>
  );
}
