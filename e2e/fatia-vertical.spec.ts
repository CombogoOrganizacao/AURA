import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import JSZip from "jszip";

// Caminho completo da fatia vertical (passo 1.4.5) — a mesma pergunta que
// motivou o passo 1.3.7: o que a pessoa digita realmente sobrevive a um
// recarregamento de página e sai no .docx exportado? Cobre título
// (metadados, autosave desde 1.3.6) e corpo (editor, autosave desde 1.3.7)
// juntos, na mesma sessão — é o cenário de corrida que 1.3.7 corrigiu.
test("criar, digitar, recarregar, persistir e exportar", async ({ page }) => {
  const titulo = "Trabalho de teste da fatia vertical";
  const corpo = "Texto digitado no corpo do editor para o passo 1.4.5.";

  await page.goto("/");
  await page.getByRole("button", { name: "Criar novo documento" }).click();
  await page.waitForURL(/\/documento\//);

  await page.getByLabel("Título").fill(titulo);

  // Editor sem toolbar nem data-testid próprio ainda — o único elemento
  // contenteditable da página é o TipTap.
  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await editor.pressSequentially(corpo);

  // Debounce do autosave é 4s (src/lib/useAutosave.ts) — espera o status
  // real, não um sleep fixo. `p[role="status"]` porque a página também tem
  // um banner de ambiente com o mesmo papel ARIA.
  const statusAutosave = page.locator('p[role="status"]');
  await expect(statusAutosave).toHaveText("Salvo", { timeout: 10_000 });

  await page.reload();

  // Título e corpo persistem JUNTOS — é a garantia que 1.3.7 introduziu
  // (antes, dois donos de `Documento` podiam apagar a mudança um do outro).
  await expect(page.getByLabel("Título")).toHaveValue(titulo);
  await expect(editor).toContainText(corpo);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar .docx" }).click();
  const download = await downloadPromise;

  const caminho = await download.path();
  expect(caminho).not.toBeNull();

  const zip = await JSZip.loadAsync(readFileSync(caminho!));
  expect(zip.file("word/document.xml")).not.toBeNull();

  // O corpo digitado sai no XML de verdade — não só um zip válido qualquer.
  const xmlDocumento = await zip.file("word/document.xml")!.async("string");
  expect(xmlDocumento).toContain(corpo);
});
