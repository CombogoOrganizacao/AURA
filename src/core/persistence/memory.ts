import type { Documento } from "../document/types";
import type { PresetInstituicao } from "../rules/types";
import type { AdaptadorPersistencia, ResumoDocumento, ResumoVersao } from "./types";
import { maisRecentePrimeiro } from "./versions";

interface VersaoArmazenada extends ResumoVersao {
  documento: Documento;
}

// Adaptador de referência: guarda tudo em memória, sem tocar em IndexedDB
// nem em rede. Serve à suíte de contrato (passo 1.2.2) e a qualquer teste
// que precise de um `AdaptadorPersistencia` sem persistência de verdade.
// Cada chamada devolve uma instância nova, com seu próprio estado — é o que
// permite à suíte de contrato isolar um teste do outro.
//
// O snapshot de versão é copiado ao gravar e ao ler, como o IndexedDB faz
// por natureza: sem isso, mexer no documento depois de salvar a versão
// mudaria a versão junto, e o contrato passaria aqui e falharia lá.
export function criarAdaptadorMemoria(): AdaptadorPersistencia {
  const documentos = new Map<string, Documento>();
  const atualizadoEm = new Map<string, Date>();
  const versoes = new Map<string, VersaoArmazenada[]>();
  const presets = new Map<string, PresetInstituicao>();

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
      return maisRecentePrimeiro((versoes.get(documentoId) ?? []).map(resumir));
    },

    async salvarVersao(documento, nome) {
      const versao: VersaoArmazenada = {
        id: crypto.randomUUID(),
        criadoEm: new Date(),
        nome,
        automatica: nome === undefined,
        documento: structuredClone(documento),
      };
      versoes.set(documento.id, [...(versoes.get(documento.id) ?? []), versao]);
      return resumir(versao);
    },

    async carregarVersao(documentoId, versaoId) {
      const versao = versoes.get(documentoId)?.find((candidata) => candidata.id === versaoId);
      return versao ? structuredClone(versao.documento) : null;
    },

    async excluirVersao(documentoId, versaoId) {
      const lista = versoes.get(documentoId);
      if (!lista) return;
      versoes.set(
        documentoId,
        lista.filter((versao) => versao.id !== versaoId),
      );
    },

    async excluirDocumento(id) {
      documentos.delete(id);
      atualizadoEm.delete(id);
      versoes.delete(id);
    },

    async salvarPreset(preset) {
      presets.set(preset.id, preset);
    },

    async listarPresets() {
      return Array.from(presets.values());
    },

    async excluirPreset(id) {
      presets.delete(id);
    },
  };
}

function resumir({ id, criadoEm, nome, automatica }: VersaoArmazenada): ResumoVersao {
  return { id, criadoEm, nome, automatica };
}
