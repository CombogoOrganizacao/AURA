import type { Documento, Metadados, NivelSecao, Secao } from "./types";

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

// Seção em branco — semente pro editor ter onde digitar quando o
// documento ainda não tem seção nenhuma (passo 1.3.7). Um parágrafo vazio
// no conteúdo, não `content: []`, porque um nó sem filho nenhum não dá
// lugar pro cursor entrar.
export function novaSecao(ordem: number, nivel: NivelSecao = 1): Secao {
  return {
    id: crypto.randomUUID(),
    ordem,
    nivel,
    titulo: "",
    content: [{ type: "paragraph" }],
  };
}
