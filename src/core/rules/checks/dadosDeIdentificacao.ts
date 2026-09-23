import type { Metadados } from "../../document/types";
import type { Verificacao } from "../compliance";

// Dados de capa e folha de rosto — NBR 14724:2024 §4.1.1 (capa) e §4.2.1.1.1
// (folha de rosto), lidos no PDF em 18/09/2026 e reconferidos em 23/09/2026.
// Capa: a) instituição (opcional); b) autor; c) título; d) subtítulo, se
// houver; e) volume; f) local; g) ano de depósito. Folha de rosto: a) autor;
// b) título; c) subtítulo; d) volume; e) natureza; f) orientador; g) local;
// h) ano. Os dois são "elemento obrigatório".
//
// Ficam de fora a instituição (opcional na capa, e dentro da natureza na
// folha de rosto), o subtítulo ("se houver") e o volume (a v1 não tem
// trabalho em mais de um volume). O curso não é elemento de nenhuma das duas.

type CampoExigido = "autores" | "titulo" | "naturezaTrabalho" | "orientador" | "local" | "ano";

const EXIGIDOS: {
  campo: CampoExigido;
  nome: string;
  item: string;
  vazio: (m: Metadados) => boolean;
}[] = [
  {
    campo: "autores",
    nome: "o nome do autor",
    item: "NBR 14724:2024 §4.1.1 b) e §4.2.1.1.1 a)",
    vazio: (m) => !m.autores.some((autor) => autor.trim()),
  },
  {
    campo: "titulo",
    nome: "o título",
    item: "NBR 14724:2024 §4.1.1 c) e §4.2.1.1.1 b)",
    vazio: (m) => !m.titulo.trim(),
  },
  {
    campo: "naturezaTrabalho",
    nome: "a natureza do trabalho (tipo, objetivo, instituição e área)",
    item: "NBR 14724:2024 §4.2.1.1.1 e)",
    vazio: (m) => !m.naturezaTrabalho.trim(),
  },
  {
    campo: "orientador",
    nome: "o nome do orientador",
    item: "NBR 14724:2024 §4.2.1.1.1 f)",
    vazio: (m) => !m.orientador.trim(),
  },
  {
    campo: "local",
    nome: "o local (cidade)",
    item: "NBR 14724:2024 §4.1.1 f) e §4.2.1.1.1 g)",
    vazio: (m) => !m.local.trim(),
  },
  {
    campo: "ano",
    nome: "o ano de depósito",
    item: "NBR 14724:2024 §4.1.1 g) e §4.2.1.1.1 h)",
    vazio: (m) => !Number.isInteger(m.ano) || m.ano <= 0,
  },
];

export const dadosDeIdentificacao: Verificacao = {
  regra: "dados-de-identificacao",
  verificar: ({ documento }) =>
    EXIGIDOS.filter((exigido) => exigido.vazio(documento.metadados)).map((exigido) => ({
      gravidade: "erro",
      item: exigido.item,
      mensagem: `Falta ${exigido.nome}, elemento obrigatório da capa ou da folha de rosto.`,
      local: { tipo: "metadado", campo: exigido.campo },
    })),
};
