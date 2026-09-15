import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import JSZip from "jszip";

// Caminho completo da fatia vertical (passo 1.4.5) — a mesma pergunta que
// motivou o passo 1.3.7: o que a pessoa digita realmente sobrevive a um
// recarregamento de página e sai no .docx exportado? Cobre título
// (metadados, autosave desde 1.3.6) e corpo (editor, autosave desde 1.3.7)
// juntos, na mesma sessão — é o cenário de corrida que 1.3.7 corrigiu.
//
// Ajustado no passo 2B.13: `/` deixou de ser a lista de documentos (2B.6
// tomou essa rota para a landing) — o botão "Criar novo documento" agora
// vive em `/documentos` (2B.8). O seletor do status de autosave também
// mudou: o parágrafo solto virou um `<span role="status">` dentro do
// `AppTopBar` (2B.10) — `p[role="status"]` nunca mais bate; `span` é o que
// distingue esse status do `<div role="status">` do banner de ambiente
// interno, que continua na página. E "Exportar .docx" passou a ter duas
// instâncias (topbar + rodapé do inspetor, 2B.11) — escopado à barra
// superior (`getByRole("banner")`) pra continuar único.
test("criar, digitar, recarregar, persistir e exportar", async ({ page }) => {
  const titulo = "Trabalho de teste da fatia vertical";
  const corpo = "Texto digitado no corpo do editor para o passo 1.4.5.";

  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);

  // "Dados do trabalho" é um `<details>` recolhido por padrão desde o
  // 2B.10 — o campo "Título" só fica visível depois de abri-lo.
  await page.getByText("Dados do trabalho").click();
  // `exact: true` desde o passo 3.5.2: o campo de título de seção
  // (`SectionView.tsx`, `aria-label="1 Título da seção"`) também casa com
  // "Título" por substring, e `getByLabel` é estrito — dois elementos
  // quebravam o `fill()`. Não é mudança deste passo, é conserto de um
  // seletor que a Fase 3.2 já tinha deixado ambíguo.
  await page.getByLabel("Título", { exact: true }).fill(titulo);

  // Editor sem toolbar nem data-testid próprio ainda — o único elemento
  // contenteditable da página é o TipTap.
  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await editor.pressSequentially(corpo);

  // Debounce do autosave é 4s (src/lib/useAutosave.ts) — espera o status
  // real, não um sleep fixo.
  const statusAutosave = page.locator('span[role="status"]');
  await expect(statusAutosave).toHaveText("Salvo", { timeout: 10_000 });

  await page.reload();

  // `<details>` não persiste `open` entre recarregamentos — reabre antes
  // de checar o campo.
  await page.getByText("Dados do trabalho").click();

  // Título e corpo persistem JUNTOS — é a garantia que 1.3.7 introduziu
  // (antes, dois donos de `Documento` podiam apagar a mudança um do outro).
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(titulo);
  await expect(editor).toContainText(corpo);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("banner").getByRole("button", { name: "Exportar .docx" }).click();
  const download = await downloadPromise;

  const caminho = await download.path();
  expect(caminho).not.toBeNull();

  const zip = await JSZip.loadAsync(readFileSync(caminho!));
  expect(zip.file("word/document.xml")).not.toBeNull();

  // O corpo digitado sai no XML de verdade — não só um zip válido qualquer.
  const xmlDocumento = await zip.file("word/document.xml")!.async("string");
  expect(xmlDocumento).toContain(corpo);
});
