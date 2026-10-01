import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { novoDocumento } from "../src/core/document/factory";
import type { Documento, Secao } from "../src/core/document/types";

// Apoio dos specs que precisam de um documento pronto (reimportação, 6.2.4;
// Overleaf, 6.3.1). Semear é mais rápido que criar cada seção pela tela, então o documento é
// gravado direto no IndexedDB do app, no formato do adaptador
// (`core/persistence/indexeddb.ts`), como em `busca.spec.ts`.

export function secao(id: string, ordem: number, titulo: string, texto: string): Secao {
  return {
    id,
    ordem,
    nivel: 1,
    titulo,
    content: [{ type: "paragraph", content: [{ type: "text", text: texto }] }],
  };
}

export function tresSecoes(): Documento {
  const documento = novoDocumento();
  documento.metadados.titulo = "Trabalho de teste";
  documento.sections = [
    secao("s1", 0, "Introdução", "Texto da introdução."),
    secao("s2", 1, "Método", "Aplicamos o questionário em campo."),
    secao("s3", 2, "Resultados", "As respostas do questionário."),
  ];
  return documento;
}

export async function abrirDocumento(page: Page, documento: Documento) {
  // Abre o app primeiro: é ele que cria o banco na versão certa.
  await page.goto("/documentos");
  await page.evaluate(
    (doc) =>
      new Promise<void>((resolve, reject) => {
        const tentar = () => {
          const pedido = indexedDB.open("aura");
          pedido.onerror = () => reject(pedido.error);
          pedido.onsuccess = () => {
            const banco = pedido.result;
            if (!banco.objectStoreNames.contains("documentos")) {
              banco.close();
              setTimeout(tentar, 100);
              return;
            }
            const tr = banco.transaction("documentos", "readwrite");
            tr.objectStore("documentos").put({
              id: doc.id,
              documento: doc,
              atualizadoEm: new Date(),
            });
            tr.oncomplete = () => {
              banco.close();
              resolve();
            };
            tr.onerror = () => reject(tr.error);
          };
        };
        tentar();
      }),
    documento,
  );
  await page.goto(`/documento/${documento.id}`);
  await expect(page.locator(".ProseMirror p").first()).toBeVisible();
}

export async function documentoSalvo(page: Page, id: string): Promise<Documento> {
  return page.evaluate(
    (idDoc) =>
      new Promise<Documento>((resolve, reject) => {
        const pedido = indexedDB.open("aura");
        pedido.onerror = () => reject(pedido.error);
        pedido.onsuccess = () => {
          const banco = pedido.result;
          const leitura = banco.transaction("documentos").objectStore("documentos").get(idDoc);
          leitura.onsuccess = () => {
            banco.close();
            resolve(leitura.result.documento);
          };
          leitura.onerror = () => reject(leitura.error);
        };
      }),
    id,
  );
}
