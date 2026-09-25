import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import JSZip from "jszip";

// Passo 3.6.5 — o critério de aceite é literal e comportamental: "renderiza
// na tela e sobrevive ao round-trip; restrito ao desktop". Nenhum dos três
// cabe no Vitest: o KaTeX só desenha com DOM de verdade, o round-trip que
// interessa aqui é o que passa pela persistência e volta no reload, e o "só
// desktop" é um breakpoint CSS. Por isso este spec existe, como o de 3.6.3.
//
// (O round-trip em memória — `toDocumento(fromDocumento(x))` — já está
// coberto em `src/core/document/serialize.test.ts`; o que este arquivo cobre
// é o caminho inteiro: editor → IndexedDB → editor.)

async function novoDocumento(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  // Materializa a seção-semente: o editor só existe de verdade depois que há
  // onde o cursor entrar.
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.type("Um parágrafo qualquer.");
}

const BOTAO_FORMULA = "Fórmula (só no computador) — escrita em LaTeX, destacada e centralizada";
const CAMPO_LATEX = "Fórmula em LaTeX";

test("a fórmula é desenhada pelo KaTeX a partir do LaTeX digitado", async ({ page }) => {
  await novoDocumento(page);

  await page.getByRole("button", { name: BOTAO_FORMULA }).click();

  // Fórmula recém-inserida: sem desenho, com um aviso honesto no lugar.
  await expect(page.getByText("fórmula vazia — escreva em LaTeX no campo abaixo")).toBeVisible();

  await page.getByLabel(CAMPO_LATEX).fill("E = mc^2");

  // O KaTeX desenhou: `.katex` é o container que ele monta, e o `2` saiu como
  // expoente de verdade (`<msup>` no MathML que ele emite junto), não como
  // o texto "mc^2".
  await expect(page.locator(".doc-formula-render .katex")).toBeVisible();
  await expect(page.locator(".doc-formula-render msup")).toHaveCount(1);

  // A checagem do `^` é no lado HTML (`.katex-html`), não no `.katex`
  // inteiro: o KaTeX guarda a fonte TeX original dentro do MathML, numa
  // `<annotation>` — procurar o acento circunflexo no container todo acharia
  // essa cópia e nunca falharia, mesmo se a fórmula não tivesse sido
  // desenhada.
  await expect(page.locator(".doc-formula-render .katex-html")).not.toContainText("^");
});

test("LaTeX inválido avisa em pt-BR e não apaga o que foi escrito", async ({ page }) => {
  await novoDocumento(page);

  await page.getByRole("button", { name: BOTAO_FORMULA }).click();
  // Chave aberta e não fechada — o estado normal de quem está no meio da
  // digitação.
  await page.getByLabel(CAMPO_LATEX).fill("\\frac{a");

  await expect(
    page.getByText("não foi possível desenhar a fórmula — confira a sintaxe LaTeX"),
  ).toBeVisible();
  // O texto continua no campo: o erro não custa o que a pessoa escreveu.
  await expect(page.getByLabel(CAMPO_LATEX)).toHaveValue("\\frac{a");

  // E conserta sozinho quando a sintaxe fecha.
  await page.getByLabel(CAMPO_LATEX).fill("\\frac{a}{b}");
  await expect(
    page.getByText("não foi possível desenhar a fórmula — confira a sintaxe LaTeX"),
  ).toBeHidden();
  await expect(page.locator(".doc-formula-render .katex")).toBeVisible();
});

test("o LaTeX sobrevive ao round-trip: é gravado e volta desenhado no reload", async ({ page }) => {
  await novoDocumento(page);

  await page.getByRole("button", { name: BOTAO_FORMULA }).click();
  const latex = "x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}";
  await page.getByLabel(CAMPO_LATEX).fill(latex);
  await expect(page.locator(".doc-formula-render .katex")).toBeVisible();

  // O autosave tem debounce de 4s (src/lib/useAutosave.ts) — esperar o status
  // virar "Salvo" é o que garante que a gravação fechou antes do reload,
  // mesma espera dos outros specs.
  await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });

  await page.reload();

  // Volta a FONTE, caractere a caractere — é ela que fica gravada, nunca o
  // desenho (ver src/core/editor/nodes/formula.ts).
  await expect(page.getByLabel(CAMPO_LATEX)).toHaveValue(latex);
  // E o desenho é refeito a partir dela.
  await expect(page.locator(".doc-formula-render .katex")).toBeVisible();
});

test("o botão de fórmula é restrito ao desktop; a fórmula criada continua editável", async ({
  page,
}) => {
  await novoDocumento(page);

  await expect(page.getByRole("button", { name: BOTAO_FORMULA })).toBeVisible();
  await page.getByRole("button", { name: BOTAO_FORMULA }).click();
  await page.getByLabel(CAMPO_LATEX).fill("a^2 + b^2 = c^2");

  // Abaixo do breakpoint `md` do Tailwind (768px).
  await page.setViewportSize({ width: 420, height: 800 });
  await expect(page.getByRole("button", { name: BOTAO_FORMULA })).toBeHidden();

  // O que o breakpoint tira é o botão de CRIAR uma fórmula, não a fórmula.
  await expect(page.getByLabel(CAMPO_LATEX)).toHaveValue("a^2 + b^2 = c^2");
  await expect(page.locator(".doc-formula-render .katex")).toBeVisible();
});

// Passo 6.1.4 — a fórmula sai no `.docx` como equação nativa do Word (OMML),
// não como o código LaTeX. Como o Word a desenha só se confere abrindo nele.
test("a fórmula sai no .docx como equação do Word, não como LaTeX", async ({ page }) => {
  await novoDocumento(page);
  await page.getByRole("button", { name: BOTAO_FORMULA }).click();
  await page.getByLabel(CAMPO_LATEX).fill(String.raw`\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i`);
  await expect(page.locator(".doc-formula-render .katex")).toBeVisible();
  // Fórmula comum: nada fica de fora do Word, e nenhum aviso aparece.
  await expect(page.getByRole("note")).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("banner").getByRole("button", { name: "Exportar .docx" }).click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  const xml = await zip.file("word/document.xml")!.async("string");

  expect(xml).toContain("<m:oMath>");
  expect(xml).toContain("<m:f>");
  expect(xml).toContain('<m:chr m:val="∑"/>');
  expect(xml).not.toContain(String.raw`\frac`);
});

test("o que a equação do Word não recebe é avisado na própria fórmula", async ({ page }) => {
  await novoDocumento(page);
  await page.getByRole("button", { name: BOTAO_FORMULA }).click();
  await page
    .getByLabel(CAMPO_LATEX)
    .fill(String.raw`A = \begin{pmatrix} a & b \\ c & d \end{pmatrix}`);

  await expect(page.getByRole("note")).toContainText(
    "no Word, esta fórmula sai sem: matriz ou equações alinhadas",
  );
});
