// Landing pública (deslogado) — passo 2B.6. Server Component: nada aqui
// depende de estado do navegador, só de conteúdo estático. `AppTopBar`
// (client) e os componentes de `src/components/landing/` são renderizados
// como filhos, sem precisar promover esta página inteira a client.
//
// Copy ajustada ao escopo da v1 em relação à referência da skill
// aura-design: o passo "Envie o documento — DOCX ou texto colado" virou
// "Escreva ou cole o texto" (importação de .docx está fora da v1,
// docs/aura-decisoes-e-pendencias.md §1.15); a faixa final trocou a
// promessa de "vincular sua universidade" (não existe esse campo) por
// "sem custo, sem limite de documentos"; nenhuma tela ou frase menciona
// PDF, plano, preço ou cota — a AURA é gratuita, sempre.
import Link from "next/link";

import { AppTopBar } from "@/components/app/AppTopBar";
import { Brand } from "@/components/app/Brand";
import { CartaoRecurso } from "@/components/landing/CartaoRecurso";
import { FaixaNormas } from "@/components/landing/FaixaNormas";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { PaperSheet } from "@/components/ui/PaperSheet";
import { RevisionMark } from "@/components/ui/RevisionMark";

const RECURSOS = [
  {
    icone: "ruler",
    titulo: "Formatação automática",
    descricao:
      "Margens, entrelinha, numeração de seções e paginação aplicadas conforme a NBR 14724 — em um clique, sem mexer em estilos.",
  },
  {
    icone: "quote",
    titulo: "Citações conferidas",
    descricao:
      "Cada chamada no texto é cruzada com a lista de referências. A AURA aponta o que falta e sugere a forma correta.",
  },
  {
    icone: "spell-check-2",
    titulo: "Revisão de texto",
    descricao:
      "Ortografia, concordância e repetições sinalizadas parágrafo a parágrafo, com sugestão pronta para aplicar.",
  },
  {
    icone: "list-ordered",
    titulo: "Sumário e elementos",
    descricao:
      "Sumário, listas de ilustrações e elementos pré-textuais gerados a partir da estrutura do seu documento.",
  },
  {
    icone: "history",
    titulo: "Histórico de versões",
    descricao:
      "Cada aplicação de norma fica registrada. Volte a qualquer ponto do documento sem perder o texto.",
  },
  {
    icone: "file-down",
    titulo: "Exportação em .docx",
    descricao:
      "O arquivo sai em Word com a formatação preservada, pronto para o depósito institucional.",
  },
] as const;

