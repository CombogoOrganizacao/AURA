import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Passo 6.6.4 — revisão de acessibilidade básica. Três garantias:
// - nenhuma violação WCAG 2.1 A/AA que o axe-core detecte, nas telas e nos
//   estados do editor (contraste, nome acessível, ARIA);
// - toda parada de Tab mostra o foco;
// - a ação que só funcionava com o mouse (grade da tabela) responde ao
//   teclado.
// O contraste do bordô sobre o creme, que o passo nomeia, está no axe e em
// números no to-do do passo (8,79:1, acima do AA e do AAA).

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function semViolacoes(page: Page, onde: string) {
  const resultado = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const resumo = resultado.violations.map(
    (violacao) =>
      `${onde}: ${violacao.id} — ${violacao.nodes.map((no) => no.target.join(" ")).join(" | ")}`,
  );
  expect(resumo).toEqual([]);
}

async function novoDocumento(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.locator(".ProseMirror").waitFor();
}

test.describe("axe: nenhuma violação WCAG 2.1 AA detectável", () => {
  for (const rota of ["/", "/entrar", "/cadastrar", "/documentos", "/editais"]) {
    test(rota, async ({ page }) => {
      await page.goto(rota);
      await semViolacoes(page, rota);
    });
  }

  test("editor, com os painéis, as abas e a janela de exportação abertos", async ({ page }) => {
    await novoDocumento(page);
    await semViolacoes(page, "editor");

    for (const painel of [
      "Dados do trabalho",
      "Folha de aprovação",
      "Resumo e palavras-chave",
      "Elementos opcionais",
      "Abreviaturas e siglas",
      "Referências",
    ]) {
      await page.getByText(painel, { exact: true }).click();
    }
    await page.getByRole("button", { name: "Nova referência" }).click();
    await semViolacoes(page, "editor com os painéis abertos");

    await page.getByRole("tab", { name: /Histórico/ }).click();
    await semViolacoes(page, "aba Histórico");
    await page.getByRole("tab", { name: "IA" }).click();
    await semViolacoes(page, "aba IA");

    await page.getByRole("banner").getByRole("button", { name: "Exportar", exact: true }).click();
    // O .zip é montado ao abrir a janela; varrer no meio da montagem pega o
    // botão em transição de cor, entre desabilitado e pronto.
    await expect(page.getByRole("button", { name: "Baixar .zip" })).toBeEnabled();
    await semViolacoes(page, "janela de exportação");
  });
});

// O que muda de visível quando um elemento ganha foco. Olha o próprio
// elemento e os vizinhos que desenham o anel no lugar dele: o rádio e a caixa
// de seleção têm o `<input>` escondido e o anel no irmão (`peer-focus-visible`),
// e a alça de redimensionar desenha a linha no filho (`group-focus-visible`).
const ESTILOS = [
  "outlineStyle",
  "outlineWidth",
  "boxShadow",
  "backgroundColor",
  "borderColor",
] as const;

async function paradaDeTab(page: Page) {
  return page.evaluate((estilos) => {
    const ativo = document.activeElement as HTMLElement | null;
    if (!ativo || ativo === document.body) return null;
    // O botão das ferramentas do Next só existe no `next dev`.
    if (ativo.tagName.toLowerCase() === "nextjs-portal") return null;
    const alvos = [ativo, ativo.nextElementSibling, ativo.firstElementChild, ativo.parentElement];
    const ler = () =>
      alvos.map((alvo) => {
        if (!alvo) return "";
        const estilo = getComputedStyle(alvo);
        return estilos.map((nome) => estilo[nome]).join(";");
      });
    const comFoco = ler();
    ativo.blur();
    const semFoco = ler();
    ativo.focus();
    const descricao = `${ativo.tagName.toLowerCase()} "${(
      ativo.getAttribute("aria-label") ??
      ativo.textContent ??
      ""
    )
      .trim()
      .slice(0, 50)}"`;
    return {
      descricao,
      editavel: ativo.isContentEditable,
      mudou: comFoco.some((valor, indice) => valor !== semFoco[indice]),
    };
  }, ESTILOS);
}

async function percorrerComTab(page: Page, limite: number) {
  const semFoco: string[] = [];
  const vistas = new Set<string>();
  for (let i = 0; i < limite; i++) {
    await page.keyboard.press("Tab");
    const parada = await paradaDeTab(page);
    if (!parada) continue;
    // O texto do editor mostra o foco pelo cursor, não por estilo.
    if (!parada.editavel && !parada.mudou) semFoco.push(parada.descricao);
    if (vistas.has(parada.descricao) && i > 5) break;
    vistas.add(parada.descricao);
  }
  return semFoco;
}

test.describe("teclado: toda parada de Tab mostra o foco", () => {
  for (const rota of ["/", "/entrar", "/cadastrar", "/documentos", "/editais"]) {
    test(rota, async ({ page }) => {
      await page.goto(rota);
      expect(await percorrerComTab(page, 40)).toEqual([]);
    });
  }

  test("editor", async ({ page }) => {
    await novoDocumento(page);
    await page.getByText("Dados do trabalho", { exact: true }).click();
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    expect(await percorrerComTab(page, 120)).toEqual([]);
  });
});

test("grade da tabela: o Enter num botão faz o que o clique faz", async ({ page }) => {
  await novoDocumento(page);
  await page.locator(".ProseMirror p").first().click();
  await page
    .getByRole("button", { name: "Tabela (só no computador) — padrão IBGE, laterais abertas" })
    .click();
  await page.locator(".ProseMirror .doc-tabela td").first().click();

  const linhas = page.locator(".ProseMirror .doc-tabela tr");
  const antes = await linhas.count();
  await page
    .getByRole("toolbar", { name: "Grade da tabela" })
    .getByRole("button", { name: "Linha abaixo" })
    .focus();
  await page.keyboard.press("Enter");

  await expect(linhas).toHaveCount(antes + 1);
});
