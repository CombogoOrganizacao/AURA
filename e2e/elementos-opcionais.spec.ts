import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import JSZip from "jszip";

// Passo 3.5.3 — o critério de aceite é literal: "Playwright liga a epígrafe,
// exporta, e ela está lá na posição correta". Por isso este spec fica no
// repositório, ao contrário dos scripts descartáveis de 3.4.2/3.5.2: a
// posição da epígrafe depende da ordem canônica da NBR 14724, que nenhum
// teste de unidade do exportador sozinho garante ponta a ponta.

const EPIGRAFE = "O saber a gente aprende com os mestres.";
const AUTORIA = "(Cora Coralina)";
const DEDICATORIA = "À minha família.";
const RESUMO = "Este trabalho investiga a formatação automática.";

async function xmlDoDocxExportado(page: import("@playwright/test").Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("banner").getByRole("button", { name: "Exportar .docx" }).click();
  const download = await downloadPromise;
  const caminho = await download.path();
  const zip = await JSZip.loadAsync(readFileSync(caminho!));
  return zip.file("word/document.xml")!.async("string");
}

async function novoDocumento(page: import("@playwright/test").Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
}

// O `<input role="switch">` é `sr-only` (`src/components/ui/Switch.tsx`): quem
// recebe o clique de verdade é o rótulo em volta, como acontece com uma
// pessoa usando o mouse. Clicar no input direto falha por interceptação.
async function alternar(page: import("@playwright/test").Page, elemento: string) {
  await page.getByText(elemento, { exact: true }).click();
}

test("liga a epígrafe, exporta, e ela sai na posição correta", async ({ page }) => {
  await novoDocumento(page);

  // O resumo existe para provar a POSIÇÃO: a epígrafe tem que sair antes
  // dele (NBR 14724 — opcionais entre folha de rosto e resumo).
  await page.getByText("Resumo e palavras-chave").click();
  await page.getByLabel("Resumo").fill(RESUMO);

  await page.getByText("Elementos opcionais").click();

  // Desligada, a epígrafe não tem nem campo de texto na tela.
  await expect(page.getByLabel("Texto — epígrafe")).toHaveCount(0);

  await alternar(page, "Epígrafe");
  await page.getByLabel("Texto — epígrafe").fill(`${EPIGRAFE}\n${AUTORIA}`);

  await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });

  const xml = await xmlDoDocxExportado(page);

  expect(xml).toContain(EPIGRAFE);
  // A autoria vira parágrafo próprio, na linha seguinte.
  expect(xml).toContain(AUTORIA);
  expect(xml.indexOf(EPIGRAFE)).toBeLessThan(xml.indexOf(AUTORIA));

  // Posição: depois da capa (seção 1) e antes do resumo.
  expect(xml.indexOf(EPIGRAFE)).toBeLessThan(xml.indexOf("RESUMO"));

  // Sem título próprio — a epígrafe não está na lista do §5.4, ao contrário
  // dos agradecimentos.
  expect(xml).not.toContain("EPÍGRAFE");

  // Recuada a partir do meio da mancha gráfica (`larguraUtil` / 2).
  const paragrafo = xml.slice(xml.lastIndexOf("<w:p>", xml.indexOf(EPIGRAFE)), xml.indexOf(EPIGRAFE));
  expect(paragrafo).toContain('w:left="4535"');
});

test("desligar preserva o texto na tela e tira o elemento do .docx", async ({ page }) => {
  await novoDocumento(page);

  await page.getByText("Elementos opcionais").click();
  await alternar(page, "Dedicatória");
  await page.getByLabel("Texto — dedicatória").fill(DEDICATORIA);
  await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });

  expect(await xmlDoDocxExportado(page)).toContain(DEDICATORIA);

  // Desliga: some do .docx, mas o texto continua guardado — religar devolve
  // o que foi escrito, que é o motivo de `ativo` ser separado de `texto`.
  await alternar(page, "Dedicatória");
  await expect(page.getByLabel("Texto — dedicatória")).toHaveCount(0);
  await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });

  expect(await xmlDoDocxExportado(page)).not.toContain(DEDICATORIA);

  await page.reload();
  await page.getByText("Elementos opcionais").click();
  await alternar(page, "Dedicatória");
  await expect(page.getByLabel("Texto — dedicatória")).toHaveValue(DEDICATORIA);
});
