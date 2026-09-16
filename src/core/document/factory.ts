import type { Documento, Metadados, NivelSecao, NoFigura, NoTabela, Secao } from "./types";

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

// Figura e tabela em branco (passo 3.6.3). Existem aqui, e não num default
// do nó do editor, pelo mesmo motivo que `Secao.id` não tem default estático
// (src/core/editor/nodes/section.ts): um default gerado no schema faria toda
// figura nova nascer com o mesmo id. Quem insere chama isto.
//
// Sem número em lugar nenhum — "Figura 1" é derivado da posição
// (`numerarFiguras()`, ./numbering.ts).
export function novaFigura(): NoFigura {
  return { type: "figura", id: crypto.randomUUID(), legenda: "", fonte: "", imagem: null };
}

// Tabela nasce 2x2 com a primeira linha de cabeçalho: uma tabela sem linha
// nenhuma não tem onde receber o cursor, e uma sem cabeçalho não mostra o
// fio que separa cabeçalho do corpo (padrão IBGE) — a pessoa não veria o que
// está formatando. Acrescentar linha/coluna é a próxima camada de UI; o nó
// aceita qualquer número das duas.
export function novaTabela(colunas = 2, linhas = 2): NoTabela {
  return {
    type: "tabela",
    id: crypto.randomUUID(),
    legenda: "",
    fonte: "",
    linhas: Array.from({ length: linhas }, (_, indiceLinha) => ({
      celulas: Array.from({ length: colunas }, () => ({ cabecalho: indiceLinha === 0 })),
    })),
  };
}
