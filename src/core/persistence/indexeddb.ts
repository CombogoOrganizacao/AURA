import type { Documento } from "../document/types";
import type { PresetInstituicao } from "../rules/types";
import type {
  AdaptadorPersistencia,
  ImagemArmazenada,
  ResumoDocumento,
  ResumoVersao,
} from "./types";
import { maisRecentePrimeiro } from "./versions";

const NOME_BANCO_PADRAO = "aura";
// 2 desde o passo 5.1.3 (loja `presets`), 3 desde o 6.1.2 (loja `imagens`).
// `onupgradeneeded` cria só a loja que falta, então um banco antigo sobe sem
// perder documento nem versão — há teste para isso em `indexeddb.test.ts`.
const VERSAO_BANCO = 3;
const LOJA_DOCUMENTOS = "documentos";
const LOJA_VERSOES = "versoes";
const LOJA_PRESETS = "presets";
const LOJA_IMAGENS = "imagens";
const INDICE_VERSOES_POR_DOCUMENTO = "documentoId";
const INDICE_IMAGENS_POR_DOCUMENTO = "documentoId";

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
      if (!banco.objectStoreNames.contains(LOJA_PRESETS)) {
        banco.createObjectStore(LOJA_PRESETS, { keyPath: "id" });
      }
      if (!banco.objectStoreNames.contains(LOJA_IMAGENS)) {
        const lojaImagens = banco.createObjectStore(LOJA_IMAGENS, { keyPath: "id" });
        lojaImagens.createIndex(INDICE_IMAGENS_POR_DOCUMENTO, "documentoId");
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
      // O índice devolve na ordem da chave, que é um UUID: a ordem do
      // histórico vem de `criadoEm`.
      return maisRecentePrimeiro(registros.map(resumir));
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
      return resumir(registro);
    },

    async carregarVersao(documentoId, versaoId) {
      const registro = await promisificar<RegistroVersao | undefined>(
        loja(LOJA_VERSOES, "readonly").get(versaoId),
      );
      // A chave da loja é só o id da versão; conferir o dono mantém o
      // contrato igual ao do Firestore, onde a versão mora sob o documento.
      return registro?.documentoId === documentoId ? registro.documento : null;
    },

    async excluirVersao(documentoId, versaoId) {
      const registro = await promisificar<RegistroVersao | undefined>(
        loja(LOJA_VERSOES, "readonly").get(versaoId),
      );
      if (registro?.documentoId !== documentoId) return;
      await promisificar(loja(LOJA_VERSOES, "readwrite").delete(versaoId));
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

      // A mesma cascata para as imagens (6.1.2).
      const indiceImagens = loja(LOJA_IMAGENS, "readonly").index(INDICE_IMAGENS_POR_DOCUMENTO);
      const chavesImagens = await promisificar<IDBValidKey[]>(indiceImagens.getAllKeys(id));
      for (const chave of chavesImagens) {
        await promisificar(loja(LOJA_IMAGENS, "readwrite").delete(chave));
      }
    },

    async salvarImagem(imagem) {
      await promisificar(loja(LOJA_IMAGENS, "readwrite").put(imagem));
    },

    async carregarImagem(documentoId, id) {
      const imagem = await promisificar<ImagemArmazenada | undefined>(
        loja(LOJA_IMAGENS, "readonly").get(id),
      );
      // A chave é só o id; conferir o dono mantém o contrato igual ao do
      // Firestore, onde a imagem mora sob o documento.
      return imagem?.documentoId === documentoId ? imagem : null;
    },

    async salvarPreset(preset) {
      await promisificar(loja(LOJA_PRESETS, "readwrite").put(preset));
    },

    async listarPresets() {
      return promisificar<PresetInstituicao[]>(loja(LOJA_PRESETS, "readonly").getAll());
    },

    async excluirPreset(id) {
      await promisificar(loja(LOJA_PRESETS, "readwrite").delete(id));
    },
  };
}

function resumir({ id, criadoEm, nome, automatica }: RegistroVersao): ResumoVersao {
  return { id, criadoEm, nome, automatica };
}
