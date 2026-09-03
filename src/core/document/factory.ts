import type { Documento, Metadados } from "./types";

// Documento em branco: metadados com os campos zerados, para o formulário
// mínimo (passo 1.3.4) preencher, e nenhuma seção, referência, apêndice ou
// anexo ainda.
function metadadosVazios(): Metadados {
  return {
    tipo: "tcc",
    norma: "abnt",
    titulo: "",
    autores: [],
    instituicao: "",
    curso: "",
    orientador: "",
    local: "",
    ano: new Date().getFullYear(),
    naturezaTrabalho: "",
    resumo: "",
    palavrasChave: [],
    abstract: "",
    keywords: [],
  };
}

export function novoDocumento(): Documento {
  return {
    id: crypto.randomUUID(),
    metadados: metadadosVazios(),
    sections: [],
    references: [],
    apendices: [],
    anexos: [],
  };
}
