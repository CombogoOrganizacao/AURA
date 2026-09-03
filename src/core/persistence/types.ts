import type { Documento } from "../document/types";

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
// snapshot manual (nomeado pela pessoa); ausente, é automático. A política
// de retenção (~30 automáticos + todos os nomeados) e a restauração de uma
// versão específica são construídas sobre isto no passo 5.3.1 — aqui só a
// forma de listar o que existe.
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
  listarVersoes(documentoId: string): Promise<ResumoVersao[]>;
  salvarVersao(documento: Documento, nome?: string): Promise<void>;
  excluirDocumento(id: string): Promise<void>;
}
