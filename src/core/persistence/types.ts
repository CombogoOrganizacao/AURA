import type { Documento } from "../document/types";
import type { PresetInstituicao } from "../rules/types";

// Interface de persistência que o editor programa contra — sem menção a
// IndexedDB nem a Firestore. O adaptador local (passo 1.2.3) implementa
// isto primeiro; o adaptador Firestore substitui depois sem tocar no editor
// (ver docs/aura-decisoes-e-pendencias.md §1.11). Trocar de adaptador é
// trocar qual implementação de `AdaptadorPersistencia` o provider (1.2.4)
// expõe, nunca uma mudança no código que chama esta interface.

// Resumo para a tela "Meus Trabalhos" (lista simples, sem pastas): só o que
// a lista mostra — título e última modificação. O documento inteiro só é
// carregado ao abrir um item.
export interface ResumoDocumento {
  id: string;
  titulo: string;
  atualizadoEm: Date;
}

// Resumo de uma entrada do histórico de versões. `nome` presente marca um
// snapshot manual (nomeado pela pessoa); ausente, é automático.
//
// O resumo e o snapshot andam separados de propósito: listar o histórico não
// carrega nenhum documento inteiro. No Firestore, o resumo vira um documento
// pequeno na subcoleção de versões, e o snapshot vai para o Cloud Storage
// (docs/aura-decisoes-e-pendencias.md §1.11), porque o documento inteiro
// pode passar do limite de 1 MB por documento do Firestore.
export interface ResumoVersao {
  id: string;
  criadoEm: Date;
  nome?: string;
  automatica: boolean;
}

export interface AdaptadorPersistencia {
  salvarDocumento(documento: Documento): Promise<void>;
  carregarDocumento(id: string): Promise<Documento | null>;
  listarDocumentos(): Promise<ResumoDocumento[]>;

  // Histórico de versões (passo 5.3.1). A retenção não mora no adaptador:
  // é `registrarVersao()` (versions.ts), escrita sobre estes métodos, para
  // o adaptador Firestore herdar a mesma política sem reescrevê-la.
  //
  // Os métodos de uma versão pedem também o id do documento: no Firestore a
  // versão só é endereçável pelo caminho do documento dono dela.

  // Da mais recente para a mais antiga.
  listarVersoes(documentoId: string): Promise<ResumoVersao[]>;
  // Grava um snapshot do documento inteiro, não um diff (§1.11).
  salvarVersao(documento: Documento, nome?: string): Promise<ResumoVersao>;
  // O documento como estava na versão, ou `null` se ela não existe.
  carregarVersao(documentoId: string, versaoId: string): Promise<Documento | null>;
  excluirVersao(documentoId: string, versaoId: string): Promise<void>;

  // Apaga também todas as versões do documento.
  excluirDocumento(id: string): Promise<void>;

  // Presets de instituição (passo 5.1.3, `rules/presets.ts`). Não pertencem
  // a um documento: um preset serve a todos os trabalhos da mesma
  // instituição. Salvar com um id existente substitui.
  salvarPreset(preset: PresetInstituicao): Promise<void>;
  listarPresets(): Promise<PresetInstituicao[]>;
  excluirPreset(id: string): Promise<void>;
}
