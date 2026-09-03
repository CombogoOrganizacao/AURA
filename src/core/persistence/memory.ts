import type { Documento } from "../document/types";
import type { AdaptadorPersistencia, ResumoDocumento, ResumoVersao } from "./types";

interface VersaoArmazenada extends ResumoVersao {
  documento: Documento;
}

// Adaptador de referência: guarda tudo em memória, sem tocar em IndexedDB
// nem em rede. Serve à suíte de contrato (passo 1.2.2) e a qualquer teste
// que precise de um `AdaptadorPersistencia` sem persistência de verdade.
// Cada chamada devolve uma instância nova, com seu próprio estado — é o que
// permite à suíte de contrato isolar um teste do outro.
export function criarAdaptadorMemoria(): AdaptadorPersistencia {
  const documentos = new Map<string, Documento>();
  const atualizadoEm = new Map<string, Date>();
  const versoes = new Map<string, VersaoArmazenada[]>();

  return {
    async salvarDocumento(documento) {
      documentos.set(documento.id, documento);
      atualizadoEm.set(documento.id, new Date());
    },

    async carregarDocumento(id) {
      return documentos.get(id) ?? null;
    },

    async listarDocumentos(): Promise<ResumoDocumento[]> {
      return Array.from(documentos.values()).map((documento) => ({
        id: documento.id,
        titulo: documento.metadados.titulo,
        atualizadoEm: atualizadoEm.get(documento.id) ?? new Date(0),
      }));
    },

    async listarVersoes(documentoId): Promise<ResumoVersao[]> {
      return (versoes.get(documentoId) ?? []).map((versao) => ({
        id: versao.id,
        criadoEm: versao.criadoEm,
        nome: versao.nome,
        automatica: versao.automatica,
      }));
    },

    async salvarVersao(documento, nome) {
      const lista = versoes.get(documento.id) ?? [];
      lista.push({
        id: crypto.randomUUID(),
        criadoEm: new Date(),
        nome,
        automatica: nome === undefined,
        documento,
      });
      versoes.set(documento.id, lista);
    },

    async excluirDocumento(id) {
      documentos.delete(id);
      atualizadoEm.delete(id);
      versoes.delete(id);
    },
  };
}