const PASSOS = [
  {
    titulo: "Escreva ou cole o texto",
    descricao: "A estrutura de seções é reconhecida automaticamente.",
  },
  {
    titulo: "Revise as pendências",
    descricao: "Normas, citações e texto em uma lista única, com sugestão pronta para aplicar.",
  },
  {
    titulo: "Exporte em .docx",
    descricao: "Arquivo Word com a formatação da norma escolhida preservada.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppTopBar mode="guest" />

      <section className="bg-gradient-to-b from-creme-50 to-card px-8 py-18">
        <div className="mx-auto grid max-w-[1160px] items-center gap-16 [grid-template-columns:1.05fr_.95fr]">
          <div>
            <Badge tone="brand">Gratuito, sempre</Badge>
            <h1 className="mt-4 text-5xl leading-[1.08] tracking-tight">
              Seu trabalho nas normas,
              <br />
              sem retrabalho.
            </h1>
            <p className="mt-5 max-w-[46ch] font-serif text-lg leading-relaxed text-body">
              A AURA formata, revisa e organiza trabalhos acadêmicos em um só lugar — do sumário às
              referências, com as normas da ABNT verificadas linha por linha.
            </p>
            <div className="mt-7 flex gap-3">
              <LinkButton
                href="/documentos"
                size="lg"
                iconEnd={<Icon name="arrow-right" size={16} />}
              >
                Comece agora!
              </LinkButton>
              <LinkButton href="/entrar" size="lg" variant="outline">
                Já tenho conta
              </LinkButton>
            </div>
            <p className="mt-4 text-xs text-subtle">
              Sem cobrança, sem limite de documentos e sem cartão de crédito.
            </p>
          </div>

          {/*
            Ilustração de marca — não é um painel funcional nem o documento
            de um usuário real: é o mesmo papel que uma captura de tela
            ilustrativa cumpre em qualquer landing. As marcas de revisão e o
            "86% · 3 pendências" abaixo são exemplo fixo, igual ao que a
            própria folha A4 do design system usa como elemento visual
            (readme da skill, "Fundos, imagens e texturas").
          */}
          <div className="relative flex justify-center">
            <PaperSheet width="330px" pageNumber={12}>
              <h2
                className="m-0 mb-2.5 text-[8px] font-bold uppercase"
                style={{ color: "var(--doc-ink)" }}
              >
                3 Metodologia
              </h2>
              <p
                className="m-0 text-[7px] leading-[1.5]"
                style={{ textIndent: "1.25cm", color: "var(--doc-ink)" }}
              >
                A pesquisa <RevisionMark kind="delete">foi feita</RevisionMark>{" "}
                <RevisionMark kind="insert">realizou-se</RevisionMark> em três etapas sucessivas{" "}
                <RevisionMark kind="citation" note="Falta a página">
                  (SILVA, 2021)
                </RevisionMark>
                . O corpus reuniu <RevisionMark kind="comment">documentos diversos</RevisionMark>{" "}
                coletados entre 2019 e 2023 em repositórios institucionais.
              </p>
              <p
                className="m-0 mt-2 text-[7px] leading-[1.5]"
                style={{ textIndent: "1.25cm", color: "var(--doc-ink)" }}
              >
                <RevisionMark kind="norm" note="NBR 14724: numeração progressiva">
                  Referencial teórico
                </RevisionMark>{" "}
                apoia-se em três eixos complementares, apresentados a seguir.
              </p>
            </PaperSheet>
            <div className="absolute -bottom-2 left-0 flex items-center gap-2.5 rounded-md border border-[var(--border-subtle)] bg-card px-3.5 py-2.5 shadow-lg">
              <span className="flex text-success">
                <Icon name="circle-check-big" size={18} />
              </span>
              <div className="flex flex-col">
                <span className="font-sans text-xs font-medium">Conformidade ABNT</span>
                <span className="font-mono text-2xs text-muted">86% · 3 pendências</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FaixaNormas />

      <section id="recursos" className="px-8 py-22">
        <div className="mx-auto max-w-[1160px]">
          <span className="font-sans text-2xs tracking-caps text-bordo-600 uppercase">
            Recursos
          </span>
          <h2 className="mt-3 max-w-[24ch] text-3xl">
            Tudo o que a banca vai olhar, verificado antes.
          </h2>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {RECURSOS.map((recurso) => (
              <CartaoRecurso
                key={recurso.titulo}
                icone={recurso.icone}
                titulo={recurso.titulo}
                descricao={recurso.descricao}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-bordo-700 px-8 py-20 text-creme-100">
        <div className="mx-auto max-w-[1160px]">
          <span className="font-sans text-2xs tracking-caps text-creme-300 uppercase">
            Como funciona
          </span>
          <h2 className="mt-3 max-w-[26ch] text-3xl text-creme-200">
            Três passos entre o rascunho e o depósito.
          </h2>
          <ol className="mt-10 grid grid-cols-3 gap-8 p-0">
            {PASSOS.map((passo, i) => (
              <li
                key={passo.titulo}
                className="flex flex-col gap-3.5 border-t-2 border-[rgba(254,212,136,0.3)] pt-5"
              >
                <span className="flex size-7.5 items-center justify-center rounded-full bg-creme-300 font-mono text-sm font-semibold text-bordo-800">
                  {i + 1}
                </span>
                <strong className="font-sans text-lg font-semibold text-creme-200">
                  {passo.titulo}
                </strong>
                <p className="text-sm leading-relaxed opacity-80">{passo.descricao}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-creme-100 px-8 py-16">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl text-on-creme">
              Pronta para entregar sem susto de formatação?
            </h2>
            <p className="mt-2 text-sm text-bordo-800 opacity-80">
              Crie sua conta — sem custo, sem limite de documentos.
            </p>
          </div>
          <LinkButton href="/documentos" size="lg" iconEnd={<Icon name="arrow-right" size={16} />}>
            Comece agora!
          </LinkButton>
        </div>
      </section>

      <footer className="bg-bordo-800 px-8 py-11 pb-7.5 text-[rgba(254,244,220,0.7)]">
        <div className="mx-auto grid max-w-[1160px] gap-8 [grid-template-columns:1.4fr_1fr]">
          <div>
            <Brand tone="creme" size={32} href="/" />
            <p className="mt-3.5 max-w-[34ch] text-xs leading-[1.7]">
              Ambiente Unificado de Revisão Acadêmica. Formatação, revisão e organização de
              trabalhos acadêmicos — gratuito.
            </p>
          </div>
          <div>
            <span className="font-sans text-2xs tracking-caps text-creme-300 uppercase">
              Produto
            </span>
            <ul className="mt-3.5 flex flex-col gap-2.5 p-0">
              <li>
                <Link
                  href="/#recursos"
                  className="text-xs text-[rgba(254,244,220,0.7)] no-underline"
                >
                  Recursos
                </Link>
              </li>
              <li>
                <Link href="/#normas" className="text-xs text-[rgba(254,244,220,0.7)] no-underline">
                  Normas suportadas
                </Link>
              </li>
              <li>
                <Link href="/editais" className="text-xs text-[rgba(254,244,220,0.7)] no-underline">
                  Central de editais
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-[1160px] justify-between border-t border-[rgba(254,212,136,0.16)] pt-4.5 text-2xs opacity-70">
          <span>© 2026 AURA. Todos os direitos reservados.</span>
          <span>Feito no Brasil</span>
        </div>
      </footer>
    </div>
  );
}
