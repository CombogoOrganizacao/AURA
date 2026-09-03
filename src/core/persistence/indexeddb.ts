import type { Documento } from "../document/types";
import type { AdaptadorPersistencia, ResumoDocumento, ResumoVersao } from "./types";

const NOME_BANCO_PADRAO = "aura";
const VERSAO_BANCO = 1;
const LOJA_DOCUMENTOS = "documentos";
const LOJA_VERSOES = "versoes";
const INDICE_VERSOES_POR_DOCUMENTO = "documentoId";

interface RegistroDocumento {
  id: string;
  documento: Documento;
  atualizadoEm: Date;
}

interface RegistroVersao {
  id: string;
  documentoId: string;
  documento: Documento;
  criadoEm: Date;
  nome?: string;
  automatica: boolean;
}

function promisificar<T>(requisicao: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => reject(requisicao.error as Error);
  });
}

function abrirBanco(nomeBanco: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const requisicao = indexedDB.open(nomeBanco, VERSAO_BANCO);
    requisicao.onupgradeneeded = () => {
      const banco = requisicao.result;
      if (!banco.objectStoreNames.contains(LOJA_DOCUMENTOS)) {
        banco.createObjectStore(LOJA_DOCUMENTOS, { keyPath: "id" });
      }
      if (!banco.objectStoreNames.contains(LOJA_VERSOES)) {
        const lojaVersoes = banco.createObjectStore(LOJA_VERSOES, { keyPath: "id" });
        lojaVersoes.createIndex(INDICE_VERSOES_POR_DOCUMENTO, "documentoId");
      }
    };
    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => reject(requisicao.error as Error);
  });
}

// Adaptador `AdaptadorPersistencia` sobre IndexedDB — o que faz "recarregar
// a página traz o documento de volta" (ver docs/aura-decisoes-e-pendencias.md
// §1.11). `nomeBanco` só existe para a suíte de contrato isolar um teste do
// outro sem colidir no mesmo banco; em produção usa sempre o nome padrão.
//
// Cada método abre a própria transação e não faz `await` no meio dela antes
// de terminar — misturar `await` com uma transação IndexedDB em aberto é o
// jeito clássico de ela fechar sozinha antes da hora.
export async function criarAdaptadorIndexedDB(
  nomeBanco: string = NOME_BANCO_PADRAO,
): Promise<AdaptadorPersistencia> {
  const banco = await abrirBanco(nomeBanco);

  function loja(nome: string, modo: IDBTransactionMode) {
    return banco.transaction(nome, modo).objectStore(nome);
  }

  return {
    async salvarDocumento(documento) {
      const registro: RegistroDocumento = {
        id: documento.id,
        documento,
        atualizadoEm: new Date(),
      };
      await promisificar(loja(LOJA_DOCUMENTOS, "readwrite").put(registro));
    },

    async carregarDocumento(id) {
      const registro = await promisificar<RegistroDocumento | undefined>(
        loja(LOJA_DOCUMENTOS, "readonly").get(id),
      );
      return registro?.documento ?? null;
    },

    async listarDocumentos(): Promise<ResumoDocumento[]> {
      const registros = await promisificar<RegistroDocumento[]>(
        loja(LOJA_DOCUMENTOS, "readonly").getAll(),
      );
      return registros.map((registro) => ({
        id: registro.id,
        titulo: registro.documento.metadados.titulo,
        atualizadoEm: registro.atualizadoEm,
      }));
    },

    async listarVersoes(documentoId): Promise<ResumoVersao[]> {
      const indice = loja(LOJA_VERSOES, "readonly").index(INDICE_VERSOES_POR_DOCUMENTO);
      const registros = await promisificar<RegistroVersao[]>(indice.getAll(documentoId));
      return registros.map((registro) => ({
        id: registro.id,
        criadoEm: registro.criadoEm,
        nome: registro.nome,
        automatica: registro.automatica,
      }));
    },

    async salvarVersao(documento, nome) {
      const registro: RegistroVersao = {
        id: crypto.randomUUID(),
        documentoId: documento.id,
        documento,
        criadoEm: new Date(),
        nome,
        automatica: nome === undefined,
      };
      await promisificar(loja(LOJA_VERSOES, "readwrite").add(registro));
    },

    async excluirDocumento(id) {
      await promisificar(loja(LOJA_DOCUMENTOS, "readwrite").delete(id));

      // Sem chave estrangeira no IndexedDB — a cascata para as versões é
      // manual: acha as chaves pelo índice, depois apaga uma a uma.
      const indice = loja(LOJA_VERSOES, "readonly").index(INDICE_VERSOES_POR_DOCUMENTO);
      const chaves = await promisificar<IDBValidKey[]>(indice.getAllKeys(id));
      for (const chave of chaves) {
        await promisificar(loja(LOJA_VERSOES, "readwrite").delete(chave));
      }
    },
  };
}
